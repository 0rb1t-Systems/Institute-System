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
 * Capture one or more on-screen A4 pages to a multi-page PDF (library layouts).
 */
async function buildDomPagesPdf(pages: HTMLElement[]): Promise<InstanceType<typeof jsPDF>> {
  const usable = pages.filter(Boolean)
  if (!usable.length) throw new Error('Nothing to export')

  const restores: Array<() => void> = []
  try {
    for (const page of usable) {
      restores.push(await inlineDomImages(page))
    }

    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < usable.length; i++) {
      const canvas = await html2canvas(usable[i], {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 20000,
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
