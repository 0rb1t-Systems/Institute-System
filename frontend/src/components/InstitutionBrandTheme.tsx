import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePlatformTheme } from '@/contexts/PlatformThemeContext'
import { getInstitutionAccent, getInstitutionPrimary, getInstitutionTertiary } from '@/lib/institution'
import { applyInstitutionBrandCss, clearInstitutionBrandCss } from '@/lib/logoBrandColors'

/**
 * Pushes the tenant's saved brand colors onto CSS variables so the app shell
 * (buttons, rings, nav accents) and branded surfaces stay consistent.
 * Light and dark tenant chrome use Amanah design-system.pen greens via applyInstitutionBrandCss.
 */
export default function InstitutionBrandTheme() {
  const { user, institution } = useAuth()
  const { mode } = usePlatformTheme()

  useEffect(() => {
    const root = document.documentElement
    if (!institution || user?.role === 'super_admin') {
      root.removeAttribute('data-tenant-chrome')
      clearInstitutionBrandCss()
      return
    }
    root.setAttribute('data-tenant-chrome', '1')
    applyInstitutionBrandCss(
      getInstitutionPrimary(institution),
      getInstitutionAccent(institution),
      getInstitutionTertiary(institution),
    )
    return () => {
      root.removeAttribute('data-tenant-chrome')
      clearInstitutionBrandCss()
    }
  }, [institution, user?.role, mode])

  return null
}
