import React from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformLayout from '@/components/platform/PlatformLayout'

const PLANS = [
  {
    name: 'Starter',
    price: 'From $29',
    cycle: '/ month',
    blurb: 'A single campus getting off spreadsheets.',
    points: ['Up to 150 students', 'Classes, attendance, fees', 'Certificates with your logo'],
    ribbon: '20% OFF',
  },
  {
    name: 'Growth',
    price: 'From $79',
    cycle: '/ month',
    blurb: 'Several programs and a busier finance desk.',
    points: ['Up to 800 students', 'Exams, gradebook, affiliates', 'Priority support'],
    featured: true,
    ribbon: '40% OFF',
  },
  {
    name: 'Campus',
    price: 'Talk to us',
    cycle: '',
    blurb: 'Multi-site centers that need custom limits.',
    points: ['Unlimited students', 'Custom billing cycle', 'Named support contact'],
    ribbon: 'BEST DEAL',
  },
]

const easeOut = [0.22, 1, 0.36, 1] as const

const PlatformPlansPage = () => (
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
        Create the portal first. A subscription can be assigned after the institution is live.
      </motion.p>

      <div className="mt-12 grid items-stretch gap-5 md:grid-cols-3 md:gap-6">
        {PLANS.map((plan, i) => (
          <motion.article
            key={plan.name}
            initial={{ opacity: 0, y: 48, scale: 0.94, rotate: i === 1 ? 0 : i === 0 ? -1.2 : 1.2 }}
            whileInView={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.65, delay: i * 0.12, ease: easeOut }}
            whileHover={{ y: -10, scale: 1.02, transition: { duration: 0.22 } }}
            className={`relative flex min-h-[440px] flex-col overflow-hidden border p-7 pt-10 sm:min-h-[480px] sm:p-8 sm:pt-11 ${
              plan.featured
                ? 'border-[var(--landing-sun)] bg-[var(--landing-room)] shadow-[0_20px_48px_rgba(234,179,8,0.18)]'
                : 'border-[var(--landing-line)] bg-[var(--landing-room)] shadow-[0_12px_32px_rgba(15,23,42,0.06)]'
            }`}
            style={{ borderRadius: 'calc(var(--landing-radius) + 4px)' }}
          >
            {/* Corner gift ribbon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.35 + i * 0.1, type: 'spring', stiffness: 260, damping: 18 }}
              className="pointer-events-none absolute -right-10 top-5 z-10 w-40 rotate-45 bg-[var(--landing-sun)] py-1.5 text-center shadow-[0_6px_16px_rgba(234,179,8,0.35)]"
              aria-label={plan.ribbon}
            >
              <span className="text-[10px] font-extrabold tracking-[0.06em] text-[var(--landing-on-sun)] sm:text-[11px]">
                {plan.ribbon}
              </span>
            </motion.div>

            <div className="pr-10">
              <h2 className="landing-display text-xl font-extrabold text-[var(--landing-ink)]">{plan.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">{plan.blurb}</p>
            </div>

            <p className="landing-display mt-8 text-3xl font-extrabold tracking-tight text-[var(--landing-ink)]">
              {plan.price}
              {plan.cycle ? (
                <span className="text-base font-medium text-[var(--landing-shadow)]">{plan.cycle}</span>
              ) : null}
            </p>

            <ul className="mt-8 flex-1 space-y-3.5 text-sm text-[var(--landing-muted)]">
              {plan.points.map((p) => (
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

            <Button asChild className="landing-btn-primary mt-8 h-12 w-full text-sm">
              <Link to="/create-institution">
                Start with an institution
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.article>
        ))}
      </div>

      <p className="mt-10 text-sm text-[var(--landing-shadow)]">
        Need a change of plan after you are live?{' '}
        <Link to="/support" className="font-semibold text-[var(--landing-sun)] hover:underline">
          Open Support
        </Link>
        .
      </p>
    </section>
  </PlatformLayout>
)

export default PlatformPlansPage
