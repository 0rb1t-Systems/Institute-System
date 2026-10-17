import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import type { LandingInstitution } from '@/components/landing/types'
import { brandInitial, dashboardPathForRole } from '@/components/landing/types'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { landingProgramIcon } from '@/components/landing/landingProgramIcons'
import { brandedImageSrc } from '@/lib/institution'
import { tenantLandingHref } from '@/lib/tenantLandingRoutes'
import {
  DEFAULT_ABOUT_HIGHLIGHTS,
  DEFAULT_PROGRAMS,
  filledAboutHighlights,
  filledLandingPrograms,
  filledLandingTeam,
  sanitizeLandingContent,
  type LandingProgramIconId,
} from '@/lib/landingContent'
const FALLBACK_PROGRAM_ICONS: LandingProgramIconId[] = [
  'graduation',
  'book',
  'code',
  'palette',
  'briefcase',
  'laptop',
  'award',
  'users',
]

export {
  LANDING_NAV_ITEMS,
  LandingPageNav,
  landingNavItemsFor,
  scrollToLandingSection,
} from '@/components/landing/LandingNav'

type SectionsProps = {
  institution: LandingInstitution
  primary: string
  accent: string
  tagline: string
  tone?: 'light' | 'dark'
  preview?: boolean
  heroImage?: string
  verifyHref?: string
  sameTenant?: boolean
  userRole?: string | null
  onOpenLogin?: () => void
}

export function LandingCtaBand({
  primary,
  accent,
  tone = 'light',
  title,
  body,
  verifyHref = '#',
  sameTenant,
  userRole,
  onOpenLogin,
  preview,
}: {
  primary: string
  accent: string
  tone?: 'light' | 'dark'
  title?: string
  body?: string
  verifyHref?: string
  sameTenant?: boolean
  userRole?: string | null
  onOpenLogin?: () => void
  preview?: boolean
}) {
  const dark = tone === 'dark'
  return (
    <section
      className="scroll-mt-24"
      style={{ backgroundColor: primary }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-12 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="min-w-0 max-w-xl">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl lg:text-[1.75rem]">
            {title || 'Ready to start your next chapter?'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-[15px]">
            {body || 'Apply online or verify a graduate identity in minutes.'}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto sm:flex-row">
          {sameTenant ? (
            <Link
              to={preview ? '#' : dashboardPathForRole(userRole)}
              className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              Go to dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!preview && onOpenLogin) onOpenLogin()
              }}
              className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              Create account
            </button>
          )}
          {preview ? (
            <span className="inline-flex h-11 items-center justify-center rounded-lg border border-white/40 px-5 text-sm font-semibold text-white">
              Verify identity
            </span>
          ) : (
            <Link
              to={verifyHref}
              className={`inline-flex h-11 items-center justify-center rounded-lg border px-5 text-sm font-semibold ${
                dark ? 'border-white/40 text-white' : 'border-white/50 text-white'
              }`}
            >
              Verify identity
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

export function LandingContentSections({
  institution,
  primary,
  accent,
  tagline,
  tone = 'light',
  preview,
  heroImage,
  verifyHref = '#',
  sameTenant,
  userRole,
  onOpenLogin,
}: SectionsProps) {
  const dark = tone === 'dark'
  const content = sanitizeLandingContent(institution.landing_content)
  const customHighlights = filledAboutHighlights(content)
  const customPrograms = filledLandingPrograms(content)
  const team = filledLandingTeam(content)
  const highlights = customHighlights.length ? customHighlights : DEFAULT_ABOUT_HIGHLIGHTS
  const programs = customPrograms.length ? customPrograms : DEFAULT_PROGRAMS
  const aboutTitle = content.about_title.trim() || 'A training center built for practice'
  const aboutBody =
    content.about_body.trim() ||
    String(institution.description || '').trim() ||
    String(institution.motto || '').trim() ||
    String(tagline || '').trim() ||
    'Hands-on programs, mentorship, and credentials employers can verify.'
  const programsIntro =
    content.programs_intro.trim() ||
    'Choose a path that matches your ambition — from short certificates to full diplomas.'
  const aboutImage = String(heroImage || '').trim()
  const tertiary = String(institution.theme_tertiary || '').trim() || accent
  const tenant = institution.subdomain || null

  const surface = dark ? 'border-white/10' : 'border-slate-200/80'
  const titleCls = dark ? 'text-white' : 'text-slate-900'
  const bodyCls = dark ? 'text-slate-300' : 'text-slate-600'
  const cardCls = dark
    ? 'border-white/10 bg-white/[0.04]'
    : 'border-slate-200 bg-white shadow-sm shadow-slate-900/5'
  const altBg = dark ? 'bg-[#070d18]' : 'bg-white'
  const pageBg = dark ? 'bg-[#0a1220]' : 'bg-slate-50'

  return (
    <>
      <section id="about" className={`scroll-mt-24 border-t ${surface} ${altBg}`}>
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-16 md:grid-cols-2 md:gap-10 lg:gap-14">
          <div className="relative order-2 overflow-hidden rounded-xl sm:rounded-2xl md:order-1">
            {aboutImage ? (
              <img
                src={aboutImage}
                alt=""
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/11]"
              />
            ) : (
              <div className="aspect-[4/3] w-full sm:aspect-[16/11]" style={{ backgroundColor: primary }} />
            )}
          </div>
          <div className="order-1 min-w-0 space-y-4 md:order-2">
            <h2 className={`max-w-xl break-words font-display text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-[2.1rem] ${titleCls}`}>
              {aboutTitle}
            </h2>
            <p className={`max-w-xl text-[15px] leading-relaxed ${bodyCls}`}>{aboutBody}</p>
            {highlights.length ? (
              <ul className="space-y-2.5 pt-1">
                {highlights.slice(0, 4).map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
                    <span className={`text-sm font-medium sm:text-[15px] ${titleCls}`}>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="pt-1">
              <LandingHeroSocials institution={institution} primary={primary} tone={tone} preview={preview} />
            </div>
            {!preview ? (
              <Link
                to={tenantLandingHref('about', { tenant })}
                className="inline-flex items-center gap-1.5 text-sm font-bold"
                style={{ color: primary }}
              >
                More about us <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {team.length ? (
        <section className={`scroll-mt-24 border-t ${surface} ${pageBg}`}>
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
            <h2 className={`font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${titleCls}`}>
              Management &amp; team
            </h2>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed sm:text-[15px] ${bodyCls}`}>
              Meet the people who run the institute day to day.
            </p>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {team.slice(0, 4).map((member, i) => {
                const photo = String(member.photo_url || '').trim()
                const name = member.name.trim() || 'Team member'
                return (
                  <li key={`${name}-${i}`} className={`overflow-hidden rounded-xl border ${cardCls}`}>
                    <div className={`aspect-[4/5] overflow-hidden ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
                      {photo ? (
                        <img src={brandedImageSrc(photo)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-2xl font-bold text-white sm:text-3xl"
                          style={{ backgroundColor: primary }}
                        >
                          {brandInitial(name)}
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-4">
                      <h3 className={`font-display text-sm font-semibold sm:text-base ${titleCls}`}>{name}</h3>
                      {member.role ? (
                        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: primary }}>
                          {member.role}
                        </p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            {!preview && team.length > 0 ? (
              <div className="mt-6">
                <Link
                  to={tenantLandingHref('about', { tenant })}
                  className="inline-flex items-center gap-1.5 text-sm font-bold"
                  style={{ color: primary }}
                >
                  View full team <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section id="programs" className={`scroll-mt-24 border-t ${surface} ${altBg}`}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <h2 className={`max-w-2xl font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${titleCls}`}>
            Programs that open doors
          </h2>
          {programsIntro ? (
            <p className={`mt-3 max-w-2xl text-sm leading-relaxed sm:text-[15px] ${bodyCls}`}>{programsIntro}</p>
          ) : null}

          {programs.length ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {programs.slice(0, 6).map((p, i) => {
                const Icon = landingProgramIcon(
                  p.icon || FALLBACK_PROGRAM_ICONS[i % FALLBACK_PROGRAM_ICONS.length],
                )
                const palette = [primary, accent, tertiary]
                const color = palette[i % palette.length]
                const photo = String(p.image_url || '').trim()
                return (
                  <motion.article
                    key={`${p.title}-${i}`}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className={`group overflow-hidden rounded-xl border transition duration-300 hover:-translate-y-0.5 ${cardCls}`}
                  >
                    {photo ? (
                      <div className="relative aspect-[16/10] overflow-hidden bg-slate-200/40">
                        <img
                          src={brandedImageSrc(photo)}
                          alt=""
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                    ) : (
                      <div className="h-1 w-full" style={{ backgroundColor: color }} aria-hidden />
                    )}
                    <div className="flex gap-3 p-4 sm:p-5">
                      {!photo ? (
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${color}18`, color }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                      ) : null}
                      <div className="min-w-0">
                        {p.title ? <h3 className={`text-base font-semibold ${titleCls}`}>{p.title}</h3> : null}
                        {p.description ? (
                          <p className={`mt-1.5 text-sm leading-relaxed ${bodyCls}`}>{p.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </motion.article>
                )
              })}
            </div>
          ) : null}

          {!preview ? (
            <div className="mt-7">
              <Link
                to={tenantLandingHref('programs', { tenant })}
                className="inline-flex items-center gap-1.5 text-sm font-bold"
                style={{ color: primary }}
              >
                Browse all programs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <LandingCtaBand
        primary={primary}
        accent={accent}
        tone={tone}
        verifyHref={verifyHref}
        sameTenant={sameTenant}
        userRole={userRole}
        onOpenLogin={onOpenLogin}
        preview={preview}
      />
    </>
  )
}
