import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import type { LandingInstitution } from '@/components/landing/types'
import {
  tenantLandingHref,
  tenantLandingPageFromPath,
  type TenantLandingPage,
} from '@/lib/tenantLandingRoutes'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

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

/** Standard hamburger + slide-out menu for mobile / small tablets. */
export function LandingMobileMenu({
  primary,
  preview,
  tone = 'light',
  institution,
  activePage,
}: {
  primary: string
  preview?: boolean
  tone?: 'light' | 'dark'
  institution?: LandingInstitution
  activePage?: TenantLandingPage
}) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const activeId = activePage || tenantLandingPageFromPath(location.pathname)
  const items = landingNavItemsFor(institution)
  const tenant = institution?.subdomain || null
  const dark = tone === 'dark'
  const triggerCls = dark
    ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white hover:bg-white/10'
    : 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
  const panelCls = dark
    ? 'border-white/10 bg-[#0b1220] text-white'
    : 'border-slate-200 bg-white text-slate-900'
  const idleCls = dark ? 'text-white/75 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" className={`md:hidden ${triggerCls}`} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className={`w-[min(100%,20rem)] p-0 ${panelCls}`}>
        <SheetHeader className={`border-b px-5 py-4 text-left ${dark ? 'border-white/10' : 'border-slate-100'}`}>
          <SheetTitle className={dark ? 'text-white' : 'text-slate-900'}>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Site pages">
          {items.map((item) => {
            const active = activeId === item.id
            const itemCls = `rounded-lg px-3 py-3 text-[15px] font-medium transition ${
              active ? 'font-semibold' : idleCls
            }`
            const style = active
              ? { backgroundColor: `${primary}22`, color: primary }
              : undefined

            if (preview) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${itemCls} text-left`}
                  style={style}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </button>
              )
            }

            return (
              <Link
                key={item.id}
                to={tenantLandingHref(item.id, { tenant })}
                className={itemCls}
                style={style}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
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
