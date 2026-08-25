import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Award, BookOpen, GraduationCap, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { LandingInstitution } from '@/components/landing/types'
import {
  filledAboutHighlights,
  filledLandingPrograms,
  landingAboutVisible,
  landingProgramsVisible,
  sanitizeLandingContent,
} from '@/lib/landingContent'

export const LANDING_NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'programs', label: 'Programs' },
  { id: 'contact', label: 'Contact' },
] as const

export function scrollToLandingSection(id: string, preview?: boolean) {
  if (preview || typeof document === 'undefined') return
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function useLandingActiveSection(preview?: boolean) {
  const [activeId, setActiveId] = useState('home')

  useEffect(() => {
    if (preview || typeof document === 'undefined') return undefined
    const els = LANDING_NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    )
    if (!els.length) return undefined

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const id = visible[0]?.target?.id
        if (id) setActiveId(id)
      },
      { rootMargin: '-28% 0px -55% 0px', threshold: [0.12, 0.35, 0.6] },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [preview])

  return activeId
}

type NavProps = {
  primary: string
  preview?: boolean
  tone?: 'light' | 'dark'
  className?: string
  institution?: LandingInstitution
}

export function landingNavItemsFor(institution?: LandingInstitution) {
  const content = sanitizeLandingContent(institution?.landing_content)
  return LANDING_NAV_ITEMS.filter((item) => {
    if (item.id === 'about') return landingAboutVisible(content)
    if (item.id === 'programs') return landingProgramsVisible(content)
    return true
  })
}

export function LandingPageNav({ primary, preview, tone = 'light', className = '', institution }: NavProps) {
  const activeId = useLandingActiveSection(preview)
  const idle = tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-900'
  const items = landingNavItemsFor(institution)

  return (
    <nav
      className={`flex max-w-full flex-nowrap items-center justify-center gap-x-3 overflow-x-auto overscroll-x-contain py-0.5 text-[11px] font-medium [scrollbar-width:none] [-ms-overflow-style:none] sm:gap-x-5 sm:text-[13px] sm:tracking-wide md:justify-start [&::-webkit-scrollbar]:hidden ${className}`}
      aria-label="Page sections"
    >
      {items.map((item) => {
        const active = activeId === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToLandingSection(item.id, preview)}
            className={`relative shrink-0 whitespace-nowrap py-1 transition ${active ? 'font-semibold' : idle}`}
            style={active ? { color: primary } : undefined}
          >
            {item.label}
            {active && (
              <span
                className="absolute -bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: primary }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}

const PROGRAM_ICONS = [GraduationCap, BookOpen, ShieldCheck, Users, Sparkles]
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
  tone = 'light',
}: SectionsProps) {
  const dark = tone === 'dark'
  const content = sanitizeLandingContent(institution.landing_content)
  const highlights = filledAboutHighlights(content)
  const programs = filledLandingPrograms(content)
  const showAbout = landingAboutVisible(content)
  const showPrograms = landingProgramsVisible(content)
  const aboutTitle = content.about_title.trim()
  const aboutBody = content.about_body.trim()
  const programsIntro = content.programs_intro.trim()

  const surface = dark ? 'border-white/10' : 'border-slate-200/80'
  const titleCls = dark ? 'text-white' : 'text-slate-900'
  const bodyCls = dark ? 'text-slate-300' : 'text-slate-600'
  const cardCls = dark
    ? 'border-white/10 bg-white/[0.04]'
    : 'border-slate-200 bg-white shadow-sm shadow-slate-900/5'

  if (!showAbout && !showPrograms) return null

  return (
    <>
      {showAbout ? (
        <section
          id="about"
          className={`scroll-mt-24 border-t ${surface} ${dark ? 'bg-[#0a1220]' : 'bg-slate-50'}`}
        >
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
                About
              </p>
              {aboutTitle ? (
                <h2 className={`mt-2 max-w-3xl break-words font-display text-2xl font-bold tracking-tight sm:text-3xl ${titleCls}`}>
                  {aboutTitle}
                </h2>
              ) : null}
              {aboutBody ? (
                <p className={`mt-4 max-w-3xl text-sm leading-relaxed sm:text-[15px] ${bodyCls}`}>{aboutBody}</p>
              ) : null}
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
      ) : null}

      {showPrograms ? (
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
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {programs.map((p, i) => {
                  const Icon = PROGRAM_ICONS[i % PROGRAM_ICONS.length]
                  const palette = [primary, accent, String(institution.theme_tertiary || '').trim() || accent]
                  const color = palette[i % palette.length]
                  return (
                    <article
                      key={`${p.title}-${i}`}
                      className={`flex gap-3 rounded-2xl border p-4 sm:gap-4 sm:p-5 ${cardCls}`}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        {p.title ? <h3 className={`text-base font-semibold ${titleCls}`}>{p.title}</h3> : null}
                        {p.description ? (
                          <p className={`mt-1.5 text-sm leading-relaxed ${bodyCls}`}>{p.description}</p>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )
}
