/**
 * Built-in Transcript Template Library (catalog only).
 * Active selection is stored per institution on document_templates.layout_key
 * for document_type = 'transcript'. Branding always comes from Institution Settings.
 */

export const TRANSCRIPT_LAYOUT_KEYS = [
  'classic',
  'modern',
  'academic',
  'formal',
  'minimal',
  'institutional',
  'compact',
  'bordered',
] as const

/** Library + custom management modes (parity with certificates). */
export const TRANSCRIPT_ALL_LAYOUT_KEYS = [
  ...TRANSCRIPT_LAYOUT_KEYS,
  'custom_upload',
  'logo_builder',
] as const

export type TranscriptLayoutKey = (typeof TRANSCRIPT_ALL_LAYOUT_KEYS)[number]

export type TranscriptTemplateMeta = {
  key: (typeof TRANSCRIPT_LAYOUT_KEYS)[number]
  name: string
  category: string
  description: string
  accentHint: string
  /** Official layouts include the completion narrative under GPA. */
  showsNarrative?: boolean
}

/** Default paragraph for official transcript layouts (Classic / Academic / Formal / Bordered). */
export const DEFAULT_TRANSCRIPT_NARRATIVE =
  'The student successfully completed all prescribed coursework, final examinations, and program assessments in accordance with the academic requirements of the program. In fulfillment of the research and publication component, the student published two peer-reviewed scientific articles in Scopus-indexed journals, demonstrating competence in research design, scientific writing, data analysis, and scholarly publication. The student served as the first author on at least one of the published articles, evidencing substantial intellectual leadership and primary responsibility for the research.'

const TRANSCRIPT_NARRATIVE_LAYOUTS = new Set<string>([
  'classic',
  'academic',
  'formal',
  'bordered',
])

export function transcriptLayoutShowsNarrative(raw?: string | null): boolean {
  return TRANSCRIPT_NARRATIVE_LAYOUTS.has(libraryTranscriptLayoutKey(raw))
}

export function isCustomTranscriptLayout(raw?: string | null): boolean {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  return key === 'logo_builder' || key === 'custom_upload'
}

export function normalizeTranscriptLayoutKey(raw?: string | null): TranscriptLayoutKey {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  if (key === 'default' || !key) return 'classic'
  if ((TRANSCRIPT_ALL_LAYOUT_KEYS as readonly string[]).includes(key)) {
    return key as TranscriptLayoutKey
  }
  return 'classic'
}

/** Chrome/styles only apply to built-in library keys. */
export function libraryTranscriptLayoutKey(raw?: string | null): (typeof TRANSCRIPT_LAYOUT_KEYS)[number] {
  const key = normalizeTranscriptLayoutKey(raw)
  if (isCustomTranscriptLayout(key)) return 'classic'
  return key as (typeof TRANSCRIPT_LAYOUT_KEYS)[number]
}

export function isValidTranscriptLayoutKey(raw?: string | null): boolean {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  return key === 'default' || (TRANSCRIPT_ALL_LAYOUT_KEYS as readonly string[]).includes(key)
}

export const TRANSCRIPT_TEMPLATE_LIBRARY: TranscriptTemplateMeta[] = [
  {
    key: 'classic',
    name: 'Classic',
    category: 'Classic',
    description: 'Traditional black rules, official title block, and completion narrative.',
    accentHint: '#111827',
    showsNarrative: true,
  },
  {
    key: 'modern',
    name: 'Modern',
    category: 'Modern',
    description: 'Colored header band with clean table styling.',
    accentHint: '#0EA5E9',
  },
  {
    key: 'academic',
    name: 'Academic',
    category: 'Academic',
    description: 'Formal academic record with navy emphasis and completion narrative.',
    accentHint: '#1E3A5F',
    showsNarrative: true,
  },
  {
    key: 'formal',
    name: 'Formal',
    category: 'Formal',
    description: 'Double-frame margins with completion narrative for official use.',
    accentHint: '#0F172A',
    showsNarrative: true,
  },
  {
    key: 'minimal',
    name: 'Minimal',
    category: 'Minimal',
    description: 'Light rules and quiet typography.',
    accentHint: '#64748B',
  },
  {
    key: 'institutional',
    name: 'Institutional',
    category: 'Brand',
    description: 'Primary-color title bar aligned to institution branding.',
    accentHint: '#0066CC',
  },
  {
    key: 'compact',
    name: 'Compact',
    category: 'Modern',
    description: 'Denser layout for longer course lists.',
    accentHint: '#059669',
  },
  {
    key: 'bordered',
    name: 'Bordered',
    category: 'Formal',
    description: 'Full outer border, accent marks, and completion narrative.',
    accentHint: '#9F1239',
    showsNarrative: true,
  },
]

export type TranscriptRenderData = {
  layoutKey: TranscriptLayoutKey
  institutionName: string
  primary: string
  accent: string
  contactLine?: string
  logoUrl?: string | null
  studentName: string
  studentCode: string
  startMonth?: string
  completionMonth?: string
  programName: string
  credentialNumber: string
  footerText?: string
  narrativeText?: string
  gpa?: string
  courses?: Array<{ code: string; name: string; marks: string; grade: string; courseProject?: string }>
}

/** Shared layout chrome for live transcript + library preview. */
export function getTranscriptLayoutChrome(
  layoutKey: TranscriptLayoutKey,
  primary: string,
): {
  pageExtra: string
  headerBorder: string
  titleBar: string
  titleBarText: string
  sectionRule: string
  tableBorder: string
  badgeBorder: string
  outerFrame: string
} {
  const p = primary || '#111827'
  switch (layoutKey) {
    case 'modern':
      return {
        pageExtra: '',
        headerBorder: 'border-b-4',
        titleBar: '',
        titleBarText: 'text-white',
        sectionRule: 'border-b border-slate-400',
        tableBorder: 'border border-slate-700',
        badgeBorder: 'border-2 border-slate-800',
        outerFrame: '',
      }
    case 'academic':
      return {
        pageExtra: '',
        headerBorder: 'border-b-4 border-[#1E3A5F]',
        titleBar: 'bg-[#1E3A5F]',
        titleBarText: 'text-white',
        sectionRule: 'border-b border-[#1E3A5F]',
        tableBorder: 'border border-[#1E3A5F]',
        badgeBorder: 'border-2 border-[#1E3A5F]',
        outerFrame: '',
      }
    case 'formal':
      return {
        pageExtra: 'p-3',
        headerBorder: 'border-b-2 border-double border-black',
        titleBar: 'bg-black',
        titleBarText: 'text-white',
        sectionRule: 'border-b-2 border-black',
        tableBorder: 'border-2 border-black',
        badgeBorder: 'border-2 border-black',
        outerFrame: 'outline outline-2 outline-black outline-offset-[-10px]',
      }
    case 'minimal':
      return {
        pageExtra: '',
        headerBorder: 'border-b border-slate-300',
        titleBar: 'bg-slate-100',
        titleBarText: 'text-slate-900',
        sectionRule: 'border-b border-slate-200',
        tableBorder: 'border border-slate-300',
        badgeBorder: 'border border-slate-400',
        outerFrame: '',
      }
    case 'institutional':
      return {
        pageExtra: '',
        headerBorder: `border-b-4`,
        titleBar: '',
        titleBarText: 'text-white',
        sectionRule: 'border-b',
        tableBorder: 'border',
        badgeBorder: 'border-2',
        outerFrame: '',
      }
    case 'compact':
      return {
        pageExtra: '',
        headerBorder: 'border-b-2 border-black',
        titleBar: 'bg-black',
        titleBarText: 'text-white',
        sectionRule: 'border-b border-black',
        tableBorder: 'border border-black',
        badgeBorder: 'border border-black',
        outerFrame: '',
      }
    case 'bordered':
      return {
        pageExtra: 'p-4',
        headerBorder: 'border-b-4 border-black',
        titleBar: 'bg-black',
        titleBarText: 'text-white',
        sectionRule: 'border-b border-black',
        tableBorder: 'border border-black',
        badgeBorder: 'border-2 border-black',
        outerFrame: 'ring-2 ring-black ring-inset',
      }
    case 'classic':
    default:
      return {
        pageExtra: '',
        headerBorder: 'border-b-4 border-black',
        titleBar: 'bg-black',
        titleBarText: 'text-white',
        sectionRule: 'border-b border-black',
        tableBorder: 'border border-black',
        badgeBorder: 'border-2 border-black',
        outerFrame: '',
      }
  }
}

/** Inline styles that need the live primary color. */
export function getTranscriptLayoutStyles(
  layoutKey: TranscriptLayoutKey,
  primary: string,
): {
  headerBorderColor?: string
  titleBarBg?: string
  titleBarColor?: string
  sectionRuleColor?: string
  tableBorderColor?: string
  badgeBorderColor?: string
} {
  const p = primary || '#111827'
  if (layoutKey === 'modern' || layoutKey === 'institutional') {
    return {
      headerBorderColor: p,
      titleBarBg: p,
      titleBarColor: '#ffffff',
      sectionRuleColor: p,
      tableBorderColor: p,
      badgeBorderColor: p,
    }
  }
  if (layoutKey === 'academic') {
    return { titleBarBg: '#1E3A5F', titleBarColor: '#ffffff' }
  }
  if (layoutKey === 'minimal') {
    return { titleBarBg: '#f1f5f9', titleBarColor: '#0f172a' }
  }
  return { titleBarBg: '#000000', titleBarColor: '#ffffff' }
}
