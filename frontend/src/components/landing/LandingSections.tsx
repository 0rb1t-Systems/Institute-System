import React, { useEffect, useMemo, useState } from 'react'
import { BookOpen, GraduationCap, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { LandingInstitution } from '@/components/landing/types'
import { getPublicClassesBySubdomain } from '@/lib/api'
import {
  DEFAULT_ABOUT_HIGHLIGHTS,
  DEFAULT_PROGRAMS,
  sanitizeLandingContent,
  type LandingProgramItem,
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
}

export function LandingPageNav({ primary, preview, tone = 'light', className = '' }: NavProps) {
  const activeId = useLandingActiveSection(preview)
  const idle = tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-900'

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium sm:gap-x-6 sm:text-[13px] sm:tracking-wide md:justify-start ${className}`}
      aria-label="Page sections"
    >
      {LANDING_NAV_ITEMS.map((item) => {
        const active = activeId === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollToLandingSection(item.id, preview)}
            className={`relative py-1 transition ${active ? 'font-semibold' : idle}`}
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
  preview = false,
}: SectionsProps) {
  const dark = tone === 'dark'
  const content = sanitizeLandingContent(institution.landing_content)
  const [livePrograms, setLivePrograms] = useState<LandingProgramItem[]>([])
  const hasCustomPrograms = content.programs.some((p) => p.title)

  useEffect(() => {
    const slug = String(institution.subdomain || '').trim()
    if (preview || !slug || hasCustomPrograms) {
      setLivePrograms([])
      return
    }
    let cancelled = false
    getPublicClassesBySubdomain(slug)
      .then((rows) => {
        if (cancelled) return
        const mapped = (Array.isArray(rows) ? rows : [])
          .slice(0, 8)
          .map((row: any) => ({
            title: String(row?.name || '').trim(),
            description:
              row?.program_type === 'diploma'
                ? 'Diploma program currently open for enrolment.'
                : 'Course currently open for enrolment.',
          }))
          .filter((p) => p.title)
        setLivePrograms(mapped)
      })
      .catch(() => {
        if (!cancelled) setLivePrograms([])
      })
    return () => {
      cancelled = true
    }
  }, [institution.subdomain, preview, hasCustomPrograms])

  const aboutTitle = content.about_title || `About ${institution.name || 'our institution'}`
  const aboutBody =
    content.about_body ||
    String(institution.description || '').trim() ||
    tagline ||
    `${institution.name || 'Our institution'} is dedicated to quality education, professional training, and trusted credentials.`

  const highlights = (content.about_highlights.filter(Boolean).length
    ? content.about_highlights.filter(Boolean)
    : DEFAULT_ABOUT_HIGHLIGHTS
  ).slice(0, 4)

  const programs: LandingProgramItem[] = useMemo(() => {
    const custom = content.programs.filter((p) => p.title)
    if (custom.length) return custom
    if (livePrograms.length) return livePrograms
    return DEFAULT_PROGRAMS
  }, [content.programs, livePrograms])

  const programsIntro =
    content.programs_intro ||
    'Explore the programs and learning paths offered by this institution.'

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
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-14">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
              About
            </p>
            <h2 className={`mt-2 max-w-xl break-words font-display text-2xl font-bold tracking-tight sm:text-3xl ${titleCls}`}>
              {aboutTitle}
            </h2>
            <p className={`mt-4 max-w-xl text-sm leading-relaxed sm:text-[15px] ${bodyCls}`}>{aboutBody}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-1">
            {highlights.map((item, i) => (
              <li
                key={`${item}-${i}`}
                className={`rounded-2xl border px-4 py-3.5 text-sm leading-snug ${cardCls} ${titleCls}`}
              >
                <span
                  className="mb-2 inline-block h-1.5 w-8 rounded-full"
                  style={{
                    backgroundColor: [primary, accent, String(institution.theme_tertiary || '').trim() || accent][
                      i % 3
                    ],
                  }}
                />
                <p>{item}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="programs"
        className={`scroll-mt-24 border-t ${surface} ${dark ? 'bg-[#070d18]' : 'bg-white'}`}
      >
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
            Programs
          </p>
          <h2 className={`mt-2 max-w-2xl font-display text-2xl font-bold tracking-tight sm:text-3xl ${titleCls}`}>
            What students can study
          </h2>
          <p className={`mt-3 max-w-2xl text-sm leading-relaxed sm:text-[15px] ${bodyCls}`}>{programsIntro}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {programs.map((p, i) => {
              const Icon = PROGRAM_ICONS[i % PROGRAM_ICONS.length]
              const palette = [primary, accent, String(institution.theme_tertiary || '').trim() || accent]
              const color = palette[i % palette.length]
              return (
                <article
                  key={`${p.title}-${i}`}
                  className={`flex gap-4 rounded-2xl border p-5 ${cardCls}`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${color}18`, color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className={`text-base font-semibold ${titleCls}`}>{p.title}</h3>
                    {p.description ? (
                      <p className={`mt-1.5 text-sm leading-relaxed ${bodyCls}`}>{p.description}</p>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
