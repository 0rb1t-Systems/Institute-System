/**
 * Certificate Upload / Import — independent of the Certificate Page Builder.
 * The uploaded file is an analysis source only. Generated templates are structured
 * elements and must not store the original PDF/DOCX as a background.
 */

export type ImportStageId =
  | 'reading'
  | 'layout'
  | 'typography'
  | 'colors'
  | 'decorations'
  | 'mapping'
  | 'generating'

export type ImportProgress = (stage: ImportStageId, detail?: string) => void

export type ImportBrand = {
  institutionName: string
  logoUrl: string | null
  sealUrl: string | null
  signatureUrl: string | null
  primary: string
  accent: string
  address: string
  email: string
  phone: string
  website: string
  motto: string
  leftName: string
  leftTitle: string
  rightName: string
  rightTitle: string
  footerText: string
}

export type TextAlign = 'left' | 'center' | 'right'

export type TextBlock = {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  align: TextAlign
  color: string
  letterSpacing: number
  lineHeight: number
}

export type ShapeKind =
  | 'border'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'logo'
  | 'seal'
  | 'signature'
  | 'qr'
  | 'photo'
  | 'decoration'

export type ShapeBlock = {
  kind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  fill?: string
  stroke?: string
  strokeWidth?: number
}

export type ColorPalette = {
  background: string
  text: string
  accent: string
  secondary: string
  border: string
  /** False when the file did not contain usable colors and institution colors were used. */
  fromDocument: boolean
}

export type PageGeometry = {
  width: number
  height: number
  orientation: 'portrait' | 'landscape'
  paperKey: string
  pageSizeLabel: string
  widthMm: number
  heightMm: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
}

export type FieldRole =
  | 'institutionName'
  | 'motto'
  | 'institutionAddress'
  | 'institutionEmail'
  | 'institutionPhone'
  | 'institutionWebsite'
  | 'studentName'
  | 'studentId'
  | 'programName'
  | 'className'
  | 'certificateNumber'
  | 'dateIssued'
  | 'completionMonth'
  | 'gpa'
  | 'leftTitle'
  | 'rightTitle'
  | 'leftName'
  | 'rightName'
  | 'title'
  | 'body'
  | 'footer'

export type ClassifiedText = TextBlock & { role: FieldRole }

export type RawCertificateScan = {
  sourceKind: 'pdf' | 'docx'
  page: PageGeometry
  colors: ColorPalette
  texts: TextBlock[]
  shapes: ShapeBlock[]
  warnings: string[]
  scanned: boolean
  pageCount: number
}

export type ImportSummary = {
  sourceKind: 'pdf' | 'docx'
  scanned: boolean
  pageCount: number
  page: PageGeometry
  colors: ColorPalette
  counts: { texts: number; shapes: number; elements: number }
}

export const IMPORT_STAGES: Array<{ id: ImportStageId; label: string }> = [
  { id: 'reading', label: 'Reading document…' },
  { id: 'layout', label: 'Detecting layout…' },
  { id: 'typography', label: 'Detecting typography…' },
  { id: 'colors', label: 'Detecting colors…' },
  { id: 'decorations', label: 'Detecting borders and decorations…' },
  { id: 'mapping', label: 'Mapping institution fields…' },
  { id: 'generating', label: 'Generating editable template…' },
]

export const PARTIAL_RECONSTRUCTION_MESSAGE =
  'Some design elements could not be reconstructed. The template was generated with the elements we could detect.'

export class CertificateImportError extends Error {
  readonly code: 'TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'LEGACY_DOC' | 'UNREADABLE'

  constructor(code: CertificateImportError['code'], message: string) {
    super(message)
    this.name = 'CertificateImportError'
    this.code = code
  }
}

export function importErrorMessage(err: unknown): string {
  if (err instanceof CertificateImportError) return err.message
  return "We couldn't analyze this certificate. Please try another PDF or DOCX file."
}
