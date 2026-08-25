import React, { useEffect, useState } from 'react'
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

export function landingNavItemsFor(_institution?: LandingInstitution) {
  return [...LANDING_NAV_ITEMS]
}

export function LandingPageNav({
  primary,
  preview,
  tone = 'light',
  className = '',
  institution,
}: {
  primary: string
  preview?: boolean
  tone?: 'light' | 'dark'
  className?: string
  institution?: LandingInstitution
}) {
  const activeId = useLandingActiveSection(preview)
  const idle = tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-900'
  const items = landingNavItemsFor(institution)

  return (
    <nav
      className={`flex shrink-0 flex-nowrap items-center gap-x-3 overflow-x-auto overscroll-x-contain py-0.5 text-[12px] font-medium [scrollbar-width:none] [-ms-overflow-style:none] sm:gap-x-4 sm:text-[13px] [&::-webkit-scrollbar]:hidden ${className}`}
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
