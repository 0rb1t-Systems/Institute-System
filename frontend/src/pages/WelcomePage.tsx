import React, { useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Shield,
  Users,
  BarChart3,
  Cloud,
  Building2,
  LayoutDashboard,
  GraduationCap,
  CreditCard,
  FileBadge,
  Globe2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { resolvePublicTenantSubdomain } from '@/lib/institution'
import TenantHomePage from '@/pages/public/TenantHomePage'
import StudentIdentityVerify from '@/components/public/StudentIdentityVerify'
import PlatformLayout from '@/components/platform/PlatformLayout'
import DashboardPreview from '@/components/platform/DashboardPreview'
import PlatformPhoto from '@/components/platform/PlatformPhoto'
import { PLATFORM_PHOTOS } from '@/lib/platformMedia'

const FEATURES = [
  { icon: Building2, title: 'Institution portal', body: 'Logo, colors, and a public page that belongs to the center.' },
  { icon: LayoutDashboard, title: 'Admin console', body: 'Classes, staff, enrollments, and day-to-day work in one place.' },
  { icon: GraduationCap, title: 'Learning', body: 'Programs, schedules, and progress without a second system.' },
  { icon: Users, title: 'Roles', body: 'Staff, instructors, affiliates, and students join from the institution page.' },
  { icon: CreditCard, title: 'Payments', body: 'Registration fees and tuition records that match the register.' },
  { icon: FileBadge, title: 'Credentials', body: 'Certificates and transcripts using the same brand as the landing page.' },
  { icon: Shield, title: 'Secure isolation', body: 'Every institution’s data stays private — multi-tenant from day one.' },
  { icon: Globe2, title: 'Ready to grow', body: 'Start locally today; move to your domain when you are ready.' },
]

const STEPS = [
  { n: '01', title: 'Create admin', body: 'Open an institution admin account on TvetFlow.' },
  { n: '02', title: 'Set up institution', body: 'Add your center name, contact details, and slug.' },
  { n: '03', title: 'Open your portal', body: 'Sign in and start managing training operations.' },
]

const WelcomePage = () => {
  const [searchParams] = useSearchParams()
  const [verifyOpen, setVerifyOpen] = useState(false)
  const tenant =
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain()

  if (tenant) {
    return <TenantHomePage subdomain={tenant} />
  }

  return (
    <PlatformLayout onVerify={() => setVerifyOpen(true)}>
      <Helmet>
        <title>TvetFlow — Training center platform</title>
      </Helmet>

      <section className="relative overflow-hidden border-b border-[var(--pf-line)]">
        <div className="platform-orb pointer-events-none absolute -left-24 -top-16 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="platform-orb pointer-events-none absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl [animation-delay:-4s]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="inline-flex items-center gap-2 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-700">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              For training centers
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-[var(--pf-text)] sm:text-5xl">
              Tvet<span className="text-teal-500">Flow</span>
            </h1>
            <p className="mt-3 max-w-lg font-display text-xl font-medium leading-snug text-[var(--pf-muted)] sm:text-2xl">
              The complete <span className="text-teal-600">training center</span> management platform
            </p>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--pf-muted)]">
              Manage students, courses, attendance, payments, exams, and certificates — then open the same teal console after you sign in.
            </p>
            <ul className="mt-6 grid max-w-md grid-cols-2 gap-3 text-sm text-[var(--pf-muted)]">
              {[
                { icon: Shield, label: 'Secure & reliable' },
                { icon: Users, label: 'Multi-tenant' },
                { icon: BarChart3, label: 'Ops overview' },
                { icon: Cloud, label: 'Cloud based' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.label} className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-teal-500/15 text-teal-600">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {item.label}
                  </li>
                )
              })}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 bg-[var(--pf-accent)] px-5 font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
                <Link to="/create-institution">
                  Create institution admin
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-11 border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]"
                onClick={() => setVerifyOpen(true)}
              >
                Verify Identity
              </Button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="pointer-events-none absolute -inset-4 rounded-[1.6rem] bg-teal-500/10 blur-2xl" aria-hidden />
            <DashboardPreview />
          </motion.div>
        </div>
      </section>

      <section className="border-b border-[var(--pf-line)] bg-[var(--pf-bg-2)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm text-teal-600">On the floor</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--pf-text)] sm:text-3xl">
              Workshops, classrooms, and the admin desk
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--pf-muted)]">
              Photos of real training spaces, graded to the same teal as the console so the site does not look pasted together.
            </p>
            <Link to="/features" className="mt-6 inline-flex items-center text-sm font-medium text-teal-700 hover:underline">
              See what is included
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { src: PLATFORM_PHOTOS.workshop, alt: 'Technical workshop', className: 'h-44 sm:h-56' },
              { src: PLATFORM_PHOTOS.classroom, alt: 'Training classroom', className: 'mt-6 h-44 sm:h-56' },
              { src: PLATFORM_PHOTOS.operations, alt: 'Admin desk', className: 'h-44 sm:h-56' },
              { src: PLATFORM_PHOTOS.students, alt: 'Students', className: 'mt-6 h-44 sm:h-56' },
            ].map((photo, i) => (
              <motion.div
                key={photo.alt}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <PlatformPhoto src={photo.src} alt={photo.alt} className={photo.className} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-[var(--pf-line)] px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-2xl font-semibold text-[var(--pf-text)] sm:text-3xl">
            Everything your institution needs
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, delay: (i % 4) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -3 }}
                  className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 hover:border-teal-500/35 hover:shadow-[0_14px_36px_rgba(6,21,18,0.12)]"
                >
                  <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/12 text-teal-600 ring-1 ring-teal-500/20">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-base font-semibold text-[var(--pf-text)]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--pf-muted)]">{item.body}</p>
                </motion.article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--pf-line)] bg-[var(--pf-bg-2)] px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-2xl font-semibold text-[var(--pf-text)]">Three simple steps</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((item, i) => (
              <motion.article
                key={item.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-6 transition duration-300 hover:-translate-y-1 hover:border-teal-500/30"
              >
                <p className="font-display text-3xl font-bold text-teal-500/40">{item.n}</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-[var(--pf-text)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--pf-muted)]">{item.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl rounded-2xl border border-[var(--pf-line)] bg-[var(--pf-surface)] px-6 py-10 sm:px-10">
          <h2 className="font-display text-2xl font-semibold text-[var(--pf-text)]">Ready to open your institution?</h2>
          <p className="mt-2 max-w-lg text-sm text-[var(--pf-muted)]">
            Start with your admin account. You can set up the institution right after.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
              <Link to="/create-institution">Create institution admin</Link>
            </Button>
            <Button asChild variant="outline" className="border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-lg border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 text-[var(--pf-text)] sm:p-6">
          <StudentIdentityVerify variant="platform" accent="#14b8a6" />
        </DialogContent>
      </Dialog>
    </PlatformLayout>
  )
}

export default WelcomePage
