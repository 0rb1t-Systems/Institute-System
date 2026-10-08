import React, { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
  const isTenantAdmin = user?.role === 'admin' && Boolean(user?.institution_id)

  const [plans, setPlans] = useState<any[]>([])
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [buyOpen, setBuyOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
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
    const monthly = Number(plan.price_monthly) || 0
    const yearly = Number(plan.price_yearly) || 0
    if (monthly <= 0 && yearly <= 0) return
    setSelectedPlan(plan)
    setBillingCycle(monthly > 0 ? 'monthly' : 'yearly')
    setPhone('')
    setBuyOpen(true)
  }

  const chargeAmount =
    selectedPlan == null
      ? 0
      : billingCycle === 'yearly'
        ? Number(selectedPlan.price_yearly) || 0
        : Number(selectedPlan.price_monthly) || 0

  const onPay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan?.id || chargeAmount <= 0) return
    setPaying(true)
    try {
      if (isTenantAdmin) {
        await purchasePlatformPlanViaWaafiPay({
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
          phone,
        })
        toast({
          title: 'Payment successful',
          description: `${selectedPlan.name} is now active on your institution.`,
        })
        setBuyOpen(false)
        await load()
      } else {
        const result = await purchasePlatformPlanPublic({
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
          phone,
        })
        const token = String(result.claim_token || '')
        toast({
          title: 'Payment successful',
          description: 'Next: create your institution admin account.',
        })
        setBuyOpen(false)
        navigate(`/create-institution?purchase=${encodeURIComponent(token)}`)
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

  return (
    <PlatformLayout>
      <Helmet>
        <title>Plans & Subscriptions — TvetFlow</title>
      </Helmet>
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold text-[var(--landing-sun)]"
        >
          Plans & Subscriptions
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.45, ease: easeOut }}
          className="landing-display mt-2 max-w-2xl text-3xl font-extrabold text-[var(--landing-ink)] sm:text-4xl"
        >
          Pick a plan when the institution is ready
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.45, ease: easeOut }}
          className="mt-4 max-w-xl text-[var(--landing-muted)]"
        >
          {isTenantAdmin
            ? 'Renew or change your plan with WaafiPay (EVC / Zaad).'
            : 'Buy a plan with WaafiPay first. After payment you can create your institution and admin account.'}
        </motion.p>

        {subscription?.platform_plans?.name ? (
          <div
            className="mt-6 border border-[var(--landing-line)] bg-[var(--landing-room)] px-4 py-3 text-sm text-[var(--landing-muted)]"
            style={{ borderRadius: 'var(--landing-radius)' }}
          >
            Current plan:{' '}
            <span className="font-semibold text-[var(--landing-ink)]">
              {subscription.platform_plans.name}
            </span>
            {' · '}
            <span className="capitalize">{subscription.status}</span>
            {subscription.billing_cycle ? (
              <>
                {' · '}
                <span className="capitalize">{subscription.billing_cycle}</span>
              </>
            ) : null}
            {subscription.ends_at ? (
              <> · renews / ends {new Date(subscription.ends_at).toLocaleDateString()}</>
            ) : null}
          </div>
        ) : null}

        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-3 md:gap-6">
          {loading ? (
            <p className="col-span-full flex items-center gap-2 text-sm text-[var(--landing-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
            </p>
          ) : plans.length === 0 ? (
            <p className="col-span-full text-sm text-[var(--landing-muted)]">
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
              const featured = i === 1
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
                  initial={{ opacity: 0, y: 48, scale: 0.94, rotate: i === 1 ? 0 : i === 0 ? -1.2 : 1.2 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.65, delay: i * 0.12, ease: easeOut }}
                  whileHover={{ y: -10, scale: 1.02, transition: { duration: 0.22 } }}
                  className={`relative flex min-h-[440px] flex-col overflow-hidden border p-7 pt-10 sm:min-h-[480px] sm:p-8 sm:pt-11 ${
                    featured
                      ? 'border-[var(--landing-sun)] bg-[var(--landing-room)] shadow-[0_20px_48px_rgba(234,179,8,0.18)]'
                      : 'border-[var(--landing-line)] bg-[var(--landing-room)] shadow-[0_12px_32px_rgba(15,23,42,0.06)]'
                  }`}
                  style={{ borderRadius: 'calc(var(--landing-radius) + 4px)' }}
                >
                  {featured ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6, rotate: 45 }}
                      whileInView={{ opacity: 1, scale: 1, rotate: 45 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.35 + i * 0.1, type: 'spring', stiffness: 260, damping: 18 }}
                      className="landing-plan-ribbon landing-plan-ribbon--featured pointer-events-none absolute -right-11 top-6 z-10 w-[9.75rem] py-2 text-center"
                      aria-label="Popular"
                    >
                      <span className="landing-plan-ribbon__label">POPULAR</span>
                    </motion.div>
                  ) : null}

                  <div className="pr-10">
                    <h2 className="landing-display text-xl font-extrabold text-[var(--landing-ink)]">
                      {plan.name}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">
                      {plan.description || 'Platform subscription for your institution.'}
                    </p>
                  </div>

                  <p className="landing-display mt-8 text-3xl font-extrabold tracking-tight text-[var(--landing-ink)]">
                    {payable ? (
                      <>
                        {money(monthly > 0 ? monthly : yearly)}
                        <span className="text-base font-medium text-[var(--landing-shadow)]">
                          {monthly > 0 ? ' / month' : ' / year'}
                        </span>
                      </>
                    ) : (
                      'Talk to us'
                    )}
                  </p>
                  {payable && yearly > 0 && monthly > 0 ? (
                    <p className="mt-1 text-xs text-[var(--landing-shadow)]">
                      or {money(yearly)} / year
                    </p>
                  ) : null}

                  <ul className="mt-8 flex-1 space-y-3.5 text-sm text-[var(--landing-muted)]">
                    {points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <span
                          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center bg-[var(--landing-sun)] text-[var(--landing-on-sun)]"
                          style={{ borderRadius: 'var(--landing-radius)' }}
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>

                  {payable ? (
                    <Button
                      type="button"
                      className="landing-btn-primary mt-8 h-12 w-full text-sm"
                      onClick={() => openBuy(plan)}
                    >
                      {isTenantAdmin
                        ? isCurrent
                          ? 'Renew with WaafiPay'
                          : 'Buy with WaafiPay'
                        : 'Buy plan then create institution'}
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

        <p className="mt-10 text-sm text-[var(--landing-shadow)]">
          Need a change of plan after you are live?{' '}
          <Link to="/support" className="font-semibold text-[var(--landing-sun)] hover:underline">
            Open Support
          </Link>
          .
        </p>
      </section>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent
          className={cn(
            'platform-landing flex max-h-[min(92vh,40rem)] max-w-[26rem] flex-col gap-0 overflow-hidden border-[var(--landing-line)] bg-[var(--landing-room)] p-0 text-[var(--landing-ink)] shadow-[0_24px_64px_rgba(15,23,42,0.18)]',
            '[&>button]:z-20 [&>button]:rounded-[var(--landing-radius)] [&>button]:text-[var(--landing-muted)] [&>button]:hover:bg-[var(--landing-room-dim)] [&>button]:hover:text-[var(--landing-ink)] [&>button]:focus:ring-[var(--landing-sun)]',
          )}
          style={{ borderRadius: 'calc(var(--landing-radius) + 6px)' }}
        >
          <div className="shrink-0 border-b border-[var(--landing-line)] bg-[var(--landing-limewash)] px-6 pb-5 pt-6 pr-12">
            <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--landing-radius)] bg-[var(--landing-sun-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--landing-sun)]">
              WaafiPay
            </div>
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="landing-display text-xl font-extrabold tracking-tight text-[var(--landing-ink)]">
                Pay with WaafiPay
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-[var(--landing-muted)]">
                {selectedPlan
                  ? isTenantAdmin
                    ? `Renew ${selectedPlan.name} — approve the prompt on your phone.`
                    : `Buy ${selectedPlan.name}, then create your institution.`
                  : 'Complete payment on your phone.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={onPay} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div
                className="flex items-end justify-between gap-3 border border-[var(--landing-line)] bg-[var(--landing-limewash)] px-4 py-3"
                style={{ borderRadius: 'var(--landing-radius)' }}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--landing-shadow)]">
                    Amount due
                  </p>
                  <p className="landing-display mt-0.5 text-2xl font-extrabold tabular-nums text-[var(--landing-ink)]">
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

              <div className="space-y-2.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-[var(--landing-muted)]">
                  Billing cycle
                </Label>
                <div className="grid grid-cols-2 gap-2.5">
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
                        disabled={!selectedPlan || !enabled}
                        onClick={() => setBillingCycle(opt.id)}
                        className={cn(
                          'flex flex-col items-start gap-0.5 border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
                          active
                            ? 'border-[var(--landing-sun)] bg-[var(--landing-sun)] text-[var(--landing-on-sun)] shadow-[0_10px_22px_color-mix(in_srgb,var(--landing-sun)_28%,transparent)]'
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

              <div className="space-y-2.5">
                <Label
                  htmlFor="waafi-phone"
                  className="text-xs font-semibold uppercase tracking-wide text-[var(--landing-muted)]"
                >
                  Mobile (EVC / Zaad)
                </Label>
                <Input
                  id="waafi-phone"
                  inputMode="tel"
                  placeholder="25261xxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="h-12 border-[var(--landing-line)] bg-[var(--landing-limewash)] text-[var(--landing-ink)] placeholder:text-[var(--landing-shadow)] focus-visible:ring-[var(--landing-sun)]"
                  style={{ borderRadius: 'var(--landing-radius)' }}
                />
                <p className="text-xs leading-relaxed text-[var(--landing-shadow)]">
                  International format without +. Approve the charge on your phone.
                </p>
              </div>
            </div>

            <div className="shrink-0 border-t border-[var(--landing-line)] bg-[var(--landing-room)] px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBuyOpen(false)}
                  disabled={paying}
                  className="h-11 w-full border-[var(--landing-line)] bg-transparent text-[var(--landing-ink)] hover:bg-[var(--landing-room-dim)] hover:text-[var(--landing-ink)] sm:w-auto"
                  style={{ borderRadius: 'var(--landing-radius)' }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={paying || chargeAmount <= 0}
                  className="landing-btn-primary h-11 w-full text-sm sm:min-w-[8.5rem] sm:w-auto"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${money(chargeAmount)}`}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PlatformLayout>
  )
}

export default PlatformPlansPage
