import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { LandingInstitution } from '@/components/landing/types'
import {
  tenantLandingHref,
  tenantLandingPageFromPath,
  type TenantLandingPage,
} from '@/lib/tenantLandingRoutes'

export const LANDING_NAV_ITEMS: { id: TenantLandingPage; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'programs', label: 'Programs' },
  { id: 'contact', label: 'Contact' },
]

/** @deprecated Prefer tenantLandingHref — kept for preview/hash fallbacks. */
export function scrollToLandingSection(id: string, preview?: boolean) {
  if (preview || typeof document === 'undefined') return
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  variant = 'links',
  activePage,
}: {
  primary: string
  preview?: boolean
  tone?: 'light' | 'dark'
  className?: string
  institution?: LandingInstitution
  variant?: 'links' | 'tabs'
  /** Override active page (e.g. template picker). */
  activePage?: TenantLandingPage
}) {
  const location = useLocation()
  const activeId = activePage || tenantLandingPageFromPath(location.pathname)
  const idle = tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-900'
  const items = landingNavItemsFor(institution)
  const tenant = institution?.subdomain || null

  if (variant === 'tabs') {
    const track =
      tone === 'dark'
        ? 'border-white/10 bg-white/10'
        : 'border-slate-200/80 bg-slate-100/90'
    const idleTab = tone === 'dark' ? 'text-white/70' : 'text-slate-500'

    return (
      <nav
        className={`grid w-full grid-cols-4 gap-0.5 rounded-xl border p-1 ${track} ${className}`}
        aria-label="Site pages"
      >
        {items.map((item) => {
          const active = activeId === item.id
          const classNameBtn = `min-w-0 rounded-lg px-1 py-1.5 text-center text-[11px] font-medium leading-tight transition sm:text-xs ${
            active ? 'font-semibold shadow-sm' : idleTab
          }`
          const style = active
            ? { backgroundColor: primary, color: 'var(--brand-on-primary, #fff)' }
            : undefined

          if (preview) {
            return (
              <button key={item.id} type="button" className={classNameBtn} style={style}>
                <span className="block truncate">{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.id}
              to={tenantLandingHref(item.id, { tenant })}
              className={classNameBtn}
              style={style}
              aria-current={active ? 'page' : undefined}
            >
              <span className="block truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav
      className={`flex shrink-0 flex-nowrap items-center gap-x-3 overflow-x-auto overscroll-x-contain py-0.5 text-[12px] font-medium [scrollbar-width:none] [-ms-overflow-style:none] sm:gap-x-4 sm:text-[13px] [&::-webkit-scrollbar]:hidden ${className}`}
      aria-label="Site pages"
    >
      {items.map((item) => {
        const active = activeId === item.id
        const classNameLink = `relative shrink-0 whitespace-nowrap py-1 transition ${active ? 'font-semibold' : idle}`
        const style = active ? { color: primary } : undefined

        if (preview) {
          return (
            <button key={item.id} type="button" className={classNameLink} style={style}>
              {item.label}
              {active && (
                <span
                  className="absolute -bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: primary }}
                />
              )}
            </button>
          )
        }

        return (
          <Link
            key={item.id}
            to={tenantLandingHref(item.id, { tenant })}
            className={classNameLink}
            style={style}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
            {active && (
              <span
                className="absolute -bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: primary }}
              />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
