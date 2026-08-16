import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileUp, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  getCertificateTemplateSignedUrl,
  getDocumentTemplate,
  saveCustomUploadFieldLayout,
  setActiveCertificateTemplate,
  setActiveTranscriptTemplate,
  setActiveInvoiceTemplate,
  uploadOwnDocumentTemplate,
  type DocumentTemplateType,
} from '@/lib/api'
import CertificateCanvas from '@/components/certificates/CertificateCanvas'
import CertificateUploadFieldMatcher from '@/components/certificates/CertificateUploadFieldMatcher'
import {
  createDefaultUploadFieldLayout,
  normalizeUploadFieldLayout,
  type CustomUploadMeta,
  type UploadFieldLayout,
} from '@/lib/certificateBuilder'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import {
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
  getCertificateFooterText,
  getTranscriptFooterText,
  getInvoiceFooterText,
} from '@/lib/institution'
import type { CertificateRenderData } from '@/lib/certificateTemplates'

/**
 * Upload Own document template — certificate / transcript / invoice.
 * Artwork stays private; field matcher places live student data.
 */
const CertificateUploadOwn = ({
  documentType = 'certificate',
}: {
  documentType?: DocumentTemplateType
} = {}) => {
  const docType = (documentType || 'certificate') as DocumentTemplateType
  const docLabel =
    docType === 'transcript' ? 'Transcript' : docType === 'invoice' ? 'Invoice' : 'Certificate'
  const setActiveTemplate =
    docType === 'transcript'
      ? setActiveTranscriptTemplate
      : docType === 'invoice'
        ? setActiveInvoiceTemplate
        : setActiveCertificateTemplate
  const { institution } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activating, setActivating] = useState(false)
  const [savingLayout, setSavingLayout] = useState(false)
  const [meta, setMeta] = useState<CustomUploadMeta | null>(null)
  const [activeLayout, setActiveLayout] = useState('classic')
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null)
  const [fieldLayout, setFieldLayout] = useState<UploadFieldLayout>(() =>
    createDefaultUploadFieldLayout(1.4, docType === 'transcript' || docType === 'invoice' ? docType : 'certificate'),
  )

  const load = async () => {
    setLoading(true)
    try {
      const tpl = await getDocumentTemplate(docType)
      setActiveLayout(String(tpl?.layout_key || 'classic'))
      const upload = tpl?.config?.custom_upload as CustomUploadMeta | undefined
      if (upload?.storage_path) {
        setMeta(upload)
        const aspect = upload.aspect_ratio != null ? Number(upload.aspect_ratio) : 1.4
        setFieldLayout(normalizeUploadFieldLayout(upload.field_layout, aspect, docType))
        const path = upload.preview_path || upload.storage_path
        try {
          const url = await getCertificateTemplateSignedUrl(String(path))
          setBackgroundUrl(url)
        } catch {
          setBackgroundUrl(null)
        }
      } else {
        setMeta(null)
        setBackgroundUrl(null)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.LOAD_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institution?.id, docType])

  const handleUpload = async (file: File | null) => {
    if (!file) return
    const mime = String(file.type || '').toLowerCase()
    if (mime.includes('word') || mime.includes('officedocument') || /\.docx?$/i.test(file.name)) {
      toast({
        title: 'Word not supported',
        description: 'Please upload a PDF or PNG/JPG file.',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    try {
      const row = await uploadOwnDocumentTemplate(docType, file, true)
      const upload = row?.config?.custom_upload as CustomUploadMeta | undefined
      setMeta(upload?.storage_path ? upload : null)
      setActiveLayout(String(row?.layout_key || 'custom_upload'))
      const aspect = upload?.aspect_ratio != null ? Number(upload.aspect_ratio) : 1.4
      setFieldLayout(normalizeUploadFieldLayout(upload?.field_layout, aspect, docType))
      if (upload?.preview_path || upload?.storage_path) {
        const url = await getCertificateTemplateSignedUrl(
          String(upload.preview_path || upload.storage_path),
        )
        setBackgroundUrl(url)
      }
      toast({
        title: `${docLabel} template uploaded`,
        description: `Match student fields on your design, then use your ${docLabel.toLowerCase()} flows as usual.`,
      })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: getUserMessage(err, {
          fallback: { title: 'Upload failed', description: 'We could not upload your file.' },
        }),
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleActivate = async () => {
    if (!meta?.storage_path) return
    setActivating(true)
    try {
      await setActiveTemplate('custom_upload')
      setActiveLayout('custom_upload')
      toast({
        title: 'Activated',
        description: `Your uploaded ${docLabel.toLowerCase()} design is now active.`,
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setActivating(false)
    }
  }

  const handleSaveFieldLayout = async () => {
    setSavingLayout(true)
    try {
      await saveCustomUploadFieldLayout(fieldLayout, docType)
      setActiveLayout('custom_upload')
      toast({
        title: 'Field positions saved',
        description: `Live ${docLabel.toLowerCase()} documents will place real data at these positions.`,
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSavingLayout(false)
    }
  }

  const handleClear = async () => {
    setUploading(true)
    try {
      await setActiveTemplate('classic')
      setActiveLayout('classic')
      toast({
        title: 'Switched',
        description: 'Classic library template is now active.',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const sampleData: CertificateRenderData = useMemo(() => {
    const base = {
      layoutKey: 'custom_upload' as const,
      institutionName: getInstitutionDisplayName(institution),
      primary: getInstitutionPrimary(institution) || '#001f3f',
      accent: getInstitutionAccent(institution) || '#c9a227',
      motto: String(institution?.motto || '').trim() || undefined,
      description: String(institution?.description || '').trim() || undefined,
      logoUrl: institution?.logo_url,
      sealUrl: institution?.seal_url,
      signatureUrl: institution?.signature_url,
      leftTitle: getSignatoryLeftTitle(institution),
      rightTitle: getSignatoryRightTitle(institution),
      leftName: getSignatoryLeftName(institution) || undefined,
      rightName: getSignatoryRightName(institution) || undefined,
      studentName: 'Amina Hassan',
      studentId: 'STU-001',
      verifyCode: 'previewcode12345678',
      dateIssued: new Date().toISOString(),
      customBackgroundUrl: backgroundUrl,
      customAspectRatio: meta?.aspect_ratio != null ? Number(meta.aspect_ratio) : null,
      customFieldLayout: fieldLayout,
    }
    if (docType === 'transcript') {
      return {
        ...base,
        programName: 'Diploma in Professional Studies',
        certificateNumber: 'TRN-0000042',
        verificationUrl: 'https://example.com/verify/previewcode12345678',
        footerText: getTranscriptFooterText(institution) || undefined,
        gpa: '3.40',
        gradesSummary: 'Intro to Practice  3  A\nResearch Methods  3  B+',
      }
    }
    if (docType === 'invoice') {
      return {
        ...base,
        programName: 'Tuition & fees',
        certificateNumber: 'INV-STU-001',
        invoiceNumber: 'INV-STU-001-202608',
        totalDue: '175.00',
        amountPaid: '150.00',
        balance: '25.00',
        lineItemsSummary:
          'Registration Fee (One-Time)    25.00\nTuition Fee - current month    150.00',
        footerText: getInvoiceFooterText(institution) || undefined,
      }
    }
    return {
      ...base,
      programName: 'Professional Training Certificate',
      certificateNumber: 'CERT-PREVIEW-001',
      verificationUrl: 'https://example.com/verify-certificate/previewcode12345678',
      footerText: getCertificateFooterText(institution) || undefined,
    }
  }, [institution, backgroundUrl, meta?.aspect_ratio, fieldLayout, docType])

  const matcherSample = useMemo(() => {
    if (docType === 'transcript') {
      return {
        studentName: 'Amina Hassan',
        studentId: 'STU-001',
        programName: 'Diploma in Professional Studies',
        certificateNumber: 'TRN-0000042',
        dateIssued: new Date().toISOString().slice(0, 10),
        verificationUrl: 'https://example.com/verify/previewcode12345678',
      }
    }
    if (docType === 'invoice') {
      return {
        studentName: 'Amina Hassan',
        studentId: 'STU-001',
        programName: 'Tuition & fees',
        certificateNumber: 'INV-STU-001',
        dateIssued: new Date().toISOString().slice(0, 10),
        verificationUrl: '',
      }
    }
    return {
      studentName: 'Amina Hassan',
      studentId: 'STU-001',
      programName: 'Professional Training Certificate',
      certificateNumber: 'CERT-PREVIEW-001',
      dateIssued: new Date().toISOString().slice(0, 10),
      verificationUrl: 'https://example.com/verify-certificate/previewcode12345678',
    }
  }, [docType])

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white text-base">Upload Own {docLabel}</CardTitle>
            <CardDescription>
              Upload your institution {docLabel.toLowerCase()} design (PDF/PNG/JPG). Your artwork
              stays as-is — place {docLabel.toLowerCase()} fields on top, then activate.
            </CardDescription>
          </div>
          {activeLayout === 'custom_upload' ? (
            <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40">Active</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center space-y-3">
          <FileUp className="h-8 w-8 text-slate-500 mx-auto" />
          <p className="text-sm text-slate-300">PDF, PNG, JPG, or WebP (max 10MB)</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Files are stored privately for your institution only. Set signatures and seal in
            Institution Settings if your design needs them as separate assets.
          </p>
          <label className="inline-flex">
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files?.[0] || null)}
            />
            <Button type="button" disabled={uploading} className="bg-indigo-600 hover:bg-indigo-500" asChild>
              <span>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
                {meta ? 'Replace & activate' : 'Upload & activate'}
              </span>
            </Button>
          </label>
        </div>

        {meta && backgroundUrl ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-white font-medium">{meta.file_name || 'Uploaded certificate'}</p>
                <p className="text-xs text-slate-500">
                  Private template · match fields so student data lands correctly
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeLayout !== 'custom_upload' ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={activating}
                    onClick={handleActivate}
                    className="bg-indigo-600 hover:bg-indigo-500"
                  >
                    {activating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    )}
                    Activate for students
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="secondary" disabled={uploading} onClick={handleClear}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Use library template
                  </Button>
                )}
              </div>
            </div>

            <CertificateUploadFieldMatcher
              backgroundUrl={backgroundUrl}
              aspectRatio={meta.aspect_ratio != null ? Number(meta.aspect_ratio) : 1.4}
              layout={fieldLayout}
              sample={matcherSample}
              onChange={setFieldLayout}
              onSave={handleSaveFieldLayout}
              saving={savingLayout}
              documentType={docType === 'transcript' || docType === 'invoice' ? docType : 'certificate'}
            />

            <div className="max-w-3xl mx-auto bg-white rounded overflow-hidden border border-slate-700">
              <p className="text-[11px] text-center text-slate-400 bg-slate-950 py-1.5 border-b border-slate-800">
                Final preview (sample data — real students use database values)
              </p>
              <CertificateCanvas data={sampleData} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default CertificateUploadOwn
