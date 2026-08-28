import React, { useEffect, useState } from 'react'
import { FileUp, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  getCertificateTemplateSignedUrl,
  getDocumentTemplate,
  saveDocumentLogoBuilder,
  uploadOwnDocumentTemplate,
  type DocumentTemplateType,
} from '@/lib/api'
import CertificateUploadTemplateEditor from '@/components/certificates/CertificateUploadTemplateEditor'
import {
  createConstructedCertificateMatchingUpload,
  normalizeLogoBuilderDesign,
  type CustomUploadMeta,
} from '@/lib/certificateBuilder'
import {
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
} from '@/lib/institution'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

/** Sample header/body colors from the uploaded preview so the built template matches its look. */
async function sampleUploadPalette(imageUrl: string): Promise<{ primary?: string; accent?: string }> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.crossOrigin = 'anonymous'
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('IMAGE_LOAD'))
      el.src = imageUrl
    })
    const w = Math.max(1, Math.min(80, img.naturalWidth || 80))
    const h = Math.max(1, Math.min(100, img.naturalHeight || 100))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return {}
    ctx.drawImage(img, 0, 0, w, h)

    const avgAt = (x0: number, y0: number, x1: number, y1: number) => {
      const sw = Math.max(1, Math.floor(x1 - x0))
      const sh = Math.max(1, Math.floor(y1 - y0))
      const data = ctx.getImageData(Math.floor(x0), Math.floor(y0), sw, sh).data
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let i = 0; i < data.length; i += 16) {
        const a = data[i + 3]
        if (a < 200) continue
        const rr = data[i]
        const gg = data[i + 1]
        const bb = data[i + 2]
        // Skip near-white / near-black paper pixels
        const lum = (rr + gg + bb) / 3
        if (lum > 235 || lum < 25) continue
        r += rr
        g += gg
        b += bb
        n += 1
      }
      if (!n) return null
      const toHex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0')
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    const primary = avgAt(w * 0.05, h * 0.02, w * 0.55, h * 0.14) || undefined
    const accent = avgAt(w * 0.05, h * 0.1, w * 0.55, h * 0.22) || undefined
    return { primary, accent }
  } catch {
    return {}
  }
}

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

/**
 * Upload Own Certificate:
 * Upload sets page size (+ palette hint) from your PDF → Generate builds a FULL
 * certificate from scratch (text, lines, logo, seal, QR) — 100% editable layers.
 * No image stacked under fields.
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
  const [meta, setMeta] = useState<CustomUploadMeta | null>(null)
  const [hasTemplate, setHasTemplate] = useState(false)
  const [active, setActive] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

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

  const generateTemplate = async (upload: CustomUploadMeta) => {
    const aspect =
      upload.aspect_ratio != null && Number(upload.aspect_ratio) > 0
        ? Number(upload.aspect_ratio)
        : null

    let primary = getInstitutionPrimary(institution)
    let accent = getInstitutionAccent(institution)
    const previewPath = previewPathForMeta(upload)
    if (previewPath) {
      try {
        const url = await getCertificateTemplateSignedUrl(previewPath)
        if (url) {
          const sampled = await sampleUploadPalette(url)
          if (sampled.primary) primary = sampled.primary
          if (sampled.accent) accent = sampled.accent
        }
      } catch {
        /* keep institution colors */
      }
    }

    const design = createConstructedCertificateMatchingUpload({
      aspectRatio: aspect,
      kind:
        docType === 'transcript'
          ? 'transcript'
          : docType === 'invoice'
            ? 'invoice'
            : 'certificate',
      institutionName: getInstitutionDisplayName(institution),
      subtitle: String(institution?.motto || '').trim() || undefined,
      primary,
      accent,
      logoUrl: institution?.logo_url || null,
      sealUrl: institution?.seal_url || null,
      signatureUrl: institution?.signature_url || null,
      leftTitle: getSignatoryLeftTitle(institution),
      rightTitle: getSignatoryRightTitle(institution),
      leftName: getSignatoryLeftName(institution) || undefined,
      rightName: getSignatoryRightName(institution) || undefined,
    })

    await saveDocumentLogoBuilder(docType, normalizeLogoBuilderDesign(design), true)
    setHasTemplate(true)
    setActive(true)
    setEditorKey((k) => k + 1)
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
    try {
      const row = await uploadOwnDocumentTemplate(docType, file, false)
      const next = row?.config?.custom_upload as CustomUploadMeta | undefined
      if (!next?.storage_path) throw new Error('UPLOAD_FAILED')
      setMeta(next)
      setHasTemplate(false)
      setActive(false)
      toast({
        title: 'Uploaded',
        description:
          'Click Generate template — we build a full editable certificate matching your page size and colors.',
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
    try {
      await generateTemplate(meta)
      toast({
        title: `${docLabel} template ready`,
        description:
          'Fully built editable layers (text, lines, logo, seal, QR). Adjust anything, then Save & use.',
      })
    } catch (err) {
      toast({
        title: 'Generate failed',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
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
            <p className="text-xs text-slate-500 mt-0.5">PDF or PNG for page size and colors, then generate editable layers.</p>
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
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileUp className="h-4 w-4 mr-2" />}
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
