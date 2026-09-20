/**
 * Shared PDF helpers for transcript / invoice (and any design using CertificateCanvas).
 * Custom layouts reuse the certificate CORS-safe pipeline so logos/backgrounds print correctly.
 */
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  downloadCertificatePDF,
  printCertificatePDF,
} from '@/lib/certificateGenerator'
import type { CertificateRenderData } from '@/lib/certificateTemplates'

/** Payload for design-based PDF (Page Builder / Upload Own). */
export function designPdfPayload(
  data: CertificateRenderData,
  institution?: Record<string, any> | null,
): Record<string, any> {
  return {
    skipLiveActiveTemplate: true,
    institution: institution || undefined,
    layoutKey: data.layoutKey,
    institutionName: data.institutionName,
    primary: data.primary,
    accent: data.accent,
    motto: data.motto,
    description: undefined,
    logoUrl: data.logoUrl,
    studentPhotoUrl: data.studentPhotoUrl,
    motto: data.motto,
    institutionEmail: data.institutionEmail,
    institutionPhone: data.institutionPhone,
    institutionAddress: data.institutionAddress,
    institutionWebsite: data.institutionWebsite,
    sealUrl: data.sealUrl,
    signatureUrl: data.signatureUrl,
    leftTitle: data.leftTitle,
    rightTitle: data.rightTitle,
    leftName: data.leftName,
    rightName: data.rightName,
    footerText: data.footerText,
    studentName: data.studentName,
    studentId: data.studentId,
    startMonth: data.startMonth,
    completionMonth: data.completionMonth,
    programName: data.programName,
    className: data.className,
    certificateNumber: data.certificateNumber,
    verifyCode: data.verifyCode,
    verificationUrl: data.verificationUrl,
    dateIssued: data.dateIssued,
    gpa: data.gpa,
    gradesSummary: data.gradesSummary,
    invoiceNumber: data.invoiceNumber,
    totalDue: data.totalDue,
    amountPaid: data.amountPaid,
    balance: data.balance,
    lineItemsSummary: data.lineItemsSummary,
    logoBuilderDesign: data.logoBuilderDesign,
    customBackgroundUrl: data.customBackgroundUrl,
    customAspectRatio: data.customAspectRatio,
    customFieldLayout: data.customFieldLayout,
    customPaperLayers: data.customPaperLayers,
  }
}

export async function downloadDesignPDF(
  data: CertificateRenderData,
  filename: string,
  institution?: Record<string, any> | null,
) {
  return downloadCertificatePDF(designPdfPayload(data, institution), filename)
}

export async function printDesignPDF(
  data: CertificateRenderData,
  institution?: Record<string, any> | null,
) {
  return printCertificatePDF(designPdfPayload(data, institution))
}

/** Inline remote <img> sources on a live DOM node so html2canvas paints them. */
async function inlineDomImages(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  const originals: Array<{ img: HTMLImageElement; src: string }> = []

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) return
      originals.push({ img, src })
      try {
        const res = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'no-cache' })
        if (!res.ok) return
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('read failed'))
          reader.readAsDataURL(blob)
        })
        img.setAttribute('src', dataUrl)
      } catch {
        /* keep original */
      }
    }),
  )

  return () => {
    originals.forEach(({ img, src }) => img.setAttribute('src', src))
  }
}

/**
 * Bake title bars to canvas so PDF matches on-screen preview.
 * html2canvas misplaces CSS text baselines inside fixed-height colored bars.
 * Long program names wrap / shrink so they stay inside horizontal padding.
 */
function wrapTitleBarLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return [text]
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
      continue
    }
    if (current) lines.push(current)
    // Single oversized token: keep it on its own line (font may shrink below)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

function rasterizeTranscriptTitleBars(root: HTMLElement): () => void {
  const backups: Array<{ node: HTMLElement; html: string; cssText: string }> = []
  const bars = Array.from(root.querySelectorAll<HTMLElement>('[data-transcript-title-bar]'))

  for (const node of bars) {
    const label = node.querySelector<HTMLElement>('[data-transcript-title-label]')
    const text = String(label?.textContent || node.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue

    const w = Math.max(1, Math.round(node.offsetWidth || node.clientWidth || 0))
    const h = Math.max(1, Math.round(node.offsetHeight || node.clientHeight || 36))
    if (w < 2 || h < 2) continue

    const barCs = window.getComputedStyle(node)
    const labelCs = label ? window.getComputedStyle(label) : barCs
    const bg = barCs.backgroundColor || '#000000'
    const color = labelCs.color || barCs.color || '#ffffff'
    const fontWeight = labelCs.fontWeight || '800'
    const fontFamily = labelCs.fontFamily || 'Arial, sans-serif'
    const letterSpacing = labelCs.letterSpacing || '0px'
    const padX = Math.max(
      16,
      Math.round(Number.parseFloat(barCs.paddingLeft) || 0),
      Math.round(Number.parseFloat(barCs.paddingRight) || 0),
    )
    const maxTextWidth = Math.max(40, w - padX * 2)
    let fontSizePx = Number.parseFloat(labelCs.fontSize) || 16
    const minFontPx = 10
    const lineHeightRatio = 1.25
    const upper = text.toUpperCase()

    const scale = 3
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.display = 'block'
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    canvas.style.margin = '0'
    canvas.style.padding = '0'

    const ctx = canvas.getContext('2d')
    if (!ctx) continue

    ctx.scale(scale, scale)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const spacingPx = Number.parseFloat(letterSpacing)
    if (Number.isFinite(spacingPx) && spacingPx !== 0 && 'letterSpacing' in ctx) {
      ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = letterSpacing
    }

    let lines: string[] = []
    for (let guard = 0; guard < 12; guard += 1) {
      ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`
      lines = wrapTitleBarLines(ctx, upper, maxTextWidth)
      const widest = Math.max(...lines.map((line) => ctx.measureText(line).width), 0)
      const blockHeight = lines.length * fontSizePx * lineHeightRatio
      const fitsWidth = widest <= maxTextWidth + 0.5
      const fitsHeight = blockHeight <= h - 4
      if ((fitsWidth && fitsHeight) || fontSizePx <= minFontPx) break
      fontSizePx = Math.max(minFontPx, fontSizePx - 1)
    }

    // Prefer at most 3 lines; if still overflowing width on min font, clip visually via maxWidth
    if (lines.length > 3) {
      lines = [lines[0], lines[1], `${lines.slice(2).join(' ')}`]
    }

    ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`
    const blockHeight = lines.length * fontSizePx * lineHeightRatio
    let y = h / 2 - blockHeight / 2 + (fontSizePx * lineHeightRatio) / 2 + 0.5
    for (const line of lines) {
      ctx.fillText(line, w / 2, y, maxTextWidth)
      y += fontSizePx * lineHeightRatio
    }

    backups.push({ node, html: node.innerHTML, cssText: node.style.cssText })
    node.style.height = `${h}px`
    node.style.lineHeight = '0'
    node.style.padding = '0'
    node.style.overflow = 'hidden'
    node.replaceChildren(canvas)
  }

  return () => {
    backups.forEach(({ node, html, cssText }) => {
      node.style.cssText = cssText
      node.innerHTML = html
    })
  }
}

/**
 * Capture one or more on-screen A4 pages to a multi-page PDF (library layouts).
 */
async function buildDomPagesPdf(pages: HTMLElement[]): Promise<InstanceType<typeof jsPDF>> {
  const usable = pages.filter(Boolean)
  if (!usable.length) throw new Error('Nothing to export')

  const restores: Array<() => void> = []
  try {
    for (const page of usable) {
      restores.push(await inlineDomImages(page))
      restores.push(rasterizeTranscriptTitleBars(page))
    }

    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < usable.length; i++) {
      const page = usable[i]
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 20000,
        scrollX: 0,
        scrollY: 0,
        onclone: (_doc, cloned) => {
          cloned.querySelectorAll('[data-transcript-stat-box]').forEach((el) => {
            const box = el as HTMLElement
            box.style.overflow = 'visible'
            box.style.paddingTop = '10px'
            box.style.paddingBottom = '10px'
            box.style.transform = 'none'
          })
          cloned.querySelectorAll('[data-transcript-stat-value]').forEach((el) => {
            const val = el as HTMLElement
            val.style.lineHeight = '1'
            val.style.margin = '0'
            val.style.padding = '0'
            val.style.transform = 'none'
            val.style.position = 'static'
          })
        },
      })
      const imgData = canvas.toDataURL('image/png')
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    }

    return pdf
  } finally {
    restores.forEach((fn) => {
      try {
        fn()
      } catch {
        /* ignore */
      }
    })
  }
}

async function printPdfBlob(pdfBlob: Blob) {
  const url = URL.createObjectURL(pdfBlob)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'Print document')
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
}

/**
 * Capture one or more on-screen A4 pages to a multi-page PDF (library layouts).
 */
export async function downloadDomPagesPdf(
  pages: HTMLElement[],
  filename: string,
): Promise<void> {
  const pdf = await buildDomPagesPdf(pages)
  pdf.save(filename)
}

/** Print the same captured pages used for Download PDF (works inside dialogs). */
export async function printDomPagesPdf(pages: HTMLElement[]): Promise<void> {
  const pdf = await buildDomPagesPdf(pages)
  await printPdfBlob(pdf.output('blob'))
}
