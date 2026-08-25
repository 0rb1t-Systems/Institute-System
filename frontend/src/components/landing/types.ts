import type { LandingTemplateId } from '@/lib/landingTemplates'
import type { LandingContent } from '@/lib/landingContent'

export type LandingInstitution = {
  id?: string
  name?: string | null
  subdomain?: string | null
  logo_url?: string | null
  description?: string | null
  motto?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  website?: string | null
  theme_primary?: string | null
  theme_accent?: string | null
  theme_tertiary?: string | null
  landing_template_id?: LandingTemplateId | string | null
  hero_image_url?: string | null
  hero_headline?: string | null
  footer_text?: string | null
  landing_content?: LandingContent | null
}

export type LandingTemplateProps = {
  institution: LandingInstitution
  primary: string
  accent: string
  heroImage: string
  headline: string
  tagline: string
  verifyHref: string
  year: number
  sameTenant: boolean
  userRole?: string | null
  onOpenLogin: () => void
  /** When true, CTAs are visual-only (template picker preview). */
  preview?: boolean
  /** Opens on-page template switcher (preferred over navigate). */
  onChangeTemplate?: () => void
}

export { hasInstitutionLogo, institutionLogoUrl } from '@/lib/institution'

export function brandInitial(name?: string | null) {
  const n = String(name || '').trim()
  return n ? n.charAt(0).toUpperCase() : 'I'
}

export function dashboardPathForRole(role?: string | null) {
  if (role === 'super_admin') return '/super-admin'
  if (role === 'student') return '/student/dashboard'
  if (role === 'instructor') return '/instructor/dashboard'
  if (role === 'affiliate') return '/affiliate'
  return '/dashboard'
}
