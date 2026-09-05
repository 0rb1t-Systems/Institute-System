import React, { useEffect, useState } from 'react'
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
import PlatformLayout, { PLATFORM_SOCIAL } from '@/components/platform/PlatformLayout'
import PlatformPhoto from '@/components/platform/PlatformPhoto'
import {
  PLATFORM_PHOTO_DEFAULTS,
  getPublicSiteCms,
  type SiteTrustedItem,
} from '@/lib/platformMedia'
import { usePlatformLang } from '@/contexts/PlatformLangContext'

const HERO_PILLS = [
  { icon: Shield, labelKey: 'secureReliable' as const, bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { icon: Users, labelKey: 'multiTenant' as const, bg: 'bg-amber-100', fg: 'text-amber-700' },
  { icon: BarChart3, labelKey: 'powerfulInsights' as const, bg: 'bg-violet-100', fg: 'text-violet-700' },
  { icon: Cloud, labelKey: 'cloudBased' as const, bg: 'bg-sky-100', fg: 'text-sky-700' },
]

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
  const { t } = usePlatformLang()
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [trusted, setTrusted] = useState<SiteTrustedItem[]>([])
  const [photos, setPhotos] = useState(PLATFORM_PHOTO_DEFAULTS)
  const tenant =
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cms = await getPublicSiteCms()
        if (cancelled) return
        setTrusted(cms.trusted.filter((item) => item.logo_url))
        setPhotos(cms.photos)
      } catch {
        /* keep defaults */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (tenant) {
    return <TenantHomePage subdomain={tenant} />
  }

  return (
    <PlatformLayout onVerify={() => setVerifyOpen(true)}>
      <Helmet>
        <title>TvetFlow — Training center platform</title>
      </Helmet>

      <section className="relative overflow-hidden border-b border-[var(--pf-line)] bg-[var(--pf-bg)]">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="inline-flex items-center rounded-md bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 [html[data-platform-theme='dark']_&]:bg-teal-500/15 [html[data-platform-theme='dark']_&]:text-teal-300">
              {t('heroBadge')}
            </p>

            <h1 className="mt-5 max-w-xl font-display text-[2rem] font-bold leading-[1.15] tracking-tight text-[var(--pf-text)] sm:text-[2.75rem]">
              {t('heroTitleA')} <span className="text-[var(--pf-accent)]">{t('heroTitleAccent')}</span>
              <br />
              {t('heroTitleB')}
            </h1>

            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--pf-muted)]">
              {t('heroBody')}
            </p>

            <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                asChild
                size="lg"
                className="h-11 w-full rounded-lg bg-[var(--pf-accent)] px-5 font-semibold text-[var(--pf-accent-fg)] hover:opacity-90 sm:w-auto"
              >
                <Link to="/create-institution">
                  {t('createInstitution')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-11 w-full rounded-lg border-[var(--pf-line)] bg-[var(--pf-surface)] font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-hover)] sm:w-auto"
                onClick={() => setVerifyOpen(true)}
              >
                {t('verifyIdentity')}
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3" aria-label="Social media">
              {PLATFORM_SOCIAL.map((item, i) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.name}
                    className="platform-hero-social landing-social-icon inline-flex h-10 w-10 items-center justify-center rounded-full border transition hover:scale-110"
                    style={{ animationDelay: `${i * 0.22}s` }}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                )
              })}
            </div>

            <ul className="mt-10 grid max-w-lg grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              {HERO_PILLS.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.labelKey} className="flex flex-col items-start gap-2">
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} ${item.fg} [html[data-platform-theme='dark']_&]:bg-white/10 [html[data-platform-theme='dark']_&]:text-teal-300`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[12px] font-semibold leading-snug text-[var(--pf-text)]">{t(item.labelKey)}</span>
                  </li>
                )
              })}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="platform-preview-bob relative min-w-0 pb-2 lg:pt-2"
          >
            <div className="overflow-hidden rounded-[1.75rem] border border-[var(--pf-line)] bg-[var(--pf-surface)] shadow-[0_20px_50px_rgba(15,23,42,0.12)] sm:rounded-[2rem]">
              <img
                src={photos.hero || PLATFORM_PHOTO_DEFAULTS.hero}
                alt="TvetFlow dashboard on desktop and mobile"
                className="block h-auto w-full object-cover object-center"
              />
            </div>
          </motion.div>
        </div>

        {trusted.length > 0 ? (
          <div className="border-t border-[var(--pf-line)] bg-[var(--pf-bg-2)]">
            <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-8">
              <p className="text-center text-sm font-medium text-[var(--pf-muted)]">
                {t('trustedBy')}
              </p>
            </div>
            <div className="trusted-marquee mt-6 pb-8" aria-label="Trusted partner logos">
              <div className="trusted-marquee-track gap-4 px-4 sm:gap-5">
                {(() => {
                  const padded: typeof trusted = []
                  while (padded.length < 6) {
                    for (const item of trusted) {
                      padded.push(item)
                      if (padded.length >= 6) break
                    }
                  }
                  return [...padded, ...padded].map((item, i) => (
                    <div
                      key={`${item.id}-${i}`}
                      className="trusted-logo-slot"
                      aria-hidden={i >= padded.length}
                    >
                      <img
                        src={item.logo_url}
                        alt={i < padded.length ? item.name || 'Partner logo' : ''}
                      />
                    </div>
                  ))
                })()}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="border-b border-[var(--pf-line)] bg-[var(--pf-bg)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-medium text-[var(--pf-accent)]">On the floor</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--pf-text)] sm:text-3xl">
              Workshops, classrooms, and the admin desk
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--pf-muted)]">
              Built around how a training center actually runs — from the shop floor to the front desk.
            </p>
            <Link to="/features" className="mt-6 inline-flex items-center text-sm font-semibold text-[var(--pf-accent)] hover:underline">
              See what is included
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { src: photos.workshop, alt: 'Technical workshop', className: 'h-44 sm:h-56' },
              { src: photos.classroom, alt: 'Training classroom', className: 'mt-6 h-44 sm:h-56' },
              { src: photos.operations, alt: 'Admin desk', className: 'h-44 sm:h-56' },
              { src: photos.students, alt: 'Students', className: 'mt-6 h-44 sm:h-56' },
            ].map((photo, i) => (
              <motion.div
                key={photo.alt}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <PlatformPhoto src={photo.src!} alt={photo.alt} className={photo.className} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-[var(--pf-line)] bg-[var(--pf-bg-2)] px-5 py-14 sm:px-8">
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
                  className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5"
                >
                  <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 [html[data-platform-theme='dark']_&]:bg-teal-500/15 [html[data-platform-theme='dark']_&]:text-teal-300">
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

      <section className="border-b border-[var(--pf-line)] bg-[var(--pf-bg)] px-5 py-14 sm:px-8">
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
                className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-6"
              >
                <p className="font-display text-3xl font-bold text-[var(--pf-accent)]/35">{item.n}</p>
                <h3 className="mt-2 font-display text-lg font-semibold text-[var(--pf-text)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--pf-muted)]">{item.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--pf-bg-2)] px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl rounded-2xl border border-[var(--pf-line)] bg-[var(--pf-surface)] px-6 py-10 sm:px-10">
          <h2 className="font-display text-2xl font-semibold text-[var(--pf-text)]">Ready to open your institution?</h2>
          <p className="mt-2 max-w-lg text-sm text-[var(--pf-muted)]">
            Start with your admin account. You can set up the institution right after.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
              <Link to="/create-institution">{t('createInstitution')}</Link>
            </Button>
            <Button asChild variant="outline" className="border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]">
              <Link to="/login">{t('logIn')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border-[var(--pf-line)] bg-[var(--pf-surface)] p-4 text-[var(--pf-text)] shadow-[0_24px_60px_rgba(6,21,18,0.35)] sm:p-6">
          <StudentIdentityVerify variant="platform" accent="#0d9488" />
        </DialogContent>
      </Dialog>
    </PlatformLayout>
  )
}

export default WelcomePage
