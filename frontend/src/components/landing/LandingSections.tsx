import React from 'react'
import { motion } from 'framer-motion'
import { Award, GraduationCap, Sparkles, Users } from 'lucide-react'
import type { LandingInstitution } from '@/components/landing/types'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { landingProgramIcon } from '@/components/landing/landingProgramIcons'
import { brandedImageSrc } from '@/lib/institution'
import {
  DEFAULT_ABOUT_HIGHLIGHTS,
  DEFAULT_PROGRAMS,
  filledAboutHighlights,
  filledLandingPrograms,
  sanitizeLandingContent,
} from '@/lib/landingContent'

export {
  LANDING_NAV_ITEMS,
  LandingPageNav,
  landingNavItemsFor,
  scrollToLandingSection,
} from '@/components/landing/LandingNav'

const HIGHLIGHT_ICONS = [Sparkles, GraduationCap, Users, Award]

type SectionsProps = {
  institution: LandingInstitution
  primary: string
  accent: string
  tagline: string
  tone?: 'light' | 'dark'
  preview?: boolean
}

export function LandingContentSections({
  institution,
  primary,
  accent,
  tagline,
  tone = 'light',
  preview,
}: SectionsProps) {
  const dark = tone === 'dark'
  const content = sanitizeLandingContent(institution.landing_content)
  const customHighlights = filledAboutHighlights(content)
  const customPrograms = filledLandingPrograms(content)
  const highlights = customHighlights.length ? customHighlights : DEFAULT_ABOUT_HIGHLIGHTS
  const programs = customPrograms.length ? customPrograms : DEFAULT_PROGRAMS
  const aboutTitle = content.about_title.trim() || 'About us'
  const aboutBody =
    content.about_body.trim() ||
    String(institution.description || '').trim() ||
    String(institution.motto || '').trim() ||
    String(tagline || '').trim() ||
    'Learn more about our institution, training, and how we support students.'
  const programsIntro =
    content.programs_intro.trim() ||
    'Structured training and credentials designed around student progress.'

  const surface = dark ? 'border-white/10' : 'border-slate-200/80'
  const titleCls = dark ? 'text-white' : 'text-slate-900'
  const bodyCls = dark ? 'text-slate-300' : 'text-slate-600'
  const cardCls = dark
    ? 'border-white/10 bg-white/[0.04]'
    : 'border-slate-200 bg-white shadow-sm shadow-slate-900/5'

  return (
    <>
      <section
          id="about"
          className={`scroll-mt-24 border-t ${surface} ${dark ? 'bg-[#0a1220]' : 'bg-slate-50'}`}
        >
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
                About
              </p>
              <h2 className={`mt-2 max-w-3xl break-words font-display text-2xl font-bold tracking-tight sm:text-3xl ${titleCls}`}>
                {aboutTitle}
              </h2>
              <p className={`mt-4 max-w-3xl text-sm leading-relaxed sm:text-[15px] ${bodyCls}`}>{aboutBody}</p>
              <div className="mt-5">
                <LandingHeroSocials
                  institution={institution}
                  primary={primary}
                  tone={tone}
                  preview={preview}
                />
              </div>
            </div>
            {highlights.length ? (
              <ul
                className={`mt-8 grid gap-3 sm:gap-4 ${
                  highlights.length === 1
                    ? 'grid-cols-1 sm:max-w-sm'
                    : highlights.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : highlights.length === 3
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                }`}
              >
                {highlights.map((item, i) => {
                  const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length]
                  const barColor = [
                    primary,
                    accent,
                    String(institution.theme_tertiary || '').trim() || accent,
                    primary,
                  ][i % 4]
                  return (
                    <motion.li
                      key={`${item}-${i}`}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.35 }}
                      transition={{ duration: 0.45, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                      className={`group relative overflow-hidden rounded-2xl border px-4 py-5 transition duration-300 hover:-translate-y-1 ${cardCls} ${titleCls} ${
                        dark
                          ? 'hover:border-white/20 hover:bg-white/[0.07]'
                          : 'hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]'
                      }`}
                    >
                      <span
                        className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-100 transition duration-500 group-hover:scale-x-110"
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
          </div>
        </section>

      <section
          id="programs"
          className={`scroll-mt-24 border-t ${surface} ${dark ? 'bg-[#070d18]' : 'bg-white'}`}
        >
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
              Programs
            </p>
            <h2 className={`mt-2 max-w-2xl font-display text-2xl font-bold tracking-tight sm:text-3xl ${titleCls}`}>
              What students can study
            </h2>
            {programsIntro ? (
              <p className={`mt-3 max-w-2xl text-sm leading-relaxed sm:text-[15px] ${bodyCls}`}>{programsIntro}</p>
            ) : null}

            {programs.length ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {programs.map((p, i) => {
                  const Icon = landingProgramIcon(
                    p.icon || (['graduation', 'book', 'code', 'palette', 'briefcase', 'laptop', 'award', 'users'][i % 8] as const),
                  )
                  const palette = [primary, accent, String(institution.theme_tertiary || '').trim() || accent]
                  const color = palette[i % palette.length]
                  const photo = String(p.image_url || '').trim()
                  return (
                    <article
                      key={`${p.title}-${i}`}
                      className={`group overflow-hidden rounded-2xl border transition duration-300 hover:-translate-y-1 ${cardCls} ${
                        dark
                          ? 'hover:border-white/20 hover:bg-white/[0.07]'
                          : 'hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]'
                      }`}
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
                          {p.title ? <h3 className={`text-base font-semibold ${titleCls}`}>{p.title}</h3> : null}
                          {p.description ? (
                            <p className={`mt-1.5 text-sm leading-relaxed ${bodyCls}`}>{p.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : null}
          </div>
        </section>
    </>
  )
}
