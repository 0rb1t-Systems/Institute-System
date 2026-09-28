import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getPlatformDashboardBrand } from '@/lib/superAdminApi'
import {
  PLATFORM_BRAND_EVENT,
  applyPlatformBrandCss,
  clearPlatformBrandCss,
  normalizePlatformDashboardBrand,
  type PlatformDashboardBrand,
} from '@/lib/logoBrandColors'

/**
 * Applies saved Super Admin dashboard brand colors to --pf-* CSS variables.
 * Only active for super_admin sessions (platform-shell).
 */
export default function PlatformBrandTheme() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  useEffect(() => {
    if (!isSuperAdmin) {
      clearPlatformBrandCss()
      return
    }

    let cancelled = false

    const apply = (brand: PlatformDashboardBrand) => {
      if (cancelled) return
      applyPlatformBrandCss(brand)
    }

    ;(async () => {
      try {
        const brand = await getPlatformDashboardBrand()
        apply(normalizePlatformDashboardBrand(brand))
      } catch {
        apply(normalizePlatformDashboardBrand(null))
      }
    })()

    const onBrand = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<PlatformDashboardBrand>>).detail
      apply(normalizePlatformDashboardBrand(detail))
    }
    window.addEventListener(PLATFORM_BRAND_EVENT, onBrand)

    return () => {
      cancelled = true
      window.removeEventListener(PLATFORM_BRAND_EVENT, onBrand)
      clearPlatformBrandCss()
    }
  }, [isSuperAdmin])

  return null
}
