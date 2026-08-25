/**
 * Unified student balance helpers — **app SSOT for outstanding totals**.
 *
 * All UI (Finance, Dashboard, Student portal, DataContext) must use
 * `computeStudentBalance` from this module. Do not re-implement balance math
 * elsewhere.
 *
 * DB view `public.enrollment_balances` is kept as an aligned SQL mirror for
 * reports/ad-hoc queries; the React app does not read that view.
 *
 * Model (aligned with Finance admin UI + enrollment_balances):
 * - classes.total_fee / fee = full program fee
 * - enrollments.discount_amount = monthly discount ($/mo)
 * - net tuition = max(0, total_fee − discount × duration_months)
 * - outstanding = unpaid tuition + unpaid registration fee (from Institution Settings)
 *
 * Only completed payments count. Registration-fee payments are excluded from tuition paid.
 */

import { getRegistrationFeeAmount } from '@/lib/institution'

export type FinanceClass = {
  id?: string
  fee?: number | null
  total_fee?: number | null
  duration_months?: number | null
  start_date?: string | null
}

export type FinanceEnrollment = {
  id?: string
  student_id?: string
  class_id?: string
  discount_amount?: number | null
  status?: string | null
}

export type FinancePayment = {
  id?: string
  student_id?: string
  class_id?: string | null
  amount?: number | null
  status?: string | null
  is_registration_fee?: boolean | null
  month_paid?: string | null
  note?: string | null
  notes?: string | null
}

function isCompletedPayment(p: FinancePayment): boolean {
  const s = p.status
  return s === 'completed' || s == null || s === undefined || s === ''
}

export function getClassTotalFee(cls?: FinanceClass | null): number {
  if (!cls) return 0
  const n = Number(cls.fee ?? cls.total_fee ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function getClassDurationMonths(cls?: FinanceClass | null): number {
  const d = Number(cls?.duration_months || 1)
  return Number.isFinite(d) && d > 0 ? d : 1
}

/** Monthly installment after discount (for invoices / monthly reports). */
export function computeMonthlyFee(
  cls?: FinanceClass | null,
  enrollment?: FinanceEnrollment | null
): number {
  const total = getClassTotalFee(cls)
  const duration = getClassDurationMonths(cls)
  const monthlyDiscount = Number(enrollment?.discount_amount || 0)
  return Math.max(0, total / duration - (Number.isFinite(monthlyDiscount) ? monthlyDiscount : 0))
}

/** Full-program net tuition after all monthly discounts. */
export function computeNetProgramTuition(
  cls?: FinanceClass | null,
  enrollment?: FinanceEnrollment | null
): number {
  const total = getClassTotalFee(cls)
  const duration = getClassDurationMonths(cls)
  const monthlyDiscount = Number(enrollment?.discount_amount || 0)
  const discountTotal =
    (Number.isFinite(monthlyDiscount) ? monthlyDiscount : 0) * duration
  return Math.max(0, total - discountTotal)
}

export type StudentBalanceInput = {
  payments?: FinancePayment[] | null
  activeClass?: FinanceClass | null
  enrollment?: FinanceEnrollment | null
  institution?: Parameters<typeof getRegistrationFeeAmount>[0]
  /** Override registration fee (defaults to Institution Settings). */
  registrationFeeAmount?: number | null
}

export type StudentBalanceResult = {
  registrationFee: number
  registrationPaid: boolean
  registrationPaidAmount: number
  originalFee: number
  monthlyDiscount: number
  discountTotal: number
  classFee: number
  monthlyFee: number
  totalTuitionPaid: number
  totalPending: number
  totalPaid: number
  tuitionBalance: number
  regBalance: number
  /** Outstanding balance (tuition remaining + unpaid registration). */
  balance: number
}

/**
 * Canonical outstanding balance for a student in their active class.
 */
/** True when Institution Settings has a registration fee > 0. */
export function isRegistrationFeeRequired(
  institution?: Parameters<typeof getRegistrationFeeAmount>[0],
  registrationFeeAmount?: number | null
): boolean {
  const fee =
    registrationFeeAmount != null && Number.isFinite(Number(registrationFeeAmount))
      ? Math.max(0, Number(registrationFeeAmount))
      : getRegistrationFeeAmount(institution || undefined)
  return fee > 0
}

/** True when the student has a completed registration-fee payment. */
export function hasCompletedRegistrationPayment(
  payments?: FinancePayment[] | null
): boolean {
  return (payments || []).some(
    (p) => p.is_registration_fee === true && isCompletedPayment(p)
  )
}

/**
 * When the institution charges a registration fee, other payments
 * (tuition / misc) are blocked until registration is recorded as completed.
 */
export function mustPayRegistrationFirst(input: {
  payments?: FinancePayment[] | null
  institution?: Parameters<typeof getRegistrationFeeAmount>[0]
  registrationFeeAmount?: number | null
}): boolean {
  if (!isRegistrationFeeRequired(input.institution, input.registrationFeeAmount)) {
    return false
  }
  return !hasCompletedRegistrationPayment(input.payments)
}

export function computeStudentBalance(input: StudentBalanceInput): StudentBalanceResult {
  const payments = input.payments || []
  const cls = input.activeClass || null
  const enrollment = input.enrollment || null

  const registrationFee =
    input.registrationFeeAmount != null && Number.isFinite(Number(input.registrationFeeAmount))
      ? Math.max(0, Number(input.registrationFeeAmount))
      : getRegistrationFeeAmount(input.institution || undefined)

  const regFeePayment = payments.find((p) => p.is_registration_fee === true)
  const registrationPaid = !!regFeePayment && isCompletedPayment(regFeePayment)
  const registrationPaidAmount = registrationPaid
    ? Number(regFeePayment?.amount || 0)
    : 0

  const tuitionPayments = payments.filter((p) => p.is_registration_fee !== true)
  const completedTuition = tuitionPayments.filter(isCompletedPayment)
  const pendingTuition = tuitionPayments.filter((p) => p.status === 'pending')

  const totalTuitionPaid = completedTuition.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  )
  const totalPending = pendingTuition.reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0)

  const originalFee = getClassTotalFee(cls)
  const duration = getClassDurationMonths(cls)
  const monthlyDiscount = Number(enrollment?.discount_amount || 0) || 0
  const discountTotal = monthlyDiscount * duration
  const classFee = computeNetProgramTuition(cls, enrollment)
  const monthlyFee = computeMonthlyFee(cls, enrollment)

  let tuitionBalance = 0
  let regBalance = 0

  if (cls) {
    tuitionBalance = Math.max(0, classFee - totalTuitionPaid)
    regBalance = registrationPaid ? 0 : registrationFee
  } else if (!registrationPaid && registrationFee > 0) {
    regBalance = registrationFee
  }

  const balance = tuitionBalance + regBalance
  const totalPaid = totalTuitionPaid + registrationPaidAmount

  return {
    registrationFee,
    registrationPaid,
    registrationPaidAmount,
    originalFee,
    monthlyDiscount,
    discountTotal,
    classFee,
    monthlyFee,
    totalTuitionPaid,
    totalPending,
    totalPaid,
    tuitionBalance,
    regBalance,
    balance,
  }
}

/** Billing month key YYYY-MM from payment note / month_paid. */
export function getPaymentBillingMonth(p?: FinancePayment | null): string | null {
  if (!p || p.is_registration_fee === true) return null
  const fromField = String(p.month_paid || '').trim()
  if (/^\d{4}-\d{2}/.test(fromField)) return fromField.slice(0, 7)
  const note = String(p.note || p.notes || '').trim()
  if (/^\d{4}-\d{2}/.test(note)) return note.slice(0, 7)
  return null
}

/**
 * Sum of completed tuition already recorded for a billing month (YYYY-MM).
 * Pass `excludePaymentId` when editing so the current row is not double-counted.
 */
export function sumPaidForBillingMonth(input: {
  payments?: FinancePayment[] | null
  month: string
  studentId?: string | null
  classId?: string | null
  excludePaymentId?: string | null
}): number {
  const month = String(input.month || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) return 0
  return (input.payments || []).reduce((sum, p) => {
    if (input.excludePaymentId && p.id === input.excludePaymentId) return sum
    if (p.is_registration_fee === true) return sum
    if (!isCompletedPayment(p)) return sum
    if (input.studentId && p.student_id && p.student_id !== input.studentId) return sum
    if (input.classId && p.class_id && p.class_id !== input.classId) return sum
    if (getPaymentBillingMonth(p) !== month) return sum
    return sum + Number(p.amount || 0)
  }, 0)
}

/** Remaining amount still allowed for a billing month (never above monthly fee). */
export function remainingForBillingMonth(input: {
  monthlyFee: number
  payments?: FinancePayment[] | null
  month: string
  studentId?: string | null
  classId?: string | null
  excludePaymentId?: string | null
}): number {
  const due = Math.max(0, Number(input.monthlyFee) || 0)
  const paid = sumPaidForBillingMonth(input)
  return Math.max(0, Math.round((due - paid) * 100) / 100)
}
