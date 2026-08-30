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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {!isBuiltInCertificateLayoutKey(activeKey) ? (
            <p className="text-xs text-emerald-200/90 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-3 py-2">
              Using {activeKey === 'logo_builder' ? 'Builder' : 'Upload'} as the live certificate. Choose a library design only if you want to switch.
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
                  className={`text-left rounded-lg border p-2.5 transition ${
                    isPreview
                      ? 'border-indigo-500 bg-slate-950 ring-1 ring-indigo-500/40'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-white truncate">{tpl.name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isLandscapeCertificateLayout(tpl.key) ? (
                        <span className="text-[9px] uppercase tracking-wide text-amber-200/90">Landscape</span>
                      ) : null}
                      {isActive ? (
                        <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40 text-[10px]">
                          Active
                        </Badge>
                      ) : (
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: tpl.accentHint }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="pointer-events-none overflow-hidden rounded border border-slate-800 bg-white">
                    <CertificateCanvas compact data={{ ...sampleData, layoutKey: tpl.key }} />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm text-slate-300">
                Preview:{' '}
                <span className="text-white font-medium">
                  {CERTIFICATE_TEMPLATE_LIBRARY.find((t) => t.key === previewKey)?.name}
                </span>
              </p>
              <Button
                type="button"
                size="sm"
                disabled={saving || previewKey === activeKey}
                onClick={() => handleActivate(previewKey)}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {previewKey === activeKey ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> In use
                  </>
                ) : (
                  'Use this design'
                )}
              </Button>
            </div>
            <div
              className={`mx-auto bg-white rounded overflow-hidden ${
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
