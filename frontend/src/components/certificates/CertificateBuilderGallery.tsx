import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Pencil, Trash2, Wand2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import CertificateCanvas from '@/components/certificates/CertificateCanvas'
import {
  extractCertStoragePath,
  normalizeLogoBuilderDesign,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import type { SavedLogoBuilderDesign } from '@/lib/logoBuilderLibrary/api'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import { getCertificateTemplateSignedUrl } from '@/lib/api'
import {
  getCertificateFooterText,
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
  institutionLogoUrl,
  type InstitutionBrand,
} from '@/lib/institution'

type Props = {
  items: SavedLogoBuilderDesign[]
  loading?: boolean
  activeId?: string | null
  activatingId?: string | null
  institution: InstitutionBrand | null
  onEdit: (item: SavedLogoBuilderDesign) => void
  onDelete: (id: string) => void
  onActivate: (item: SavedLogoBuilderDesign) => void
}

async function resolveDesignImages(design: LogoBuilderDesign): Promise<LogoBuilderDesign> {
  const normalized = normalizeLogoBuilderDesign(design)
  const elements = await Promise.all(
    (normalized.elements || []).map(async (el) => {
      if (el.type !== 'image' || !el.src) return el
      const path = extractCertStoragePath(el.src)
      if (!path) return el
      try {
        const url = await getCertificateTemplateSignedUrl(path)
        return url ? { ...el, src: url } : el
      } catch {
        return el
      }
    }),
  )
  return { ...normalized, elements }
}

function TemplateThumb({
  design,
  institution,
}: {
  design: LogoBuilderDesign
  institution: InstitutionBrand | null
}) {
  const [resolved, setResolved] = useState<LogoBuilderDesign | null>(null)

  useEffect(() => {
    let cancelled = false
    resolveDesignImages(design).then((next) => {
      if (!cancelled) setResolved(next)
    })
    return () => {
      cancelled = true
    }
  }, [design])

  const data = useMemo<CertificateRenderData>(() => {
    const d = resolved || design
    const w = d.canvas?.width || 794
    const h = d.canvas?.height || 1123
    return {
      layoutKey: 'logo_builder',
      institutionName: getInstitutionDisplayName(institution),
      primary: getInstitutionPrimary(institution),
      accent: getInstitutionAccent(institution),
      logoUrl: institutionLogoUrl(institution) || null,
      sealUrl: institution?.seal_url,
      signatureUrl: institution?.signature_url,
      motto: institution?.motto || undefined,
      studentName: 'Amina Hassan',
      studentId: 'STU-001',
      programName: 'Diploma',
      className: 'Class',
      certificateNumber: 'CERT-001',
      dateIssued: new Date().toISOString(),
      verifyCode: 'preview',
      verificationUrl: 'https://example.com/verify/preview',
      footerText: getCertificateFooterText(institution) || undefined,
      leftTitle: getSignatoryLeftTitle(institution),
      rightTitle: getSignatoryRightTitle(institution),
      leftName: getSignatoryLeftName(institution) || undefined,
      rightName: getSignatoryRightName(institution) || undefined,
      logoBuilderDesign: d,
      customAspectRatio: w / Math.max(1, h),
    }
  }, [design, institution, resolved])

  const w = (resolved || design).canvas?.width || 794
  const h = (resolved || design).canvas?.height || 1123
  const destW = 220
  const scale = destW / w

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-md border border-[var(--ds-border,#DDE5DF)] bg-white shadow-sm"
      style={{ width: destW, height: h * scale }}
    >
      <div
        className="pointer-events-none origin-top-left"
        style={{ width: w, height: h, transform: `scale(${scale})` }}
      >
        <CertificateCanvas data={data} compact />
      </div>
    </div>
  )
}

const CertificateBuilderGallery = ({
  items,
  loading,
  activeId,
  activatingId,
  institution,
  onEdit,
  onDelete,
  onActivate,
}: Props) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] py-12 text-sm text-[var(--ds-text-secondary,#5B6B61)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
        Loading saved designs…
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-6 py-10 text-center">
        <p className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">
          No saved Page Builder designs yet
        </p>
        <p className="mt-1 text-sm text-[var(--ds-text-secondary,#5B6B61)]">
          Design on the canvas, then Save — give it a name and optional class. You can keep many here.
        </p>
      </div>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const isActive = activeId === item.id
        const activating = activatingId === item.id
        return (
          <li
            key={item.id}
            className={`overflow-hidden rounded-2xl border bg-[var(--ds-surface,#fff)] shadow-sm transition ${
              isActive
                ? 'border-[var(--ds-accent,#1F8A5B)] ring-1 ring-[var(--ds-accent,#1F8A5B)]/30'
                : 'border-[var(--ds-border,#DDE5DF)] hover:border-[var(--ds-accent,#1F8A5B)]/50'
            }`}
          >
            <div className="bg-[linear-gradient(160deg,#F4F7F5_0%,#EEF3F0_55%,#E8EEEA_100%)] px-3 pb-3 pt-4">
              <TemplateThumb design={item.design} institution={institution} />
            </div>
            <div className="space-y-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start gap-2">
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ds-text-primary,#122018)]">
                    {item.name}
                  </h3>
                  {isActive ? (
                    <Badge variant="success" className="shrink-0 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Live
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                  {item.className ? item.className : 'All classes'}
                  {' · '}
                  {item.updatedAt || item.createdAt
                    ? new Date(item.updatedAt || item.createdAt).toLocaleDateString()
                    : '—'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                {!isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={activating}
                    onClick={() => onActivate(item)}
                  >
                    {activating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Use for students
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="secondary" disabled>
                    Active for generate
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default CertificateBuilderGallery
