import React from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
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
  },
  {
    name: 'Growth',
    price: 'From $79',
    cycle: '/ month',
    blurb: 'Several programs and a busier finance desk.',
    points: ['Up to 800 students', 'Exams, gradebook, affiliates', 'Priority support'],
    featured: true,
  },
  {
    name: 'Campus',
    price: 'Talk to us',
    cycle: '',
    blurb: 'Multi-site centers that need custom limits.',
    points: ['Unlimited students', 'Custom billing cycle', 'Named support contact'],
  },
]

const PlatformPlansPage = () => (
  <PlatformLayout>
    <Helmet>
      <title>Plans & Subscriptions — TvetFlow</title>
    </Helmet>
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-sm text-teal-600">Plans & Subscriptions</p>
      <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold text-[var(--pf-text)] sm:text-4xl">
        Pick a plan when the institution is ready
      </h1>
      <p className="mt-4 max-w-xl text-[var(--pf-muted)]">
        Create the portal first. A subscription can be assigned after the institution is live.
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.name}
            className={`flex flex-col rounded-2xl border p-6 transition-transform duration-300 hover:-translate-y-1 ${
              plan.featured
                ? 'border-teal-500/40 bg-[var(--pf-surface)] shadow-[0_16px_40px_rgba(6,21,18,0.12)]'
                : 'border-[var(--pf-line)] bg-[var(--pf-surface)]'
            }`}
          >
            <h2 className="font-display text-lg font-semibold text-[var(--pf-text)]">{plan.name}</h2>
            <p className="mt-1 text-sm text-[var(--pf-muted)]">{plan.blurb}</p>
            <p className="mt-5 font-display text-2xl font-semibold text-[var(--pf-text)]">
              {plan.price}
              {plan.cycle ? <span className="text-sm font-normal text-[var(--pf-faint)]">{plan.cycle}</span> : null}
            </p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-[var(--pf-muted)]">
              {plan.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  {p}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
              <Link to="/create-institution">
                Start with an institution
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm text-[var(--pf-faint)]">
        Need a change of plan after you are live?{' '}
        <Link to="/support" className="text-teal-700 hover:underline">
          Open Support
        </Link>
        .
      </p>
    </section>
  </PlatformLayout>
)

export default PlatformPlansPage
