import React from 'react'
import { BookOpen, GraduationCap, ShieldCheck, Users } from 'lucide-react'
import type { LandingInstitution } from '@/components/landing/types'

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

type NavProps = {
  primary: string
  preview?: boolean
  tone?: 'light' | 'dark'
  className?: string
  activeId?: string
}

export function LandingPageNav({ primary, preview, tone = 'light', className = '', activeId = 'home' }: NavProps) {
  const idle = tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-900'

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] font-medium tracking-wide md:justify-start ${className}`}
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
                className="absolute -bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: primary }}
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}

type SectionsProps = {
  institution: LandingInstitution
  primary: string
  accent: string
  tagline: string
  tone?: 'light' | 'dark'
  heroImage?: string
}

/**
 * Compact About + Programs strip — keeps nav anchors working without a long page.
 */
export function LandingContentSections({
  institution,
  primary,
  accent,
  tagline,
  tone = 'light',
}: SectionsProps) {
  const dark = tone === 'dark'
  const aboutText =
    String(institution.description || '').trim() ||
    tagline ||
    `${institution.name || 'Our institution'} is dedicated to quality education and trusted credentials.`
  const shortAbout = aboutText.length > 220 ? `${aboutText.slice(0, 217)}…` : aboutText

  const programs = [
    { icon: GraduationCap, title: 'Programs', color: primary },
    { icon: ShieldCheck, title: 'Credentials', color: accent },
    { icon: BookOpen, title: 'Learning', color: dark ? '#7DD3FC' : '#0284C7' },
    { icon: Users, title: 'Support', color: dark ? '#6EE7B7' : '#059669' },
  ]

  return (
    <>
      <section
        id="about"
        className={`scroll-mt-24 border-t ${dark ? 'border-white/10 bg-[#0a1220]' : 'border-slate-100 bg-slate-50'}`}
      >
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: primary }}
          >
            About
          </p>
          <h2
            className={`mt-2 max-w-2xl font-display text-2xl font-bold tracking-tight sm:text-3xl ${
              dark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {institution.name || 'Our institution'}
          </h2>
          <p
            className={`mt-3 max-w-2xl text-sm leading-relaxed sm:text-[15px] ${
              dark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {shortAbout}
          </p>
        </div>
      </section>

      <section
        id="programs"
        className={`scroll-mt-24 border-t ${dark ? 'border-white/10 bg-[#070d18]' : 'border-slate-100 bg-white'}`}
      >
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-2 sm:px-6 sm:py-10 lg:grid-cols-4">
          {programs.map((p) => (
            <div key={p.title} className="flex items-center gap-3 py-1">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${p.color}18`, color: p.color }}
              >
                <p.icon className="h-4 w-4" />
              </span>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>
                {p.title}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
