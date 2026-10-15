import React from 'react'
import { motion } from 'framer-motion'
import { Award, GraduationCap, Mail, MapPin, Phone, Sparkles, Users } from 'lucide-react'
import type { LandingInstitution } from '@/components/landing/types'
import { brandInitial } from '@/components/landing/types'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingContentSections } from '@/components/landing/LandingSections'
import { landingProgramIcon } from '@/components/landing/landingProgramIcons'
import { brandedImageSrc } from '@/lib/institution'
import type { TenantLandingPage } from '@/lib/tenantLandingRoutes'
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

const HIGHLIGHT_ICONS = [Sparkles, GraduationCap, Users, Award]
const ease = [0.22, 1, 0.36, 1] as const

type Tone = 'light' | 'dark'

type PageChromeProps = {
  institution: LandingInstitution
  primary: string
  accent: string
  tagline: string
  tone?: Tone
  preview?: boolean
  verifyHref: string
  sameTenant: boolean
  userRole?: string | null
  onOpenLogin: () => void
  heroImage?: string
}

function sectionTone(dark: boolean) {
  return {
    surface: dark ? 'border-white/10' : 'border-slate-200/80',
    title: dark ? 'text-white' : 'text-slate-900',
    body: dark ? 'text-slate-300' : 'text-slate-600',
    muted: dark ? 'text-slate-500' : 'text-slate-500',
    card: dark
      ? 'border-white/10 bg-white/[0.04]'
      : 'border-slate-200 bg-white shadow-sm shadow-slate-900/5',
    pageBg: dark ? 'bg-[#0a1220]' : 'bg-slate-50',
    altBg: dark ? 'bg-[#070d18]' : 'bg-white',
  }
}

function SimplePageHead({
  eyebrow,
  title,
  body,
  primary,
  titleCls,
  bodyCls,
}: {
  eyebrow: string
  title: string
  body?: string
  primary: string
  titleCls: string
  bodyCls: string
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
        {eyebrow}
      </p>
      <h1 className={`mt-2 max-w-3xl break-words font-display text-2xl font-bold tracking-tight sm:text-3xl ${titleCls}`}>
        {title}
      </h1>
      {body ? <p className={`mt-4 max-w-3xl text-sm leading-relaxed sm:text-[15px] ${bodyCls}`}>{body}</p> : null}
    </div>
  )
}

export function LandingAboutPageContent(props: PageChromeProps) {
  const { institution, primary, accent, tagline, tone = 'light', preview } = props
  const dark = tone === 'dark'
  const t = sectionTone(dark)
  const content = sanitizeLandingContent(institution.landing_content)
  const highlights = filledAboutHighlights(content).length
    ? filledAboutHighlights(content)
    : DEFAULT_ABOUT_HIGHLIGHTS
  const team = filledLandingTeam(content)
  const aboutTitle = content.about_title.trim() || 'About us'
  const aboutBody =
    content.about_body.trim() ||
    String(institution.description || '').trim() ||
    String(institution.motto || '').trim() ||
    String(tagline || '').trim() ||
    'Learn more about our institution, training, and how we support students.'
  const tertiary = String(institution.theme_tertiary || '').trim() || accent

  return (
    <section className={`border-t ${t.surface} ${t.pageBg}`}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <SimplePageHead
          eyebrow="About"
          title={aboutTitle}
          body={aboutBody}
          primary={primary}
          titleCls={t.title}
          bodyCls={t.body}
        />
        <div className="mt-5">
          <LandingHeroSocials institution={institution} primary={primary} tone={tone} preview={preview} />
        </div>
        {highlights.length ? (
          <ul
            className={`mt-8 grid gap-3 sm:gap-4 ${
              highlights.length <= 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : highlights.length === 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {highlights.map((item, i) => {
              const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length]
              const barColor = [primary, accent, tertiary, primary][i % 4]
              return (
                <motion.li
                  key={`${item}-${i}`}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.45, delay: i * 0.07, ease }}
                  className={`group relative overflow-hidden rounded-2xl border px-4 py-5 transition duration-300 hover:-translate-y-1 ${t.card} ${t.title}`}
                >
                  <span
                    className="absolute inset-x-0 top-0 h-0.5"
                    style={{ backgroundColor: barColor, boxShadow: `0 0 18px ${barColor}88` }}
                    aria-hidden
                  />
                  <span
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${barColor}22`, color: barColor }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-semibold leading-snug sm:text-[15px]">{item}</p>
                </motion.li>
              )
            })}
          </ul>
        ) : null}

        {team.length ? (
          <div className="mt-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
              Leadership
            </p>
            <h2 className={`mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl ${t.title}`}>
              Management &amp; team
            </h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {team.map((member, i) => {
                const photo = String(member.photo_url || '').trim()
                const name = member.name.trim() || 'Team member'
                return (
                  <li key={`${name}-${i}`} className={`overflow-hidden rounded-2xl border ${t.card}`}>
                    <div className={`aspect-[4/5] overflow-hidden ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
                      {photo ? (
                        <img src={brandedImageSrc(photo)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-3xl font-bold text-white"
                          style={{ backgroundColor: primary }}
                        >
                          {brandInitial(name)}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className={`font-display text-base font-semibold ${t.title}`}>{name}</h3>
                      {member.role ? (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide" style={{ color: primary }}>
                          {member.role}
                        </p>
                      ) : null}
                      {member.bio ? <p className={`mt-2 text-sm leading-relaxed ${t.body}`}>{member.bio}</p> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function LandingProgramsPageContent(props: PageChromeProps) {
  const { institution, primary, accent, tone = 'light' } = props
  const dark = tone === 'dark'
  const t = sectionTone(dark)
  const content = sanitizeLandingContent(institution.landing_content)
  const programs = filledLandingPrograms(content).length
    ? filledLandingPrograms(content)
    : DEFAULT_PROGRAMS
  const programsIntro =
    content.programs_intro.trim() ||
    'Structured training and credentials designed around student progress.'
  const tertiary = String(institution.theme_tertiary || '').trim() || accent
  const palette = [primary, accent, tertiary]

  return (
    <section className={`border-t ${t.surface} ${t.altBg}`}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <SimplePageHead
          eyebrow="Programs"
          title="What students can study"
          body={programsIntro}
          primary={primary}
          titleCls={t.title}
          bodyCls={t.body}
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p, i) => {
            const Icon = landingProgramIcon(p.icon || FALLBACK_PROGRAM_ICONS[i % FALLBACK_PROGRAM_ICONS.length])
            const color = palette[i % palette.length]
            const photo = String(p.image_url || '').trim()
            return (
              <article
                key={`${p.title}-${i}`}
                className={`group overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 ${t.card}`}
              >
                {photo ? (
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-200/40">
                    <img
                      src={brandedImageSrc(photo)}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <span
                      className="absolute left-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
                      style={{ backgroundColor: '#fff', color }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                ) : null}
                <div className="flex gap-3 p-4 sm:gap-4 sm:p-5">
                  {photo ? null : (
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    {p.title ? <h3 className={`text-base font-semibold ${t.title}`}>{p.title}</h3> : null}
                    {p.description ? <p className={`mt-1.5 text-sm leading-relaxed ${t.body}`}>{p.description}</p> : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function LandingContactPageContent(props: PageChromeProps) {
  const { institution, primary, tone = 'light', preview } = props
  const dark = tone === 'dark'
  const t = sectionTone(dark)
  const note =
    String(institution.footer_text || '').trim() ||
    'Reach out for admissions, verification, or partnership inquiries.'

  return (
    <section className={`border-t ${t.surface} ${t.pageBg}`}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <SimplePageHead
          eyebrow="Contact"
          title="Get in touch"
          body={note}
          primary={primary}
          titleCls={t.title}
          bodyCls={t.body}
        />
        <ul className="mt-8 max-w-xl space-y-3 text-sm">
          {institution.address ? (
            <li className={`flex gap-2 ${t.body}`}>
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: primary }} />
              <span>{institution.address}</span>
            </li>
          ) : null}
          {institution.phone ? (
            <li className={`flex gap-2 ${t.body}`}>
              <Phone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: primary }} />
              {preview ? (
                <span>{institution.phone}</span>
              ) : (
                <a href={`tel:${institution.phone}`} className="hover:underline">
                  {institution.phone}
                </a>
              )}
            </li>
          ) : null}
          {institution.email ? (
            <li className={`flex gap-2 ${t.body}`}>
              <Mail className="mt-0.5 h-4 w-4 shrink-0" style={{ color: primary }} />
              {preview ? (
                <span className="break-all">{institution.email}</span>
              ) : (
                <a href={`mailto:${institution.email}`} className="break-all hover:underline">
                  {institution.email}
                </a>
              )}
            </li>
          ) : null}
          {!institution.address && !institution.phone && !institution.email ? (
            <li className={t.muted}>Contact details coming soon.</li>
          ) : null}
        </ul>
        <div className="mt-6">
          <LandingHeroSocials institution={institution} primary={primary} tone={tone} preview={preview} />
        </div>
      </div>
    </section>
  )
}

export function LandingSitePage({
  page,
  ...props
}: PageChromeProps & { page: Exclude<TenantLandingPage, 'home'> }) {
  if (page === 'about') return <LandingAboutPageContent {...props} />
  if (page === 'programs') return <LandingProgramsPageContent {...props} />
  return <LandingContactPageContent {...props} />
}

/**
 * Keeps the original home layout (hero + LandingContentSections).
 * Inner routes use the same visual language without the overbuilt redesign.
 */
export function LandingTemplateMain({
  page = 'home',
  hero,
  ...props
}: PageChromeProps & { page?: TenantLandingPage; hero: React.ReactNode }) {
  if (!page || page === 'home') {
    return (
      <>
        {hero}
        <LandingContentSections
          institution={props.institution}
          primary={props.primary}
          accent={props.accent}
          tagline={props.tagline}
          tone={props.tone}
          preview={props.preview}
        />
      </>
    )
  }
  return <LandingSitePage page={page} {...props} />
}
