import React, { useEffect, useRef, useState } from 'react'
import { FileUp, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  getCertificateTemplateSignedUrl,
  getDocumentTemplate,
  saveDocumentLogoBuilder,
  uploadCertificateBuilderImage,
  uploadOwnDocumentTemplate,
  type DocumentTemplateType,
} from '@/lib/api'
import CertificateUploadTemplateEditor from '@/components/certificates/CertificateUploadTemplateEditor'
import {
  normalizeLogoBuilderDesign,
  type CustomUploadMeta,
  type DocumentBuilderKind,
} from '@/lib/certificateBuilder'
import { extractCertificateDesign } from '@/lib/extractCertificateDesign'
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
 * Upload Own Certificate:
 * Upload a sample PDF/PNG → Generate scans that design and builds a full editable
 * clone (text as layers, decorative art as residual paper) that matches colors,
 * layout, and fields of what you uploaded.
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
  const [editorKey, setEditorKey] = useState(0)
  const sourceFileRef = useRef<File | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const tpl = await getDocumentTemplate(docType)
      const upload = tpl?.config?.custom_upload as CustomUploadMeta | undefined
      setMeta(upload?.storage_path ? upload : null)
      const layout = String(tpl?.layout_key || '')
      const lb = tpl?.config?.logo_builder
      const elements =
        lb && typeof lb === 'object' && Array.isArray((lb as { elements?: unknown }).elements)
          ? (lb as { elements: unknown[] }).elements
          : []
      const ready = elements.length > 0 && layout === 'logo_builder'
      setHasTemplate(ready)
      setActive(ready)
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

      const design = await extractCertificateDesign({
        file,
        imageUrl: scanned.url,
        aspectRatio: aspect,
        kind,
        uploadImageBlob: async (blob, fileName) => {
          const asFile = new File([blob], fileName || 'certificate-paper.png', {
            type: blob.type || 'image/png',
          })
          const up = await uploadCertificateBuilderImage(asFile)
          return { path: up.path, signedUrl: up.signedUrl }
        },
        onProgress: (message) => setProgress(message),
      })

      setProgress('Saving template…')
      await saveDocumentLogoBuilder(docType, normalizeLogoBuilderDesign(design), true)
      setHasTemplate(true)
      setActive(true)
      setEditorKey((k) => k + 1)
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
      toast({
        title: 'Uploaded',
        description:
          'Click Generate — we scan your design and build a matching editable template (colors, layout, fields).',
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
        title: `${docLabel} template ready`,
        description:
          'Editable clone of your upload (text layers + artwork). Adjust anything, then Save & use.',
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
      <div className="rounded-xl border border-slate-800 bg-slate-900 flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-medium text-white">Upload a sample</p>
            <p className="text-xs text-slate-500 mt-0.5">
              PDF or PNG of your certificate. Generate builds an editable clone that matches it.
            </p>
          </div>
          {active && hasTemplate ? (
            <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40">Active</Badge>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-4 text-center sm:text-left">
            <p className="text-sm text-slate-300 truncate">
              {meta?.file_name || 'No file yet'}
            </p>
            {busy && progress ? (
              <p className="mt-1 text-xs text-indigo-300">{progress}</p>
            ) : null}
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
              <Button type="button" disabled={busy} variant="outline" className="border-slate-700" asChild>
                <span>
                  {busy && !progress ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileUp className="h-4 w-4 mr-2" />
                  )}
                  {meta?.storage_path ? 'Replace' : 'Upload'}
                </span>
              </Button>
            </label>
            <Button
              type="button"
              disabled={busy || !meta?.storage_path}
              className="bg-indigo-600 hover:bg-indigo-500"
              onClick={() => void handleGenerate()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {hasTemplate ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </div>
      </div>

      {hasTemplate ? (
        <CertificateUploadTemplateEditor documentType={docType} remountKey={editorKey} />
      ) : null}
    </div>
  )
}

export default CertificateUploadOwn
