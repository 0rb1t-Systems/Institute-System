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
    if (!institution || user?.role === 'super_admin') {
      clearInstitutionBrandCss()
      return
    }
    applyInstitutionBrandCss(
      getInstitutionPrimary(institution),
      getInstitutionAccent(institution),
      getInstitutionTertiary(institution),
    )
    return () => clearInstitutionBrandCss()
  }, [institution, user?.role])

  return null
}
