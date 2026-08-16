/**
 * Logo / page builder + custom upload types for Certificate Management.
 * Designs are stored on document_templates.config (tenant-scoped via RLS/RPC).
 *
 * Rules:
 * - Keep tools few but capable (not a Word clone).
 * - Verification QR is optional (add only if the design needs the system verify link).
 * - Builder image elements store private storage paths (signed URLs resolved at render).
 */

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
] as const

/** Dynamic fields users can bind to text — QR is system-managed separately. */
export const BUILDER_BINDINGS = [
  { key: 'none', label: 'Static text (free)' },
  { key: 'studentName', label: 'Student name' },
  { key: 'studentId', label: 'Student ID' },
  { key: 'programName', label: 'Program / course' },
  { key: 'className', label: 'Class name' },
  { key: 'certificateNumber', label: 'Document number' },
  { key: 'dateIssued', label: 'Date issued' },
  { key: 'institutionName', label: 'Institution name' },
  { key: 'leftName', label: 'Left signatory name' },
  { key: 'rightName', label: 'Right signatory name' },
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
    { key: 'programName', label: 'Program' },
    { key: 'className', label: 'Class' },
    { key: 'certificateNumber', label: 'Cert No.' },
    { key: 'dateIssued', label: 'Date' },
    { key: 'institutionName', label: 'Institution' },
    { key: 'leftName', label: 'Left name' },
    { key: 'rightName', label: 'Right name' },
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
  textAlign?: 'left' | 'center' | 'right'
  color?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  src?: string
  bind?: BuilderBinding
  /** System-locked elements (QR) cannot be deleted or unbound. */
  locked?: boolean
  /** Ready decorative ornament key — allows recolor while keeping the shape. */
  decorKey?: string
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
] as const

export type PaperSizeKey = (typeof PAPER_SIZES)[number]['key']

export const SYSTEM_QR_ID = 'system_verification_qr'

export function createElementId() {
  return `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

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
    rightName: 'Right Signatory Name',
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

/** Official academic transcript starter (not a certificate layout). */
export function createStarterTranscriptDesign(paperKey: PaperSizeKey = 'a4-portrait'): LogoBuilderDesign {
  const paper = getPaperSize(paperKey)
  const w = paper.width
  const h = paper.height
  const primary = '#0f172a'
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
    createBoundTextElement('institutionName', { width: w, height: h }, {
      y: h * 0.06,
      fontSize: 20,
      fontWeight: 'bold',
      color: primary,
      zIndex: nextZ(),
    }),
    {
      id: createElementId(),
      type: 'text',
      x: w * 0.12,
      y: h * 0.11,
      width: w * 0.76,
      height: 36,
      rotation: 0,
      zIndex: nextZ(),
      text: 'Official Academic Transcript',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 24,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'center',
      color: primary,
      opacity: 1,
      bind: 'none',
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
      stroke: primary,
      strokeWidth: 2,
      fill: primary,
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
      height: 24,
      fontSize: 12,
      fontWeight: 'bold',
      textAlign: 'center',
      color: primary,
      zIndex: nextZ(),
    }),
    createBoundTextElement('rightName', { width: w, height: h }, {
      x: w * 0.6,
      y: h * 0.84,
      width: w * 0.28,
      height: 24,
      fontSize: 12,
      fontWeight: 'bold',
      textAlign: 'center',
      color: primary,
      zIndex: nextZ(),
    }),
  ]

  return normalizeVerificationQr({
    version: 1,
    canvas: { width: w, height: h, background: '#ffffff', paperKey: paper.key },
    elements,
  })
}

/** Fee invoice / statement starter (not a certificate layout). */
export function createStarterInvoiceDesign(paperKey: PaperSizeKey = 'a4-portrait'): LogoBuilderDesign {
  const paper = getPaperSize(paperKey)
  const w = paper.width
  const h = paper.height
  const primary = '#0f172a'
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
    createBoundTextElement('institutionName', { width: w, height: h }, {
      y: 22,
      fontSize: 18,
      fontWeight: 'bold',
      color: '#ffffff',
      zIndex: nextZ(),
    }),
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
      color: '#b45309',
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
    },
  ]

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
    },
  ]
}

/** Ready decorative ornaments for certificates — borders, medals, seals, flourishes. */
export const DECORATIVE_SHAPE_CATEGORIES = [
  { id: 'borders', label: 'Borders & frames' },
  { id: 'badges', label: 'Badges, seals & medals' },
  { id: 'corners', label: 'Corner ornaments' },
  { id: 'dividers', label: 'Dividers & flourishes' },
  { id: 'modern', label: 'Modern accents' },
] as const

export const DECORATIVE_SHAPES = [
  // Borders
  { key: 'border_classic_double', label: 'Classic double frame', category: 'borders', size: 0, fullPage: true },
  { key: 'border_gold_ornate', label: 'Ornate gold frame', category: 'borders', size: 0, fullPage: true },
  { key: 'border_navy_block', label: 'Navy corner blocks', category: 'borders', size: 0, fullPage: true },
  { key: 'border_elegant_thin', label: 'Elegant thin frame', category: 'borders', size: 0, fullPage: true },
  { key: 'border_maroon_gold', label: 'Maroon & gold frame', category: 'borders', size: 0, fullPage: true },
  { key: 'border_green_filigree', label: 'Green filigree frame', category: 'borders', size: 0, fullPage: true },
  // Badges / seals / medals
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
  // Corners
  { key: 'corner_flourish', label: 'Corner flourish', category: 'corners', size: 90 },
  { key: 'corner_filigree', label: 'Corner filigree', category: 'corners', size: 100 },
  { key: 'corner_geometric', label: 'Corner geometric', category: 'corners', size: 90 },
  { key: 'corner_floral', label: 'Corner floral', category: 'corners', size: 95 },
  { key: 'corner_celtic', label: 'Corner celtic', category: 'corners', size: 90 },
  // Dividers & flourishes
  { key: 'ribbon', label: 'Ribbon banner', category: 'dividers', size: 240 },
  { key: 'divider_ornate', label: 'Ornate divider', category: 'dividers', size: 280 },
  { key: 'divider_diamond', label: 'Diamond divider', category: 'dividers', size: 260 },
  { key: 'flourish_scroll', label: 'Scroll flourish', category: 'dividers', size: 200 },
  { key: 'crown', label: 'Crown', category: 'dividers', size: 80 },
  { key: 'stars_row', label: 'Stars row', category: 'dividers', size: 180 },
  // Modern
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

/** Generate SVG markup for a decorative shape using primary/accent colors. */
export function buildDecorativeSvg(
  key: string,
  primary = '#002147',
  accent = '#c9a227',
): { svg: string; viewW: number; viewH: number } {
  const p = primary
  const a = accent
  const g = '#1a5c3a' // secondary green accent for multi-tone ornaments

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
  const built = buildDecorativeSvg(el.decorKey, primary, accent)
  return {
    ...el,
    fill: primary,
    stroke: accent,
    src: svgDataUri(built.svg),
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

  if (fullPage) {
    return {
      id: createElementId(),
      type: 'image',
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      rotation: 0,
      zIndex: 1,
      src: svgDataUri(built.svg),
      opacity: 1,
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
    src: svgDataUri(built.svg),
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
  if (isQrElement(el)) return 'verification-qr'
  if (el.type === 'image' && String(el.text || '').trim()) return String(el.text).trim()
  if (
    (el.type === 'rect' || el.type === 'ellipse' || el.type === 'line') &&
    String(el.text || '').trim()
  ) {
    return String(el.text).trim()
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

export function applyPaperSize(design: LogoBuilderDesign, paperKey: PaperSizeKey): LogoBuilderDesign {
  const paper = getPaperSize(paperKey)
  const prevW = design.canvas.width || paper.width
  const prevH = design.canvas.height || paper.height
  const scaleX = paper.width / prevW
  const scaleY = paper.height / prevH
  const next: LogoBuilderDesign = {
    version: 1,
    canvas: {
      width: paper.width,
      height: paper.height,
      background: design.canvas.background || '#ffffff',
      paperKey: paper.key,
    },
    elements: (design.elements || []).map((el) => ({
      ...el,
      x: el.x * scaleX,
      y: el.y * scaleY,
      width: Math.max(8, el.width * scaleX),
      height: Math.max(8, el.height * scaleY),
    })),
  }
  return normalizeVerificationQr(next)
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
  let paper = getPaperSize(paperKey || undefined)
  const width = Number(canvasRaw.width) > 0 ? Number(canvasRaw.width) : paper.width
  const height = Number(canvasRaw.height) > 0 ? Number(canvasRaw.height) : paper.height
  // If paperKey missing/mismatched, pick the closest predefined paper by aspect
  if (!paperKey || Math.abs(paper.width / paper.height - width / height) > 0.05) {
    const match = PAPER_SIZES.find(
      (p) => Math.abs(p.width / p.height - width / Math.max(1, height)) < 0.05,
    )
    if (match) paper = match
  }

  const normalized: LogoBuilderDesign = {
    version: 1,
    canvas: {
      width,
      height,
      background: String(canvasRaw.background || '#ffffff'),
      paperKey: paper.key,
    },
    elements: elements
      .filter((el): el is Record<string, unknown> => !!el && typeof el === 'object')
      .slice(0, 80)
      .map((el, index) => {
        const bindRaw = String(el.bind || 'none')
        const bind = (allowedBinds.has(bindRaw) ? bindRaw : 'none') as BuilderBinding
        const isQr =
          bind === 'qr' ||
          String(el.id) === SYSTEM_QR_ID ||
          String(el.id) === 'system_qr_locked'
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
          fontSize: Math.max(8, Math.min(120, Number(el.fontSize) || 16)),
          fontWeight: el.fontWeight === 'bold' ? 'bold' : 'normal',
          fontStyle: el.fontStyle === 'italic' ? 'italic' : 'normal',
          textAlign:
            el.textAlign === 'left' || el.textAlign === 'right' ? el.textAlign : 'center',
          color: String(el.color || '#0f172a'),
          fill: el.fill != null ? String(el.fill) : '#e2e8f0',
          stroke: el.stroke != null ? String(el.stroke) : '#002147',
          strokeWidth: Math.max(0, Number(el.strokeWidth) || 1),
          opacity: Math.min(1, Math.max(0.1, Number(el.opacity) || 1)),
          src: el.src ? String(el.src) : undefined,
          bind: isQr ? 'qr' : bind,
          locked: false,
          decorKey: el.decorKey ? String(el.decorKey) : undefined,
        }
      }),
  }

  // Refresh decorative SVG colors from stored fill/stroke if present
  normalized.elements = normalized.elements.map((el) => {
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
    programName?: string
    className?: string
    certificateNumber?: string
    dateIssued?: string | null
    institutionName?: string
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
    case 'programName':
      return data.programName || el.text || 'Program'
    case 'className':
      return data.className || el.text || 'Class'
    case 'certificateNumber':
      return data.certificateNumber || el.text || 'DOC-000'
    case 'dateIssued':
      return data.dateIssued ? String(data.dateIssued).slice(0, 10) : el.text || 'YYYY-MM-DD'
    case 'institutionName':
      return data.institutionName || el.text || 'Institution'
    case 'leftName':
      return data.leftName || el.text || 'Signatory'
    case 'rightName':
      return data.rightName || el.text || 'Signatory'
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
