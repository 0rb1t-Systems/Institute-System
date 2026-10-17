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

export function LandingAboutPageContent(props: PageChromeProps) {
  const { institution, primary, accent, tagline, tone = 'light', preview, heroImage } = props
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
  const hero = String(heroImage || '').trim()

  return (
    <section className={`border-t ${t.surface} ${t.pageBg}`}>
      <div className={`border-b ${t.surface} ${t.altBg}`}>
        <div className="mx-auto grid max-w-6xl items-stretch md:min-h-[min(42vh,360px)] lg:min-h-[min(52vh,420px)] md:grid-cols-2">
          <div className="flex flex-col justify-center px-4 py-10 sm:px-6 sm:py-14 lg:px-10 md:py-12 lg:py-16">
            <div className="h-1 w-12 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
            <h1 className={`mt-4 max-w-xl break-words font-display text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl ${t.title}`}>
              {aboutTitle}
            </h1>
            <p className={`mt-4 max-w-xl text-[15px] leading-relaxed ${t.body}`}>{aboutBody}</p>
            <div className="mt-5">
              <LandingHeroSocials institution={institution} primary={primary} tone={tone} preview={preview} />
            </div>
          </div>
          <div className="relative min-h-[200px] sm:min-h-[260px] md:min-h-full">
            {hero ? (
              <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ backgroundColor: primary }} />
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {highlights.length ? (
          <ul
            className={`grid gap-3 sm:gap-4 ${
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
                  className={`group relative overflow-hidden rounded-xl border px-4 py-5 transition duration-300 hover:-translate-y-1 ${t.card} ${t.title}`}
                >
                  <span className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: barColor }} aria-hidden />
                  <span
                    className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg"
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
          <div className="mt-12 sm:mt-16">
            <h2 className={`font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${t.title}`}>
              Management &amp; team
            </h2>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed sm:text-[15px] ${t.body}`}>
              Meet the people who run the institute — from leadership to program leads.
            </p>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
              {team.map((member, i) => {
                const photo = String(member.photo_url || '').trim()
                const name = member.name.trim() || 'Team member'
                return (
                  <li key={`${name}-${i}`} className={`overflow-hidden rounded-xl border ${t.card}`}>
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
                      <h3 className={`font-display text-sm font-semibold sm:text-base ${t.title}`}>{name}</h3>
                      {member.role ? (
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: primary }}>
                          {member.role}
                        </p>
                      ) : null}
                      {member.bio ? <p className={`mt-2 text-xs leading-relaxed sm:text-sm ${t.body}`}>{member.bio}</p> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : (
          <div className={`mt-12 rounded-xl border px-4 py-8 text-center sm:mt-16 sm:px-6 ${t.card}`}>
            <p className={`text-sm ${t.body}`}>
              Add leadership photos and bios in Landing Customize so visitors can meet your management team here.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

export function LandingProgramsPageContent(props: PageChromeProps) {
  const { institution, primary, accent, tone = 'light', heroImage } = props
  const dark = tone === 'dark'
  const t = sectionTone(dark)
  const content = sanitizeLandingContent(institution.landing_content)
  const programs = filledLandingPrograms(content).length
    ? filledLandingPrograms(content)
    : DEFAULT_PROGRAMS
  const programsIntro =
    content.programs_intro.trim() ||
    'Explore diploma and certificate pathways — each with clear outcomes and verified credentials.'
  const tertiary = String(institution.theme_tertiary || '').trim() || accent
  const palette = [primary, accent, tertiary]
  const featured = programs[0]
  const rest = programs.slice(1)
  const featuredPhoto = String(featured?.image_url || heroImage || '').trim()

  return (
    <section className={`border-t ${t.surface} ${t.altBg}`}>
      <div className={`${t.pageBg} border-b ${t.surface}`}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="h-1 w-12 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
          <h1 className={`mt-4 max-w-3xl break-words font-display text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl ${t.title}`}>
            Programs that open doors
          </h1>
          <p className={`mt-4 max-w-2xl text-[15px] leading-relaxed ${t.body}`}>{programsIntro}</p>
        </div>
      </div>

      {featured ? (
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-14 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl sm:rounded-2xl">
            {featuredPhoto ? (
              <img
                src={
                  featuredPhoto.startsWith('http') || featuredPhoto.startsWith('blob:')
                    ? featuredPhoto
                    : brandedImageSrc(featuredPhoto)
                }
                alt=""
                className="aspect-[16/11] w-full object-cover"
              />
            ) : (
              <div className="aspect-[16/11] w-full" style={{ backgroundColor: primary }} />
            )}
          </div>
          <div className="min-w-0 space-y-3">
            <h2 className={`font-display text-xl font-extrabold tracking-tight sm:text-2xl ${t.title}`}>
              {featured.title || 'Featured program'}
            </h2>
            {featured.description ? (
              <p className={`text-[15px] leading-relaxed ${t.body}`}>{featured.description}</p>
            ) : null}
            {featured.icon ? (
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${primary}18`, color: primary }}
              >
                {(() => {
                  const Icon = landingProgramIcon(featured.icon)
                  return <Icon className="h-5 w-5" />
                })()}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`border-t ${t.surface} ${t.pageBg}`}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <h2 className={`font-display text-xl font-extrabold tracking-tight sm:text-2xl ${t.title}`}>All programs</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {(rest.length ? rest : programs).map((p, i) => {
              const Icon = landingProgramIcon(p.icon || FALLBACK_PROGRAM_ICONS[i % FALLBACK_PROGRAM_ICONS.length])
              const color = palette[i % palette.length]
              const photo = String(p.image_url || '').trim()
              return (
                <article
                  key={`${p.title}-${i}`}
                  className={`group overflow-hidden rounded-xl border transition duration-300 hover:-translate-y-0.5 ${t.card}`}
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
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                    ) : null}
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
        <h1 className={`max-w-3xl break-words font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${t.title}`}>
          Get in touch
        </h1>
        <p className={`mt-4 max-w-3xl text-sm leading-relaxed sm:text-[15px] ${t.body}`}>{note}</p>
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
 * Keeps the home layout (hero + content sections).
 * Inner routes use the same visual language.
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
          heroImage={props.heroImage}
          verifyHref={props.verifyHref}
          sameTenant={props.sameTenant}
          userRole={props.userRole}
          onOpenLogin={props.onOpenLogin}
        />
      </>
    )
  }
  return <LandingSitePage page={page} {...props} />
}
