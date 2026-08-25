import React from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { LifeBuoy, Mail, Clock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PlatformLayout from '@/components/platform/PlatformLayout'

const PlatformSupportPage = () => (
  <PlatformLayout>
    <Helmet>
      <title>Support — TvetFlow</title>
    </Helmet>
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-sm text-teal-600">Support</p>
      <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold text-[var(--pf-text)] sm:text-4xl">
        Help for institutions
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--pf-muted)]">
        Institution staff sign in from their own landing page. For a new center, start with create institution.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 transition-transform duration-300 hover:-translate-y-1">
          <Mail className="h-5 w-5 text-teal-600" />
          <h2 className="mt-3 font-display font-semibold text-[var(--pf-text)]">Email</h2>
          <a href="mailto:orb1tsystems22@gmail.com" className="mt-2 block text-sm text-teal-700 hover:underline">
            orb1tsystems22@gmail.com
          </a>
        </article>
        <article className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 transition-transform duration-300 hover:-translate-y-1">
          <Clock className="h-5 w-5 text-teal-600" />
          <h2 className="mt-3 font-display font-semibold text-[var(--pf-text)]">Hours</h2>
          <p className="mt-2 text-sm text-[var(--pf-muted)]">Sunday–Thursday, business hours (EAT).</p>
        </article>
        <article className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 transition-transform duration-300 hover:-translate-y-1">
          <LifeBuoy className="h-5 w-5 text-teal-600" />
          <h2 className="mt-3 font-display font-semibold text-[var(--pf-text)]">Tickets</h2>
          <p className="mt-2 text-sm text-[var(--pf-muted)]">Email us and we will follow up from the support inbox.</p>
        </article>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild className="bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
          <Link to="/create-institution">
            Create institution
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]">
          <Link to="/contact">Contact</Link>
        </Button>
        <Button asChild variant="outline" className="border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    </section>
  </PlatformLayout>
)

export default PlatformSupportPage
