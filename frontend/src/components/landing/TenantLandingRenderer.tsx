import React from 'react'
import {
  getLandingTemplate,
  resolveHeroHeadline,
  resolveHeroImage,
  type LandingTemplateId,
} from '@/lib/landingTemplates'
import {
  getInstitutionAccent,
  getInstitutionPrimary,
} from '@/lib/institution'
import type { LandingInstitution, LandingTemplateProps } from '@/components/landing/types'
import ClassicTemplate from '@/components/landing/templates/ClassicTemplate'
import AuroraTemplate from '@/components/landing/templates/AuroraTemplate'
import CampusTemplate from '@/components/landing/templates/CampusTemplate'
import HorizonTemplate from '@/components/landing/templates/HorizonTemplate'
import CrestTemplate from '@/components/landing/templates/CrestTemplate'
import NovaTemplate from '@/components/landing/templates/NovaTemplate'
import LedgerTemplate from '@/components/landing/templates/LedgerTemplate'
import AtelierTemplate from '@/components/landing/templates/AtelierTemplate'

const TEMPLATE_MAP: Record<LandingTemplateId, React.ComponentType<LandingTemplateProps>> = {
  classic: ClassicTemplate,
  aurora: AuroraTemplate,
  campus: CampusTemplate,
  horizon: HorizonTemplate,
  crest: CrestTemplate,
  nova: NovaTemplate,
  ledger: LedgerTemplate,
  atelier: AtelierTemplate,
}

type Props = {
  institution: LandingInstitution
  verifyHref?: string
  sameTenant?: boolean
  userRole?: string | null
  onOpenLogin?: () => void
  preview?: boolean
  onChangeTemplate?: () => void
  templateId?: string | null
}

export default function TenantLandingRenderer({
  institution,
  verifyHref = '#',
  sameTenant = false,
  userRole = null,
  onOpenLogin = () => {},
  preview = false,
  onChangeTemplate,
  templateId,
}: Props) {
  const meta = getLandingTemplate(templateId || institution.landing_template_id)
  const Template = TEMPLATE_MAP[meta.id] || ClassicTemplate

  const primary =
    String(institution.theme_primary || '').trim() || meta.defaultPrimary || getInstitutionPrimary(institution)
  const accent =
    String(institution.theme_accent || '').trim() || meta.defaultAccent || getInstitutionAccent(institution)

  const heroImage = resolveHeroImage({
    ...institution,
    landing_template_id: meta.id,
  })
  const headline = resolveHeroHeadline({
    ...institution,
    landing_template_id: meta.id,
  })
  const tagline =
    String(institution.description || '').trim() ||
    'A trusted place for training, credentials, and academic excellence.'
  const shortTagline = tagline.length > 220 ? `${tagline.slice(0, 217)}…` : tagline

  return (
    <Template
      institution={institution}
      primary={primary}
      accent={accent}
      heroImage={heroImage}
      headline={headline}
      tagline={shortTagline}
      verifyHref={verifyHref}
      year={new Date().getFullYear()}
      sameTenant={sameTenant}
      userRole={userRole}
      onOpenLogin={onOpenLogin}
      preview={preview}
      onChangeTemplate={preview ? undefined : onChangeTemplate}
    />
  )
}
