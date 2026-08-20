import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, Award } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getDocumentTemplate, setActiveCertificateTemplate } from '@/lib/api'
import {
  CERTIFICATE_TEMPLATE_LIBRARY,
  isBuiltInCertificateLayoutKey,
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
      programName: 'Professional Training Certificate',
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
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-400" />
          <div>
            <CardTitle className="text-white text-base">Certificate Template Library</CardTitle>
            <CardDescription>
              Preview professional designs and choose one active template. Your institution branding is applied automatically.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {CERTIFICATE_TEMPLATE_LIBRARY.map((tpl) => {
                const isActive = tpl.key === activeKey
                const isPreview = tpl.key === previewKey
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => setPreviewKey(tpl.key)}
                    className={`text-left rounded-lg border p-3 transition ${
                      isPreview
                        ? 'border-indigo-500 bg-slate-950 ring-1 ring-indigo-500/40'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-medium text-white">{tpl.name}</p>
                        <p className="text-[11px] text-slate-500">{tpl.category}</p>
                      </div>
                      {isActive ? (
                        <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40">Active</Badge>
                      ) : (
                        <span
                          className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: tpl.accentHint }}
                        />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{tpl.description}</p>
                    <div className="pointer-events-none max-h-36 overflow-hidden rounded border border-slate-800 bg-white">
                      <CertificateCanvas
                        compact
                        data={{ ...sampleData, layoutKey: tpl.key }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>

            {!isBuiltInCertificateLayoutKey(activeKey) ? (
              <p className="text-xs text-emerald-200/90 rounded-md border border-emerald-700/40 bg-emerald-950/30 px-3 py-2">
                <strong className="text-emerald-300">
                  {activeKey === 'logo_builder'
                    ? 'Certificate Page Builder'
                    : activeKey === 'custom_upload'
                      ? 'Upload Own Certificate'
                      : activeKey}{' '}
                  is active
                </strong>
                {' — '}
                Report Center download/print uses this design. Do not click “Set as active template” on a
                library card unless you want to switch away from your custom design.
              </p>
            ) : null}

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
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Active template
                    </>
                  ) : (
                    'Set as active template'
                  )}
                </Button>
              </div>
              <div className="max-w-md mx-auto bg-white rounded overflow-hidden">
                <CertificateCanvas data={sampleData} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default CertificateTemplateLibrary
