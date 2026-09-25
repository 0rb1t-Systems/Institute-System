import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  getCertificateTemplateSignedUrl,
  getDocumentTemplate,
  saveDocumentUploadBuilder,
  uploadOwnDocumentTemplate,
  type DocumentTemplateType,
} from '@/lib/api'
import CertificateCanvas from '@/components/certificates/CertificateCanvas'
import {
  customUploadHasGeneratedDesign,
  normalizeLogoBuilderDesign,
  type CustomUploadMeta,
  type DocumentBuilderKind,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import { extractCertificateDesign } from '@/lib/extractCertificateDesign'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import {
  getCertificateFooterText,
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getInvoiceFooterText,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
  getTranscriptFooterText,
} from '@/lib/institution'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

function previewPathForMeta(upload: CustomUploadMeta | null | undefined): string | null {
  if (!upload) return null
  const preview = String(upload.preview_path || '').trim()
  if (preview) return preview
  const mime = String(upload.mime_type || '').toLowerCase()
  const path = String(upload.storage_path || '').trim()
  if (!path) return null
  if (mime.includes('pdf') || path.toLowerCase().endsWith('.pdf')) return null
  return path
}

async function fetchStorageFile(
  path: string,
  fileName: string,
  mimeType: string,
): Promise<File> {
  const url = await getCertificateTemplateSignedUrl(path)
  if (!url) throw new Error('CERT_TEMPLATE_NOT_FOUND')
  const res = await fetch(url)
  if (!res.ok) throw new Error('CERT_TEMPLATE_NOT_FOUND')
  const blob = await res.blob()
  return new File([blob], fileName || 'certificate-template', {
    type: mimeType || blob.type || 'application/octet-stream',
  })
}

async function rasterizePdfToObjectUrl(file: File): Promise<{ url: string; revoke: () => void }> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('UPLOAD_FAILED')
  await page.render({ canvasContext: ctx, viewport }).promise
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('UPLOAD_FAILED'))), 'image/png')
  })
  const url = URL.createObjectURL(blob)
  return { url, revoke: () => URL.revokeObjectURL(url) }
}

/**
 * Upload Own — independent of Page Builder.
 * Scan a document’s size, colors, and layout, then build a template from institution data.
 * The uploaded picture is not kept as an editable image.
 */
const CertificateUploadOwn = ({
  documentType = 'certificate',
}: {
  documentType?: DocumentTemplateType
} = {}) => {
  const docType = (documentType || 'certificate') as DocumentTemplateType
  const docLabel =
    docType === 'transcript' ? 'Transcript' : docType === 'invoice' ? 'Invoice' : 'Certificate'
  const { institution } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [meta, setMeta] = useState<CustomUploadMeta | null>(null)
  const [hasTemplate, setHasTemplate] = useState(false)
  const [active, setActive] = useState(false)
  const [design, setDesign] = useState<LogoBuilderDesign | null>(null)
  const sourceFileRef = useRef<File | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const tpl = await getDocumentTemplate(docType)
      const upload = tpl?.config?.custom_upload as CustomUploadMeta | undefined
      setMeta(upload?.storage_path ? upload : null)
      const layout = String(tpl?.layout_key || '')
      const ready = customUploadHasGeneratedDesign(upload)
      setHasTemplate(ready)
      setActive(ready && layout === 'custom_upload')
      setDesign(ready ? normalizeLogoBuilderDesign(upload!.design) : null)
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

  const sampleData: CertificateRenderData = useMemo(() => {
    const base = {
      layoutKey: 'custom_upload' as const,
      institutionName: getInstitutionDisplayName(institution),
      primary: getInstitutionPrimary(institution),
      accent: getInstitutionAccent(institution),
      logoUrl: institution?.logo_url,
      sealUrl: institution?.seal_url,
      signatureUrl: institution?.signature_url,
      motto: institution?.motto || undefined,
      studentName: 'Amina Hassan',
      studentId: 'STU-001',
      className: 'Morning Cohort',
      verifyCode: 'previewcode12345678',
      dateIssued: new Date().toISOString(),
      leftTitle: getSignatoryLeftTitle(institution) || 'Academic Registrar',
      rightTitle: getSignatoryRightTitle(institution) || 'Principal',
      leftName: getSignatoryLeftName(institution) || undefined,
      rightName: getSignatoryRightName(institution) || undefined,
      logoBuilderDesign: design || undefined,
    }
    if (docType === 'transcript') {
      return {
        ...base,
        programName: 'Diploma in Professional Studies',
        certificateNumber: 'TRN-0000042',
        verificationUrl: 'https://example.com/verify/previewcode12345678',
        footerText: getTranscriptFooterText(institution) || undefined,
        gpa: '3.40',
        gradesSummary: 'Intro to Practice                 3      A',
      } as CertificateRenderData
    }
    if (docType === 'invoice') {
      return {
        ...base,
        programName: 'Tuition & fees',
        certificateNumber: 'INV-STU-001',
        invoiceNumber: 'INV-STU-001',
        totalDue: '175.00',
        amountPaid: '150.00',
        balance: '25.00',
        footerText: getInvoiceFooterText(institution) || undefined,
      } as CertificateRenderData
    }
    return {
      ...base,
      programName: 'Diploma in Professional Studies',
      certificateNumber: 'CERT-0000042',
      verificationUrl: 'https://example.com/verify/previewcode12345678',
      footerText: getCertificateFooterText(institution) || undefined,
    }
  }, [institution, design, docType])

  const resolveSourceFile = async (upload: CustomUploadMeta): Promise<File> => {
    if (sourceFileRef.current) return sourceFileRef.current
    const file = await fetchStorageFile(
      upload.storage_path,
      upload.file_name || `${docType}-template`,
      upload.mime_type || 'application/octet-stream',
    )
    sourceFileRef.current = file
    return file
  }

  const resolveScanImageUrl = async (
    upload: CustomUploadMeta,
    file: File,
  ): Promise<{ url: string; revoke?: () => void }> => {
    const previewPath = previewPathForMeta(upload)
    if (previewPath) {
      const url = await getCertificateTemplateSignedUrl(previewPath)
      if (url) return { url }
    }
    const mime = String(file.type || upload.mime_type || '').toLowerCase()
    if (mime.includes('pdf') || /\.pdf$/i.test(file.name)) {
      return rasterizePdfToObjectUrl(file)
    }
    const url = URL.createObjectURL(file)
    return { url, revoke: () => URL.revokeObjectURL(url) }
  }

  const generateTemplate = async (upload: CustomUploadMeta) => {
    const aspect =
      upload.aspect_ratio != null && Number(upload.aspect_ratio) > 0
        ? Number(upload.aspect_ratio)
        : null

    setProgress('Loading your upload…')
    const file = await resolveSourceFile(upload)
    const scanned = await resolveScanImageUrl(upload, file)

    try {
      const kind: DocumentBuilderKind =
        docType === 'transcript'
          ? 'transcript'
          : docType === 'invoice'
            ? 'invoice'
            : 'certificate'

      const nextDesign = await extractCertificateDesign({
        file,
        imageUrl: scanned.url,
        aspectRatio: aspect,
        kind,
        institution: {
          name: getInstitutionDisplayName(institution),
          primary: getInstitutionPrimary(institution),
          accent: getInstitutionAccent(institution),
          logoUrl: institution?.logo_url,
          sealUrl: institution?.seal_url,
          signatureUrl: institution?.signature_url,
          motto: institution?.motto,
          leftTitle: getSignatoryLeftTitle(institution),
          rightTitle: getSignatoryRightTitle(institution),
          leftName: getSignatoryLeftName(institution),
          rightName: getSignatoryRightName(institution),
        },
        onProgress: (message) => setProgress(message),
      })

      setProgress('Saving template…')
      const normalized = normalizeLogoBuilderDesign(nextDesign)
      await saveDocumentUploadBuilder(docType, normalized, true)
      setDesign(normalized)
      setHasTemplate(true)
      setActive(true)
    } finally {
      scanned.revoke?.()
    }
  }

  const handleUpload = async (file: File | null) => {
    if (!file) return
    const mime = String(file.type || '').toLowerCase()
    if (mime.includes('word') || mime.includes('officedocument') || /\.docx?$/i.test(file.name)) {
      toast({
        title: 'Export to PDF first',
        description: 'From Word or Illustrator, export PDF or PNG, then upload here.',
        variant: 'destructive',
      })
      return
    }

    setBusy(true)
    setProgress(null)
    try {
      const row = await uploadOwnDocumentTemplate(docType, file, false)
      const next = row?.config?.custom_upload as CustomUploadMeta | undefined
      if (!next?.storage_path) throw new Error('UPLOAD_FAILED')
      sourceFileRef.current = file
      setMeta(next)
      setHasTemplate(false)
      setActive(false)
      setDesign(null)
      toast({
        title: 'Uploaded',
        description: `Click Generate template. We read this ${docLabel.toLowerCase()} and rebuild it with your institution’s details.`,
      })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: getUserMessage(err, {
          fallback: { title: 'Upload failed', description: 'We could not upload the file.' },
        }),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleGenerate = async () => {
    if (!meta?.storage_path) return
    setBusy(true)
    setProgress('Starting…')
    try {
      await generateTemplate(meta)
      toast({
        title: `${docLabel} template generated`,
        description: `The ${docLabel.toLowerCase()} layout is now a template filled with your institution’s name, logo, and colors.`,
      })
    } catch (err) {
      toast({
        title: 'Generate failed',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] py-14">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)]">
        <div className="border-b border-[var(--ds-border,#DDE5DF)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-primary,#1F8A5B)]">
                Upload own
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--ds-text-primary,#122018)]">
                Turn a sample {docLabel.toLowerCase()} into your institution template
              </p>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--ds-text-secondary,#5B6B61)]">
                Upload a PDF or image. Generate reads its size, colors, lines, and text, then builds
                the same layout using your institution’s name, logo, and signatories. The picture
                itself is not edited.
              </p>
            </div>
            {active && hasTemplate ? (
              <Badge variant="success">Live template</Badge>
            ) : hasTemplate ? (
              <Badge variant="outline" className="text-[var(--ds-warning,#C2410C)]">
                Ready
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <div className="min-w-0 flex-1 rounded-xl border border-dashed border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-4 py-4 text-center sm:text-left">
            <p className="truncate text-sm text-[var(--ds-text-primary,#122018)]">{meta?.file_name || 'No file yet'}</p>
            {busy && progress ? (
              <p className="mt-1 text-xs text-[var(--ds-primary,#1F8A5B)]">{progress}</p>
            ) : (
              <p className="mt-1 text-xs text-[var(--ds-text-tertiary,#8A978E)]">PDF · PNG · JPG · WebP</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  void handleUpload(e.target.files?.[0] || null)
                  e.target.value = ''
                }}
              />
              <Button type="button" disabled={busy} variant="outline" asChild>
                <span>
                  {busy && !progress ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="mr-2 h-4 w-4" />
                  )}
                  {meta?.storage_path ? 'Replace' : 'Upload'}
                </span>
              </Button>
            </label>
            <Button
              type="button"
              disabled={busy || !meta?.storage_path}
              onClick={() => void handleGenerate()}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {hasTemplate ? 'Regenerate template' : 'Generate template'}
            </Button>
          </div>
        </div>
      </div>

      {hasTemplate && design ? (
        <div className="overflow-hidden rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)]">
          <div className="border-b border-[var(--ds-border,#DDE5DF)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">Institution template</p>
            <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
              Same layout as the upload. Names, logo, and colors come from your institution. Sample
              student data is shown here.
            </p>
          </div>
          <div className="bg-[var(--ds-surface-muted,#F7FAF8)] p-3 sm:p-5">
            <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-white shadow-lg">
              <CertificateCanvas data={sampleData} compact />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CertificateUploadOwn
