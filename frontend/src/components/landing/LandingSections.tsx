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
  const idle = tone === 'dark' ? 'text-white/65 hover:text-white' : 'text-slate-500 hover:text-slate-900'

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[13px] font-medium md:justify-start ${className}`}
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
              <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full" style={{ backgroundColor: primary }} />
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
  const shortAbout = aboutText.length > 180 ? `${aboutText.slice(0, 177)}…` : aboutText

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
        className={`scroll-mt-24 border-t ${dark ? 'border-white/10 bg-[#070f1c]' : 'border-slate-100 bg-slate-50/90'}`}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-9">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
              About
            </p>
            <h2 className={`mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl ${dark ? 'text-white' : 'text-slate-900'}`}>
              {institution.name || 'Our institution'}
            </h2>
            <p className={`mt-2 text-sm leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-600'}`}>{shortAbout}</p>
          </div>
        </div>
      </section>

      <section
        id="programs"
        className={`scroll-mt-24 border-t ${dark ? 'border-white/10 bg-[#0a1424]' : 'border-slate-100 bg-white'}`}
      >
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {programs.map((p) => (
            <div
              key={p.title}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-100 bg-slate-50/80'
              }`}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${p.color}18`, color: p.color }}
              >
                <p.icon className="h-4 w-4" />
              </span>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>{p.title}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
