/**
 * Shared hydration for Page Builder + Upload Own designs across
 * certificate / transcript / invoice document templates.
 */
import { getCertificateTemplateSignedUrl } from '@/lib/api'
import {
  extractCertStoragePath,
  normalizeLogoBuilderDesign,
  normalizePaperLayers,
  normalizeUploadFieldLayout,
  normalizeVerificationQr,
  type LogoBuilderDesign,
  type PaperContentLayer,
  type UploadFieldLayout,
} from '@/lib/certificateBuilder'

export type HydratedDocumentDesign = {
  layoutKey: string
  logoBuilderDesign: LogoBuilderDesign | null
  customBackgroundUrl: string | null
  customAspectRatio: number | null
  customFieldLayout: UploadFieldLayout | null
  customPaperLayers: PaperContentLayer[] | null
  showLogo: boolean
  showContact: boolean
}

function loadImageAspectRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth || 0
      const h = img.naturalHeight || 0
      resolve(w > 0 && h > 0 ? w / h : null)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function resolveBuilderImageSrcs(
  design: LogoBuilderDesign | null | undefined,
): Promise<LogoBuilderDesign | null> {
  if (!design?.elements?.length) return design || null
  const elements = await Promise.all(
    design.elements.map(async (el) => {
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
  return { ...design, elements }
}

/**
 * Resolve signed URLs + normalize config for an active document_templates row
 * (or snapshot template object with layout_key + config).
 */
export async function hydrateDocumentDesignFromTemplate(
  tpl: { layout_key?: string | null; config?: Record<string, any> | null; document_type?: string | null } | null | undefined,
  documentType?: 'certificate' | 'transcript' | 'invoice',
): Promise<HydratedDocumentDesign> {
  const layoutKey = String(tpl?.layout_key || 'classic')
    .trim()
    .toLowerCase()
  const config = (tpl?.config || {}) as Record<string, any>
  const showLogo = config.show_logo !== false
  const showContact = config.show_contact !== false
  const kind = (documentType ||
    String(tpl?.document_type || 'certificate').toLowerCase()) as
    | 'certificate'
    | 'transcript'
    | 'invoice'

  if (layoutKey === 'logo_builder') {
    const raw = config.logo_builder
    const design = raw
      ? normalizeVerificationQr(normalizeLogoBuilderDesign(raw))
      : null
    const withImages = design ? await resolveBuilderImageSrcs(design) : null
    return {
      layoutKey,
      logoBuilderDesign: withImages,
      customBackgroundUrl: null,
      customAspectRatio: null,
      customFieldLayout: null,
      customPaperLayers: null,
      showLogo,
      showContact,
    }
  }

  if (layoutKey === 'custom_upload') {
    const upload = config.custom_upload || {}
    let url: string | null = null
    const path = upload.preview_path || upload.storage_path
    if (path) {
      try {
        url = await getCertificateTemplateSignedUrl(String(path))
      } catch {
        url = null
      }
    }

    let aspect =
      upload.aspect_ratio != null && Number(upload.aspect_ratio) > 0
        ? Number(upload.aspect_ratio)
        : null
    if ((!aspect || !(aspect > 0)) && url) {
      aspect = await loadImageAspectRatio(url)
    }

    return {
      layoutKey,
      logoBuilderDesign: null,
      customBackgroundUrl: url,
      customAspectRatio: aspect && aspect > 0 ? aspect : null,
      customFieldLayout: normalizeUploadFieldLayout(upload.field_layout, aspect, kind),
      customPaperLayers: normalizePaperLayers(upload.paper_layers),
      showLogo,
      showContact,
    }
  }

  return {
    layoutKey,
    logoBuilderDesign: null,
    customBackgroundUrl: null,
    customAspectRatio: null,
    customFieldLayout: null,
    customPaperLayers: null,
    showLogo,
    showContact,
  }
}
