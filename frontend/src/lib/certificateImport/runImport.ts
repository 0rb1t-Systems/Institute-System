import { analyzeCertificateDocx } from '@/lib/certificateImport/analyzeDocx'
import { analyzeCertificatePdf } from '@/lib/certificateImport/analyzePdf'
import { generateImportedTemplate } from '@/lib/certificateImport/generateTemplate'
import {
  CertificateImportError,
  type ImportBrand,
  type ImportProgress,
  type ImportSummary,
  type RawCertificateScan,
  type TextBlock,
} from '@/lib/certificateImport/types'
import { sanitizeScanTexts } from '@/lib/certificateImport/untangle'
import type { LogoBuilderDesign } from '@/lib/certificateBuilder'

const MAX_BYTES = 10 * 1024 * 1024

export type CertificateImportResult = {
  design: LogoBuilderDesign
  warnings: string[]
  summary: ImportSummary
  referenceTexts: TextBlock[]
  sourceKind: 'pdf' | 'docx'
}

async function sniff(file: File): Promise<'pdf' | 'docx' | 'doc' | 'unknown'> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf'
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'docx'
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return 'doc'
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.docx')) return 'docx'
  if (name.endsWith('.doc')) return 'doc'
  return 'unknown'
}

function summaryFrom(scan: RawCertificateScan, elementCount: number): ImportSummary {
  return {
    sourceKind: scan.sourceKind,
    scanned: scan.scanned,
    pageCount: scan.pageCount,
    page: scan.page,
    colors: scan.colors,
    counts: {
      texts: scan.texts.length,
      shapes: scan.shapes.length,
      elements: elementCount,
    },
  }
}

export async function runCertificateImport(
  file: File,
  brand: ImportBrand,
  onProgress: ImportProgress,
): Promise<CertificateImportResult> {
  if (!file || file.size <= 0) {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }
  if (file.size > MAX_BYTES) {
    throw new CertificateImportError(
      'TOO_LARGE',
      'This file is larger than 10 MB. Upload a smaller PDF or DOCX.',
    )
  }
  const kind = await sniff(file)
  if (kind === 'doc') {
    throw new CertificateImportError(
      'LEGACY_DOC',
      "Legacy Word .doc files can't be analyzed. Save the certificate as PDF or DOCX and upload that file.",
    )
  }
  if (kind !== 'pdf' && kind !== 'docx') {
    throw new CertificateImportError('UNSUPPORTED_TYPE', 'Upload a PDF, DOC, or DOCX certificate.')
  }

  const scan =
    kind === 'pdf'
      ? await analyzeCertificatePdf(file, brand, onProgress)
      : await analyzeCertificateDocx(file, brand, onProgress)

  onProgress('mapping')
  onProgress('generating')
  let generated: ReturnType<typeof generateImportedTemplate>
  try {
    generated = generateImportedTemplate(scan, brand)
  } catch {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }

  return {
    design: generated.design,
    warnings: generated.warnings,
    summary: summaryFrom(scan, generated.design.elements.length),
    referenceTexts: sanitizeScanTexts(scan.texts) as TextBlock[],
    sourceKind: kind,
  }
}
