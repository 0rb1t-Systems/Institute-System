/**
 * Built-in Certificate Template Library (catalog only).
 * Active selection is stored per institution on document_templates.layout_key
 * for document_type = 'certificate'. Branding always comes from Institution Settings.
 */

export const CERTIFICATE_LAYOUT_KEYS = [
  'modern',
  'classic',
  'premium',
  'elegant',
  'minimal',
  'luxury',
  'academic',
  'formal',
  'contemporary',
  'heritage',
  'appreciation',
  'ornate',
  'medallion',
  'horizon',
  'laurel',
  'regal',
] as const

/** A4 landscape library designs (297×210). Portrait keys stay 210×297. */
export const CERTIFICATE_LANDSCAPE_KEYS = [
  'appreciation',
  'ornate',
  'medallion',
  'horizon',
  'laurel',
] as const

/** Built-in library keys plus custom Certificate Management modes. */
export const CERTIFICATE_ALL_LAYOUT_KEYS = [
  ...CERTIFICATE_LAYOUT_KEYS,
  'custom_upload',
  'logo_builder',
] as const

export type CertificateLayoutKey = (typeof CERTIFICATE_ALL_LAYOUT_KEYS)[number]

export type CertificateTemplateMeta = {
  key: CertificateLayoutKey
  name: string
  category: string
  description: string
  /** Thumbnail accent hint for library cards */
  accentHint: string
}

/** Map legacy / unknown keys to a known layout. */
export function normalizeCertificateLayoutKey(raw?: string | null): CertificateLayoutKey {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  if (key === 'default' || !key) return 'classic'
  if ((CERTIFICATE_ALL_LAYOUT_KEYS as readonly string[]).includes(key)) {
    return key as CertificateLayoutKey
  }
  return 'classic'
}

export function isValidCertificateLayoutKey(raw?: string | null): boolean {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  return key === 'default' || (CERTIFICATE_ALL_LAYOUT_KEYS as readonly string[]).includes(key)
}

export function isBuiltInCertificateLayoutKey(raw?: string | null): boolean {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  return key === 'default' || (CERTIFICATE_LAYOUT_KEYS as readonly string[]).includes(key)
}

export function isLandscapeCertificateLayout(raw?: string | null): boolean {
  const key = normalizeCertificateLayoutKey(raw)
  return (CERTIFICATE_LANDSCAPE_KEYS as readonly string[]).includes(key)
}

export const CERTIFICATE_TEMPLATE_LIBRARY: CertificateTemplateMeta[] = [
  {
    key: 'modern',
    name: 'Modern',
    category: 'Modern',
    description: 'Bold header band, geometric accents, clean typography.',
    accentHint: '#0EA5E9',
  },
  {
    key: 'classic',
    name: 'Classic',
    category: 'Classic',
    description: 'Traditional training-center layout with signature lines.',
    accentHint: '#002147',
  },
  {
    key: 'premium',
    name: 'Premium',
    category: 'Premium',
    description: 'Double frame, refined spacing, elevated presentation.',
    accentHint: '#B45309',
  },
  {
    key: 'elegant',
    name: 'Elegant',
    category: 'Elegant',
    description: 'Centered serif emphasis with delicate ornamental rules.',
    accentHint: '#7C3AED',
  },
  {
    key: 'minimal',
    name: 'Minimal',
    category: 'Minimal',
    description: 'Quiet whitespace, thin rules, understated authority.',
    accentHint: '#334155',
  },
  {
    key: 'luxury',
    name: 'Luxury',
    category: 'Luxury',
    description: 'Deep header and footer panels with gold-line accents.',
    accentHint: '#C9A227',
  },
  {
    key: 'academic',
    name: 'Academic',
    category: 'Academic',
    description: 'Formal academic composition with seal-forward balance.',
    accentHint: '#1E3A5F',
  },
  {
    key: 'formal',
    name: 'Formal',
    category: 'Formal',
    description: 'Strict margins, corner marks, official document feel.',
    accentHint: '#111827',
  },
  {
    key: 'contemporary',
    name: 'Contemporary',
    category: 'Modern',
    description: 'Side accent bar and modern title block.',
    accentHint: '#059669',
  },
  {
    key: 'heritage',
    name: 'Heritage',
    category: 'Classic',
    description: 'Ribbon title banner and classic crest placement.',
    accentHint: '#9F1239',
  },
  {
    key: 'appreciation',
    name: 'Appreciation',
    category: 'Landscape',
    description: 'A4 landscape navy header, gold wave, seal-forward layout.',
    accentHint: '#001F3F',
  },
  {
    key: 'ornate',
    name: 'Ornate Frame',
    category: 'Landscape',
    description: 'Landscape cream paper with triple gold filigree frames.',
    accentHint: '#C9A227',
  },
  {
    key: 'medallion',
    name: 'Medallion',
    category: 'Landscape',
    description: 'Colorful corner seals and a central medallion on landscape.',
    accentHint: '#DC2626',
  },
  {
    key: 'horizon',
    name: 'Horizon',
    category: 'Landscape',
    description: 'Wide landscape with a brand side panel and gold rules.',
    accentHint: '#0F766E',
  },
  {
    key: 'laurel',
    name: 'Laurel',
    category: 'Landscape',
    description: 'Landscape laurel sides, ribbon title, and honor patches.',
    accentHint: '#15803D',
  },
  {
    key: 'regal',
    name: 'Regal',
    category: 'Classic',
    description: 'Portrait baroque gold frame with corner ornaments.',
    accentHint: '#92400E',
  },
]

export function getCertificateTemplateMeta(key?: string | null): CertificateTemplateMeta {
  const normalized = normalizeCertificateLayoutKey(key)
  return (
    CERTIFICATE_TEMPLATE_LIBRARY.find((t) => t.key === normalized) ||
    CERTIFICATE_TEMPLATE_LIBRARY.find((t) => t.key === 'classic') ||
    CERTIFICATE_TEMPLATE_LIBRARY[0]
  )
}

/** Shared payload shape for screen + PDF renderers. */
export type CertificateRenderData = {
  layoutKey: CertificateLayoutKey
  institutionName: string
  primary: string
  accent?: string
  motto?: string
  description?: string
  logoUrl?: string | null
  /** Live student ID / profile photo (from profiles.avatar_url). */
  studentPhotoUrl?: string | null
  institutionEmail?: string
  institutionPhone?: string
  institutionAddress?: string
  institutionWebsite?: string
  sealUrl?: string | null
  signatureUrl?: string | null
  leftTitle: string
  rightTitle: string
  leftName?: string
  rightName?: string
  footerText?: string
  studentName: string
  studentId?: string
  startMonth?: string
  completionMonth?: string
  programName: string
  className?: string
  certificateNumber: string
  verifyCode?: string
  verificationUrl?: string
  dateIssued?: string | null
  /** Transcript / invoice builder extras (optional). */
  gpa?: string
  gradesSummary?: string
  invoiceNumber?: string
  totalDue?: string
  amountPaid?: string
  balance?: string
  lineItemsSummary?: string
  /** Certificate builder design (from template config / snapshot). */
  logoBuilderDesign?: import('@/lib/certificateBuilder').LogoBuilderDesign | null
  /** Signed URL for custom uploaded background (private bucket). */
  customBackgroundUrl?: string | null
  /** width/height of uploaded template — used to size paper correctly. */
  customAspectRatio?: number | null
  /** Matched field positions for Upload Own Certificate. */
  customFieldLayout?: import('@/lib/certificateBuilder').UploadFieldLayout | null
  /** Editable text layers covering printed content on an uploaded paper. */
  customPaperLayers?: import('@/lib/certificateBuilder').PaperContentLayer[] | null
}
