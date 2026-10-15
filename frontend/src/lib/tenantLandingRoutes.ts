/**
 * Tenant public site paths (Home / About / Programs / Contact).
 * Preserves ?tenant= when browsing on the platform host.
 */

export type TenantLandingPage = 'home' | 'about' | 'programs' | 'contact'

export const TENANT_LANDING_PAGES: TenantLandingPage[] = ['home', 'about', 'programs', 'contact']

export function isTenantLandingPage(value: unknown): value is TenantLandingPage {
  return TENANT_LANDING_PAGES.includes(value as TenantLandingPage)
}

/** Path segment for a page (home → `/`). */
export function tenantLandingPath(page: TenantLandingPage): string {
  return page === 'home' ? '/' : `/${page}`
}

/**
 * Build a tenant site href, keeping `?tenant=` / `?subdomain=` when present
 * so links work on localhost and the platform apex.
 */
export function tenantLandingHref(
  page: TenantLandingPage,
  opts?: { tenant?: string | null; search?: string | null; preview?: boolean },
): string {
  if (opts?.preview) return '#'
  const path = tenantLandingPath(page)
  const params = new URLSearchParams(
    typeof opts?.search === 'string'
      ? opts.search.startsWith('?')
        ? opts.search.slice(1)
        : opts.search
      : typeof window !== 'undefined'
        ? window.location.search
        : '',
  )
  const fromOpt = String(opts?.tenant || '').trim().toLowerCase()
  if (fromOpt) {
    params.set('tenant', fromOpt)
    params.delete('subdomain')
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** Resolve active nav page from pathname. */
export function tenantLandingPageFromPath(pathname?: string | null): TenantLandingPage {
  const p = String(pathname || '/').replace(/\/+$/, '') || '/'
  if (p === '/about') return 'about'
  if (p === '/programs') return 'programs'
  if (p === '/contact') return 'contact'
  return 'home'
}
