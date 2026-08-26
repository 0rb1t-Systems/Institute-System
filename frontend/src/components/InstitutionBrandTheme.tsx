import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getInstitutionAccent, getInstitutionPrimary, getInstitutionTertiary } from '@/lib/institution'
import { applyInstitutionBrandCss, clearInstitutionBrandCss } from '@/lib/logoBrandColors'

/**
 * Pushes the tenant's saved brand colors onto CSS variables so the app shell
 * (buttons, rings, nav accents) and branded surfaces stay consistent.
 */
export default function InstitutionBrandTheme() {
  const { user, institution } = useAuth()

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
  }, [institution, user?.role])

  return null
}
