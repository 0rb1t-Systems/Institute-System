import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { brandedImageSrc, getInstitutionDisplayName, institutionLogoUrl } from '@/lib/institution'
import { GraduationCap } from 'lucide-react'

/**
 * Tenant-aware logo. Never hardcodes BRCE/Benaadir assets in the tenant shell.
 * Super Admin / logged-out: neutral mark (no tenant branding).
 */
const Logo = ({ className = 'h-12', institution: institutionProp = undefined }) => {
  const { institution: ctxInstitution, user } = useAuth()
  const institution = institutionProp !== undefined ? institutionProp : ctxInstitution
  const isPlatform = user?.role === 'super_admin' || !institution

  const name = getInstitutionDisplayName(institution, isPlatform ? 'TvetFlow' : 'Training Center')
  const logoUrl = institutionLogoUrl(institution)

  if (logoUrl) {
    return (
      <img
        key={logoUrl}
        src={brandedImageSrc(logoUrl)}
        alt={`${name} logo`}
        className={`w-auto object-contain ${className}`}
        crossOrigin="anonymous"
      />
    )
  }

  if (user?.role === 'super_admin') {
    return (
      <div className={`flex items-center gap-2 min-w-0 ${className}`}>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-500 ring-1 ring-teal-500/25">
          <GraduationCap className="h-4 w-4" />
        </span>
        <span className="font-display text-base font-bold text-[var(--pf-text)] truncate">
          Tvet<span className="text-teal-500">Flow</span>
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <div className="h-full aspect-square max-h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--brand-primary, #002147)', color: 'var(--brand-on-primary, #fff)' }}>
        <GraduationCap className="h-[55%] w-[55%]" />
      </div>
      <span className="text-sm font-bold truncate leading-tight hidden sm:inline text-[var(--tenant-text,#fff)]">
        {name}
      </span>
    </div>
  )
}

export default Logo
