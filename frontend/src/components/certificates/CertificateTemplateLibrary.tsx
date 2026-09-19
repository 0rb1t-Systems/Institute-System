import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getDocumentTemplate, setActiveCertificateTemplate } from '@/lib/api'
import {
  CERTIFICATE_TEMPLATE_LIBRARY,
  isBuiltInCertificateLayoutKey,
  isLandscapeCertificateLayout,
  normalizeCertificateLayoutKey,
  type CertificateLayoutKey,
  type CertificateRenderData,
} from '@/lib/certificateTemplates'
import {
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getInstitutionAccent,
  getSignatoryLeftTitle,
  getSignatoryRightTitle,
  getSignatoryLeftName,
  getSignatoryRightName,
  getCertificateFooterText,
} from '@/lib/institution'
import CertificateCanvas from '@/components/certificates/CertificateCanvas'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

/**
 * Certificate Template Library — embedded in Institution Settings.
 * Selects active layout only; branding always from Institution Settings.
 */
const CertificateTemplateLibrary = () => {
  const { institution } = useAuth()
  const { toast } = useToast()
  const [activeKey, setActiveKey] = useState<CertificateLayoutKey>('classic')
  const [previewKey, setPreviewKey] = useState<CertificateLayoutKey>('classic')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const tpl = await getDocumentTemplate('certificate')
        const key = normalizeCertificateLayoutKey(tpl?.layout_key)
        if (!cancelled) {
          setActiveKey(key)
          // Preview one of the 10 library designs (not custom_upload / logo_builder)
          setPreviewKey(isBuiltInCertificateLayoutKey(key) ? key : 'classic')
        }
      } catch {
        if (!cancelled) {
          setActiveKey('classic')
          setPreviewKey('classic')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [institution?.id])

  const sampleData: CertificateRenderData = useMemo(
    () => ({
      layoutKey: previewKey,
      institutionName: getInstitutionDisplayName(institution),
      primary: getInstitutionPrimary(institution),
      accent: getInstitutionAccent(institution),
      motto: String(institution?.motto || '').trim() || undefined,
      logoUrl: institution?.logo_url,
      sealUrl: institution?.seal_url,
      signatureUrl: institution?.signature_url,
      leftTitle: getSignatoryLeftTitle(institution),
      rightTitle: getSignatoryRightTitle(institution),
      leftName: getSignatoryLeftName(institution) || undefined,
      rightName: getSignatoryRightName(institution) || undefined,
      footerText: getCertificateFooterText(institution) || undefined,
      studentName: 'Amina Hassan',
      studentId: 'STU-1042',
      startMonth: 'Jan 2026',
      completionMonth: 'Aug 2026',
      programName: 'Professional Training Certificate',
      className: 'Cohort A',
      certificateNumber: 'CERT-PREVIEW-001',
      verifyCode: 'previewcode12345678',
      verificationUrl: 'https://example.com/verify-certificate/previewcode12345678',
      dateIssued: new Date().toISOString(),
    }),
    [institution, previewKey],
  )

  const handleActivate = async (key: CertificateLayoutKey) => {
    setSaving(true)
    try {
      const row = await setActiveCertificateTemplate(key)
      const next = normalizeCertificateLayoutKey(row?.layout_key || key)
      setActiveKey(next)
      setPreviewKey(next)
      toast({
        title: 'Template activated',
        description: `${CERTIFICATE_TEMPLATE_LIBRARY.find((t) => t.key === next)?.name || next} is now your active certificate design.`,
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-4">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
        </div>
      ) : (
        <>
          {!isBuiltInCertificateLayoutKey(activeKey) ? (
            <p className="rounded-[var(--ds-radius-md,8px)] border border-[var(--ds-warning,#C2410C)]/30 bg-[var(--ds-warning-bg,#FFF7ED)] px-3 py-2 text-xs text-[var(--ds-warning,#C2410C)]">
              Using {activeKey === 'logo_builder' ? 'Page Builder' : 'Upload'} as the live certificate. Choose a library design only if you want to switch.
            </p>
          ) : null}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {CERTIFICATE_TEMPLATE_LIBRARY.map((tpl) => {
              const isActive = tpl.key === activeKey
              const isPreview = tpl.key === previewKey
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => setPreviewKey(tpl.key)}
                  className={`rounded-[var(--ds-radius-lg,12px)] border p-2.5 text-left transition ${
                    isPreview
                      ? 'border-[var(--ds-primary,#1F8A5B)] bg-[var(--ds-primary-soft,#ECFDF5)] ring-1 ring-[var(--ds-primary,#1F8A5B)]/30'
                      : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:border-[var(--ds-border-strong,#C5D0C8)]'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[var(--ds-text-primary,#122018)]">{tpl.name}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isLandscapeCertificateLayout(tpl.key) ? (
                        <span className="text-[9px] uppercase tracking-wide text-[var(--ds-warning,#C2410C)]">
                          Landscape
                        </span>
                      ) : null}
                      {isActive ? (
                        <Badge className="border-[var(--ds-accent,#1F8A5B)]/30 bg-[var(--ds-primary-soft,#ECFDF5)] text-[10px] text-[var(--ds-accent,#1F8A5B)]">
                          Active
                        </Badge>
                      ) : (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: tpl.accentHint }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="pointer-events-none overflow-hidden rounded border border-[var(--ds-border,#DDE5DF)] bg-white">
                    <CertificateCanvas compact data={{ ...sampleData, layoutKey: tpl.key }} />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="rounded-[var(--ds-radius-lg,12px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                Preview:{' '}
                <span className="font-medium text-[var(--ds-text-primary,#122018)]">
                  {CERTIFICATE_TEMPLATE_LIBRARY.find((t) => t.key === previewKey)?.name}
                </span>
              </p>
              <Button
                type="button"
                size="sm"
                disabled={saving || previewKey === activeKey}
                onClick={() => handleActivate(previewKey)}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {previewKey === activeKey ? (
                  <>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> In use
                  </>
                ) : (
                  'Use this design'
                )}
              </Button>
            </div>
            <div
              className={`mx-auto overflow-hidden rounded bg-white ${
                isLandscapeCertificateLayout(previewKey) ? 'max-w-2xl' : 'max-w-md'
              }`}
            >
              <CertificateCanvas data={sampleData} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CertificateTemplateLibrary
