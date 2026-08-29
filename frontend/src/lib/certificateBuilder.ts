import { getCertificatePatchMeta, rebuildCertificatePatch } from './certificatePatches'

/**
 * Logo / page builder + custom upload types for Certificate Management.
 * Designs are stored on document_templates.config (tenant-scoped via RLS/RPC).
 *
 * Rules:
 * - Keep tools few but capable (not a Word clone).
 * - Verification QR is optional (add only if the design needs the system verify link).
 * - Builder image elements store private storage paths (signed URLs resolved at render).
 */

/** System stacks first — indexes 0 and 4 are used by starter templates. Then OFL Google Fonts. */
export const BUILDER_FONT_FAMILIES = [
  'Georgia, serif',
  'Times New Roman, Times, serif',
  'Palatino Linotype, Book Antiqua, Palatino, serif',
  'Garamond, serif',
  'Arial, Helvetica, sans-serif',
  'Segoe UI, Tahoma, sans-serif',
  'Trebuchet MS, sans-serif',
  'Verdana, Geneva, sans-serif',
  'Courier New, Courier, monospace',
  'Impact, Charcoal, sans-serif',
  '"Playfair Display", Georgia, serif',
  '"Cormorant Garamond", Garamond, serif',
  '"EB Garamond", Garamond, serif',
  '"Libre Baskerville", Georgia, serif',
  '"Source Serif 4", Georgia, serif',
  '"Merriweather", Georgia, serif',
  '"Lora", Georgia, serif',
  '"Spectral", Georgia, serif',
  '"Cardo", Georgia, serif',
  '"Cinzel", Palatino, serif',
  '"Cinzel Decorative", Cinzel, Palatino, serif',
  '"Great Vibes", "Segoe Script", cursive',
  '"Allura", "Segoe Script", cursive',
  '"Tangerine", "Segoe Script", cursive',
  '"Pinyon Script", "Segoe Script", cursive',
  '"Italianno", "Segoe Script", cursive',
  '"Montserrat", Arial, sans-serif',
  '"DM Sans", Arial, sans-serif',
  '"Poppins", Arial, sans-serif',
  '"Josefin Sans", Arial, sans-serif',
  '"Crimson Text", Georgia, serif',
  '"Unna", Georgia, serif',
  '"Marcellus", Palatino, serif',
] as const

export function builderFontLabel(stack: string): string {
  return String(stack || '')
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim()
}

/** Dynamic fields users can bind to text — QR is system-managed separately. */
export const BUILDER_BINDINGS = [
  { key: 'none', label: 'Static text (free)' },
  { key: 'studentName', label: 'Student name' },
  { key: 'studentId', label: 'Student ID' },
  { key: 'startMonth', label: 'Start month' },
  { key: 'completionMonth', label: 'Completion month' },
  { key: 'programName', label: 'Course / program' },
  { key: 'className', label: 'Class name' },
  { key: 'certificateNumber', label: 'Document number' },
  { key: 'dateIssued', label: 'Date issued' },
  { key: 'institutionName', label: 'Institution name' },
  { key: 'leftName', label: 'Left signatory name' },
  { key: 'leftTitle', label: 'Left signatory title' },
  { key: 'rightName', label: 'Right signatory name' },
  { key: 'rightTitle', label: 'Right signatory title' },
  { key: 'verifyCode', label: 'Verification code' },
  { key: 'gpa', label: 'GPA' },
  { key: 'gradesSummary', label: 'Grades summary' },
  { key: 'invoiceNumber', label: 'Invoice number' },
  { key: 'totalDue', label: 'Total due' },
  { key: 'amountPaid', label: 'Amount paid' },
  { key: 'balance', label: 'Balance' },
  { key: 'lineItemsSummary', label: 'Fee line items' },
] as const

export type BuilderBinding = (typeof BUILDER_BINDINGS)[number]['key'] | 'qr'

export type DocumentBuilderKind = 'certificate' | 'transcript' | 'invoice'

/** Field chips shown in the page builder toolbar (document-specific). */
export function getDocumentBuilderQuickFields(
  kind: DocumentBuilderKind,
): Array<{ key: Exclude<BuilderBinding, 'qr' | 'none'>; label: string }> {
  if (kind === 'transcript') {
    return [
      { key: 'studentName', label: 'Student name' },
      { key: 'studentId', label: 'Student ID' },
      { key: 'startMonth', label: 'Start month' },
      { key: 'completionMonth', label: 'Completion month' },
      { key: 'programName', label: 'Program' },
      { key: 'className', label: 'Class' },
      { key: 'gpa', label: 'GPA' },
      { key: 'gradesSummary', label: 'Grades block' },
      { key: 'certificateNumber', label: 'Credential No.' },
      { key: 'dateIssued', label: 'Date' },
      { key: 'institutionName', label: 'Institution' },
      { key: 'verifyCode', label: 'Verify code' },
    ]
  }
  if (kind === 'invoice') {
    return [
      { key: 'studentName', label: 'Student name' },
      { key: 'studentId', label: 'Student ID' },
      { key: 'className', label: 'Class' },
      { key: 'invoiceNumber', label: 'Invoice No.' },
      { key: 'dateIssued', label: 'Invoice date' },
      { key: 'totalDue', label: 'Total due' },
      { key: 'amountPaid', label: 'Paid' },
      { key: 'balance', label: 'Balance' },
      { key: 'lineItemsSummary', label: 'Fee lines' },
      { key: 'institutionName', label: 'Institution' },
    ]
  }
  return [
    { key: 'studentName', label: 'Student name' },
    { key: 'studentId', label: 'Student ID' },
    { key: 'programName', label: 'Course / program' },
    { key: 'className', label: 'Class' },
    { key: 'certificateNumber', label: 'Cert No.' },
    { key: 'dateIssued', label: 'Date' },
    { key: 'gpa', label: 'Grade / GPA' },
    { key: 'institutionName', label: 'Institution' },
    { key: 'leftName', label: 'Left name' },
    { key: 'leftTitle', label: 'Left title' },
    { key: 'rightName', label: 'Right name' },
    { key: 'rightTitle', label: 'Right title' },
  ]
}

export type BuilderElementType = 'text' | 'image' | 'rect' | 'ellipse' | 'line'

export type BuilderElement = {
  id: string
  type: BuilderElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline'
  textAlign?: 'left' | 'center' | 'right'
  letterSpacing?: number
  lineHeight?: number
  color?: string
  fill?: string
  /** Optional linear fill for rect/ellipse (CSS). Ignored on decorative SVG. */
  fillGradient?: { from: string; to: string; angle?: number } | null
  stroke?: string
  strokeWidth?: number
  opacity?: number
  src?: string
  bind?: BuilderBinding
  /** Optional Layers-panel name (does not change printed text). */
  name?: string
  /** Locked elements cannot be moved/resized/deleted until unlocked. */
  locked?: boolean
  /** Hidden elements are omitted from canvas/PDF until shown again. */
  hidden?: boolean
  /**
   * Elements that visually belong together (e.g. a paragraph, logo cluster).
   * Groups move together until the user enters the group to edit individuals.
   */
  groupId?: string
  /** Ready decorative ornament key — allows recolor while keeping the shape. */
  decorKey?: string
  /** Ready certificate patch (ribbon/seal/badge) — text and colors are editable. */
  patchKey?: string
}

export type LogoBuilderDesign = {
  version: number
  canvas: { width: number; height: number; background?: string; paperKey?: string }
  elements: BuilderElement[]
}

export type CustomUploadMeta = {
  storage_path: string
  preview_path?: string | null
  file_name: string
  mime_type: string
  uploaded_at?: string
  /** width/height of template image — keeps paper sizing correct */
  aspect_ratio?: number | null
  /** Matched field positions on the uploaded design (percent 0–100). */
  field_layout?: UploadFieldLayout | null
  /** Editable text/cover layers extracted or drawn on the uploaded paper. */
  paper_layers?: PaperContentLayer[] | null
}

/** Student data slots matched onto an uploaded document design. */
export type UploadFieldKey =
  | 'studentName'
  | 'studentId'
  | 'programName'
  | 'certificateNumber'
  | 'dateIssued'
  | 'qr'
  | 'gpa'
  | 'gradesSummary'
  | 'totalDue'
  | 'amountPaid'
  | 'balance'
  | 'lineItemsSummary'

/** Editable block sitting on top of uploaded artwork (covers original pixels). */
export type PaperContentLayer = {
  id: string
  /** Percent of paper width/height */
  x: number
  y: number
  w: number
  h: number
  text: string
  fontSize: number
  color: string
  /** Opaque cover so original printed text is hidden */
  coverColor: string
  align?: 'left' | 'center' | 'right'
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  /** Optional live student/system binding */
  bind?: UploadFieldKey | 'none' | null
  enabled?: boolean
}

export function createPaperLayerId() {
  return `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function normalizePaperLayers(raw: unknown): PaperContentLayer[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((l) => l && typeof l === 'object')
    .map((l: any) => ({
      id: String(l.id || createPaperLayerId()),
      x: Math.min(100, Math.max(0, Number(l.x) || 0)),
      y: Math.min(100, Math.max(0, Number(l.y) || 0)),
      w: Math.min(100, Math.max(2, Number(l.w) || 10)),
      h: Math.min(100, Math.max(2, Number(l.h) || 4)),
      text: String(l.text ?? ''),
      fontSize: Math.min(72, Math.max(8, Number(l.fontSize) || 14)),
      color: String(l.color || '#0f172a'),
      coverColor: String(l.coverColor || '#ffffff'),
      align: l.align === 'left' || l.align === 'right' ? l.align : 'center',
      fontWeight: l.fontWeight === 'bold' ? 'bold' : 'normal',
      fontStyle: l.fontStyle === 'italic' ? 'italic' : 'normal',
      bind: l.bind || 'none',
      enabled: l.enabled !== false,
    }))
}

export type UploadFieldSlot = {
  key: UploadFieldKey
  /** left % of template width */
  x: number
  /** top % of template height */
  y: number
  /** width % of template */
  w: number
  /** height % of template (mainly for QR) */
  h: number
  fontSize: number
  color: string
  enabled: boolean
  align?: 'left' | 'center' | 'right'
}

export type UploadFieldLayout = {
  version: 1
  fields: UploadFieldSlot[]
}

export const UPLOAD_FIELD_LABELS: Record<UploadFieldKey, string> = {
  studentName: 'Student name',
  studentId: 'Student ID',
  programName: 'Program',
  certificateNumber: 'Certificate No.',
  dateIssued: 'Date issued',
  qr: 'Verification QR',
  gpa: 'GPA',
  gradesSummary: 'Grades block',
  totalDue: 'Total due',
  amountPaid: 'Amount paid',
  balance: 'Balance',
  lineItemsSummary: 'Fee line items',
}

/** Upload Own matcher labels — same slot keys, document-specific wording. */
export function getUploadFieldLabels(
  kind: DocumentBuilderKind = 'certificate',
): Partial<Record<UploadFieldKey, string>> {
  if (kind === 'transcript') {
    return {
      studentName: 'Student name',
      studentId: 'Student ID',
      programName: 'Program / class',
      certificateNumber: 'Credential No.',
      dateIssued: 'Date issued',
      gpa: 'GPA',
      gradesSummary: 'Grades block',
      qr: 'Verification QR',
    }
  }
  if (kind === 'invoice') {
    return {
      studentName: 'Student name',
      studentId: 'Student ID',
      programName: 'Class / description',
      certificateNumber: 'Invoice No.',
      dateIssued: 'Invoice date',
      lineItemsSummary: 'Fee lines',
      totalDue: 'Total due',
      amountPaid: 'Paid',
      balance: 'Balance',
    }
  }
  return {
    studentName: 'Student name',
    studentId: 'Student ID',
    programName: 'Program',
    certificateNumber: 'Certificate No.',
    dateIssued: 'Date issued',
    qr: 'Verification QR',
  }
}

/**
 * System fields that must stay on the uploaded design (can move/resize, cannot remove).
 * Others can be removed from the canvas and re-added later.
 */
export function getRequiredUploadFieldKeys(
  kind: DocumentBuilderKind = 'certificate',
): UploadFieldKey[] {
  if (kind === 'invoice') return ['studentName', 'certificateNumber', 'totalDue']
  if (kind === 'transcript') return ['studentName', 'certificateNumber']
  return ['studentName', 'certificateNumber']
}

export function isRequiredUploadField(
  key: UploadFieldKey,
  kind: DocumentBuilderKind = 'certificate',
): boolean {
  return getRequiredUploadFieldKeys(kind).includes(key)
}

/** Keys shown in the Upload Own matcher for each document type. */
export function getUploadFieldKeysForKind(kind: DocumentBuilderKind = 'certificate'): UploadFieldKey[] {
  return Object.keys(getUploadFieldLabels(kind)) as UploadFieldKey[]
}

/** True when src is a private certificate-templates storage path (not a public/signed URL). */
export function isPrivateCertStoragePath(src?: string | null): boolean {
  if (!src) return false
  const s = String(src).trim()
  if (!s || s.includes('..')) return false
  if (/^(https?:|blob:|data:)/i.test(s)) return false
  return s.includes('/')
}

/** Recover a private storage path from a raw path or a signed Supabase URL (legacy designs). */
export function extractCertStoragePath(src?: string | null): string | null {
  if (!src) return null
  const s = String(src).trim()
  if (!s || s.includes('..')) return null
  if (isPrivateCertStoragePath(s)) return s
  try {
    const u = new URL(s)
    const markers = [
      '/object/sign/certificate-templates/',
      '/object/authenticated/certificate-templates/',
      '/object/public/certificate-templates/',
    ]
    for (const marker of markers) {
      const idx = u.pathname.indexOf(marker)
      if (idx >= 0) {
        return decodeURIComponent(u.pathname.slice(idx + marker.length))
      }
    }
  } catch {
    /* not a URL */
  }
  return null
}

/** Default match positions after scanning upload aspect (no decorative chrome). */
export function createDefaultUploadFieldLayout(
  aspectRatio?: number | null,
  kind: DocumentBuilderKind = 'certificate',
): UploadFieldLayout {
  const landscape = (aspectRatio || 1) >= 1
  const base: UploadFieldSlot[] = [
    {
      key: 'studentName',
      x: 15,
      y: landscape ? 36 : 34,
      w: 70,
      h: 8,
      fontSize: landscape ? 36 : 30,
      color: '#111827',
      enabled: true,
      align: 'center',
    },
    {
      key: 'studentId',
      x: 30,
      y: landscape ? 44 : 42,
      w: 40,
      h: 4,
      fontSize: 11,
      color: '#6b7280',
      enabled: false,
      align: 'center',
    },
    {
      key: 'programName',
      x: 18,
      y: landscape ? 48 : 46,
      w: 64,
      h: 6,
      fontSize: landscape ? 14 : 13,
      color: '#374151',
      enabled: true,
      align: 'center',
    },
    {
      key: 'certificateNumber',
      x: 18,
      y: landscape ? 54 : 52,
      w: 40,
      h: 4,
      fontSize: 11,
      color: '#4b5563',
      enabled: true,
      align: 'center',
    },
    {
      key: 'dateIssued',
      x: 58,
      y: landscape ? 54 : 52,
      w: 24,
      h: 4,
      fontSize: 11,
      color: '#4b5563',
      enabled: true,
      align: 'center',
    },
  ]

  if (kind === 'transcript') {
    base.push(
      {
        key: 'gpa',
        x: 35,
        y: landscape ? 58 : 56,
        w: 30,
        h: 4,
        fontSize: 12,
        color: '#111827',
        enabled: true,
        align: 'center',
      },
      {
        key: 'gradesSummary',
        x: 12,
        y: landscape ? 64 : 62,
        w: 76,
        h: landscape ? 22 : 24,
        fontSize: 10,
        color: '#1e293b',
        enabled: true,
        align: 'left',
      },
      {
        key: 'qr',
        x: landscape ? 88 : 82,
        y: landscape ? 78 : 82,
        w: landscape ? 8 : 12,
        h: landscape ? 14 : 10,
        fontSize: 10,
        color: '#0f172a',
        enabled: true,
        align: 'center',
      },
    )
  } else if (kind === 'invoice') {
    base.push(
      {
        key: 'lineItemsSummary',
        x: 12,
        y: landscape ? 58 : 56,
        w: 76,
        h: landscape ? 16 : 18,
        fontSize: 11,
        color: '#1e293b',
        enabled: true,
        align: 'left',
      },
      {
        key: 'totalDue',
        x: 50,
        y: landscape ? 76 : 76,
        w: 38,
        h: 4,
        fontSize: 13,
        color: '#111827',
        enabled: true,
        align: 'right',
      },
      {
        key: 'amountPaid',
        x: 50,
        y: landscape ? 80 : 80,
        w: 38,
        h: 4,
        fontSize: 11,
        color: '#334155',
        enabled: true,
        align: 'right',
      },
      {
        key: 'balance',
        x: 50,
        y: landscape ? 84 : 84,
        w: 38,
        h: 4,
        fontSize: 11,
        color: '#334155',
        enabled: true,
        align: 'right',
      },
    )
  } else {
    base.push({
      key: 'qr',
      x: landscape ? 88 : 82,
      y: landscape ? 78 : 82,
      w: landscape ? 8 : 12,
      h: landscape ? 14 : 10,
      fontSize: 10,
      color: '#0f172a',
      enabled: true,
      align: 'center',
    })
  }

  const allowed = new Set(getUploadFieldKeysForKind(kind))
  return {
    version: 1,
    fields: base.filter((f) => allowed.has(f.key)),
  }
}

export function normalizeUploadFieldLayout(
  raw: unknown,
  aspectRatio?: number | null,
  kind: DocumentBuilderKind = 'certificate',
): UploadFieldLayout {
  const fallback = createDefaultUploadFieldLayout(aspectRatio, kind)
  if (!raw || typeof raw !== 'object') return fallback
  const fields = Array.isArray((raw as any).fields) ? (raw as any).fields : []
  if (!fields.length) return fallback

  const allowed = new Set(getUploadFieldKeysForKind(kind))
  const byKey = new Map<string, UploadFieldSlot>()
  for (const f of fields) {
    const key = String(f?.key || '') as UploadFieldKey
    if (!UPLOAD_FIELD_LABELS[key] || !allowed.has(key)) continue
    byKey.set(key, {
      key,
      x: Math.min(95, Math.max(0, Number(f.x) || 0)),
      y: Math.min(95, Math.max(0, Number(f.y) || 0)),
      w: Math.min(100, Math.max(4, Number(f.w) || 20)),
      h: Math.min(100, Math.max(3, Number(f.h) || 5)),
      fontSize: Math.min(72, Math.max(8, Number(f.fontSize) || 14)),
      color: String(f.color || '#111827'),
      enabled: f.enabled !== false,
      align: f.align === 'left' || f.align === 'right' ? f.align : 'center',
    })
  }

  // Keep known slots; append any saved extras that are allowed
  const merged = fallback.fields.map((d) => byKey.get(d.key) || d)
  for (const [key, slot] of byKey) {
    if (!merged.some((f) => f.key === key) && allowed.has(key as UploadFieldKey)) {
      merged.push(slot)
    }
  }

  return {
    version: 1,
    fields: merged,
  }
}

export const DEFAULT_BUILDER_CANVAS = {
  width: 794,
  height: 1123,
  background: '#ffffff',
  paperKey: 'a4-portrait',
}

/** Paper sizes the institution can choose when finishing a design. */
export const PAPER_SIZES = [
  {
    key: 'a4-portrait',
    label: 'A4 Portrait',
    width: 794,
    height: 1123,
    pdfOrientation: 'portrait' as const,
    pdfFormat: 'a4' as const,
    pdfWmm: 210,
    pdfHmm: 297,
  },
  {
    key: 'a4-landscape',
    label: 'A4 Landscape',
    width: 1123,
    height: 794,
    pdfOrientation: 'landscape' as const,
    pdfFormat: 'a4' as const,
    pdfWmm: 297,
    pdfHmm: 210,
  },
  {
    key: 'letter-portrait',
    label: 'Letter Portrait',
    width: 816,
    height: 1056,
    pdfOrientation: 'portrait' as const,
    pdfFormat: 'letter' as const,
    pdfWmm: 215.9,
    pdfHmm: 279.4,
  },
  {
    key: 'letter-landscape',
    label: 'Letter Landscape',
    width: 1056,
    height: 816,
    pdfOrientation: 'landscape' as const,
    pdfFormat: 'letter' as const,
    pdfWmm: 279.4,
    pdfHmm: 215.9,
  },
  {
    key: 'square',
    label: 'Square (logo sheet)',
    width: 800,
    height: 800,
    pdfOrientation: 'portrait' as const,
    pdfFormat: [210, 210] as unknown as 'a4',
    pdfWmm: 210,
    pdfHmm: 210,
  },
  {
    key: 'custom',
    label: 'Custom size',
    width: 794,
    height: 1123,
    pdfOrientation: 'portrait' as const,
    pdfFormat: 'a4' as const,
    pdfWmm: 210,
    pdfHmm: 297,
  },
] as const

export type PaperSizeKey = (typeof PAPER_SIZES)[number]['key']

export const SYSTEM_QR_ID = 'system_verification_qr'

export function createElementId() {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createGroupId(prefix = 'grp') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** Max elements persisted (must stay ≤ DB RPC limit). */
export const MAX_BUILDER_ELEMENTS = 180

export function getPaperSize(key?: string | null) {
  return PAPER_SIZES.find((p) => p.key === key) || PAPER_SIZES[0]
}

/** Optional verification QR — removable if the design already has its own QR artwork. */
export function createVerificationQrElement(canvas?: {
  width?: number
  height?: number
  background?: string
  paperKey?: string
}): BuilderElement {
  const width = canvas?.width || DEFAULT_BUILDER_CANVAS.width
  const height = canvas?.height || DEFAULT_BUILDER_CANVAS.height
  const size = 96
  return {
    id: SYSTEM_QR_ID,
    type: 'text',
    x: Math.max(16, width - size - 36),
    y: Math.max(16, height - size - 36),
    width: size,
    height: size,
    rotation: 0,
    zIndex: 9999,
    text: 'verification-qr',
    bind: 'qr',
    locked: false,
    color: '#0f172a',
    fill: '#ffffff',
  }
}

/** Free blank canvas — user builds freely; add verification QR only if needed. */
export function createDefaultBuilderDesign(): LogoBuilderDesign {
  const paper = PAPER_SIZES[0]
  return {
    version: 1,
    canvas: {
      width: paper.width,
      height: paper.height,
      background: '#ffffff',
      paperKey: paper.key,
    },
    elements: [],
  }
}

/** Marker text on the locked full-bleed uploaded paper image. */
export const UPLOAD_PAPER_MARKER = '__upload_paper__'

export function isUploadPaperElement(el?: BuilderElement | null): boolean {
  if (!el || el.type !== 'image') return false
  // Full-bleed paper from Upload Own (exact design match).
  return el.text === UPLOAD_PAPER_MARKER || el.text === 'background-art'
}

/**
 * Upload Own → template that LOOKS like the uploaded PDF (same design),
 * with data slots cleared on the artwork itself so live student/institution
 * data replaces sample text — no stacked white boxes on top of printed text.
 */
export function createDesignFromUploadedPaper(
  backgroundPath: string,
  aspectRatio?: number | null,
  kind: DocumentBuilderKind = 'certificate',
  options?: { slotsClearedOnPaper?: boolean },
): LogoBuilderDesign {
  const ar = aspectRatio && aspectRatio > 0 ? aspectRatio : 1.414
  const paperKey: PaperSizeKey = ar >= 1 ? 'a4-landscape' : 'a4-portrait'
  const paper = getPaperSize(paperKey)
  const w = paper.width
  const h = Math.max(400, Math.round(w / ar))
  const canvas = { width: w, height: h }
  const portrait = ar < 1.05
  const cleared = options?.slotsClearedOnPaper === true
  // Transparent when slots already cleared on the paper; white only as fallback cover
  const fill = cleared ? 'transparent' : '#ffffff'
  let z = 1

  const paperEl: BuilderElement = {
    id: createElementId(),
    type: 'image',
    x: 0,
    y: 0,
    width: w,
    height: h,
    rotation: 0,
    zIndex: 0,
    src: backgroundPath,
    opacity: 1,
    bind: 'none',
    locked: true,
    text: 'background-art',
  }

  const elements: BuilderElement[] = [paperEl]

  const field = (
    bind: Exclude<BuilderBinding, 'qr'>,
    overrides: Partial<BuilderElement> = {},
  ) =>
    createBoundTextElement(bind, canvas, {
      fill,
      zIndex: z++,
      locked: false,
      ...overrides,
    })

  /** Default data-slot rectangles (percent of canvas) for clearing + field placement. */
  const slots = getUploadDataSlots(w, h, kind, portrait)

  if (kind === 'invoice') {
    elements.push(
      field('studentName', { ...slots.studentName, fontSize: 28 }),
      field('invoiceNumber', {
        ...slots.certificateNumber,
        fontSize: 14,
        fontWeight: 'normal',
        fontStyle: 'normal',
      }),
      field('totalDue', {
        ...slots.dateIssued,
        fontSize: 16,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'right',
      }),
    )
  } else if (kind === 'transcript') {
    elements.push(
      field('studentName', { ...slots.studentName, fontSize: 28 }),
      field('programName', {
        ...slots.programName,
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'normal',
      }),
      field('certificateNumber', {
        ...slots.certificateNumber,
        fontSize: 12,
        textAlign: 'left',
        fontWeight: 'normal',
        fontStyle: 'normal',
      }),
      field('dateIssued', {
        ...slots.dateIssued,
        fontSize: 12,
        textAlign: 'right',
        fontWeight: 'normal',
        fontStyle: 'normal',
      }),
      {
        ...createVerificationQrElement(canvas),
        ...slots.qr,
        zIndex: z++,
        locked: false,
      },
    )
  } else {
    elements.push(
      field('programName', {
        ...slots.programName,
        fontSize: portrait ? 24 : 20,
        fontWeight: 'bold',
        fontStyle: 'italic',
        textAlign: 'center',
      }),
      field('studentName', {
        ...slots.studentName,
        fontSize: portrait ? 28 : 32,
        fontWeight: 'bold',
        fontStyle: 'italic',
      }),
      field('certificateNumber', {
        ...slots.certificateNumber,
        fontSize: 12,
        textAlign: 'left',
        fontWeight: 'normal',
        fontStyle: 'normal',
      }),
      field('dateIssued', {
        ...slots.dateIssued,
        fontSize: 12,
        textAlign: 'right',
        fontWeight: 'normal',
        fontStyle: 'normal',
      }),
      field('leftName', {
        ...slots.leftName,
        fontSize: 13,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
      }),
      field('rightName', {
        ...slots.rightName,
        fontSize: 13,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
      }),
      {
        ...createVerificationQrElement(canvas),
        ...slots.qr,
        zIndex: z++,
        locked: false,
      },
    )
  }

  return normalizeVerificationQr({
    version: 1,
    canvas: {
      width: w,
      height: h,
      background: '#ffffff',
      paperKey: paper.key,
    },
    elements,
  })
}

export type UploadDataSlot = { x: number; y: number; width: number; height: number }

/** Layout slots where sample PDF text is cleared and live data is placed. */
export function getUploadDataSlots(
  w: number,
  h: number,
  kind: DocumentBuilderKind,
  portrait = h > w,
): Record<string, UploadDataSlot> {
  if (kind === 'invoice') {
    return {
      studentName: { x: w * 0.12, y: h * 0.28, width: w * 0.76, height: 40 },
      programName: { x: w * 0.12, y: h * 0.4, width: w * 0.76, height: 36 },
      certificateNumber: { x: w * 0.12, y: h * 0.12, width: w * 0.4, height: 28 },
      dateIssued: { x: w * 0.45, y: h * 0.72, width: w * 0.43, height: 28 },
      leftName: { x: w * 0.1, y: h * 0.82, width: w * 0.3, height: 28 },
      rightName: { x: w * 0.6, y: h * 0.82, width: w * 0.3, height: 28 },
      qr: { x: Math.max(16, w - 120), y: 28, width: 88, height: 88 },
    }
  }
  if (kind === 'transcript') {
    return {
      studentName: { x: w * 0.12, y: h * 0.3, width: w * 0.76, height: 40 },
      programName: { x: w * 0.12, y: h * 0.4, width: w * 0.76, height: 36 },
      certificateNumber: { x: w * 0.12, y: h * 0.68, width: w * 0.4, height: 24 },
      dateIssued: { x: w * 0.52, y: h * 0.68, width: w * 0.36, height: 24 },
      leftName: { x: w * 0.1, y: h * 0.82, width: w * 0.3, height: 28 },
      rightName: { x: w * 0.6, y: h * 0.82, width: w * 0.3, height: 28 },
      qr: { x: Math.max(16, w - 120), y: 28, width: 88, height: 88 },
    }
  }
  // Certificate — Benadir-style portrait defaults
  return {
    programName: {
      x: w * 0.12,
      y: portrait ? h * 0.24 : h * 0.28,
      width: w * 0.76,
      height: portrait ? 70 : 48,
    },
    studentName: {
      x: w * 0.12,
      y: portrait ? h * 0.42 : h * 0.4,
      width: w * 0.76,
      height: 44,
    },
    certificateNumber: {
      x: w * 0.08,
      y: portrait ? h * 0.68 : h * 0.72,
      width: w * 0.42,
      height: 26,
    },
    dateIssued: {
      x: w * 0.52,
      y: portrait ? h * 0.68 : h * 0.72,
      width: w * 0.4,
      height: 26,
    },
    leftName: {
      x: w * 0.08,
      y: portrait ? h * 0.8 : h * 0.82,
      width: w * 0.32,
      height: 28,
    },
    rightName: {
      x: w * 0.6,
      y: portrait ? h * 0.8 : h * 0.82,
      width: w * 0.32,
      height: 28,
    },
    qr: {
      x: Math.max(16, w - 118),
      y: 24,
      width: 92,
      height: 92,
    },
  }
}

/**
 * Build a FULL constructed certificate (all elements: text, lines, bars, logo, seal, QR).
 * Styled to resemble a professional uploaded certificate (Benadir-style): institution
 * colors, green subtitle, course title, student name, seal, and signatory titles from Settings.
 */
export function createConstructedCertificateMatchingUpload(opts?: {
  aspectRatio?: number | null
  institutionName?: string
  subtitle?: string
  primary?: string
  accent?: string
  logoUrl?: string | null
  sealUrl?: string | null
  signatureUrl?: string | null
  leftTitle?: string
  rightTitle?: string
  leftName?: string
  rightName?: string
  kind?: DocumentBuilderKind
}): LogoBuilderDesign {
  const kind = opts?.kind || 'certificate'
  const arHint = opts?.aspectRatio && opts.aspectRatio > 0 ? opts.aspectRatio : null
  const orientKey: PaperSizeKey = arHint != null && arHint >= 1 ? 'a4-landscape' : 'a4-portrait'
  if (kind === 'transcript') {
    return createStarterTranscriptDesign(orientKey, opts)
  }
  if (kind === 'invoice') {
    return createStarterInvoiceDesign(orientKey, opts)
  }

  const ar = arHint && arHint > 0 ? arHint : 0.707
  const paperKey: PaperSizeKey = ar >= 1 ? 'a4-landscape' : 'a4-portrait'
  const paper = getPaperSize(paperKey)
  const w = paper.width
  const h = Math.max(520, Math.round(w / Math.max(0.55, Math.min(ar, 1.2))))
  // Match typical uploaded certificate palette (navy + institutional green)
  const primary = opts?.primary || '#1e40af'
  const accent = opts?.accent || '#15803d'
  const instName = String(opts?.institutionName || '').trim() || 'Institution Name'
  const subtitle = String(opts?.subtitle || '').trim()
  const leftTitle = String(opts?.leftTitle || '').trim() || 'Academic Registrar'
  const rightTitle = String(opts?.rightTitle || '').trim() || 'Principal'
  const leftName = String(opts?.leftName || '').trim()
  const rightName = String(opts?.rightName || '').trim()
  let z = 0
  const nextZ = () => {
    z += 1
    return z
  }

  const elements: BuilderElement[] = []

  // Soft page margin frame (subtle, like printed certificates)
  elements.push({
    id: createElementId(),
    type: 'rect',
    x: 22,
    y: 22,
    width: w - 44,
    height: h - 44,
    rotation: 0,
    zIndex: nextZ(),
    fill: 'transparent',
    stroke: primary,
    strokeWidth: 2,
    opacity: 0.35,
    bind: 'none',
    text: 'page-frame',
  })

  if (opts?.logoUrl) {
    elements.push({
      id: createElementId(),
      type: 'image',
      x: w * 0.08,
      y: h * 0.04,
      width: 68,
      height: 68,
      rotation: 0,
      zIndex: nextZ(),
      src: opts.logoUrl,
      opacity: 1,
      bind: 'none',
      text: 'logo',
      locked: false,
    })
  } else {
    // Name only when no logo (never both)
    elements.push(
      createBoundTextElement('institutionName', { width: w, height: h }, {
        x: w * 0.1,
        y: h * 0.045,
        width: w * 0.58,
        height: 36,
        fontSize: 20,
        fontWeight: 'bold',
        fontStyle: 'normal',
        fontFamily: BUILDER_FONT_FAMILIES[4],
        textAlign: 'left',
        color: primary,
        text: instName,
        zIndex: nextZ(),
      }),
    )
  }

  const headerX = opts?.logoUrl ? w * 0.2 : w * 0.1
  const headerW = opts?.logoUrl ? w * 0.48 : w * 0.58

  // Optional short motto only — never institution description
  if (subtitle) {
    elements.push({
      id: createElementId(),
      type: 'text',
      x: headerX,
      y: h * 0.09,
      width: headerW,
      height: 36,
      rotation: 0,
      zIndex: nextZ(),
      text: subtitle,
      fontFamily: BUILDER_FONT_FAMILIES[4],
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: accent,
      fill: 'transparent',
      opacity: 1,
      bind: 'none',
      locked: false,
    })
  }

  elements.push({
    ...createVerificationQrElement({ width: w, height: h }),
    x: Math.max(16, w - 108),
    y: h * 0.035,
    width: 82,
    height: 82,
    zIndex: nextZ(),
    locked: false,
  })

  // Header rule (blue, like uploaded)
  elements.push({
    id: createElementId(),
    type: 'line',
    x: w * 0.1,
    y: h * 0.16,
    width: w * 0.8,
    height: 3,
    rotation: 0,
    zIndex: nextZ(),
    stroke: primary,
    strokeWidth: 2,
    fill: primary,
    opacity: 1,
    bind: 'none',
    text: 'header-rule',
  })

  // Course / diploma — DYNAMIC
  elements.push(
    createBoundTextElement('programName', { width: w, height: h }, {
      x: w * 0.1,
      y: h * 0.2,
      width: w * 0.8,
      height: 64,
      fontSize: 24,
      fontWeight: 'bold',
      fontStyle: 'italic',
      textAlign: 'center',
      color: '#0f172a',
      zIndex: nextZ(),
    }),
  )

  elements.push({
    id: createElementId(),
    type: 'text',
    x: w * 0.15,
    y: h * 0.32,
    width: w * 0.7,
    height: 26,
    rotation: 0,
    zIndex: nextZ(),
    text: 'This is to certify that',
    fontFamily: BUILDER_FONT_FAMILIES[0],
    fontSize: 15,
    fontWeight: 'normal',
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#334155',
    fill: 'transparent',
    opacity: 1,
    bind: 'none',
    locked: false,
  })

  elements.push(
    createBoundTextElement('studentName', { width: w, height: h }, {
      x: w * 0.1,
      y: h * 0.37,
      width: w * 0.8,
      height: 46,
      fontSize: 30,
      fontWeight: 'bold',
      fontStyle: 'italic',
      textAlign: 'center',
      color: '#0f172a',
      zIndex: nextZ(),
    }),
  )

  // Green name underline (uploaded look)
  elements.push({
    id: createElementId(),
    type: 'line',
    x: w * 0.22,
    y: h * 0.44,
    width: w * 0.56,
    height: 2,
    rotation: 0,
    zIndex: nextZ(),
    stroke: accent,
    strokeWidth: 1.5,
    fill: accent,
    opacity: 1,
    bind: 'none',
    text: 'name-rule',
  })

  elements.push({
    id: createElementId(),
    type: 'text',
    x: w * 0.12,
    y: h * 0.47,
    width: w * 0.76,
    height: 88,
    rotation: 0,
    zIndex: nextZ(),
    text: 'has successfully completed the approved programme of study and passed the prescribed examinations under the authority of the academic board.',
    fontFamily: BUILDER_FONT_FAMILIES[0],
    fontSize: 13,
    fontWeight: 'normal',
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#334155',
    fill: 'transparent',
    opacity: 1,
    bind: 'none',
    locked: false,
  })

  // Cert No. label + value
  elements.push(
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.1,
      y: h * 0.6,
      width: w * 0.16,
      height: 22,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Cert No.',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 12,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#475569',
      fill: 'transparent',
      opacity: 1,
      bind: 'none',
      locked: false,
    },
    createBoundTextElement('certificateNumber', { width: w, height: h }, {
      x: w * 0.26,
      y: h * 0.6,
      width: w * 0.28,
      height: 22,
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#0f172a',
      zIndex: nextZ(),
    }),
    createBoundTextElement('dateIssued', { width: w, height: h }, {
      x: w * 0.55,
      y: h * 0.6,
      width: w * 0.35,
      height: 22,
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'right',
      color: '#0f172a',
      zIndex: nextZ(),
    }),
  )

  // Seal
  if (opts?.sealUrl) {
    elements.push({
      id: createElementId(),
      type: 'image',
      x: w * 0.5 - 52,
      y: h * 0.66,
      width: 104,
      height: 104,
      rotation: 0,
      zIndex: nextZ(),
      src: opts.sealUrl,
      opacity: 1,
      bind: 'none',
      text: 'institution-stamp',
      locked: false,
    })
  } else {
    const seal = createDecorativeShapeElement(
      'seal_ring',
      { width: w, height: h },
      { primary: accent, accent: primary },
    )
    elements.push({
      ...seal,
      x: w * 0.5 - 48,
      y: h * 0.68,
      width: 96,
      height: 96,
      zIndex: nextZ(),
      locked: false,
    })
  }

  if (opts?.signatureUrl) {
    elements.push({
      id: createElementId(),
      type: 'image',
      x: w * 0.12,
      y: h * 0.74,
      width: 130,
      height: 44,
      rotation: 0,
      zIndex: nextZ(),
      src: opts.signatureUrl,
      opacity: 1,
      bind: 'none',
      text: 'signature',
      locked: false,
    })
  }

  // Signature lines
  elements.push(
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.1,
      y: h * 0.82,
      width: w * 0.28,
      height: 2,
      rotation: 0,
      zIndex: nextZ(),
      stroke: primary,
      strokeWidth: 1,
      fill: primary,
      opacity: 1,
      bind: 'none',
      text: 'signature-line-left',
    },
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.62,
      y: h * 0.82,
      width: w * 0.28,
      height: 2,
      rotation: 0,
      zIndex: nextZ(),
      stroke: primary,
      strokeWidth: 1,
      fill: primary,
      opacity: 1,
      bind: 'none',
      text: 'signature-line-right',
    },
  )

  // Names (optional from settings) then TITLES from Settings (required)
  if (leftName) {
    elements.push(
      createBoundTextElement('leftName', { width: w, height: h }, {
        x: w * 0.1,
        y: h * 0.83,
        width: w * 0.28,
        height: 22,
        fontSize: 12,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
        color: primary,
        text: leftName,
        zIndex: nextZ(),
      }),
    )
  }
  if (rightName) {
    elements.push(
      createBoundTextElement('rightName', { width: w, height: h }, {
        x: w * 0.62,
        y: h * 0.83,
        width: w * 0.28,
        height: 22,
        fontSize: 12,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textAlign: 'center',
        color: primary,
        text: rightName,
        zIndex: nextZ(),
      }),
    )
  }

  elements.push(
    createBoundTextElement('leftTitle', { width: w, height: h }, {
      x: w * 0.1,
      y: leftName ? h * 0.865 : h * 0.835,
      width: w * 0.28,
      height: 24,
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#334155',
      text: leftTitle,
      zIndex: nextZ(),
    }),
    createBoundTextElement('rightTitle', { width: w, height: h }, {
      x: w * 0.62,
      y: rightName ? h * 0.865 : h * 0.835,
      width: w * 0.28,
      height: 24,
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#334155',
      text: rightTitle,
      zIndex: nextZ(),
    }),
  )

  // Footer bar — institution primary color
  elements.push({
    id: createElementId(),
    type: 'rect',
    x: 0,
    y: h - 26,
    width: w,
    height: 26,
    rotation: 0,
    zIndex: nextZ(),
    fill: primary,
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    bind: 'none',
    text: 'footer-bar',
  })

  return normalizeVerificationQr({
    version: 1,
    canvas: {
      width: w,
      height: h,
      background: '#ffffff',
      paperKey: paper.key,
    },
    elements,
  })
}

/**
 * Build a full constructed editable template from upload metadata (no image overlay).
 */
export async function buildTemplateFromUploadedCertificate(opts: {
  imageUrl?: string
  aspectRatio?: number | null
  kind?: DocumentBuilderKind
  uploadImageBlob?: (blob: Blob, fileName: string) => Promise<{ path: string }>
  institutionName?: string
  primary?: string
  accent?: string
  logoUrl?: string | null
  sealUrl?: string | null
  signatureUrl?: string | null
}): Promise<LogoBuilderDesign> {
  void opts.imageUrl
  void opts.uploadImageBlob
  return createConstructedCertificateMatchingUpload({
    aspectRatio: opts.aspectRatio,
    kind: opts.kind,
    institutionName: opts.institutionName,
    primary: opts.primary,
    accent: opts.accent,
    logoUrl: opts.logoUrl,
    sealUrl: opts.sealUrl,
    signatureUrl: opts.signatureUrl,
  })
}

/** True when this image is residual/base art from an upload decomposition. */
export function isBackgroundArtElement(el?: BuilderElement | null): boolean {
  if (!el || el.type !== 'image') return false
  const label = String(el.text || '')
  return label === 'background-art' || label === UPLOAD_PAPER_MARKER || isUploadPaperElement(el)
}

/** One-click bound text field for the certificate builder. */
export function createBoundTextElement(
  bind: Exclude<BuilderBinding, 'qr'>,
  canvas: { width: number; height: number },
  overrides: Partial<BuilderElement> = {},
): BuilderElement {
  const labels: Record<string, string> = {
    studentName: 'Student Name',
    studentId: 'Student ID',
    programName: 'Program / Course',
    className: 'Class Name',
    certificateNumber: 'Document No.',
    dateIssued: 'Date Issued',
    institutionName: 'Institution Name',
    leftName: 'Left Signatory Name',
    leftTitle: 'Left Signatory Title',
    rightName: 'Right Signatory Name',
    rightTitle: 'Right Signatory Title',
    verifyCode: 'Verification Code',
    gpa: 'GPA',
    gradesSummary: 'Course · Credits · Grade',
    invoiceNumber: 'Invoice No.',
    totalDue: 'Total Due',
    amountPaid: 'Amount Paid',
    balance: 'Balance',
    none: 'Text',
  }
  const isTitle = bind === 'studentName' || bind === 'institutionName'
  const isProgram = bind === 'programName'
  const base: BuilderElement = {
    id: createElementId(),
    type: 'text',
    x: canvas.width * 0.12,
    y: canvas.height * 0.4,
    width: canvas.width * 0.76,
    height: isTitle ? 56 : isProgram ? 40 : 36,
    rotation: 0,
    zIndex: 10,
    text: labels[bind] || 'Text',
    fontFamily: BUILDER_FONT_FAMILIES[0],
    fontSize: isTitle ? 36 : isProgram ? 20 : 16,
    fontWeight: isTitle ? 'bold' : 'normal',
    fontStyle: bind === 'studentName' ? 'italic' : 'normal',
    textAlign: 'center',
    color: '#0f172a',
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    bind,
  }
  return {
    ...base,
    ...overrides,
    id: overrides.id || base.id,
    bind,
  }
}

/**
 * Starter professional certificate layout — essential fields already placed
 * so the institution can finish (logo, stamp, colors) instead of starting blank.
 */
export function createStarterCertificateDesign(paperKey: PaperSizeKey = 'a4-portrait'): LogoBuilderDesign {
  const paper = getPaperSize(paperKey)
  const w = paper.width
  const h = paper.height
  const primary = '#002147'
  let z = 1
  const nextZ = () => {
    z += 1
    return z
  }

  const borderGroupId = createElementId()
  const borderOuter: BuilderElement = {
    id: createElementId(),
    type: 'rect',
    x: 28,
    y: 28,
    width: w - 56,
    height: h - 56,
    rotation: 0,
    zIndex: nextZ(),
    fill: 'transparent',
    stroke: primary,
    strokeWidth: 3,
    opacity: 1,
    bind: 'none',
    text: 'border-outer',
    groupId: borderGroupId,
  }
  const borderInner: BuilderElement = {
    id: createElementId(),
    type: 'rect',
    x: 40,
    y: 40,
    width: w - 80,
    height: h - 80,
    rotation: 0,
    zIndex: nextZ(),
    fill: 'transparent',
    stroke: '#c9a227',
    strokeWidth: 1,
    opacity: 1,
    bind: 'none',
    text: 'border-inner',
    groupId: borderGroupId,
  }

  const elements: BuilderElement[] = [
    borderOuter,
    borderInner,
    createBoundTextElement('institutionName', { width: w, height: h }, {
      y: h * 0.1,
      fontSize: 22,
      fontWeight: 'bold',
      color: primary,
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.15,
      y: h * 0.18,
      width: w * 0.7,
      height: 40,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Certificate of Completion',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 28,
      fontWeight: 'bold',
      fontStyle: 'italic',
      textAlign: 'center',
      color: primary,
      opacity: 1,
      bind: 'none',
    },
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.2,
      y: h * 0.28,
      width: w * 0.6,
      height: 28,
      rotation: 0,
      zIndex: nextZ(),
      text: 'This is to certify that',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 14,
      fontWeight: 'normal',
      fontStyle: 'italic',
      textAlign: 'center',
      color: '#64748b',
      opacity: 1,
      bind: 'none',
    },
    createBoundTextElement('studentName', { width: w, height: h }, {
      y: h * 0.34,
      fontSize: 40,
      color: primary,
      zIndex: nextZ(),
    }),
    createBoundTextElement('programName', { width: w, height: h }, {
      y: h * 0.44,
      fontSize: 18,
      color: '#334155',
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.15,
      y: h * 0.5,
      width: w * 0.7,
      height: 72,
      rotation: 0,
      zIndex: nextZ(),
      text: 'has successfully completed the approved programme of study and met all academic requirements.',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 13,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#64748b',
      opacity: 1,
      bind: 'none',
    },
    createBoundTextElement('certificateNumber', { width: w, height: h }, {
      x: w * 0.12,
      y: h * 0.68,
      width: w * 0.35,
      height: 28,
      fontSize: 12,
      textAlign: 'left',
      color: '#475569',
      zIndex: nextZ(),
    }),
    createBoundTextElement('dateIssued', { width: w, height: h }, {
      x: w * 0.53,
      y: h * 0.68,
      width: w * 0.35,
      height: 28,
      fontSize: 12,
      textAlign: 'right',
      color: '#475569',
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.12,
      y: h * 0.8,
      width: w * 0.28,
      height: 3,
      rotation: 0,
      zIndex: nextZ(),
      stroke: primary,
      strokeWidth: 2,
      fill: primary,
      opacity: 1,
      bind: 'none',
      text: 'signature-line-left',
    },
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.6,
      y: h * 0.8,
      width: w * 0.28,
      height: 3,
      rotation: 0,
      zIndex: nextZ(),
      stroke: primary,
      strokeWidth: 2,
      fill: primary,
      opacity: 1,
      bind: 'none',
      text: 'signature-line-right',
    },
    // Signatory names from Institution Settings (place/move freely on the page)
    createBoundTextElement('leftName', { width: w, height: h }, {
      x: w * 0.12,
      y: h * 0.82,
      width: w * 0.28,
      height: 28,
      fontSize: 14,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'center',
      color: primary,
      zIndex: nextZ(),
    }),
    createBoundTextElement('rightName', { width: w, height: h }, {
      x: w * 0.6,
      y: h * 0.82,
      width: w * 0.28,
      height: 28,
      fontSize: 14,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'center',
      color: primary,
      zIndex: nextZ(),
    }),
    // QR is optional — add via toolbar “Verification QR” only if needed
  ]

  return normalizeVerificationQr({
    version: 1,
    canvas: {
      width: w,
      height: h,
      background: '#ffffff',
      paperKey: paper.key,
    },
    elements,
  })
}

/** Branding applied when Upload Own / Page Builder builds a constructed document. */
export type DocumentBrandOpts = {
  institutionName?: string
  subtitle?: string
  primary?: string
  accent?: string
  logoUrl?: string | null
  sealUrl?: string | null
  signatureUrl?: string | null
  leftTitle?: string
  rightTitle?: string
  leftName?: string
  rightName?: string
  aspectRatio?: number | null
}

function canvasSizeForUpload(
  paperKey: PaperSizeKey,
  aspectRatio?: number | null,
): { w: number; h: number; paper: ReturnType<typeof getPaperSize> } {
  const paper = getPaperSize(paperKey)
  const w = paper.width
  const ar = aspectRatio && aspectRatio > 0 ? aspectRatio : paper.width / paper.height
  const h = Math.max(520, Math.round(w / Math.max(0.45, Math.min(ar, 2.2))))
  return { w, h, paper }
}

/** Official academic transcript — full editable layers (Upload Own / starter). */
export function createStarterTranscriptDesign(
  paperKey: PaperSizeKey = 'a4-portrait',
  brand?: DocumentBrandOpts,
): LogoBuilderDesign {
  const { w, h, paper } = canvasSizeForUpload(paperKey, brand?.aspectRatio)
  const primary = brand?.primary || '#0f172a'
  const accent = brand?.accent || '#15803d'
  const instName = String(brand?.institutionName || '').trim() || 'Institution Name'
  const leftTitle = String(brand?.leftTitle || '').trim() || 'Academic Registrar'
  const rightTitle = String(brand?.rightTitle || '').trim() || 'Principal'
  const leftName = String(brand?.leftName || '').trim()
  const rightName = String(brand?.rightName || '').trim()
  let z = 1
  const nextZ = () => {
    z += 1
    return z
  }

  const elements: BuilderElement[] = [
    {
      id: createElementId(),
      type: 'rect',
      x: 32,
      y: 32,
      width: w - 64,
      height: h - 64,
      rotation: 0,
      zIndex: nextZ(),
      fill: 'transparent',
      stroke: primary,
      strokeWidth: 2,
      opacity: 1,
      bind: 'none',
      text: 'transcript-frame',
    },
  ]

  if (brand?.logoUrl) {
    elements.push({
      id: createElementId(),
      type: 'image',
      x: w * 0.12,
      y: h * 0.045,
      width: 56,
      height: 56,
      rotation: 0,
      zIndex: nextZ(),
      src: brand.logoUrl,
      opacity: 1,
      bind: 'none',
      text: 'logo',
      locked: false,
    })
  } else {
    elements.push(
      createBoundTextElement('institutionName', { width: w, height: h }, {
        x: w * 0.12,
        y: h * 0.055,
        width: w * 0.76,
        height: 32,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        color: primary,
        text: instName,
        zIndex: nextZ(),
      }),
    )
  }

  elements.push(
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: h * 0.115,
      width: w * 0.76,
      height: 36,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Official Academic Transcript',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 22,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'center',
      color: primary,
      opacity: 1,
      bind: 'none',
      locked: false,
    },
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.12,
      y: h * 0.155,
      width: w * 0.76,
      height: 2,
      rotation: 0,
      zIndex: nextZ(),
      stroke: accent,
      strokeWidth: 2,
      fill: accent,
      opacity: 1,
      bind: 'none',
      text: 'header-rule',
    },
    createBoundTextElement('studentName', { width: w, height: h }, {
      x: w * 0.12,
      y: h * 0.18,
      width: w * 0.5,
      height: 28,
      fontSize: 16,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      color: primary,
      zIndex: nextZ(),
    }),
    createBoundTextElement('studentId', { width: w, height: h }, {
      x: w * 0.55,
      y: h * 0.18,
      width: w * 0.33,
      height: 28,
      fontSize: 13,
      textAlign: 'right',
      color: '#334155',
      zIndex: nextZ(),
    }),
    createBoundTextElement('programName', { width: w, height: h }, {
      x: w * 0.12,
      y: h * 0.22,
      width: w * 0.76,
      height: 26,
      fontSize: 14,
      textAlign: 'left',
      color: '#334155',
      zIndex: nextZ(),
    }),
    createBoundTextElement('className', { width: w, height: h }, {
      x: w * 0.12,
      y: h * 0.255,
      width: w * 0.5,
      height: 24,
      fontSize: 13,
      textAlign: 'left',
      color: '#475569',
      zIndex: nextZ(),
    }),
    createBoundTextElement('gpa', { width: w, height: h }, {
      x: w * 0.55,
      y: h * 0.255,
      width: w * 0.33,
      height: 24,
      fontSize: 13,
      fontWeight: 'bold',
      textAlign: 'right',
      color: primary,
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: h * 0.3,
      width: w * 0.76,
      height: 22,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Course                              Credits    Grade',
      fontFamily: 'Courier New, Courier, monospace',
      fontSize: 12,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      color: primary,
      opacity: 1,
      bind: 'none',
      locked: false,
    },
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.12,
      y: h * 0.325,
      width: w * 0.76,
      height: 1,
      rotation: 0,
      zIndex: nextZ(),
      stroke: '#94a3b8',
      strokeWidth: 1,
      fill: '#94a3b8',
      opacity: 1,
      bind: 'none',
      text: 'grades-header-rule',
    },
    createBoundTextElement('gradesSummary', { width: w, height: h }, {
      x: w * 0.12,
      y: h * 0.34,
      width: w * 0.76,
      height: h * 0.32,
      fontSize: 12,
      fontFamily: 'Courier New, Courier, monospace',
      textAlign: 'left',
      color: '#1e293b',
      zIndex: nextZ(),
    }),
    createBoundTextElement('certificateNumber', { width: w, height: h }, {
      x: w * 0.12,
      y: h * 0.72,
      width: w * 0.4,
      height: 24,
      fontSize: 12,
      textAlign: 'left',
      color: '#475569',
      zIndex: nextZ(),
    }),
    createBoundTextElement('dateIssued', { width: w, height: h }, {
      x: w * 0.48,
      y: h * 0.72,
      width: w * 0.4,
      height: 24,
      fontSize: 12,
      textAlign: 'right',
      color: '#475569',
      zIndex: nextZ(),
    }),
  )

  if (brand?.signatureUrl) {
    elements.push({
      id: createElementId(),
      type: 'image',
      x: w * 0.14,
      y: h * 0.76,
      width: 90,
      height: 36,
      rotation: 0,
      zIndex: nextZ(),
      src: brand.signatureUrl,
      opacity: 1,
      bind: 'none',
      text: 'signature',
      locked: false,
    })
  }

  elements.push(
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.12,
      y: h * 0.82,
      width: w * 0.28,
      height: 2,
      rotation: 0,
      zIndex: nextZ(),
      stroke: primary,
      strokeWidth: 2,
      fill: primary,
      opacity: 1,
      bind: 'none',
      text: 'signature-line-left',
    },
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.6,
      y: h * 0.82,
      width: w * 0.28,
      height: 2,
      rotation: 0,
      zIndex: nextZ(),
      stroke: primary,
      strokeWidth: 2,
      fill: primary,
      opacity: 1,
      bind: 'none',
      text: 'signature-line-right',
    },
    createBoundTextElement('leftName', { width: w, height: h }, {
      x: w * 0.12,
      y: h * 0.84,
      width: w * 0.28,
      height: 22,
      fontSize: 12,
      fontWeight: 'bold',
      textAlign: 'center',
      color: primary,
      text: leftName || 'Authorized Signatory',
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: h * 0.865,
      width: w * 0.28,
      height: 20,
      rotation: 0,
      zIndex: nextZ(),
      text: leftTitle,
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 11,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#64748b',
      opacity: 1,
      bind: 'none',
      locked: false,
    },
    createBoundTextElement('rightName', { width: w, height: h }, {
      x: w * 0.6,
      y: h * 0.84,
      width: w * 0.28,
      height: 22,
      fontSize: 12,
      fontWeight: 'bold',
      textAlign: 'center',
      color: primary,
      text: rightName || 'Authorized Signatory',
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.6,
      y: h * 0.865,
      width: w * 0.28,
      height: 20,
      rotation: 0,
      zIndex: nextZ(),
      text: rightTitle,
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 11,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#64748b',
      opacity: 1,
      bind: 'none',
      locked: false,
    },
    {
      ...createVerificationQrElement({ width: w, height: h }),
      x: Math.max(16, w - 100),
      y: h * 0.045,
      width: 72,
      height: 72,
      zIndex: nextZ(),
      locked: false,
    },
  )

  return normalizeVerificationQr({
    version: 1,
    canvas: { width: w, height: h, background: '#ffffff', paperKey: paper.key },
    elements,
  })
}

/** Fee invoice / statement — full editable layers (Upload Own / starter). */
export function createStarterInvoiceDesign(
  paperKey: PaperSizeKey = 'a4-portrait',
  brand?: DocumentBrandOpts,
): LogoBuilderDesign {
  const { w, h, paper } = canvasSizeForUpload(paperKey, brand?.aspectRatio)
  const primary = brand?.primary || '#0f172a'
  const accent = brand?.accent || '#b45309'
  const instName = String(brand?.institutionName || '').trim() || 'Institution Name'
  let z = 1
  const nextZ = () => {
    z += 1
    return z
  }

  const elements: BuilderElement[] = [
    {
      id: createElementId(),
      type: 'rect',
      x: 0,
      y: 0,
      width: w,
      height: 72,
      rotation: 0,
      zIndex: nextZ(),
      fill: primary,
      stroke: primary,
      strokeWidth: 0,
      opacity: 1,
      bind: 'none',
      text: 'invoice-header-band',
    },
  ]

  if (brand?.logoUrl) {
    elements.push({
      id: createElementId(),
      type: 'image',
      x: 28,
      y: 12,
      width: 48,
      height: 48,
      rotation: 0,
      zIndex: nextZ(),
      src: brand.logoUrl,
      opacity: 1,
      bind: 'none',
      text: 'logo',
      locked: false,
    })
  } else {
    elements.push(
      createBoundTextElement('institutionName', { width: w, height: h }, {
        x: w * 0.12,
        y: 22,
        width: w * 0.76,
        height: 32,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'left',
        color: '#ffffff',
        text: instName,
        zIndex: nextZ(),
      }),
    )
  }

  elements.push(
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: 96,
      width: w * 0.4,
      height: 32,
      rotation: 0,
      zIndex: nextZ(),
      text: 'INVOICE',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 26,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      color: primary,
      opacity: 1,
      bind: 'none',
      locked: false,
    },
    createBoundTextElement('invoiceNumber', { width: w, height: h }, {
      x: w * 0.5,
      y: 96,
      width: w * 0.38,
      height: 24,
      fontSize: 13,
      textAlign: 'right',
      color: '#334155',
      zIndex: nextZ(),
    }),
    createBoundTextElement('dateIssued', { width: w, height: h }, {
      x: w * 0.5,
      y: 122,
      width: w * 0.38,
      height: 22,
      fontSize: 12,
      textAlign: 'right',
      color: '#64748b',
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: 160,
      width: w * 0.4,
      height: 20,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Bill to',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 11,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#64748b',
      opacity: 1,
      bind: 'none',
      locked: false,
    },
    createBoundTextElement('studentName', { width: w, height: h }, {
      x: w * 0.12,
      y: 182,
      width: w * 0.5,
      height: 28,
      fontSize: 16,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      color: primary,
      zIndex: nextZ(),
    }),
    createBoundTextElement('studentId', { width: w, height: h }, {
      x: w * 0.12,
      y: 212,
      width: w * 0.4,
      height: 22,
      fontSize: 12,
      textAlign: 'left',
      color: '#475569',
      zIndex: nextZ(),
    }),
    createBoundTextElement('className', { width: w, height: h }, {
      x: w * 0.12,
      y: 236,
      width: w * 0.6,
      height: 22,
      fontSize: 12,
      textAlign: 'left',
      color: '#475569',
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: 280,
      width: w * 0.76,
      height: 22,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Description                                         Amount',
      fontFamily: 'Courier New, Courier, monospace',
      fontSize: 12,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      color: primary,
      opacity: 1,
      bind: 'none',
      locked: false,
    },
    {
      id: createElementId(),
      type: 'line',
      x: w * 0.12,
      y: 304,
      width: w * 0.76,
      height: 1,
      rotation: 0,
      zIndex: nextZ(),
      stroke: '#cbd5e1',
      strokeWidth: 1,
      fill: '#cbd5e1',
      opacity: 1,
      bind: 'none',
      text: 'fees-rule',
    },
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: 320,
      width: w * 0.76,
      height: 120,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Registration Fee                            25.00\nTuition Fee — current month                150.00',
      fontFamily: 'Courier New, Courier, monospace',
      fontSize: 12,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#1e293b',
      opacity: 1,
      bind: 'lineItemsSummary',
      locked: false,
    },
    createBoundTextElement('totalDue', { width: w, height: h }, {
      x: w * 0.45,
      y: h * 0.58,
      width: w * 0.43,
      height: 28,
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'right',
      color: primary,
      zIndex: nextZ(),
    }),
    createBoundTextElement('amountPaid', { width: w, height: h }, {
      x: w * 0.45,
      y: h * 0.62,
      width: w * 0.43,
      height: 24,
      fontSize: 13,
      textAlign: 'right',
      color: '#334155',
      zIndex: nextZ(),
    }),
    createBoundTextElement('balance', { width: w, height: h }, {
      x: w * 0.45,
      y: h * 0.66,
      width: w * 0.43,
      height: 24,
      fontSize: 13,
      fontWeight: 'bold',
      textAlign: 'right',
      color: accent,
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: h * 0.82,
      width: w * 0.76,
      height: 40,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Thank you for your payment. Keep this statement for your records.',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 11,
      fontWeight: 'normal',
      fontStyle: 'italic',
      textAlign: 'center',
      color: '#64748b',
      opacity: 1,
      bind: 'none',
      locked: false,
    },
  )

  return normalizeVerificationQr({
    version: 1,
    canvas: { width: w, height: h, background: '#ffffff', paperKey: paper.key },
    elements,
  })
}

/** Pick the correct starter layout for certificate / transcript / invoice. */
export function createStarterDocumentDesign(
  kind: DocumentBuilderKind,
  paperKey: PaperSizeKey = 'a4-portrait',
): LogoBuilderDesign {
  if (kind === 'transcript') return createStarterTranscriptDesign(paperKey)
  if (kind === 'invoice') return createStarterInvoiceDesign(paperKey)
  return createStarterCertificateDesign(paperKey)
}

/** Double border frame for the current canvas. */
export function createBorderFrameElements(canvas: {
  width: number
  height: number
}, primary = '#002147', accent = '#c9a227'): BuilderElement[] {
  const w = canvas.width
  const h = canvas.height
  const groupId = createElementId()
  return [
    {
      id: createElementId(),
      type: 'rect',
      x: 24,
      y: 24,
      width: w - 48,
      height: h - 48,
      rotation: 0,
      zIndex: 1,
      fill: 'transparent',
      stroke: primary,
      strokeWidth: 3,
      opacity: 1,
      bind: 'none',
      text: 'border-outer',
      groupId,
    },
    {
      id: createElementId(),
      type: 'rect',
      x: 36,
      y: 36,
      width: w - 72,
      height: h - 72,
      rotation: 0,
      zIndex: 2,
      fill: 'transparent',
      stroke: accent,
      strokeWidth: 1,
      opacity: 1,
      bind: 'none',
      text: 'border-inner',
      groupId,
    },
  ]
}

/** Ready decorative ornaments for certificates. */
export const DECORATIVE_SHAPE_CATEGORIES = [
  { id: 'borders', label: 'Borders & frames' },
  { id: 'lines', label: 'Lines & rules' },
  { id: 'headers', label: 'Header ornaments' },
  { id: 'guilloche', label: 'Guilloche patterns' },
  { id: 'watermarks', label: 'Watermarks' },
  { id: 'geometric', label: 'Geometric patterns' },
  { id: 'flourishes', label: 'Flourishes & swashes' },
  { id: 'dividers', label: 'Decorative dividers' },
  { id: 'badges', label: 'Badges, seals & emblems' },
  { id: 'corners', label: 'Corner ornaments' },
  { id: 'modern', label: 'Modern accents' },
] as const

export const DECORATIVE_SHAPES = [
  { key: 'border_classic_double', label: 'Classic double frame', category: 'borders', size: 0, fullPage: true },
  { key: 'border_gold_ornate', label: 'Ornate gold frame', category: 'borders', size: 0, fullPage: true },
  { key: 'border_navy_block', label: 'Navy corner blocks', category: 'borders', size: 0, fullPage: true },
  { key: 'border_elegant_thin', label: 'Elegant thin frame', category: 'borders', size: 0, fullPage: true },
  { key: 'border_maroon_gold', label: 'Maroon & gold frame', category: 'borders', size: 0, fullPage: true },
  { key: 'border_green_filigree', label: 'Green filigree frame', category: 'borders', size: 0, fullPage: true },
  { key: 'line_double_rule', label: 'Double rule', category: 'lines', size: 280 },
  { key: 'line_triple_rule', label: 'Triple rule', category: 'lines', size: 280 },
  { key: 'line_ornate_rule', label: 'Ornate rule', category: 'lines', size: 280 },
  { key: 'line_dashed', label: 'Dashed rule', category: 'lines', size: 280 },
  { key: 'line_vertical', label: 'Vertical rule', category: 'lines', size: 36 },
  { key: 'line_bracket', label: 'Bracket rule', category: 'lines', size: 260 },
  { key: 'header_pediment', label: 'Classic pediment', category: 'headers', size: 300 },
  { key: 'header_greek_key', label: 'Greek-key header', category: 'headers', size: 300 },
  { key: 'header_crest_bar', label: 'Crest header bar', category: 'headers', size: 300 },
  { key: 'header_sunburst', label: 'Sunburst header', category: 'headers', size: 300 },
  { key: 'header_banner', label: 'Ribbon header', category: 'headers', size: 300 },
  { key: 'guilloche_rosette', label: 'Guilloche rosette', category: 'guilloche', size: 160 },
  { key: 'guilloche_oval', label: 'Guilloche oval', category: 'guilloche', size: 220 },
  { key: 'guilloche_border', label: 'Guilloche border', category: 'guilloche', size: 0, fullPage: true },
  { key: 'guilloche_engine', label: 'Engine-turned disc', category: 'guilloche', size: 150 },
  { key: 'watermark_seal', label: 'Seal watermark', category: 'watermarks', size: 0, fullPage: true, watermark: true },
  { key: 'watermark_diamond', label: 'Diamond watermark', category: 'watermarks', size: 0, fullPage: true, watermark: true },
  { key: 'watermark_laurel', label: 'Laurel watermark', category: 'watermarks', size: 0, fullPage: true, watermark: true },
  { key: 'watermark_grid', label: 'Security grid', category: 'watermarks', size: 0, fullPage: true, watermark: true },
  { key: 'geo_greek_key', label: 'Greek key band', category: 'geometric', size: 280 },
  { key: 'geo_chevrons', label: 'Chevron band', category: 'geometric', size: 280 },
  { key: 'geo_diamonds', label: 'Diamond lattice', category: 'geometric', size: 220 },
  { key: 'geo_hex', label: 'Hex motif', category: 'geometric', size: 140 },
  { key: 'geo_triangles', label: 'Triangle row', category: 'geometric', size: 260 },
  { key: 'flourish_scroll', label: 'Scroll flourish', category: 'flourishes', size: 200 },
  { key: 'flourish_swash_left', label: 'Swash left', category: 'flourishes', size: 160 },
  { key: 'flourish_swash_right', label: 'Swash right', category: 'flourishes', size: 160 },
  { key: 'flourish_vine', label: 'Vine flourish', category: 'flourishes', size: 220 },
  { key: 'flourish_ampersand', label: 'Calligraphic swirl', category: 'flourishes', size: 90 },
  { key: 'ribbon', label: 'Ribbon banner', category: 'dividers', size: 240 },
  { key: 'divider_ornate', label: 'Ornate divider', category: 'dividers', size: 280 },
  { key: 'divider_diamond', label: 'Diamond divider', category: 'dividers', size: 260 },
  { key: 'divider_dots', label: 'Dotted divider', category: 'dividers', size: 260 },
  { key: 'divider_laurel', label: 'Laurel divider', category: 'dividers', size: 240 },
  { key: 'crown', label: 'Crown', category: 'dividers', size: 80 },
  { key: 'stars_row', label: 'Stars row', category: 'dividers', size: 180 },
  { key: 'medal_gold', label: 'Gold medal + ribbon', category: 'badges', size: 120 },
  { key: 'medal_navy', label: 'Navy medal + ribbon', category: 'badges', size: 120 },
  { key: 'seal_wax', label: 'Wax seal', category: 'badges', size: 100 },
  { key: 'seal_scallop', label: 'Scalloped seal', category: 'badges', size: 110 },
  { key: 'seal_ring', label: 'Ring seal', category: 'badges', size: 110 },
  { key: 'seal_sunburst', label: 'Sunburst medallion', category: 'badges', size: 130 },
  { key: 'star_badge', label: 'Star badge', category: 'badges', size: 100 },
  { key: 'laurel', label: 'Laurel wreath', category: 'badges', size: 130 },
  { key: 'laurel_star', label: 'Laurel + star', category: 'badges', size: 120 },
  { key: 'rosette', label: 'Rosette', category: 'badges', size: 100 },
  { key: 'diamond_seal', label: 'Diamond seal', category: 'badges', size: 90 },
  { key: 'emblem_shield', label: 'Shield emblem', category: 'badges', size: 110 },
  { key: 'emblem_cross', label: 'Cross medallion', category: 'badges', size: 100 },
  { key: 'corner_flourish', label: 'Corner flourish', category: 'corners', size: 90 },
  { key: 'corner_filigree', label: 'Corner filigree', category: 'corners', size: 100 },
  { key: 'corner_geometric', label: 'Corner geometric', category: 'corners', size: 90 },
  { key: 'corner_floral', label: 'Corner floral', category: 'corners', size: 95 },
  { key: 'corner_celtic', label: 'Corner celtic', category: 'corners', size: 90 },
  { key: 'modern_wave_top', label: 'Wave header', category: 'modern', size: 0, fullPage: true },
  { key: 'modern_side_bar', label: 'Side accent bar', category: 'modern', size: 0, fullPage: true },
  { key: 'modern_corner_sweep', label: 'Corner sweep', category: 'modern', size: 180 },
  { key: 'modern_arch', label: 'Arch accent', category: 'modern', size: 220 },
] as const

export type DecorativeShapeKey = (typeof DECORATIVE_SHAPES)[number]['key']

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`
}

export function isDecorativeElement(el: BuilderElement | null | undefined): boolean {
  return !!(el && el.decorKey && DECORATIVE_SHAPES.some((s) => s.key === el.decorKey))
}

export function isFullPageDecorKey(key?: string | null): boolean {
  if (!key) return false
  const meta = DECORATIVE_SHAPES.find((s) => s.key === key)
  return !!(meta && 'fullPage' in meta && meta.fullPage)
}

export function isFullPageDecorElement(el?: BuilderElement | null): boolean {
  return isFullPageDecorKey(el?.decorKey)
}

function decorativeImageSrc(key: string, primary: string, accent: string) {
  const built = buildDecorativeSvg(key, primary, accent)
  const svg = isFullPageDecorKey(key)
    ? built.svg.replace(/<svg\b/, '<svg preserveAspectRatio="none"')
    : built.svg
  return svgDataUri(svg)
}

/** Generate SVG markup for a decorative shape using primary/accent colors. */
export function buildDecorativeSvg(
  key: string,
  primary = '#002147',
  accent = '#c9a227',
): { svg: string; viewW: number; viewH: number } {
  const p = primary
  const a = accent
  const g = '#1a5c3a'
  const rings = (cx: number, cy: number, count: number, start = 10, step = 5.5) =>
    Array.from({ length: count }, (_, i) => {
      const r = start + i * step
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i % 2 ? a : p}" stroke-width="0.55"/>`
    }).join('')

  switch (key) {
    case 'border_classic_double':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="10" y="10" width="280" height="400" fill="none" stroke="${p}" stroke-width="4"/><rect x="18" y="18" width="264" height="384" fill="none" stroke="${a}" stroke-width="1.5"/><rect x="24" y="24" width="252" height="372" fill="none" stroke="${p}" stroke-width="1"/></svg>`,
      }
    case 'border_gold_ornate':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="12" y="12" width="276" height="396" fill="none" stroke="${a}" stroke-width="5"/><rect x="22" y="22" width="256" height="376" fill="none" stroke="${p}" stroke-width="1.5"/><path d="M12 40 Q40 12 60 12 M240 12 Q260 12 288 40 M288 380 Q260 408 240 408 M60 408 Q40 408 12 380" fill="none" stroke="${a}" stroke-width="3"/><circle cx="30" cy="30" r="6" fill="${a}"/><circle cx="270" cy="30" r="6" fill="${a}"/><circle cx="30" cy="390" r="6" fill="${a}"/><circle cx="270" cy="390" r="6" fill="${a}"/></svg>`,
      }
    case 'border_navy_block':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><path d="M0 0 H70 L50 20 H20 V50 L0 70 Z" fill="${p}"/><path d="M300 0 H230 L250 20 H280 V50 L300 70 Z" fill="${p}"/><path d="M0 420 H70 L50 400 H20 V370 L0 350 Z" fill="${p}"/><path d="M300 420 H230 L250 400 H280 V370 L300 350 Z" fill="${p}"/><rect x="16" y="16" width="268" height="388" fill="none" stroke="${a}" stroke-width="2"/></svg>`,
      }
    case 'border_elegant_thin':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="14" y="14" width="272" height="392" fill="none" stroke="${p}" stroke-width="1.5"/><rect x="20" y="20" width="260" height="380" fill="none" stroke="${a}" stroke-width="0.8"/><path d="M40 14 H14 V40 M260 14 H286 V40 M14 380 V406 H40 M286 380 V406 H260" fill="none" stroke="${p}" stroke-width="2"/></svg>`,
      }
    case 'border_maroon_gold':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="8" y="8" width="284" height="404" fill="none" stroke="${p}" stroke-width="8"/><rect x="18" y="18" width="264" height="384" fill="none" stroke="${a}" stroke-width="2"/><rect x="26" y="26" width="248" height="368" fill="none" stroke="${p}" stroke-width="1"/></svg>`,
      }
    case 'border_green_filigree':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="14" y="14" width="272" height="392" fill="none" stroke="${g}" stroke-width="3"/><rect x="22" y="22" width="256" height="376" fill="none" stroke="${a}" stroke-width="1"/><path d="M30 30 Q50 20 70 30 Q50 40 30 30 M270 30 Q250 20 230 30 Q250 40 270 30 M30 390 Q50 400 70 390 Q50 380 30 390 M270 390 Q250 400 230 390 Q250 380 270 390" fill="${a}" opacity="0.9"/></svg>`,
      }
    case 'medal_gold':
    case 'medal_navy': {
      const outer = key === 'medal_gold' ? a : p
      const inner = key === 'medal_gold' ? '#f5e6a6' : '#1e3a5f'
      const star = key === 'medal_gold' ? p : a
      return {
        viewW: 120,
        viewH: 140,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140"><path d="M40 88 L28 130 L50 112 L60 132 L70 112 L92 130 L80 88 Z" fill="${outer}"/><circle cx="60" cy="55" r="42" fill="${outer}"/><circle cx="60" cy="55" r="34" fill="${inner}" stroke="${outer}" stroke-width="3"/><circle cx="60" cy="55" r="26" fill="none" stroke="${star}" stroke-width="2"/><path d="M60 32 L66 48 L84 48 L70 58 L75 74 L60 64 L45 74 L50 58 L36 48 L54 48 Z" fill="${star}"/></svg>`,
      }
    }
    case 'seal_wax':
      return {
        viewW: 100,
        viewH: 120,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><ellipse cx="50" cy="48" rx="42" ry="40" fill="${a}"/><ellipse cx="50" cy="48" rx="32" ry="30" fill="${p}" opacity="0.85"/><circle cx="50" cy="48" r="16" fill="${a}"/><path d="M38 85 L32 115 L44 100 L50 118 L56 100 L68 115 L62 85 Z" fill="${p}"/><path d="M45 85 L42 110 L50 100 L58 110 L55 85" fill="${g}" opacity="0.8"/></svg>`,
      }
    case 'seal_scallop':
      return {
        viewW: 110,
        viewH: 110,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 110"><circle cx="55" cy="55" r="50" fill="${p}"/><circle cx="55" cy="55" r="42" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="4 3"/><circle cx="55" cy="55" r="34" fill="${a}" opacity="0.25"/><circle cx="55" cy="55" r="22" fill="none" stroke="${a}" stroke-width="2"/><path d="M55 38 L58 48 L69 48 L60 55 L63 66 L55 59 L47 66 L50 55 L41 48 L52 48 Z" fill="${a}"/></svg>`,
      }
    case 'seal_ring':
      return {
        viewW: 120,
        viewH: 120,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="${p}" stroke-width="6"/><circle cx="60" cy="60" r="44" fill="none" stroke="${a}" stroke-width="3"/><circle cx="60" cy="60" r="34" fill="none" stroke="${p}" stroke-width="2"/><circle cx="60" cy="60" r="8" fill="${a}"/><path d="M60 22 L64 38 L60 34 L56 38 Z M98 60 L82 64 L86 60 L82 56 Z M60 98 L56 82 L60 86 L64 82 Z M22 60 L38 56 L34 60 L38 64 Z" fill="${p}"/></svg>`,
      }
    case 'seal_sunburst':
      return {
        viewW: 130,
        viewH: 130,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130"><g fill="${a}">${Array.from({ length: 16 }, (_, i) => {
          const ang = (i * 22.5 * Math.PI) / 180
          const x1 = 65 + Math.cos(ang) * 38
          const y1 = 65 + Math.sin(ang) * 38
          const x2 = 65 + Math.cos(ang) * 62
          const y2 = 65 + Math.sin(ang) * 62
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${a}" stroke-width="4"/>`
        }).join('')}</g><circle cx="65" cy="65" r="36" fill="${p}"/><circle cx="65" cy="65" r="28" fill="none" stroke="${a}" stroke-width="3"/><path d="M65 48 L68 58 L79 58 L70 64 L73 75 L65 68 L57 75 L60 64 L51 58 L62 58 Z" fill="${a}"/></svg>`,
      }
    case 'star_badge':
      return {
        viewW: 100,
        viewH: 100,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="${p}"/><circle cx="50" cy="50" r="38" fill="${a}"/><path d="M50 18 L56 40 L80 40 L60 54 L68 76 L50 62 L32 76 L40 54 L20 40 L44 40 Z" fill="${p}"/></svg>`,
      }
    case 'laurel':
      return {
        viewW: 130,
        viewH: 130,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130"><path d="M65 118 C20 100 12 55 28 28 C40 48 48 70 52 95 C42 78 30 58 28 40 C18 70 28 105 65 118 Z" fill="${a}" opacity="0.95"/><path d="M65 118 C110 100 118 55 102 28 C90 48 82 70 78 95 C88 78 100 58 102 40 C112 70 102 105 65 118 Z" fill="${a}" opacity="0.95"/><circle cx="65" cy="58" r="18" fill="none" stroke="${p}" stroke-width="3"/><path d="M65 44 L68 54 L79 54 L70 60 L73 71 L65 65 L57 71 L60 60 L51 54 L62 54 Z" fill="${p}"/></svg>`,
      }
    case 'laurel_star':
      return {
        viewW: 120,
        viewH: 120,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M60 110 C22 95 14 55 28 28 C38 45 45 65 48 88 C40 72 30 55 28 40 C20 65 28 95 60 110 Z" fill="${a}"/><path d="M60 110 C98 95 106 55 92 28 C82 45 75 65 72 88 C80 72 90 55 92 40 C100 65 92 95 60 110 Z" fill="${a}"/><path d="M60 35 L65 50 L82 50 L68 60 L73 76 L60 66 L47 76 L52 60 L38 50 L55 50 Z" fill="${p}"/></svg>`,
      }
    case 'rosette':
      return {
        viewW: 100,
        viewH: 100,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="${p}"><circle cx="50" cy="18" r="12"/><circle cx="50" cy="82" r="12"/><circle cx="18" cy="50" r="12"/><circle cx="82" cy="50" r="12"/><circle cx="27" cy="27" r="12"/><circle cx="73" cy="27" r="12"/><circle cx="27" cy="73" r="12"/><circle cx="73" cy="73" r="12"/></g><circle cx="50" cy="50" r="22" fill="${a}"/><circle cx="50" cy="50" r="12" fill="${p}"/></svg>`,
      }
    case 'diamond_seal':
      return {
        viewW: 90,
        viewH: 90,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><path d="M45 6 L84 45 L45 84 L6 45 Z" fill="${p}" stroke="${a}" stroke-width="3"/><path d="M45 18 L72 45 L45 72 L18 45 Z" fill="none" stroke="${a}" stroke-width="2"/><circle cx="45" cy="45" r="10" fill="${a}"/></svg>`,
      }
    case 'corner_flourish':
      return {
        viewW: 90,
        viewH: 90,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><path d="M8 8 H55 M8 8 V55" fill="none" stroke="${p}" stroke-width="4" stroke-linecap="round"/><path d="M8 8 Q40 12 48 40 Q20 36 8 8" fill="${a}" opacity="0.85"/><circle cx="20" cy="20" r="4" fill="${p}"/><path d="M55 8 Q70 20 78 40" fill="none" stroke="${a}" stroke-width="2"/><path d="M8 55 Q20 70 40 78" fill="none" stroke="${a}" stroke-width="2"/></svg>`,
      }
    case 'corner_filigree':
      return {
        viewW: 100,
        viewH: 100,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M6 6 H70 M6 6 V70" stroke="${a}" stroke-width="3" fill="none"/><path d="M6 6 C40 10 55 30 60 60 C35 55 15 40 6 6" fill="${p}" opacity="0.9"/><path d="M20 6 Q45 20 55 45" stroke="${a}" fill="none" stroke-width="1.5"/><circle cx="18" cy="18" r="3" fill="${a}"/></svg>`,
      }
    case 'corner_geometric':
      return {
        viewW: 90,
        viewH: 90,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><path d="M4 4 H55 L45 14 H14 V45 Z" fill="${a}"/><path d="M4 4 H40 L32 12 H12 V40 Z" fill="${p}"/><rect x="4" y="4" width="50" height="4" fill="${a}"/><rect x="4" y="4" width="4" height="50" fill="${a}"/></svg>`,
      }
    case 'corner_floral':
      return {
        viewW: 95,
        viewH: 95,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 95 95"><path d="M8 8 C30 5 50 20 55 45 C35 40 18 28 8 8" fill="${a}"/><path d="M8 8 C5 30 20 50 45 55 C40 35 28 18 8 8" fill="${p}" opacity="0.85"/><circle cx="22" cy="22" r="6" fill="${a}"/><path d="M8 55 Q25 70 45 78 M55 8 Q70 25 78 45" stroke="${a}" fill="none" stroke-width="2"/></svg>`,
      }
    case 'corner_celtic':
      return {
        viewW: 90,
        viewH: 90,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><path d="M10 10 H50 V20 H20 V50 H10 Z" fill="none" stroke="${p}" stroke-width="4"/><path d="M18 18 C40 14 55 30 50 50 C34 55 14 40 18 18" fill="none" stroke="${a}" stroke-width="3"/><path d="M18 18 C14 40 30 55 50 50 C55 34 40 14 18 18" fill="none" stroke="${p}" stroke-width="2"/></svg>`,
      }
    case 'ribbon':
      return {
        viewW: 240,
        viewH: 56,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 56"><path d="M12 8 H228 L216 28 L228 48 H12 L24 28 Z" fill="${p}"/><path d="M28 14 H212 L204 28 L212 42 H28 L36 28 Z" fill="none" stroke="${a}" stroke-width="2"/></svg>`,
      }
    case 'divider_ornate':
      return {
        viewW: 280,
        viewH: 28,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 28"><path d="M10 14 H120 M160 14 H270" stroke="${a}" stroke-width="2"/><path d="M140 4 L150 14 L140 24 L130 14 Z" fill="${p}"/><circle cx="140" cy="14" r="4" fill="${a}"/><path d="M110 14 Q120 6 130 14 Q120 22 110 14 M170 14 Q160 6 150 14 Q160 22 170 14" fill="${a}" opacity="0.8"/></svg>`,
      }
    case 'divider_diamond':
      return {
        viewW: 260,
        viewH: 24,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 24"><line x1="10" y1="12" x2="110" y2="12" stroke="${p}" stroke-width="1.5"/><line x1="150" y1="12" x2="250" y2="12" stroke="${p}" stroke-width="1.5"/><path d="M130 4 L140 12 L130 20 L120 12 Z" fill="${a}" stroke="${p}" stroke-width="1"/></svg>`,
      }
    case 'flourish_scroll':
      return {
        viewW: 200,
        viewH: 40,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><path d="M10 20 C40 5 60 5 80 20 C100 35 120 35 140 20 C160 5 180 5 190 20" fill="none" stroke="${a}" stroke-width="2.5"/><path d="M20 20 C45 10 55 10 70 20" fill="none" stroke="${p}" stroke-width="1.5"/><circle cx="100" cy="20" r="3" fill="${p}"/></svg>`,
      }
    case 'crown':
      return {
        viewW: 80,
        viewH: 50,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 50"><path d="M8 38 L8 18 L22 30 L40 8 L58 30 L72 18 L72 38 Z" fill="${a}" stroke="${p}" stroke-width="1.5"/><circle cx="8" cy="16" r="4" fill="${p}"/><circle cx="40" cy="8" r="5" fill="${p}"/><circle cx="72" cy="16" r="4" fill="${p}"/><rect x="8" y="38" width="64" height="6" fill="${p}"/></svg>`,
      }
    case 'stars_row':
      return {
        viewW: 180,
        viewH: 32,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 32">${[18, 54, 90, 126, 162]
          .map(
            (x) =>
              `<path d="M${x} 4 L${x + 3} 12 L${x + 12} 12 L${x + 5} 17 L${x + 8} 26 L${x} 20 L${x - 8} 26 L${x - 5} 17 L${x - 12} 12 L${x - 3} 12 Z" fill="${a}"/>`,
          )
          .join('')}</svg>`,
      }
    case 'line_double_rule':
      return {
        viewW: 280,
        viewH: 16,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 16"><line x1="8" y1="5" x2="272" y2="5" stroke="${p}" stroke-width="1.6"/><line x1="8" y1="11" x2="272" y2="11" stroke="${a}" stroke-width="1.2"/></svg>`,
      }
    case 'line_triple_rule':
      return {
        viewW: 280,
        viewH: 20,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 20"><line x1="8" y1="4" x2="272" y2="4" stroke="${p}" stroke-width="1.2"/><line x1="8" y1="10" x2="272" y2="10" stroke="${a}" stroke-width="2.2"/><line x1="8" y1="16" x2="272" y2="16" stroke="${p}" stroke-width="1.2"/></svg>`,
      }
    case 'line_ornate_rule':
      return {
        viewW: 280,
        viewH: 22,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 22"><path d="M10 11 H118 M162 11 H270" stroke="${p}" stroke-width="1.6"/><path d="M140 3 L148 11 L140 19 L132 11 Z" fill="${a}"/><circle cx="140" cy="11" r="2.4" fill="${p}"/></svg>`,
      }
    case 'line_dashed':
      return {
        viewW: 280,
        viewH: 12,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 12"><line x1="8" y1="6" x2="272" y2="6" stroke="${p}" stroke-width="1.6" stroke-dasharray="8 6"/></svg>`,
      }
    case 'line_vertical':
      return {
        viewW: 16,
        viewH: 200,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 200"><line x1="5" y1="8" x2="5" y2="192" stroke="${p}" stroke-width="1.6"/><line x1="11" y1="8" x2="11" y2="192" stroke="${a}" stroke-width="1.2"/></svg>`,
      }
    case 'line_bracket':
      return {
        viewW: 260,
        viewH: 18,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 18"><path d="M12 14 V4 H248 V14" fill="none" stroke="${p}" stroke-width="1.8"/><path d="M20 14 V8 H240 V14" fill="none" stroke="${a}" stroke-width="1"/></svg>`,
      }
    case 'header_pediment':
      return {
        viewW: 300,
        viewH: 70,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 70"><path d="M10 62 L150 8 L290 62 Z" fill="none" stroke="${p}" stroke-width="3"/><path d="M28 62 L150 18 L272 62 Z" fill="none" stroke="${a}" stroke-width="1.4"/><rect x="8" y="60" width="284" height="6" fill="${p}"/><circle cx="150" cy="28" r="5" fill="${a}"/></svg>`,
      }
    case 'header_greek_key':
      return {
        viewW: 300,
        viewH: 28,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 28"><rect x="0" y="4" width="300" height="20" fill="none" stroke="${p}" stroke-width="2"/>${Array.from({ length: 12 }, (_, i) => {
          const x = 8 + i * 24
          return `<path d="M${x} 20 V8 H${x + 10} V16 H${x + 16} V8 H${x + 22}" fill="none" stroke="${a}" stroke-width="1.6"/>`
        }).join('')}</svg>`,
      }
    case 'header_crest_bar':
      return {
        viewW: 300,
        viewH: 48,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 48"><rect x="0" y="18" width="300" height="12" fill="${p}"/><rect x="0" y="30" width="300" height="4" fill="${a}"/><path d="M128 18 L150 4 L172 18 Z" fill="${a}"/><circle cx="150" cy="22" r="8" fill="${p}" stroke="${a}" stroke-width="2"/></svg>`,
      }
    case 'header_sunburst':
      return {
        viewW: 300,
        viewH: 80,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><path d="M0 80 C80 20 220 20 300 80" fill="none" stroke="${p}" stroke-width="3"/>${Array.from({ length: 11 }, (_, i) => {
          const ang = ((i - 5) * 12 * Math.PI) / 180
          const x2 = 150 + Math.sin(ang) * 70
          const y2 = 78 - Math.cos(ang) * 62
          return `<line x1="150" y1="78" x2="${x2}" y2="${y2}" stroke="${a}" stroke-width="1.4"/>`
        }).join('')}<circle cx="150" cy="72" r="7" fill="${a}"/></svg>`,
      }
    case 'header_banner':
      return {
        viewW: 300,
        viewH: 44,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 44"><path d="M18 6 H282 L268 22 L282 38 H18 L32 22 Z" fill="${p}"/><path d="M36 12 H264 L254 22 L264 32 H36 L46 22 Z" fill="none" stroke="${a}" stroke-width="1.6"/></svg>`,
      }
    case 'guilloche_rosette':
      return {
        viewW: 160,
        viewH: 160,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${rings(80, 80, 12, 8, 5.5)}${Array.from({ length: 12 }, (_, i) => {
          const ang = (i * 30 * Math.PI) / 180
          const cx = 80 + Math.cos(ang) * 28
          const cy = 80 + Math.sin(ang) * 28
          return `<circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="${a}" stroke-width="0.7"/>`
        }).join('')}</svg>`,
      }
    case 'guilloche_oval':
      return {
        viewW: 220,
        viewH: 140,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 140">${Array.from({ length: 8 }, (_, i) => `<ellipse cx="110" cy="70" rx="${40 + i * 9}" ry="${22 + i * 6}" fill="none" stroke="${i % 2 ? a : p}" stroke-width="0.7"/>`).join('')}</svg>`,
      }
    case 'guilloche_border':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="16" y="16" width="268" height="388" fill="none" stroke="${p}" stroke-width="1.2"/>${[
          [40, 40],
          [260, 40],
          [40, 380],
          [260, 380],
          [150, 40],
          [150, 380],
        ]
          .map(([cx, cy]) => rings(cx, cy, 6, 6, 4))
          .join('')}</svg>`,
      }
    case 'guilloche_engine':
      return {
        viewW: 150,
        viewH: 150,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">${rings(75, 75, 14, 6, 4.4)}${Array.from({ length: 18 }, (_, i) => {
          const ang = (i * 20 * Math.PI) / 180
          return `<line x1="${75 + Math.cos(ang) * 18}" y1="${75 + Math.sin(ang) * 18}" x2="${75 + Math.cos(ang) * 68}" y2="${75 + Math.sin(ang) * 68}" stroke="${a}" stroke-width="0.45"/>`
        }).join('')}</svg>`,
      }
    case 'watermark_seal':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><g transform="translate(150 210)">${rings(0, 0, 8, 18, 8)}<circle cx="0" cy="0" r="22" fill="none" stroke="${a}" stroke-width="3"/><path d="M0 -14 L4 0 L14 0 L6 8 L9 20 L0 12 L-9 20 L-6 8 L-14 0 L-4 0 Z" fill="${p}"/></g></svg>`,
      }
    case 'watermark_diamond':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><g transform="translate(150 210) rotate(-18)"><path d="M0 -90 L78 0 L0 90 L-78 0 Z" fill="none" stroke="${p}" stroke-width="3"/><path d="M0 -58 L50 0 L0 58 L-50 0 Z" fill="none" stroke="${a}" stroke-width="2"/></g></svg>`,
      }
    case 'watermark_laurel':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><g transform="translate(90 140) scale(1.6)" opacity="0.9"><path d="M65 118 C20 100 12 55 28 28 C40 48 48 70 52 95 C42 78 30 58 28 40 C18 70 28 105 65 118 Z" fill="${a}"/><path d="M65 118 C110 100 118 55 102 28 C90 48 82 70 78 95 C88 78 100 58 102 40 C112 70 102 105 65 118 Z" fill="${a}"/></g></svg>`,
      }
    case 'watermark_grid':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420">${Array.from({ length: 15 }, (_, i) => `<line x1="${20 + i * 18}" y1="20" x2="${20 + i * 18}" y2="400" stroke="${p}" stroke-width="0.4"/>`).join('')}${Array.from({ length: 20 }, (_, i) => `<line x1="20" y1="${20 + i * 19}" x2="280" y2="${20 + i * 19}" stroke="${a}" stroke-width="0.4"/>`).join('')}</svg>`,
      }
    case 'geo_greek_key':
      return {
        viewW: 280,
        viewH: 22,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 22">${Array.from({ length: 11 }, (_, i) => {
          const x = 6 + i * 25
          return `<path d="M${x} 18 V4 H${x + 8} V12 H${x + 14} V4 H${x + 20} V18" fill="none" stroke="${p}" stroke-width="1.5"/>`
        }).join('')}</svg>`,
      }
    case 'geo_chevrons':
      return {
        viewW: 280,
        viewH: 24,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 24">${Array.from({ length: 14 }, (_, i) => `<path d="M${8 + i * 20} 20 L${18 + i * 20} 6 L${28 + i * 20} 20" fill="none" stroke="${i % 2 ? a : p}" stroke-width="1.8"/>`).join('')}</svg>`,
      }
    case 'geo_diamonds':
      return {
        viewW: 220,
        viewH: 80,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80">${Array.from({ length: 5 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => {
            const x = 18 + c * 26 + (r % 2) * 13
            const y = 14 + r * 14
            return `<path d="M${x} ${y - 8} L${x + 8} ${y} L${x} ${y + 8} L${x - 8} ${y} Z" fill="none" stroke="${(r + c) % 2 ? a : p}" stroke-width="1"/>`
          }).join(''),
        ).join('')}</svg>`,
      }
    case 'geo_hex':
      return {
        viewW: 140,
        viewH: 140,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><polygon points="70,12 118,40 118,96 70,124 22,96 22,40" fill="none" stroke="${p}" stroke-width="3"/><polygon points="70,32 102,50 102,86 70,104 38,86 38,50" fill="none" stroke="${a}" stroke-width="2"/><circle cx="70" cy="70" r="12" fill="${a}"/></svg>`,
      }
    case 'geo_triangles':
      return {
        viewW: 260,
        viewH: 22,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 22">${Array.from({ length: 13 }, (_, i) => `<path d="M${10 + i * 19} 18 L${19 + i * 19} 4 L${28 + i * 19} 18 Z" fill="${i % 2 ? a : p}"/>`).join('')}</svg>`,
      }
    case 'flourish_swash_left':
      return {
        viewW: 160,
        viewH: 48,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 48"><path d="M150 24 C110 8 80 8 50 24 C28 36 18 36 10 24 C22 16 40 28 62 24 C90 18 120 28 150 24" fill="none" stroke="${a}" stroke-width="2.2"/><path d="M18 24 C30 12 44 12 56 22" fill="none" stroke="${p}" stroke-width="1.3"/></svg>`,
      }
    case 'flourish_swash_right':
      return {
        viewW: 160,
        viewH: 48,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 48"><path d="M10 24 C50 8 80 8 110 24 C132 36 142 36 150 24 C138 16 120 28 98 24 C70 18 40 28 10 24" fill="none" stroke="${a}" stroke-width="2.2"/><path d="M142 24 C130 12 116 12 104 22" fill="none" stroke="${p}" stroke-width="1.3"/></svg>`,
      }
    case 'flourish_vine':
      return {
        viewW: 220,
        viewH: 36,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 36"><path d="M8 22 C40 6 70 30 100 18 C130 6 160 30 212 16" fill="none" stroke="${p}" stroke-width="1.8"/><circle cx="48" cy="12" r="4" fill="${a}"/><circle cx="108" cy="14" r="4" fill="${a}"/><circle cx="168" cy="20" r="4" fill="${a}"/></svg>`,
      }
    case 'flourish_ampersand':
      return {
        viewW: 90,
        viewH: 90,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><path d="M58 18 C40 8 18 22 22 42 C26 62 52 64 58 48 C64 34 40 30 36 46 C32 64 54 78 72 68" fill="none" stroke="${a}" stroke-width="3.2" stroke-linecap="round"/><path d="M28 70 C44 82 70 78 78 58" fill="none" stroke="${p}" stroke-width="1.6"/></svg>`,
      }
    case 'divider_dots':
      return {
        viewW: 260,
        viewH: 16,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 16">${Array.from({ length: 17 }, (_, i) => `<circle cx="${16 + i * 14}" cy="8" r="${i === 8 ? 3.2 : 1.8}" fill="${i === 8 ? a : p}"/>`).join('')}</svg>`,
      }
    case 'divider_laurel':
      return {
        viewW: 240,
        viewH: 28,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 28"><path d="M12 14 H96 M144 14 H228" stroke="${p}" stroke-width="1.5"/><path d="M108 8 C112 16 116 16 120 8 C124 16 128 16 132 8" fill="none" stroke="${a}" stroke-width="2"/><circle cx="120" cy="16" r="3" fill="${a}"/></svg>`,
      }
    case 'emblem_shield':
      return {
        viewW: 110,
        viewH: 130,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 130"><path d="M55 8 L98 24 V62 C98 92 78 114 55 122 C32 114 12 92 12 62 V24 Z" fill="${p}" stroke="${a}" stroke-width="3"/><path d="M55 20 L86 32 V62 C86 84 72 102 55 108 C38 102 24 84 24 62 V32 Z" fill="none" stroke="${a}" stroke-width="1.6"/><path d="M55 42 L60 54 L74 54 L63 62 L67 76 L55 68 L43 76 L47 62 L36 54 L50 54 Z" fill="${a}"/></svg>`,
      }
    case 'emblem_cross':
      return {
        viewW: 100,
        viewH: 100,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="${p}"/><circle cx="50" cy="50" r="36" fill="none" stroke="${a}" stroke-width="3"/><path d="M46 22 H54 V46 H78 V54 H54 V78 H46 V54 H22 V46 H46 Z" fill="${a}"/></svg>`,
      }
    case 'modern_wave_top':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><path d="M0 0 H300 V90 C220 130 80 40 0 100 Z" fill="${p}"/><path d="M0 0 H300 V70 C200 110 100 30 0 80 Z" fill="${a}" opacity="0.85"/></svg>`,
      }
    case 'modern_side_bar':
      return {
        viewW: 300,
        viewH: 420,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420"><rect x="0" y="0" width="28" height="420" fill="${p}"/><rect x="28" y="0" width="6" height="420" fill="${a}"/><circle cx="14" cy="210" r="8" fill="${a}"/></svg>`,
      }
    case 'modern_corner_sweep':
      return {
        viewW: 180,
        viewH: 180,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><path d="M0 0 H180 C120 40 40 120 0 180 Z" fill="${p}"/><path d="M0 0 H140 C100 40 40 100 0 140 Z" fill="${a}" opacity="0.9"/></svg>`,
      }
    case 'modern_arch':
      return {
        viewW: 220,
        viewH: 120,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120"><path d="M10 110 C10 40 210 40 210 110" fill="none" stroke="${p}" stroke-width="8"/><path d="M24 110 C24 52 196 52 196 110" fill="none" stroke="${a}" stroke-width="3"/><circle cx="110" cy="48" r="10" fill="${a}"/></svg>`,
      }
    default:
      return {
        viewW: 100,
        viewH: 100,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${p}"/><circle cx="50" cy="50" r="24" fill="${a}"/></svg>`,
      }
  }
}

/** Rebuild decorative image src when colors change. */
export function recolorDecorativeElement(
  el: BuilderElement,
  primary: string,
  accent: string,
): BuilderElement {
  if (!el.decorKey) return { ...el, fill: primary, stroke: accent }
  return {
    ...el,
    fill: primary,
    stroke: accent,
    src: decorativeImageSrc(el.decorKey, primary, accent),
  }
}

/** Build an SVG ornament as a movable/resizable/recolorable image element. */
export function createDecorativeShapeElement(
  key: DecorativeShapeKey,
  canvas: { width: number; height: number },
  colors: { primary?: string; accent?: string } = {},
): BuilderElement {
  const primary = colors.primary || '#002147'
  const accent = colors.accent || '#c9a227'
  const meta = DECORATIVE_SHAPES.find((s) => s.key === key) || DECORATIVE_SHAPES[0]
  const built = buildDecorativeSvg(key, primary, accent)
  const fullPage = 'fullPage' in meta && meta.fullPage
  const watermark = 'watermark' in meta && meta.watermark

  if (fullPage) {
    return {
      id: createElementId(),
      type: 'image',
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      rotation: 0,
      zIndex: watermark ? 2 : 1,
      src: decorativeImageSrc(key, primary, accent),
      opacity: watermark ? 0.16 : 1,
      bind: 'none',
      text: meta.label,
      decorKey: key,
      fill: primary,
      stroke: accent,
    }
  }

  const size = meta.size || 100
  const aspect = built.viewH / built.viewW
  const width = size
  const height = Math.round(size * aspect)
  const isWide = built.viewW > built.viewH * 1.5

  return {
    id: createElementId(),
    type: 'image',
    x: isWide ? canvas.width / 2 - width / 2 : canvas.width / 2 - width / 2,
    y: isWide ? canvas.height * 0.2 : canvas.height / 2 - height / 2,
    width,
    height,
    rotation: 0,
    zIndex: 40,
    src: decorativeImageSrc(key, primary, accent),
    opacity: 1,
    bind: 'none',
    text: meta.label,
    decorKey: key,
    fill: primary,
    stroke: accent,
  }
}

export function isQrElement(el: BuilderElement | null | undefined): boolean {
  if (!el) return false
  return el.bind === 'qr' || el.id === SYSTEM_QR_ID || el.id === 'system_qr_locked'
}

/** Human-readable layer name for the builder Layers panel. */
export function getBuilderLayerLabel(el: BuilderElement): string {
  if (el.name && String(el.name).trim()) return String(el.name).trim()
  if (isQrElement(el)) return 'verification-qr'
  if (el.type === 'image' && String(el.text || '').trim()) return String(el.text).trim()
  if (
    (el.type === 'rect' || el.type === 'ellipse' || el.type === 'line') &&
    String(el.text || '').trim()
  ) {
    return String(el.text).trim()
  }
  if (el.patchKey) {
    return getCertificatePatchMeta(el.patchKey)?.label || el.text || el.patchKey
  }
  if (el.decorKey) {
    return DECORATIVE_SHAPES.find((s) => s.key === el.decorKey)?.label || el.decorKey
  }
  if (el.bind && el.bind !== 'none' && el.bind !== 'qr') {
    return BUILDER_BINDINGS.find((b) => b.key === el.bind)?.label || el.bind
  }
  if (el.type === 'text') {
    const t = String(el.text || '').trim()
    return t ? (t.length > 28 ? `${t.slice(0, 28)}…` : t) : 'text'
  }
  if (el.type === 'image') return 'image'
  if (el.type === 'rect') return 'box'
  if (el.type === 'ellipse') return 'circle'
  if (el.type === 'line') return 'line'
  return el.type
}

export function getGroupLabel(groupId: string, elements: BuilderElement[]): string {
  const members = elements.filter((e) => e.groupId === groupId)
  if (!members.length) return 'group'
  if (members.every((e) => e.type === 'text')) {
    const first = String(members[0].text || '').trim()
    return first ? `¶ ${first.slice(0, 22)}${first.length > 22 ? '…' : ''}` : 'paragraph'
  }
  if (members.every((e) => e.type === 'image')) {
    const labels = [...new Set(members.map((e) => String(e.text || 'image')))]
    return labels[0] || 'images'
  }
  return `group (${members.length})`
}

export function hasVerificationQr(design: LogoBuilderDesign): boolean {
  return (design.elements || []).some((el) => isQrElement(el))
}

/** Keep at most one system verification QR (does not force-add). */
export function normalizeVerificationQr(design: LogoBuilderDesign): LogoBuilderDesign {
  const canvas = {
    width: design.canvas?.width || DEFAULT_BUILDER_CANVAS.width,
    height: design.canvas?.height || DEFAULT_BUILDER_CANVAS.height,
    background: design.canvas?.background || '#ffffff',
    paperKey: design.canvas?.paperKey || DEFAULT_BUILDER_CANVAS.paperKey,
  }
  const nonQr = (design.elements || []).filter((el) => !isQrElement(el))
  const qrs = (design.elements || []).filter((el) => isQrElement(el))
  if (!qrs.length) {
    return { version: 1, canvas, elements: nonQr }
  }
  const qr = {
    ...qrs[0],
    id: SYSTEM_QR_ID,
    bind: 'qr' as const,
    locked: false,
    width: Math.max(48, qrs[0].width || 96),
    height: Math.max(48, qrs[0].height || 96),
  }
  return { version: 1, canvas, elements: [...nonQr, qr] }
}

/** @deprecated use normalizeVerificationQr — kept so older imports do not break mid-edit */
export function ensureRequiredQr(design: LogoBuilderDesign): LogoBuilderDesign {
  return normalizeVerificationQr(design)
}

export function scaleDesignToCanvas(
  design: LogoBuilderDesign,
  width: number,
  height: number,
  paperKey: string,
): LogoBuilderDesign {
  const w = Math.max(200, Math.min(2800, Math.round(width)))
  const h = Math.max(200, Math.min(2800, Math.round(height)))
  const prevW = design.canvas.width || w
  const prevH = design.canvas.height || h
  const scaleX = w / prevW
  const scaleY = h / prevH
  const next: LogoBuilderDesign = {
    version: 1,
    canvas: {
      width: w,
      height: h,
      background: design.canvas.background || '#ffffff',
      paperKey,
    },
    elements: (design.elements || []).map((el) => {
      const scaled = {
        ...el,
        x: el.x * scaleX,
        y: el.y * scaleY,
        width: Math.max(8, el.width * scaleX),
        height: Math.max(8, el.height * scaleY),
      }
      const coveredPage =
        el.x <= 8 &&
        el.y <= 8 &&
        el.x + el.width >= prevW - 8 &&
        el.y + el.height >= prevH - 8
      if (isFullPageDecorElement(el) || (el.decorKey && coveredPage)) {
        return recolorDecorativeElement(
          { ...scaled, x: 0, y: 0, width: w, height: h },
          el.fill || '#002147',
          el.stroke || '#c9a227',
        )
      }
      return scaled
    }),
  }
  return normalizeVerificationQr(next)
}

export function applyPaperSize(design: LogoBuilderDesign, paperKey: PaperSizeKey): LogoBuilderDesign {
  if (paperKey === 'custom') {
    return {
      ...design,
      canvas: { ...design.canvas, paperKey: 'custom' },
    }
  }
  const paper = getPaperSize(paperKey)
  return scaleDesignToCanvas(design, paper.width, paper.height, paper.key)
}

export function applyCustomPaperSize(
  design: LogoBuilderDesign,
  widthPx: number,
  heightPx: number,
): LogoBuilderDesign {
  return scaleDesignToCanvas(design, widthPx, heightPx, 'custom')
}

/** PDF page size in mm — matches builder paper so export does not stretch. */
export function getDesignPdfPageMm(canvas?: {
  width?: number
  height?: number
  paperKey?: string
}): { wmm: number; hmm: number; orientation: 'portrait' | 'landscape' } {
  const w = Math.max(1, canvas?.width || DEFAULT_BUILDER_CANVAS.width)
  const h = Math.max(1, canvas?.height || DEFAULT_BUILDER_CANVAS.height)
  const key = String(canvas?.paperKey || '')
  if (key && key !== 'custom') {
    const paper = PAPER_SIZES.find((p) => p.key === key)
    if (paper && paper.key !== 'custom') {
      return {
        wmm: paper.pdfWmm,
        hmm: paper.pdfHmm,
        orientation: paper.pdfOrientation,
      }
    }
  }
  const wmm = Math.round((w * 25.4) / 96 * 100) / 100
  const hmm = Math.round((h * 25.4) / 96 * 100) / 100
  return {
    wmm,
    hmm,
    orientation: wmm >= hmm ? 'landscape' : 'portrait',
  }
}

export function pxToMm(px: number, canvasWidthPx: number, canvasWidthMm: number) {
  return Math.round((px * canvasWidthMm) / Math.max(1, canvasWidthPx) * 10) / 10
}

export function mmToPx(mm: number, canvasWidthPx: number, canvasWidthMm: number) {
  return (mm * canvasWidthPx) / Math.max(1, canvasWidthMm)
}

export function normalizeLogoBuilderDesign(raw: unknown): LogoBuilderDesign {
  if (!raw || typeof raw !== 'object') return createDefaultBuilderDesign()
  const obj = raw as Record<string, unknown>
  const canvasRaw = (obj.canvas && typeof obj.canvas === 'object' ? obj.canvas : {}) as Record<
    string,
    unknown
  >
  const elements = Array.isArray(obj.elements) ? obj.elements : []
  const allowedBinds = new Set<string>([...BUILDER_BINDINGS.map((b) => b.key), 'qr'])
  const paperKey = String(canvasRaw.paperKey || '')
  const isCustomPaper = paperKey === 'custom'
  let paper = getPaperSize(paperKey || undefined)
  const width = Number(canvasRaw.width) > 0 ? Number(canvasRaw.width) : paper.width
  const height = Number(canvasRaw.height) > 0 ? Number(canvasRaw.height) : paper.height
  // If paperKey missing/mismatched, pick the closest predefined paper by aspect
  if (
    !isCustomPaper &&
    (!paperKey || Math.abs(paper.width / paper.height - width / height) > 0.05)
  ) {
    const match = PAPER_SIZES.find(
      (p) =>
        p.key !== 'custom' &&
        Math.abs(p.width / p.height - width / Math.max(1, height)) < 0.05,
    )
    if (match) paper = match
  }

  const normalized: LogoBuilderDesign = {
    version: 1,
    canvas: {
      width,
      height,
      background: String(canvasRaw.background || '#ffffff'),
      paperKey: isCustomPaper ? 'custom' : paper.key,
    },
    elements: elements
      .filter((el): el is Record<string, unknown> => !!el && typeof el === 'object')
      .slice(0, MAX_BUILDER_ELEMENTS)
      .map((el, index) => {
        const bindRaw = String(el.bind || 'none')
        const bind = (allowedBinds.has(bindRaw) ? bindRaw : 'none') as BuilderBinding
        const isQr =
          bind === 'qr' ||
          String(el.id) === SYSTEM_QR_ID ||
          String(el.id) === 'system_qr_locked'
        const groupId =
          el.groupId != null && String(el.groupId).trim()
            ? String(el.groupId).slice(0, 64)
            : undefined
        return {
          id: isQr ? SYSTEM_QR_ID : String(el.id || createElementId()),
          type: (['text', 'image', 'rect', 'ellipse', 'line'].includes(String(el.type))
            ? el.type
            : 'text') as BuilderElementType,
          x: Number(el.x) || 0,
          y: Number(el.y) || 0,
          width: Math.max(8, Number(el.width) || 100),
          height: Math.max(8, Number(el.height) || 40),
          rotation: Number(el.rotation) || 0,
          zIndex: Number.isFinite(Number(el.zIndex)) ? Number(el.zIndex) : index,
          text: el.text != null ? String(el.text) : 'Text',
          fontFamily: String(el.fontFamily || BUILDER_FONT_FAMILIES[0]),
          fontSize: Math.max(8, Math.min(200, Number(el.fontSize) || 16)),
          fontWeight: el.fontWeight === 'bold' ? 'bold' : 'normal',
          fontStyle: el.fontStyle === 'italic' ? 'italic' : 'normal',
          textDecoration: el.textDecoration === 'underline' ? 'underline' : 'none',
          textAlign:
            el.textAlign === 'left' || el.textAlign === 'right' ? el.textAlign : 'center',
          letterSpacing: Number.isFinite(Number(el.letterSpacing))
            ? Math.max(-4, Math.min(40, Number(el.letterSpacing)))
            : 0,
          lineHeight: Number(el.lineHeight) > 0 ? Math.max(0.8, Math.min(3, Number(el.lineHeight))) : 1.2,
          color: String(el.color || '#0f172a'),
          // Text/image never use fill as a painted background in the editor —
          // defaulting missing fill to slate (#e2e8f0) made PDF/print show
          // accidental highlight boxes behind static copy.
          fill: (() => {
            const elType = String(el.type || 'text')
            const raw = el.fill != null ? String(el.fill).trim() : ''
            if (elType === 'text' || elType === 'image') {
              if (!raw || raw.toLowerCase() === 'transparent' || raw.toLowerCase() === '#e2e8f0') {
                return 'transparent'
              }
              return raw
            }
            return raw || '#e2e8f0'
          })(),
          stroke: el.stroke != null ? String(el.stroke) : '#002147',
          strokeWidth: Math.max(0, Number(el.strokeWidth) || 1),
          opacity: Math.min(1, Math.max(0, Number(el.opacity) || 1)),
          src: el.src ? String(el.src) : undefined,
          bind: isQr ? 'qr' : bind,
          name: el.name != null && String(el.name).trim() ? String(el.name).slice(0, 80) : undefined,
          locked: el.locked === true,
          hidden: el.hidden === true,
          groupId,
          decorKey: el.decorKey ? String(el.decorKey) : undefined,
          patchKey: el.patchKey ? String(el.patchKey).slice(0, 64) : undefined,
          fillGradient: (() => {
            const g = el.fillGradient
            if (!g || typeof g !== 'object') return undefined
            const rec = g as Record<string, unknown>
            const from = String(rec.from || '')
            const to = String(rec.to || '')
            if (!/^#[0-9a-fA-F]{3,8}$/.test(from) || !/^#[0-9a-fA-F]{3,8}$/.test(to)) return undefined
            return {
              from,
              to,
              angle: Number.isFinite(Number(rec.angle)) ? Number(rec.angle) : 180,
            }
          })(),
        }
      }),
  }

  // Refresh decorative SVG colors from stored fill/stroke if present
  normalized.elements = normalized.elements.map((el) => {
    if (el.patchKey) return rebuildCertificatePatch(el)
    if (!el.decorKey) return el
    return recolorDecorativeElement(
      el,
      el.fill || '#002147',
      el.stroke || '#c9a227',
    )
  })

  return normalizeVerificationQr(normalized)
}

export function resolveBuilderText(
  el: BuilderElement,
  data: {
    studentName?: string
    studentId?: string
    startMonth?: string
    completionMonth?: string
    programName?: string
    className?: string
    certificateNumber?: string
    dateIssued?: string | null
    institutionName?: string
    logoUrl?: string | null
    verifyCode?: string
    leftName?: string
    leftTitle?: string
    rightName?: string
    rightTitle?: string
    gpa?: string
    gradesSummary?: string
    invoiceNumber?: string
    totalDue?: string
    amountPaid?: string
    balance?: string
    lineItemsSummary?: string
  },
): string {
  switch (el.bind) {
    case 'studentName':
      return data.studentName || el.text || 'Student Name'
    case 'studentId':
      return data.studentId || el.text || 'Student ID'
    case 'startMonth':
      return data.startMonth || el.text || 'Start month'
    case 'completionMonth':
      return data.completionMonth || el.text || 'Completion month'
    case 'programName':
      return data.programName || el.text || 'Program'
    case 'className':
      return data.className || el.text || 'Class'
    case 'certificateNumber':
      return data.certificateNumber || el.text || 'DOC-000'
    case 'dateIssued':
      return data.dateIssued ? String(data.dateIssued).slice(0, 10) : el.text || 'YYYY-MM-DD'
    case 'institutionName':
      // Logo XOR name — never both on issued documents
      if (String(data.logoUrl || '').trim()) return ''
      return data.institutionName || el.text || 'Institution'
    case 'leftName':
      return data.leftName || el.text || 'Signatory'
    case 'leftTitle':
      return data.leftTitle || el.text || 'Academic Registrar'
    case 'rightName':
      return data.rightName || el.text || 'Signatory'
    case 'rightTitle':
      return data.rightTitle || el.text || 'Principal'
    case 'verifyCode':
      return data.verifyCode || el.text || 'CODE'
    case 'gpa':
      return data.gpa ? `GPA: ${data.gpa}` : el.text || 'GPA'
    case 'gradesSummary':
      return data.gradesSummary || el.text || 'Course · Credits · Grade'
    case 'invoiceNumber':
      return data.invoiceNumber || el.text || 'INV-000'
    case 'totalDue':
      return data.totalDue ? `Total due: ${data.totalDue}` : el.text || 'Total due'
    case 'amountPaid':
      return data.amountPaid ? `Paid: ${data.amountPaid}` : el.text || 'Amount paid'
    case 'balance':
      return data.balance ? `Balance: ${data.balance}` : el.text || 'Balance'
    case 'lineItemsSummary':
      return data.lineItemsSummary || el.text || 'Fee line items'
    default:
      return el.text || ''
  }
}
