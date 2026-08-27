import { computeMonthlyFee } from '@/lib/finance'
import { getMonthsBetween } from '@/lib/utils'

export type AffiliatePayStatus = 'paid' | 'partial' | 'unpaid'

export function monthKeyFromDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function paymentMonthKey(payment: { month_paid?: string | null }): string | null {
  if (!payment?.month_paid) return null
  return String(payment.month_paid).slice(0, 7)
}

function isCompleted(payment: { status?: string | null }): boolean {
  const s = payment.status
  return s === 'completed' || s == null || s === ''
}

function classCoversMonth(cls: { start_date?: string | null; end_date?: string | null } | undefined, monthKey: string): boolean {
  if (!cls?.start_date || !cls?.end_date) return true
  const months = getMonthsBetween(cls.start_date, cls.end_date)
  if (months.length === 0) return true
  return months.includes(monthKey)
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
      const billed = studentEnrollments.filter((e) => classCoversMonth(classById.get(e.class_id), monthKey))
      const source = billed.length > 0 ? billed : studentEnrollments
      if (source.length === 0) return null

      const enrollmentIds = new Set(source.map((e) => e.id))
      const monthPayments = (payments || []).filter((p) => {
        if (!isCompleted(p) || p.is_registration_fee) return false
        if (!enrollmentIds.has(p.enrollment_id) && p.student_id !== student.id) return false
        return paymentMonthKey(p) === monthKey
      })

      const paidAmount = monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
      const dueAmount = source.reduce((sum, e) => {
        const cls = classById.get(e.class_id)
        return sum + computeMonthlyFee(cls, e)
      }, 0)
      const remaining = Math.max(0, dueAmount - paidAmount)
      const status: AffiliatePayStatus =
        paidAmount <= 0 ? 'unpaid' : remaining > 0 ? 'partial' : 'paid'
      const commission = monthPayments.reduce(
        (sum, p) => sum + (commissionByPaymentId.get(p.id) || 0),
        0,
      )
      const classNames = source
        .map((e) => classById.get(e.class_id)?.name)
        .filter(Boolean)
        .join(', ')

      return {
        ...student,
        classNames: classNames || '—',
        paidAmount,
        dueAmount,
        remaining,
        commission,
        status,
        billedThisMonth: billed.length > 0,
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const order = { unpaid: 0, partial: 1, paid: 2 }
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
