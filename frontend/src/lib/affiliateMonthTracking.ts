import { computeMonthlyFee } from '@/lib/finance'
import { getMonthsBetween } from '@/lib/utils'

export type AffiliatePayStatus = 'paid' | 'partial' | 'unpaid' | 'not_due'

export function monthKeyFromDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function dateFromMonthKey(monthKey: string): Date | null {
  const [y, m] = String(monthKey || '').split('-')
  const year = Number(y)
  const month = Number(m)
  if (!year || !month) return null
  return new Date(year, month - 1, 1)
}

export function formatMonthKey(monthKey: string): string {
  const d = dateFromMonthKey(monthKey)
  if (!d) return monthKey
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function paymentMonthKey(payment: { month_paid?: string | null; note?: string | null; notes?: string | null }): string | null {
  const fromField = payment?.month_paid ? String(payment.month_paid).slice(0, 7) : ''
  if (/^\d{4}-\d{2}$/.test(fromField)) return fromField
  const note = String(payment?.note || payment?.notes || '')
  if (/^\d{4}-\d{2}/.test(note)) return note.slice(0, 7)
  return null
}

function isCompleted(payment: { status?: string | null }): boolean {
  const s = payment.status
  return s === 'completed' || s == null || s === ''
}

function classRangeStart(cls: any): string | null {
  const v = cls?.start_date || cls?.start_month
  return v ? String(v).slice(0, 10) : null
}

function classRangeEnd(cls: any): string | null {
  const v = cls?.end_date || cls?.end_month
  return v ? String(v).slice(0, 10) : null
}

function classCoversMonth(cls: any, monthKey: string): boolean {
  const start = classRangeStart(cls)
  const end = classRangeEnd(cls)
  if (!start || !end) return true
  const months = getMonthsBetween(start, end)
  if (months.length === 0) return true
  return months.includes(monthKey)
}

export function latestBillingMonthDate({
  students = [],
  payments = [],
  settlements = [],
  affiliateId,
}: {
  students?: any[]
  payments?: any[]
  settlements?: any[]
  affiliateId?: string | null
}): Date | null {
  if (!affiliateId) return null
  const studentIds = new Set(
    (students || []).filter((s) => s.affiliate_id === affiliateId).map((s) => s.id),
  )
  let latest: string | null = null
  const consider = (key: string | null) => {
    if (!key) return
    if (!latest || key > latest) latest = key
  }
  for (const p of payments || []) {
    if (!isCompleted(p) || p.is_registration_fee) continue
    if (p.student_id && studentIds.has(p.student_id)) consider(paymentMonthKey(p))
  }
  for (const s of settlements || []) {
    if (s.affiliate_id !== affiliateId) continue
    const p = (payments || []).find((row) => row.id === s.payment_id)
    consider(p ? paymentMonthKey(p) : monthKeyFromDate(new Date(s.created_at)))
  }
  return latest ? dateFromMonthKey(latest) : null
}

export function buildAffiliateStudentMonthRows({
  students = [],
  enrollments = [],
  classes = [],
  payments = [],
  settlements = [],
  affiliateId,
  monthKey,
}: {
  students?: any[]
  enrollments?: any[]
  classes?: any[]
  payments?: any[]
  settlements?: any[]
  affiliateId?: string | null
  monthKey: string
}) {
  if (!affiliateId) return []

  const referred = (students || []).filter((s) => s.affiliate_id === affiliateId)
  const classById = new Map((classes || []).map((c) => [c.id, c]))
  const commissionByPaymentId = new Map<string, number>()
  for (const s of settlements || []) {
    if (s.affiliate_id !== affiliateId) continue
    const pid = s.payment_id
    if (!pid) continue
    commissionByPaymentId.set(pid, (commissionByPaymentId.get(pid) || 0) + Number(s.amount || 0))
  }

  return referred
    .map((student) => {
      const studentEnrollments = (enrollments || []).filter((e) => e.student_id === student.id)
      if (studentEnrollments.length === 0) {
        return {
          ...student,
          classNames: '—',
          paidAmount: 0,
          dueAmount: 0,
          remaining: 0,
          commission: 0,
          status: 'not_due' as AffiliatePayStatus,
          billedThisMonth: false,
          paidMonths: [] as string[],
        }
      }

      const enrollmentIds = new Set(studentEnrollments.map((e) => e.id))
      const billed = studentEnrollments.filter((e) =>
        classCoversMonth(classById.get(e.class_id), monthKey),
      )

      const completedTuition = (payments || []).filter((p) => {
        if (!isCompleted(p) || p.is_registration_fee) return false
        return enrollmentIds.has(p.enrollment_id) || p.student_id === student.id
      })

      const paidMonths = [
        ...new Set(completedTuition.map((p) => paymentMonthKey(p)).filter(Boolean)),
      ].sort() as string[]

      const monthPayments = completedTuition.filter((p) => paymentMonthKey(p) === monthKey)
      const paidAmount = monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const commission = monthPayments.reduce(
        (sum, p) => sum + (commissionByPaymentId.get(p.id) || 0),
        0,
      )
      const classNames = studentEnrollments
        .map((e) => classById.get(e.class_id)?.name)
        .filter(Boolean)
        .join(', ')

      if (billed.length === 0) {
        return {
          ...student,
          classNames: classNames || '—',
          paidAmount,
          dueAmount: 0,
          remaining: 0,
          commission,
          status: (paidAmount > 0 ? 'paid' : 'not_due') as AffiliatePayStatus,
          billedThisMonth: false,
          paidMonths,
        }
      }

      const dueAmount = billed.reduce((sum, e) => {
        const cls = classById.get(e.class_id)
        return sum + computeMonthlyFee(cls, e)
      }, 0)
      const remaining = Math.max(0, dueAmount - paidAmount)
      const status: AffiliatePayStatus =
        paidAmount <= 0 ? 'unpaid' : remaining > 0 ? 'partial' : 'paid'

      return {
        ...student,
        classNames: classNames || '—',
        paidAmount,
        dueAmount,
        remaining,
        commission,
        status,
        billedThisMonth: true,
        paidMonths,
      }
    })
    .sort((a: any, b: any) => {
      const order = { unpaid: 0, partial: 1, paid: 2, not_due: 3 }
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.name || '').localeCompare(String(b.name || ''))
    })
}

export function filterSettlementsForMonth(settlements = [], affiliateId: string | null | undefined, monthKey: string, payments = []) {
  if (!affiliateId) return []
  const paymentById = new Map((payments || []).map((p) => [p.id, p]))
  return (settlements || []).filter((s) => {
    if (s.affiliate_id !== affiliateId) return false
    const payment = paymentById.get(s.payment_id)
    const fromPayment = payment ? paymentMonthKey(payment) : null
    if (fromPayment) return fromPayment === monthKey
    const d = new Date(s.created_at)
    if (Number.isNaN(d.getTime())) return false
    return monthKeyFromDate(d) === monthKey
  })
}
