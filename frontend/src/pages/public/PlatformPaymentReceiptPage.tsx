import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Printer, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformLayout from '@/components/platform/PlatformLayout'
import { getPlatformPaymentReceipt } from '@/lib/api'

function money(n: number, currency = 'USD') {
  return `$${Number(n || 0).toFixed(2)} ${currency}`
}

const PlatformPaymentReceiptPage = () => {
  const [params] = useSearchParams()
  const token = String(params.get('token') || '').trim()
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      if (!token) {
        setReceipt(null)
        setLoading(false)
        return
      }
      try {
        const data = await getPlatformPaymentReceipt(token)
        if (!cancelled) setReceipt(data)
      } catch {
        if (!cancelled) setReceipt(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const paidAt = receipt?.paid_at || receipt?.created_at
  const canCreate = Boolean(receipt?.can_create_institution && receipt?.claim_token)

  return (
    <PlatformLayout>
      <Helmet>
        <title>Payment receipt — TvetFlow</title>
      </Helmet>

      <section className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-[var(--landing-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
          </p>
        ) : !receipt?.ok ? (
          <div
            className="border border-[var(--landing-line)] bg-[var(--landing-room)] p-6"
            style={{ borderRadius: 'calc(var(--landing-radius) + 4px)' }}
          >
            <h1 className="landing-display text-xl font-extrabold text-[var(--landing-ink)]">
              Receipt not found
            </h1>
            <p className="mt-2 text-sm text-[var(--landing-muted)]">
              This payment receipt link is invalid or the payment was not completed.
            </p>
            <Button asChild className="landing-btn-primary mt-6">
              <Link to="/plans">Back to plans</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                Payment recorded
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 border-[var(--landing-line)]"
                  style={{ borderRadius: 'var(--landing-radius)' }}
                  onClick={() => window.print()}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Save PDF
                </Button>
                {canCreate ? (
                  <Button asChild className="landing-btn-primary h-10">
                    <Link to={`/create-institution?purchase=${encodeURIComponent(receipt.claim_token)}`}>
                      Create institution
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <article
              className="border border-[var(--landing-line)] bg-[var(--landing-room)] p-6 sm:p-8 print:border-black"
              style={{ borderRadius: 'calc(var(--landing-radius) + 4px)' }}
            >
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--landing-line)] pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--landing-sun)]">
                    TvetFlow
                  </p>
                  <h1 className="landing-display mt-1 text-2xl font-extrabold text-[var(--landing-ink)]">
                    Payment invoice
                  </h1>
                  <p className="mt-1 text-sm text-[var(--landing-muted)]">
                    Platform subscription receipt
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-[var(--landing-ink)]">
                    {receipt.invoice_number || '—'}
                  </p>
                  <p className="mt-1 text-[var(--landing-muted)]">
                    {paidAt ? new Date(paidAt).toLocaleString() : '—'}
                  </p>
                  <p className="mt-1 font-medium capitalize text-emerald-700">{receipt.status}</p>
                </div>
              </header>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--landing-shadow)]">
                    Billed to
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--landing-ink)]">
                    {receipt.payer_name || '—'}
                  </dd>
                  <dd className="font-mono text-sm text-[var(--landing-muted)]">
                    {receipt.payer_phone || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--landing-shadow)]">
                    Plan
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--landing-ink)]">
                    {receipt.plan_name || '—'}
                  </dd>
                  <dd className="text-sm capitalize text-[var(--landing-muted)]">
                    {receipt.billing_cycle || '—'} billing
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--landing-shadow)]">
                    Amount paid
                  </dt>
                  <dd className="mt-1 text-xl font-extrabold tabular-nums text-[var(--landing-ink)]">
                    {money(receipt.amount, receipt.currency || 'USD')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--landing-shadow)]">
                    Payment method
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--landing-ink)]">WaafiPay</dd>
                  <dd className="text-sm text-[var(--landing-muted)]">Mobile money</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--landing-shadow)]">
                    Reference
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs text-[var(--landing-muted)]">
                    {receipt.reference_id || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--landing-shadow)]">
                    Waafi transaction
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-[var(--landing-muted)]">
                    {receipt.waafi_transaction_id || '—'}
                  </dd>
                </div>
              </dl>

              <p className="mt-8 border-t border-[var(--landing-line)] pt-4 text-xs leading-relaxed text-[var(--landing-shadow)]">
                This invoice confirms your TvetFlow platform plan payment. Keep it for your records.
                {canCreate
                  ? ' Continue to create your institution using the button above.'
                  : ''}
              </p>
            </article>
          </>
        )}
      </section>
    </PlatformLayout>
  )
}

export default PlatformPaymentReceiptPage
