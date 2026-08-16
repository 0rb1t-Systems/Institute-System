import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getInstitutionDisplayName } from '@/lib/institution'
import { GraduationCap } from 'lucide-react'

/**
 * Tenant-aware logo. Never hardcodes BRCE/Benaadir assets in the tenant shell.
 * Super Admin / logged-out: neutral mark (no tenant branding).
 */
const Logo = ({ className = 'h-12', institution: institutionProp = undefined }) => {
  const { institution: ctxInstitution, user } = useAuth()
  const institution = institutionProp !== undefined ? institutionProp : ctxInstitution
  const isPlatform = user?.role === 'super_admin' || !institution

  const name = getInstitutionDisplayName(institution, isPlatform ? 'Platform' : 'Training Center')
  const logoUrl = institution?.logo_url

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={`w-auto object-contain ${className}`}
        crossOrigin="anonymous"
      />
    )
  }

  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      <div className="h-full aspect-square max-h-10 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
        <GraduationCap className="h-[55%] w-[55%] text-white" />
      </div>
      <span className="text-sm font-bold text-white truncate leading-tight hidden sm:inline">
        {name}
      </span>
    </div>
  )
}

export default Logo
