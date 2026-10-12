import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Printer, ArrowRight, CheckCircle2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformLayout from '@/components/platform/PlatformLayout'
import { getPlatformPaymentReceipt } from '@/lib/api'
import { downloadDomPagesPdf, printDomPagesPdf } from '@/lib/documentPdf'

function money(n: number, currency = 'USD') {
  const code = String(currency || 'USD').toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
    }).format(Number(n || 0))
  } catch {
    return `$${Number(n || 0).toFixed(2)} ${code}`
  }
}

const PlatformPaymentReceiptPage = () => {
  const [params] = useSearchParams()
  const token = String(params.get('token') || '').trim()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
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
  const invoiceNumber = receipt?.invoice_number || '—'
  const paidLabel = paidAt
    ? new Date(paidAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'
  const amountLabel = money(receipt?.amount, receipt?.currency || 'USD')

  const handlePrint = async () => {
    const el = document.getElementById('printable-invoice')
    if (!el) {
      window.print()
      return
    }
    setBusy(true)
    try {
      await printDomPagesPdf([el])
    } catch {
      window.print()
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = async () => {
    const el = document.getElementById('printable-invoice')
    if (!el) return
    setBusy(true)
    try {
      const safeName = String(invoiceNumber).replace(/[^\w.-]+/g, '_')
      await downloadDomPagesPdf([el], `TvetFlow_Invoice_${safeName}.pdf`)
    } catch (err) {
      console.error('PDF download failed', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PlatformLayout>
      <Helmet>
        <title>Payment invoice — TvetFlow</title>
      </Helmet>

      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-[var(--landing-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading invoice…
          </p>
        ) : !receipt?.ok ? (
          <div
            className="border border-[var(--landing-line)] bg-[var(--landing-room)] p-6"
            style={{ borderRadius: 'calc(var(--landing-radius) + 4px)' }}
          >
            <h1 className="landing-display text-xl font-extrabold text-[var(--landing-ink)]">
              Invoice not found
            </h1>
            <p className="mt-2 text-sm text-[var(--landing-muted)]">
              This payment invoice link is invalid or the payment was not completed.
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
                  className="h-10 border-[var(--landing-line)] bg-white text-slate-900 hover:bg-slate-50"
                  style={{ borderRadius: 'var(--landing-radius)' }}
                  onClick={handlePrint}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                  Print
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 border-[var(--landing-line)] bg-white text-slate-900 hover:bg-slate-50"
                  style={{ borderRadius: 'var(--landing-radius)' }}
                  onClick={handleDownload}
                  disabled={busy}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
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

            {/* Printable A4-style payment invoice */}
            <article
              id="printable-invoice"
              className="relative overflow-hidden bg-white text-slate-900 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)] print:shadow-none"
            >
              {/* Brand header */}
              <div className="bg-slate-950 px-6 py-6 text-white sm:px-10 sm:py-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--landing-sun)] text-sm font-black text-slate-950">
                        TF
                      </span>
                      <div>
                        <p
                          className="text-xl font-extrabold tracking-tight"
                          style={{ fontFamily: "var(--landing-font-display, 'Montserrat', sans-serif)" }}
                        >
                          TvetFlow
                        </p>
                        <p className="text-xs text-slate-400">TVET platform · Subscription billing</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black tracking-wide sm:text-3xl">INVOICE</p>
                    <p className="mt-1 font-mono text-sm text-slate-300">{invoiceNumber}</p>
                    <p className="mt-1 text-sm text-slate-400">{paidLabel}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-sm">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Paid · {String(receipt.status || 'completed').replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-400">
                    {String(receipt.billing_cycle || '—')} billing
                  </span>
                </div>
              </div>

              <div className="px-6 py-8 sm:px-10 sm:py-10">
                <div className="grid gap-8 sm:grid-cols-2">
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Billed to
                    </h3>
                    <p className="mt-2 text-lg font-bold text-slate-900">
                      {receipt.payer_name || '—'}
                    </p>
                    <p className="mt-1 font-mono text-sm text-slate-600">
                      {receipt.payer_phone || '—'}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Plan
                    </h3>
                    <p className="mt-2 text-lg font-bold text-slate-900">
                      {receipt.plan_name || '—'}
                    </p>
                    <p className="mt-1 text-sm capitalize text-slate-600">
                      {receipt.billing_cycle || '—'} cycle
                    </p>
                  </div>
                </div>

                <table className="mt-10 w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      <th className="py-3 text-left font-bold text-slate-500">Description</th>
                      <th className="py-3 text-right font-bold text-slate-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-4 text-slate-700">
                        <span className="font-semibold text-slate-900">
                          {receipt.plan_name || 'Platform plan'}
                        </span>
                        <span className="mt-0.5 block text-xs capitalize text-slate-500">
                          TvetFlow subscription · {receipt.billing_cycle || 'standard'} billing
                        </span>
                      </td>
                      <td className="py-4 text-right font-semibold tabular-nums text-slate-900">
                        {amountLabel}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="ml-auto mt-6 w-full max-w-xs space-y-2">
                  <div className="flex justify-between gap-4 text-slate-600">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{amountLabel}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-slate-600">
                    <span>Amount paid</span>
                    <span className="font-semibold tabular-nums text-emerald-700">
                      {amountLabel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
                    <span className="font-bold text-slate-900">Balance</span>
                    <span className="text-xl font-bold tabular-nums text-emerald-700">
                      {money(0, receipt.currency || 'USD')}
                    </span>
                  </div>
                </div>

                <div className="mt-10 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Payment method
                    </p>
                    <p className="mt-1 font-semibold text-slate-800">WaafiPay · Mobile money</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Reference
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600">
                      {receipt.reference_id || '—'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Waafi transaction
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-600">
                      {receipt.waafi_transaction_id || '—'}
                    </p>
                  </div>
                </div>

                <p className="mt-10 border-t border-slate-200 pt-5 text-center text-xs leading-relaxed text-slate-400">
                  This invoice confirms your TvetFlow platform plan payment. Keep it for your records.
                  {canCreate
                    ? ' Use Create institution on the receipt page to finish setup.'
                    : ''}
                </p>
              </div>

              {/* Paid seal for print */}
              <div
                className="pointer-events-none absolute right-8 top-36 rotate-[-12deg] select-none rounded-md border-[3px] border-emerald-600 px-5 py-1.5 text-sm font-black uppercase tracking-[0.22em] text-emerald-600 opacity-80"
                aria-hidden
              >
                Paid
              </div>
            </article>
          </>
        )}
      </section>
    </PlatformLayout>
  )
}

export default PlatformPaymentReceiptPage
