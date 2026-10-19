import React, { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PlatformLayout from '@/components/platform/PlatformLayout'
import { useAuth } from '@/contexts/AuthContext'
import {
  listActivePlatformPlans,
  getMyTenantSubscription,
  purchasePlatformPlanViaWaafiPay,
  purchasePlatformPlanPublic,
} from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { mapError } from '@/lib/mapError'
import { cn } from '@/lib/utils'

const easeOut = [0.22, 1, 0.36, 1] as const

function featureList(features: unknown): string[] {
  if (Array.isArray(features)) return features.map(String).filter(Boolean)
  if (typeof features === 'string') {
    try {
      const parsed = JSON.parse(features)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {
      return features
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}

function money(n: number) {
  return `$${Number(n || 0).toFixed(0)}`
}

const PlatformPlansPage = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const reduceMotion = useReducedMotion()
  const isTenantAdmin = user?.role === 'admin' && Boolean(user?.institution_id)

  const [plans, setPlans] = useState<any[]>([])
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [buyOpen, setBuyOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [payerName, setPayerName] = useState('')
  const [phone, setPhone] = useState('')
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = await listActivePlatformPlans()
      setPlans(p)
      if (isTenantAdmin) {
        try {
          const sub = await getMyTenantSubscription()
          setSubscription(sub)
        } catch {
          setSubscription(null)
        }
      } else {
        setSubscription(null)
      }
    } catch (err) {
      toast({
        title: 'Unable to load plans',
        description: mapError(err).description,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [isTenantAdmin, toast])

  useEffect(() => {
    load()
  }, [load])

  const openBuy = (plan: any) => {
    if (!plan?.id) return
    const monthly = Number(plan.price_monthly) || 0
    const yearly = Number(plan.price_yearly) || 0
    if (monthly <= 0 && yearly <= 0) {
      toast({
        title: 'Custom plan',
        description: 'This plan needs a quote. Open Support to continue.',
      })
      return
    }
    setSelectedPlan(plan)
    setBillingCycle(monthly > 0 ? 'monthly' : 'yearly')
    setPayerName('')
    setPhone('')
    setBuyOpen(true)
  }

  // Deep-link: /plans?plan=starter|enterprise opens WaafiPay checkout
  useEffect(() => {
    if (loading || buyOpen || !plans.length) return
    const slug = String(searchParams.get('plan') || '').trim().toLowerCase()
    if (!slug) return
    const match = plans.find((p) => String(p.slug || '').toLowerCase() === slug)
    if (!match) return
    openBuy(match)
    const next = new URLSearchParams(searchParams)
    next.delete('plan')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per ?plan=
  }, [loading, plans, searchParams])

  const chargeAmount =
    selectedPlan == null
      ? 0
      : billingCycle === 'yearly'
        ? Number(selectedPlan.price_yearly) || 0
        : Number(selectedPlan.price_monthly) || 0

  const onPay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan?.id || chargeAmount <= 0) return
    if (!payerName.trim()) return
    setPaying(true)
    try {
      if (isTenantAdmin) {
        const result = await purchasePlatformPlanViaWaafiPay({
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
          phone,
          payer_name: payerName.trim(),
        })
        toast({
          title: 'Payment successful',
          description: `${selectedPlan.name} is now active. Your invoice is ready.`,
        })
        setBuyOpen(false)
        const receiptToken = String(result.receipt_token || '')
        if (receiptToken) {
          navigate(`/payment-receipt?token=${encodeURIComponent(receiptToken)}`)
        } else {
          await load()
        }
      } else {
        const result = await purchasePlatformPlanPublic({
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
          phone,
          payer_name: payerName.trim(),
        })
        const receiptToken = String(result.receipt_token || result.claim_token || '')
        toast({
          title: 'Payment successful',
          description: 'Invoice saved. Continue to create your institution.',
        })
        setBuyOpen(false)
        navigate(`/payment-receipt?token=${encodeURIComponent(receiptToken)}`)
      }
    } catch (err) {
      const mapped = mapError(err)
      toast({
        title: mapped.title,
        description: mapped.description,
        variant: 'destructive',
      })
    } finally {
      setPaying(false)
    }
  }

  const planCount = plans.length
  const dualLayout = planCount === 2

  return (
    <PlatformLayout>
      <Helmet>
        <title>Plans & Subscriptions — TvetFlow</title>
      </Helmet>

      <section className="relative overflow-hidden">
        {/* Soft desk atmosphere — stays within Ops Desk tokens */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[var(--landing-limewash)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-0 h-[28rem] w-[28rem] rounded-full bg-[var(--landing-sun)]/[0.07] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-32 h-[22rem] w-[22rem] rounded-full bg-[var(--landing-sun)]/[0.05] blur-3xl"
        />

        <div className="relative mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOut }}
              className="landing-display text-3xl font-extrabold tracking-tight text-[var(--landing-ink)] sm:text-5xl sm:leading-[1.1]"
            >
              TvetFlow plans
            </motion.h1>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.45, ease: easeOut }}
              className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[var(--landing-muted)] sm:text-lg"
            >
              {isTenantAdmin
                ? 'Renew or change your institution plan with WaafiPay.'
                : 'Choose a plan, pay with WaafiPay, then create your institution.'}
            </motion.p>
          </div>

          {subscription?.platform_plans?.name ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4, ease: easeOut }}
              className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 border border-[var(--landing-line)] bg-[var(--landing-room)] px-4 py-2.5 text-sm text-[var(--landing-muted)]"
              style={{ borderRadius: 'var(--landing-radius)' }}
            >
              <span>Current</span>
              <span className="font-semibold text-[var(--landing-ink)]">
                {subscription.platform_plans.name}
              </span>
              <span className="text-[var(--landing-shadow)]">·</span>
              <span className="capitalize">{subscription.status}</span>
            </motion.div>
          ) : null}

          <div
            className={cn(
              'mt-12 sm:mt-14',
              dualLayout
                ? 'mx-auto grid max-w-3xl grid-cols-1 items-stretch gap-6 sm:gap-7 md:grid-cols-2'
                : planCount === 1
                  ? 'mx-auto grid max-w-md grid-cols-1'
                  : 'mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 md:grid-cols-3 md:gap-5',
            )}
          >
            {loading ? (
              <p className="col-span-full flex items-center justify-center gap-2 py-16 text-sm text-[var(--landing-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
              </p>
            ) : plans.length === 0 ? (
              <p className="col-span-full text-center text-sm text-[var(--landing-muted)]">
                No plans are published yet. Check back soon or{' '}
                <Link to="/support" className="font-semibold text-[var(--landing-sun)] hover:underline">
                  contact Support
                </Link>
                .
              </p>
            ) : (
              plans.map((plan, i) => {
                const monthly = Number(plan.price_monthly) || 0
                const yearly = Number(plan.price_yearly) || 0
                const payable = monthly > 0 || yearly > 0
                const featured =
                  String(plan.slug || '').toLowerCase() === 'enterprise' ||
                  (dualLayout && i === 1)
                const points = featureList(plan.features)
                if (plan.max_students != null) {
                  points.unshift(`Up to ${plan.max_students} students`)
                } else if (!points.some((p) => /unlimited/i.test(p))) {
                  points.unshift('Unlimited students')
                }
                const isCurrent = subscription?.plan_id === plan.id

                return (
                  <motion.article
                    key={plan.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.1, ease: easeOut }}
                    className={cn(
                      'relative flex flex-col border bg-[var(--landing-room)] p-7 sm:p-8',
                      featured
                        ? 'border-[var(--landing-sun)] shadow-[0_18px_44px_rgba(234,179,8,0.16)] md:-mt-2 md:mb-0 md:min-h-[28rem]'
                        : 'border-[var(--landing-line)] shadow-[0_10px_28px_rgba(15,23,42,0.05)] md:min-h-[26rem]',
                    )}
                    style={{ borderRadius: 'calc(var(--landing-radius) + 6px)' }}
                  >
                    {featured ? (
                      <span
                        className="mb-5 inline-flex w-fit items-center bg-[var(--landing-sun)] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[var(--landing-on-sun)]"
                        style={{ borderRadius: 'var(--landing-radius)' }}
                      >
                        Best value
                      </span>
                    ) : (
                      <span className="mb-5 block h-[1.625rem]" aria-hidden />
                    )}

                    <header>
                      <h2 className="landing-display text-2xl font-extrabold text-[var(--landing-ink)]">
                        {plan.name}
                      </h2>
                      <p className="mt-2 min-h-[2.75rem] text-sm leading-relaxed text-[var(--landing-muted)]">
                        {plan.description || 'Platform subscription for your institution.'}
                      </p>
                    </header>

                    <div className="mt-6 border-t border-[var(--landing-line)] pt-6">
                      <p className="landing-display text-4xl font-extrabold tracking-tight text-[var(--landing-ink)]">
                        {payable ? (
                          <>
                            {money(monthly > 0 ? monthly : yearly)}
                            <span className="ml-1 text-base font-medium text-[var(--landing-shadow)]">
                              {monthly > 0 ? '/mo' : '/yr'}
                            </span>
                          </>
                        ) : (
                          'Talk to us'
                        )}
                      </p>
                      {payable && yearly > 0 && monthly > 0 ? (
                        <p className="mt-1.5 text-sm text-[var(--landing-shadow)]">
                          or {money(yearly)} billed yearly
                        </p>
                      ) : (
                        <p className="mt-1.5 h-5" aria-hidden />
                      )}
                    </div>

                    <ul className="mt-7 flex-1 space-y-3 text-sm text-[var(--landing-muted)]">
                      {points.map((p) => (
                        <li key={p} className="flex gap-2.5">
                          <span
                            className={cn(
                              'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center',
                              featured
                                ? 'bg-[var(--landing-sun)] text-[var(--landing-on-sun)]'
                                : 'bg-[var(--landing-sun-soft)] text-[var(--landing-sun)]',
                            )}
                            style={{ borderRadius: 'var(--landing-radius)' }}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                          <span className="leading-snug">{p}</span>
                        </li>
                      ))}
                    </ul>

                    {payable ? (
                      <Button
                        type="button"
                        className={cn(
                          'mt-8 h-12 w-full text-sm font-semibold',
                          featured ? 'landing-btn-primary' : 'landing-btn-primary opacity-95',
                        )}
                        onClick={() => openBuy(plan)}
                      >
                        {isTenantAdmin
                          ? isCurrent
                            ? 'Renew plan'
                            : 'Buy plan'
                          : 'Get started'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button asChild className="landing-btn-primary mt-8 h-12 w-full text-sm">
                        <Link to="/support">
                          Contact Support
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </motion.article>
                )
              })
            )}
          </div>

          <p className="mt-12 text-center text-sm text-[var(--landing-shadow)]">
            Need a change after you are live?{' '}
            <Link to="/support" className="font-semibold text-[var(--landing-sun)] hover:underline">
              Open Support
            </Link>
          </p>
        </div>
      </section>

      <Dialog open={buyOpen} onOpenChange={(open) => !paying && setBuyOpen(open)}>
        <DialogContent
          className={cn(
            'platform-landing !max-h-none max-w-[24rem] gap-0 overflow-visible border-[var(--landing-line)] bg-[var(--landing-room)] p-0 text-[var(--landing-ink)] shadow-[0_24px_64px_rgba(15,23,42,0.18)]',
            '[&>button]:z-20 [&>button]:rounded-[var(--landing-radius)] [&>button]:text-[var(--landing-muted)] [&>button]:hover:bg-[var(--landing-room-dim)] [&>button]:hover:text-[var(--landing-ink)] [&>button]:focus:ring-[var(--landing-sun)]',
          )}
          style={{ borderRadius: 'calc(var(--landing-radius) + 6px)' }}
        >
          <div className="border-b border-[var(--landing-line)] bg-[var(--landing-limewash)] px-5 pb-4 pt-5 pr-11">
            <div className="mb-2 inline-flex items-center gap-2 rounded-[var(--landing-radius)] bg-[var(--landing-sun-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--landing-sun)]">
              WaafiPay
            </div>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="landing-display text-lg font-extrabold tracking-tight text-[var(--landing-ink)]">
                Pay with WaafiPay
              </DialogTitle>
              <DialogDescription className="text-sm leading-snug text-[var(--landing-muted)]">
                {selectedPlan
                  ? isTenantAdmin
                    ? `Renew ${selectedPlan.name} — approve on your phone.`
                    : `Buy ${selectedPlan.name}, then create your institution.`
                  : 'Complete payment on your phone.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={onPay} className="space-y-4 px-5 py-4">
            <div
              className="flex items-end justify-between gap-3 border border-[var(--landing-line)] bg-[var(--landing-limewash)] px-3.5 py-2.5"
              style={{ borderRadius: 'var(--landing-radius)' }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-shadow)]">
                  Amount due
                </p>
                <p className="landing-display text-2xl font-extrabold tabular-nums text-[var(--landing-ink)]">
                  {money(chargeAmount)}
                  <span className="ml-1 text-sm font-medium text-[var(--landing-muted)]">USD</span>
                </p>
              </div>
              {selectedPlan ? (
                <p className="text-right text-sm font-semibold text-[var(--landing-ink)]">
                  {selectedPlan.name}
                  <span className="mt-0.5 block text-xs font-medium capitalize text-[var(--landing-muted)]">
                    {billingCycle}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
                Billing cycle
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'monthly' as const, label: 'Monthly', price: selectedPlan?.price_monthly },
                    { id: 'yearly' as const, label: 'Yearly', price: selectedPlan?.price_yearly },
                  ] as const
                ).map((opt) => {
                  const enabled = Number(opt.price) > 0
                  const active = billingCycle === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!selectedPlan || !enabled || paying}
                      onClick={() => setBillingCycle(opt.id)}
                      className={cn(
                        'flex flex-col items-start gap-0.5 border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
                        active
                          ? 'border-[var(--landing-sun)] bg-[var(--landing-sun)] text-[var(--landing-on-sun)] shadow-[0_8px_18px_color-mix(in_srgb,var(--landing-sun)_28%,transparent)]'
                          : 'border-[var(--landing-line)] bg-[var(--landing-room)] text-[var(--landing-ink)] hover:border-[var(--landing-sun)]/50 hover:bg-[var(--landing-sun-soft)]/40',
                      )}
                      style={{ borderRadius: 'var(--landing-radius)' }}
                    >
                      <span className="text-sm font-bold">{opt.label}</span>
                      <span
                        className={cn(
                          'text-xs font-medium tabular-nums',
                          active ? 'text-[var(--landing-on-sun)]/80' : 'text-[var(--landing-muted)]',
                        )}
                      >
                        {money(opt.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="waafi-payer-name"
                className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]"
              >
                Full name
              </Label>
              <Input
                id="waafi-payer-name"
                autoComplete="name"
                placeholder="Name on the invoice"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                required
                disabled={paying}
                className="h-11 border-[var(--landing-line)] bg-[var(--landing-limewash)] text-[var(--landing-ink)] placeholder:text-[var(--landing-shadow)] focus-visible:ring-[var(--landing-sun)]"
                style={{ borderRadius: 'var(--landing-radius)' }}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="waafi-phone"
                className="text-[10px] font-semibold uppercase tracking-wide text-[var(--landing-muted)]"
              >
                Mobile number
              </Label>
              <Input
                id="waafi-phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="25261xxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={paying}
                className="h-11 border-[var(--landing-line)] bg-[var(--landing-limewash)] text-[var(--landing-ink)] placeholder:text-[var(--landing-shadow)] focus-visible:ring-[var(--landing-sun)]"
                style={{ borderRadius: 'var(--landing-radius)' }}
              />
              <p className="text-[11px] leading-snug text-[var(--landing-shadow)]">
                Approve the charge on your phone. An invoice is saved after payment.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--landing-line)] pt-4 sm:flex-row sm:justify-end sm:gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBuyOpen(false)}
                disabled={paying}
                className="h-10 w-full border-[var(--landing-line)] bg-transparent text-[var(--landing-ink)] hover:bg-[var(--landing-room-dim)] hover:text-[var(--landing-ink)] sm:w-auto"
                style={{ borderRadius: 'var(--landing-radius)' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={paying || chargeAmount <= 0}
                className="landing-btn-primary h-10 w-full text-sm sm:min-w-[8rem] sm:w-auto"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${money(chargeAmount)}`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PlatformLayout>
  )
}

export default PlatformPlansPage
