import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { resolvePublicTenantSubdomain } from '@/lib/institution'
import TenantHomePage from '@/pages/public/TenantHomePage'
import StudentIdentityVerify from '@/components/public/StudentIdentityVerify'
import PlatformLayout, { PLATFORM_CONTACT_EMAIL } from '@/components/platform/PlatformLayout'
import PlatformSocialLinks from '@/components/platform/PlatformSocialLinks'
import {
  getPublicSiteCms,
  type SiteTrustedItem,
} from '@/lib/platformMedia'
import { usePlatformLang } from '@/contexts/PlatformLangContext'
import { usePlatformTheme } from '@/contexts/PlatformThemeContext'

const HERO_LIGHT = '/platform/hero-tvetflow-light.png'
const HERO_DARK = '/platform/hero-tvetflow.png'

const FEATURES = [
  { code: '01', title: 'Institution portal', body: 'Your logo, colors, and public page — branded to the center.' },
  { code: '02', title: 'Day-to-day ops', body: 'Students, classes, attendance, and staff in one console.' },
  { code: '03', title: 'Payments', body: 'Fees and tuition that match the register.' },
  { code: '04', title: 'Credentials', body: 'Certificates and transcripts in your own brand.' },
]

const STEPS = [
  { title: 'Create admin', body: 'Open an institution admin account.' },
  { title: 'Set up institution', body: 'Add your center name and details.' },
  { title: 'Open your portal', body: 'Sign in and start running operations.' },
]

const easeOut = [0.22, 1, 0.36, 1] as const

const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(10px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const WelcomePage = () => {
  const [searchParams] = useSearchParams()
  const { t } = usePlatformLang()
  const { mode } = usePlatformTheme()
  const heroSrc = mode === 'light' ? HERO_LIGHT : HERO_DARK
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [trusted, setTrusted] = useState<SiteTrustedItem[]>([])
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
      } catch {
        /* keep empty */
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

      <section className="relative overflow-hidden border-b border-[var(--landing-line)] bg-[var(--landing-limewash)]">
        {mode === 'dark' ? (
          <>
            <div
              className="landing-hero-fabric pointer-events-none absolute inset-0 opacity-[0.09]"
              aria-hidden
              style={{
                backgroundImage: 'url(/platform/hero-fabric.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            <div
              className="landing-hero-fabric-veil pointer-events-none absolute inset-0"
              aria-hidden
              style={{
                background:
                  'linear-gradient(180deg, rgba(11,18,32,0.78) 0%, rgba(11,18,32,0.7) 50%, rgba(17,24,39,0.88) 100%), radial-gradient(ellipse 55% 50% at 88% 35%, rgba(250,204,21,0.08) 0%, transparent 70%)',
              }}
            />
          </>
        ) : null}

        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-5 pb-2 pt-8 sm:gap-6 sm:px-8 sm:pb-6 sm:pt-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-2 lg:px-10 lg:pb-2 lg:pt-4 xl:px-16">
          <motion.div
            className="relative z-10 max-w-xl lg:pb-2"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
            }}
          >
            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.7, ease: easeOut }}
              className="landing-display text-[2.75rem] font-black leading-[0.92] text-[var(--landing-ink)] sm:text-6xl lg:text-[4.75rem]"
            >
              TvetFlow
            </motion.h1>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.7, ease: easeOut }}
              className="landing-display mt-4 text-[1.45rem] font-extrabold leading-[1.12] text-[var(--landing-ink)] sm:mt-5 sm:text-[2.1rem] lg:text-[2.35rem]"
            >
              {t('heroTitleA')} {t('heroTitleAccent')}
              <br />
              {t('heroTitleB')}
            </motion.p>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.65, ease: easeOut }}
              className="mt-4 max-w-md text-[15px] font-medium leading-relaxed text-[var(--landing-muted)] sm:text-base"
            >
              {t('heroBody')}
            </motion.p>
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.65, ease: easeOut }}
              className="mt-6 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/create-institution"
                  className="landing-btn-primary inline-flex h-12 items-center justify-center gap-2 px-6 text-sm sm:w-auto"
                >
                  {t('createInstitution')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="landing-btn-outline inline-flex h-12 items-center justify-center px-6 text-sm sm:w-auto"
                onClick={() => setVerifyOpen(true)}
              >
                {t('verifyIdentity')}
              </motion.button>
            </motion.div>

            <motion.div variants={fadeUp} transition={{ duration: 0.6, ease: easeOut }} className="mt-7">
              <PlatformSocialLinks variant="hero" animated />
              <a
                href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
                className="mt-2.5 inline-block text-xs font-semibold text-[var(--landing-sun)] hover:underline sm:text-sm"
              >
                {PLATFORM_CONTACT_EMAIL}
              </a>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.94, filter: 'blur(14px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.95, delay: 0.18, ease: easeOut }}
            className="relative z-0 -mx-2 flex w-full items-end justify-center sm:mx-0 lg:-mr-8 lg:-mt-10 lg:min-h-[480px] lg:justify-end xl:-mr-12 xl:-mt-12"
          >
            <motion.div
              className="relative aspect-[1024/682] w-full max-w-[640px] -translate-y-3 sm:-translate-y-5 lg:max-w-none lg:w-[115%] lg:-translate-y-8 lg:translate-x-2"
              animate={{ y: [0, -14, 0], rotate: [0, 0.6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img
                src={heroSrc}
                alt="Administrator running a training center on TvetFlow"
                className="absolute inset-0 h-full w-full object-contain object-bottom"
                width={1024}
                height={682}
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {trusted.length > 0 ? (
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="border-b border-[var(--landing-line)] bg-[var(--landing-room)] py-8"
        >
          <p className="px-5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--landing-muted)] sm:px-8">
            {t('trustedBy')}
          </p>
          <div className="trusted-marquee mt-5" aria-label="Trusted partner logos">
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
                  <div key={`${item.id}-${i}`} className="trusted-logo-slot" aria-hidden={i >= padded.length}>
                    <img src={item.logo_url} alt={i < padded.length ? item.name || 'Partner logo' : ''} />
                  </div>
                ))
              })()}
            </div>
          </div>
        </motion.section>
      ) : null}

      <section id="features" className="border-b border-[var(--landing-line)] bg-[var(--landing-limewash)] px-5 py-14 sm:px-8 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="landing-display text-3xl font-extrabold tracking-tight text-[var(--landing-ink)] sm:text-4xl"
          >
            What you run from day one
          </motion.h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((item, i) => (
              <motion.article
                key={item.code}
                initial={{ opacity: 0, y: 36, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.55, delay: i * 0.1, ease: easeOut }}
                whileHover={{ y: -8, scale: 1.015, transition: { duration: 0.22 } }}
                className="border border-[var(--landing-line)] bg-[var(--landing-room)] p-5 sm:p-6"
                style={{ borderRadius: 'var(--landing-radius)' }}
              >
                <p className="text-xs font-bold tracking-[0.16em] text-[var(--landing-sun)]">{item.code}</p>
                <h3 className="landing-display mt-2 text-xl font-extrabold text-[var(--landing-ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)] sm:text-[15px]">{item.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--landing-line)] bg-[var(--landing-room)] px-5 py-14 sm:px-8 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="landing-display text-3xl font-extrabold tracking-tight text-[var(--landing-ink)] sm:text-4xl"
          >
            Open in three moves
          </motion.h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((item, i) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 40, x: i % 2 === 0 ? -12 : 12 }}
                whileInView={{ opacity: 1, y: 0, x: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.6, delay: i * 0.14, ease: easeOut }}
              >
                <motion.div
                  className="mb-4 h-1.5 w-12 rounded-full bg-[var(--landing-sun)] origin-left"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.65, delay: 0.2 + i * 0.12, ease: easeOut }}
                />
                <h3 className="landing-display text-xl font-extrabold text-[var(--landing-ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">{item.body}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="mx-auto flex max-w-6xl flex-col gap-8 bg-[var(--landing-poche)] px-6 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-10"
          style={{ borderRadius: 'calc(var(--landing-radius) + 4px)' }}
        >
          <div>
            <h2 className="landing-display text-3xl font-extrabold tracking-tight text-[var(--landing-on-poche)]">
              Ready to open your center?
            </h2>
            <p className="mt-2 max-w-md text-sm text-[var(--landing-shadow)]">
              Start with your admin account. Set up the institution right after.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/create-institution"
              className="landing-btn-primary inline-flex h-12 items-center justify-center px-6 text-sm"
            >
              {t('createInstitution')}
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center border border-[var(--landing-on-poche)]/30 px-6 text-sm font-bold text-[var(--landing-on-poche)] transition-colors hover:border-[var(--landing-on-poche)] hover:bg-[var(--landing-on-poche)]/8"
              style={{ borderRadius: 'var(--landing-radius)' }}
            >
              {t('logIn')}
            </Link>
          </div>
        </motion.div>
      </section>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent
          className="platform-landing max-h-[90vh] max-w-lg overflow-y-auto border-[var(--landing-line)] bg-[var(--landing-limewash)] p-4 text-[var(--landing-ink)] shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-6"
          style={{ borderRadius: 'var(--landing-radius)' }}
        >
          <StudentIdentityVerify variant="platform" accent="#eab308" />
        </DialogContent>
      </Dialog>
    </PlatformLayout>
  )
}

export default WelcomePage
