/**
 * Certificate PDF — single visual source: CertificateCanvas (same as on-screen preview).
 * Renders off-DOM via React, captures with html2canvas, writes PDF matching paper/aspect.
 */
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import CertificateCanvas from '@/components/certificates/CertificateCanvas'
import {
  normalizeCertificateLayoutKey,
  type CertificateRenderData,
} from '@/lib/certificateTemplates'
import {
  getCertificateFooterText,
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
  getVerificationUrl,
  resolveDocumentBranding,
  type InstitutionBrand,
} from '@/lib/institution'
import {
  extractCertStoragePath,
  normalizeLogoBuilderDesign,
  normalizePaperLayers,
  normalizeVerificationQr,
  normalizeUploadFieldLayout,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import { getCertificateTemplateSignedUrl, getDocumentTemplate } from '@/lib/api'

/**
 * Prefer the institution’s currently active certificate template for preview/PDF.
 * Activating Page Builder / Upload Own / a library template applies immediately —
 * including certificates already listed in Report Center.
 * Only skip when the caller exports an in-progress builder canvas (draft preview).
 */
export async function withLiveActiveCertificateTemplate(
  certificateData: Record<string, any>,
): Promise<Record<string, any>> {
  // Page Builder draft download / explicit canvas export must not be overwritten
  if (certificateData?.skipLiveActiveTemplate || certificateData?.useCurrentDesign) {
    return certificateData
  }

  try {
    const tpl = await getDocumentTemplate('certificate')
    if (!tpl?.layout_key) return certificateData

    const layoutKey = normalizeCertificateLayoutKey(tpl.layout_key)
    const prevSnap = certificateData.template_snapshot || {}
    const prevTpl = prevSnap.template || prevSnap
    const config = {
      ...(prevTpl?.config || prevSnap.config || {}),
      ...(tpl.config || {}),
    }

    // Custom modes need their payload present; otherwise keep snapshot
    if (layoutKey === 'custom_upload' && !config?.custom_upload?.storage_path) {
      return certificateData
    }
    if (layoutKey === 'logo_builder' && !config?.logo_builder) {
      return certificateData
    }

    // Prefer an already-provided builder design (e.g. editor canvas export)
    if (
      layoutKey === 'logo_builder' &&
      certificateData.logoBuilderDesign &&
      typeof certificateData.logoBuilderDesign === 'object'
    ) {
      return {
        ...certificateData,
        layoutKey,
        template_snapshot: {
          ...prevSnap,
          layout_key: layoutKey,
          template: {
            ...(typeof prevTpl === 'object' ? prevTpl : {}),
            layout_key: layoutKey,
            config: {
              ...config,
              logo_builder: certificateData.logoBuilderDesign,
            },
          },
          config: {
            ...config,
            logo_builder: certificateData.logoBuilderDesign,
          },
        },
      }
    }

    return {
      ...certificateData,
      layoutKey,
      template_snapshot: {
        ...prevSnap,
        layout_key: layoutKey,
        template: {
          ...(typeof prevTpl === 'object' ? prevTpl : {}),
          layout_key: layoutKey,
          config,
        },
        config,
      },
    }
  } catch {
    return certificateData
  }
}

/** @deprecated use withLiveActiveCertificateTemplate */
export async function withLiveCustomUploadTemplate(
  certificateData: Record<string, any>,
): Promise<Record<string, any>> {
  return withLiveActiveCertificateTemplate(certificateData)
}

async function resolveBuilderImageSrcs(design: LogoBuilderDesign | null | undefined): Promise<LogoBuilderDesign | null> {
  if (!design?.elements?.length) return design || null
  const elements = await Promise.all(
    design.elements.map(async (el) => {
      if (el.type !== 'image' || !el.src) return el
      const path = extractCertStoragePath(el.src)
      if (!path) return el
      try {
        const url = await getCertificateTemplateSignedUrl(path)
        // Keep path in persisted sense for future saves via snapshot; display uses signed URL
        return url ? { ...el, src: url } : el
      } catch {
        return el
      }
    }),
  )
  return { ...design, elements }
}

/** Normalize any download caller payload into CertificateRenderData. */
export function toCertificateRenderData(certificateData: Record<string, any>): CertificateRenderData {
  const brand = resolveDocumentBranding(
    (certificateData.institution || null) as InstitutionBrand,
    certificateData.template_snapshot,
  )
  const layoutKey = normalizeCertificateLayoutKey(
    certificateData.layoutKey ||
      certificateData.template_snapshot?.template?.layout_key ||
      certificateData.template_snapshot?.layout_key,
  )

  const studentName =
    certificateData.student?.name ||
    certificateData.student?.full_name ||
    certificateData.studentName ||
    'Student Name'
  const studentId =
    certificateData.student?.student_code ||
    certificateData.studentId ||
    certificateData.student_code ||
    undefined
  const programName =
    certificateData.diploma?.name ||
    certificateData.course?.name ||
    certificateData.diplomaName ||
    certificateData.courseName ||
    certificateData.class?.name ||
    certificateData.className ||
    certificateData.template_snapshot?.program_name ||
    'Certificate of Completion'
  const className =
    certificateData.class?.name ||
    certificateData.className ||
    certificateData.template_snapshot?.class_name ||
    undefined
  const certificateNumber =
    certificateData.certificateNumber || certificateData.certificate_number || 'N/A'
  const dateIssued =
    certificateData.dateIssued || certificateData.date_issued || certificateData.issued_at || null
  const verifyCode = String(
    certificateData.verifyCode ||
      certificateData.verification_code ||
      certificateData.certificate?.verification_code ||
      '',
  ).trim()

  let verificationUrl = String(
    certificateData.verificationUrl || certificateData.qrData || '',
  ).trim()
  if (!verificationUrl && verifyCode) {
    verificationUrl = getVerificationUrl(verifyCode, brand, 'certificate')
  }

  const tplConfig =
    certificateData.template_snapshot?.template?.config ||
    certificateData.template_snapshot?.config ||
    certificateData.config ||
    {}

  const logoBuilderDesign =
    certificateData.logoBuilderDesign ||
    (tplConfig?.logo_builder
      ? normalizeVerificationQr(normalizeLogoBuilderDesign(tplConfig.logo_builder))
      : null)

  return {
    layoutKey,
    institutionName: getInstitutionDisplayName(brand),
    primary: getInstitutionPrimary(brand),
    accent: getInstitutionAccent(brand),
    motto: String(brand?.motto || '').trim() || undefined,
    // Institution description is for landing/settings only — never print on documents
    description: undefined,
    logoUrl: brand?.logo_url,
    sealUrl: brand?.seal_url,
    signatureUrl: brand?.signature_url,
    leftTitle: getSignatoryLeftTitle(brand),
    rightTitle: getSignatoryRightTitle(brand),
    leftName: getSignatoryLeftName(brand) || undefined,
    rightName: getSignatoryRightName(brand) || undefined,
    footerText:
      String(certificateData.footerText || '').trim() ||
      getCertificateFooterText(brand) ||
      undefined,
    studentName,
    studentId,
    programName,
    className,
    certificateNumber,
    verifyCode: verifyCode || undefined,
    verificationUrl: verificationUrl || undefined,
    dateIssued,
    gpa: certificateData.gpa != null ? String(certificateData.gpa) : undefined,
    gradesSummary: certificateData.gradesSummary
      ? String(certificateData.gradesSummary)
      : undefined,
    invoiceNumber: certificateData.invoiceNumber
      ? String(certificateData.invoiceNumber)
      : undefined,
    totalDue: certificateData.totalDue ? String(certificateData.totalDue) : undefined,
    amountPaid: certificateData.amountPaid ? String(certificateData.amountPaid) : undefined,
    balance: certificateData.balance ? String(certificateData.balance) : undefined,
    lineItemsSummary: certificateData.lineItemsSummary
      ? String(certificateData.lineItemsSummary)
      : undefined,
    logoBuilderDesign,
    customBackgroundUrl: certificateData.customBackgroundUrl || null,
    customAspectRatio:
      certificateData.customAspectRatio != null
        ? Number(certificateData.customAspectRatio)
        : tplConfig?.custom_upload?.aspect_ratio != null
          ? Number(tplConfig.custom_upload.aspect_ratio)
          : null,
    customFieldLayout:
      certificateData.customFieldLayout ||
      (tplConfig?.custom_upload
        ? normalizeUploadFieldLayout(
            tplConfig.custom_upload.field_layout,
            tplConfig.custom_upload.aspect_ratio,
          )
        : null),
    customPaperLayers:
      certificateData.customPaperLayers ||
      (tplConfig?.custom_upload
        ? normalizePaperLayers(tplConfig.custom_upload.paper_layers)
        : null),
  }
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

/**
 * Resolve private custom-upload background + builder images into short-lived signed URLs.
 * Prefers the institution’s live active template when Upload Own / Page Builder is active.
 */
export async function hydrateCertificateRenderData(
  certificateData: Record<string, any>,
): Promise<CertificateRenderData> {
  const merged = await withLiveActiveCertificateTemplate(certificateData)
  let data = toCertificateRenderData(merged)

  if (data.layoutKey === 'logo_builder' && data.logoBuilderDesign) {
    const withImages = await resolveBuilderImageSrcs(data.logoBuilderDesign)
    data = { ...data, logoBuilderDesign: withImages }
    return data
  }

  if (data.layoutKey !== 'custom_upload') return data

  const tplConfig =
    merged.template_snapshot?.template?.config ||
    merged.template_snapshot?.config ||
    merged.config ||
    {}
  const upload = tplConfig?.custom_upload

  let url = data.customBackgroundUrl || null
  if (!url) {
    const path = upload?.preview_path || upload?.storage_path
    if (path) {
      try {
        url = await getCertificateTemplateSignedUrl(String(path))
      } catch {
        url = null
      }
    }
  }

  let aspect =
    data.customAspectRatio && data.customAspectRatio > 0
      ? data.customAspectRatio
      : upload?.aspect_ratio != null
        ? Number(upload.aspect_ratio)
        : null
  if ((!aspect || !(aspect > 0)) && url) {
    aspect = await loadImageAspectRatio(url)
  }

  return {
    ...data,
    layoutKey: 'custom_upload',
    customBackgroundUrl: url,
    customAspectRatio: aspect && aspect > 0 ? aspect : null,
    customFieldLayout: normalizeUploadFieldLayout(upload?.field_layout, aspect),
    customPaperLayers: normalizePaperLayers(upload?.paper_layers),
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Fetch a remote image and return a data-URL so html2canvas can paint it (CORS-safe). */
async function inlineImageSrc(src: string | null | undefined): Promise<string | null> {
  if (!src) return null
  const s = String(src)
  if (s.startsWith('data:')) return s
  try {
    const res = await fetch(s, { mode: 'cors', credentials: 'omit', cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(blob)
    })
  } catch {
    // Fallback: draw via Image + canvas (works when CORS headers allow)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          try {
            const c = document.createElement('canvas')
            c.width = img.naturalWidth || 1
            c.height = img.naturalHeight || 1
            const ctx = c.getContext('2d')
            if (!ctx) {
              reject(new Error('no ctx'))
              return
            }
            ctx.drawImage(img, 0, 0)
            resolve(c.toDataURL('image/png'))
          } catch (err) {
            reject(err)
          }
        }
        img.onerror = () => reject(new Error('img error'))
        img.src = s
      })
      return dataUrl
    } catch {
      return s
    }
  }
}

/** Inline every remote bitmap on the certificate so PDF capture matches on-screen preview. */
async function prepareDataForPdfCapture(data: CertificateRenderData): Promise<CertificateRenderData> {
  const [logoUrl, sealUrl, signatureUrl, customBackgroundUrl] = await Promise.all([
    inlineImageSrc(data.logoUrl),
    inlineImageSrc(data.sealUrl),
    inlineImageSrc(data.signatureUrl),
    inlineImageSrc(data.customBackgroundUrl),
  ])

  let logoBuilderDesign = data.logoBuilderDesign
  if (logoBuilderDesign?.elements?.length) {
    const elements = await Promise.all(
      logoBuilderDesign.elements.map(async (el) => {
        if (el.type !== 'image' || !el.src) return el
        if (String(el.src).startsWith('data:')) return el
        const inlined = await inlineImageSrc(el.src)
        return inlined ? { ...el, src: inlined } : el
      }),
    )
    logoBuilderDesign = { ...logoBuilderDesign, elements }
  }

  return {
    ...data,
    logoUrl: logoUrl || data.logoUrl,
    sealUrl: sealUrl || data.sealUrl,
    signatureUrl: signatureUrl || data.signatureUrl,
    customBackgroundUrl: customBackgroundUrl || data.customBackgroundUrl,
    logoBuilderDesign,
  }
}

/**
 * Mount CertificateCanvas at full design size, capture, return PDF blob.
 * Matches on-screen Preview (same canvas + inlined images) — no crop, no stretch.
 */
export async function generateCertificatePDF(certificateData: Record<string, any>): Promise<Blob> {
  const hydrated = await hydrateCertificateRenderData(certificateData)
  const data = await prepareDataForPdfCapture(hydrated)
  const isUpload = data.layoutKey === 'custom_upload'
  const isBuilder = data.layoutKey === 'logo_builder' && !!data.logoBuilderDesign?.canvas

  const aspect =
    isUpload && data.customAspectRatio && data.customAspectRatio > 0
      ? data.customAspectRatio
      : 297 / 210

  const pageWpx = isBuilder
    ? Math.max(400, Math.round(data.logoBuilderDesign!.canvas.width))
    : isUpload
      ? aspect >= 1
        ? 1123
        : 794
      : 794

  const pageHpx = isBuilder
    ? Math.max(400, Math.round(data.logoBuilderDesign!.canvas.height))
    : isUpload
      ? Math.max(400, Math.round(pageWpx / Math.max(0.4, aspect)))
      : Math.round(pageWpx * (297 / 210))

  // PDF page mm always matches capture pixel aspect — prevents stretch/qallooc
  let pageWmm: number
  let pageHmm: number
  let orientation: 'portrait' | 'landscape'
  let format: [number, number]

  const canvasAspect = pageWpx / pageHpx
  if (canvasAspect >= 1) {
    orientation = 'landscape'
    pageWmm = 297
    pageHmm = Math.round((297 / canvasAspect) * 100) / 100
  } else {
    orientation = 'portrait'
    pageWmm = 210
    pageHmm = Math.round((210 / canvasAspect) * 100) / 100
  }
  format = [pageWmm, pageHmm]

  const host = document.createElement('div')
  host.setAttribute('data-certificate-pdf-host', '1')
  // Off-screen but fully opaque — opacity:0 breaks html2canvas painting of images/SVG
  host.style.cssText = [
    'position:fixed',
    'left:-12000px',
    'top:0',
    `width:${pageWpx}px`,
    `height:${pageHpx}px`,
    'opacity:1',
    'pointer-events:none',
    'z-index:-1',
    'overflow:hidden',
    'background:#ffffff',
  ].join(';')
  document.body.appendChild(host)

  const revokeList: string[] = []
  let root: Root | null = null
  try {
    root = createRoot(host)
    root.render(createElement(CertificateCanvas, { data, forPdf: true }))
    await wait(isUpload || isBuilder ? 1200 : 600)

    // Ensure every <img> is decoded
    const imgs = Array.from(host.querySelectorAll('img'))
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve()
              return
            }
            const done = () => resolve()
            img.addEventListener('load', done, { once: true })
            img.addEventListener('error', done, { once: true })
            window.setTimeout(done, 4000)
          }),
      ),
    )
    // Wait for fonts
    try {
      await (document as any).fonts?.ready
    } catch {
      /* ignore */
    }
    await wait(200)
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      try {
        await document.fonts.ready
      } catch {
        /* keep going with fallbacks */
      }
    }

    const el = host.firstElementChild as HTMLElement | null
    if (!el) throw new Error('Certificate canvas failed to mount')

    el.style.cssText = [
      `width:${pageWpx}px`,
      `height:${pageHpx}px`,
      `min-width:${pageWpx}px`,
      `min-height:${pageHpx}px`,
      `max-width:${pageWpx}px`,
      `max-height:${pageHpx}px`,
      'aspect-ratio:auto',
      'border-radius:0',
      'box-shadow:none',
      'border:none',
      'margin:0',
      'padding:0',
      'overflow:hidden',
      'background:#ffffff',
      'position:relative',
    ].join(';')
    void el.offsetHeight
    await wait(50)

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 20000,
      foreignObjectRendering: false,
      // Measure the element itself — do not force a mismatched viewport
      width: pageWpx,
      height: pageHpx,
      onclone: (_doc, cloned) => {
        cloned.style.width = `${pageWpx}px`
        cloned.style.height = `${pageHpx}px`
        cloned.style.overflow = 'hidden'
        // Strip accidental text highlight boxes (legacy fill defaults / selection paint)
        cloned.querySelectorAll('[data-cert-mode="logo-builder"] [style]').forEach((node) => {
          const el = node as HTMLElement
          if (el.tagName === 'IMG' || el.querySelector('img, svg, canvas')) return
          const bg = (el.style.backgroundColor || el.style.background || '').toLowerCase()
          if (
            !bg ||
            bg === 'transparent' ||
            bg === 'rgba(0, 0, 0, 0)' ||
            bg.includes('255, 255, 255')
          ) {
            return
          }
          // Light slate/blue-grey fills that were never meant as text backgrounds
          if (
            bg.includes('226, 232, 240') || // #e2e8f0
            bg.includes('203, 213, 225') || // #cbd5e1
            bg.includes('241, 245, 249') || // #f1f5f9
            bg === '#e2e8f0' ||
            bg === '#cbd5e1' ||
            bg === '#f1f5f9'
          ) {
            el.style.background = 'transparent'
            el.style.backgroundColor = 'transparent'
          }
        })
        // Rasterize QR SVG → canvas so it is not missing in PDF
        cloned.querySelectorAll('svg').forEach((svg) => {
          try {
            const parent = svg.parentElement
            if (!parent) return
            const rect = parent.getBoundingClientRect()
            const w = Math.max(32, Math.round(rect.width || parent.clientWidth || 96))
            const h = Math.max(32, Math.round(rect.height || parent.clientHeight || 96))
            const xml = new XMLSerializer().serializeToString(svg)
            const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
            const img = cloned.ownerDocument.createElement('img')
            img.src = svgUrl
            img.width = w
            img.height = h
            img.style.width = '100%'
            img.style.height = '100%'
            img.style.display = 'block'
            svg.replaceWith(img)
          } catch {
            /* keep svg */
          }
        })
      },
    })

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format,
      compress: true,
    })
    const imgData = canvas.toDataURL('image/png', 1.0)
    pdf.addImage(imgData, 'PNG', 0, 0, pageWmm, pageHmm, undefined, 'FAST')
    return pdf.output('blob')
  } finally {
    try {
      root?.unmount()
    } catch {
      /* ignore */
    }
    host.remove()
    revokeList.forEach((u) => {
      try {
        URL.revokeObjectURL(u)
      } catch {
        /* ignore */
      }
    })
  }
}

export async function downloadCertificatePDF(
  certificateData: Record<string, any>,
  filename: string | undefined = undefined,
) {
  try {
    const pdfBlob = await generateCertificatePDF(certificateData)
    const url = URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = url
    const studentCode =
      certificateData.student?.student_code || certificateData.studentCode || 'Unknown'
    const dateStr = new Date().toISOString().split('T')[0]
    const defaultFilename = `${studentCode}_Certificate_${dateStr}.pdf`
    link.download = filename || defaultFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error('PDF download failed:', error)
    throw error
  }
}

/**
 * Print only the full certificate page (no preview UI / dialog chrome).
 * Uses the same full-bleed PDF as download.
 */
export async function printCertificatePDF(certificateData: Record<string, any>) {
  const pdfBlob = await generateCertificatePDF(certificateData)
  const url = URL.createObjectURL(pdfBlob)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Print certificate')
  iframe.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;border:0;opacity:0;pointer-events:none;z-index:-1;'
  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Print timeout')), 30000)
      iframe.onload = () => {
        window.clearTimeout(timer)
        window.setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
            resolve()
          } catch {
            window.open(url, '_blank')
            resolve()
          }
        }, 250)
      }
      iframe.onerror = () => {
        window.clearTimeout(timer)
        window.open(url, '_blank')
        resolve()
      }
      iframe.src = url
    })
  } finally {
    window.setTimeout(() => {
      try {
        iframe.remove()
      } catch {
        /* ignore */
      }
      URL.revokeObjectURL(url)
    }, 180000)
  }
  return true
}
