/**
 * Institution landing page copy (About / Programs).
 * Plain text only — never render as HTML.
 */

export const LANDING_PROGRAM_ICON_IDS = [
  'graduation',
  'book',
  'code',
  'palette',
  'briefcase',
  'laptop',
  'camera',
  'globe',
  'languages',
  'calculator',
  'music',
  'stethoscope',
  'wrench',
  'megaphone',
  'award',
  'users',
] as const

export type LandingProgramIconId = (typeof LANDING_PROGRAM_ICON_IDS)[number]

export type LandingProgramItem = {
  title: string
  description: string
  image_url: string
  icon: LandingProgramIconId | ''
}

export function emptyLandingProgram(): LandingProgramItem {
  return { title: '', description: '', image_url: '', icon: '' }
}

export function isLandingProgramIconId(value: string): value is LandingProgramIconId {
  return (LANDING_PROGRAM_ICON_IDS as readonly string[]).includes(value)
}

export function sanitizeProgramIcon(value: unknown): LandingProgramIconId | '' {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
  return isLandingProgramIconId(s) ? s : ''
}

/** Persist only http(s) image URLs. Blob previews stay in the editor until upload. */
export function sanitizeProgramImageUrl(value: unknown, allowBlob = false): string {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (allowBlob && s.startsWith('blob:')) return s.slice(0, 2000)
  if (!/^https?:\/\//i.test(s)) return ''
  if (/[\s<>'"]/.test(s) || /javascript:/i.test(s) || /^data:/i.test(s)) return ''
  return s.slice(0, 2000)
}

export type LandingContent = {
  about_title: string
  about_body: string
  about_highlights: string[]
  programs_intro: string
  programs: LandingProgramItem[]
}

export const EMPTY_LANDING_CONTENT: LandingContent = {
  about_title: '',
  about_body: '',
  about_highlights: ['', '', '', ''],
  programs_intro: '',
  programs: [emptyLandingProgram(), emptyLandingProgram()],
}

const LIMITS = {
  about_title: 80,
  about_body: 4000,
  highlight: 90,
  programs_intro: 400,
  program_title: 80,
  program_description: 280,
  max_highlights: 4,
  max_programs: 8,
}

/** Strip tags/control chars so public pages cannot run injected markup. */
export function sanitizePlainText(value: unknown, maxLen: number): string {
  let s = String(value ?? '')
  s = s.replace(/<[^>]*>/g, ' ')
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length > maxLen) s = s.slice(0, maxLen).trim()
  return s
}

export function sanitizeLandingContent(raw?: unknown): LandingContent {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const highlightsIn = Array.isArray(src.about_highlights) ? src.about_highlights : []
  const programsIn = Array.isArray(src.programs) ? src.programs : []

  const about_highlights = highlightsIn
    .slice(0, LIMITS.max_highlights)
    .map((h) => sanitizePlainText(h, LIMITS.highlight))

  while (about_highlights.length < 4) about_highlights.push('')

  const programs = programsIn.slice(0, LIMITS.max_programs).map((row) => {
    const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    return {
      title: sanitizePlainText(item.title, LIMITS.program_title),
      description: sanitizePlainText(item.description, LIMITS.program_description),
      image_url: sanitizeProgramImageUrl(item.image_url, true),
      icon: sanitizeProgramIcon(item.icon),
    }
  })

  while (programs.length < 2) programs.push(emptyLandingProgram())

  return {
    about_title: sanitizePlainText(src.about_title, LIMITS.about_title),
    about_body: sanitizePlainText(src.about_body, LIMITS.about_body),
    about_highlights,
    programs_intro: sanitizePlainText(src.programs_intro, LIMITS.programs_intro),
    programs,
  }
}

export function landingContentForSave(content: LandingContent): LandingContent {
  const clean = sanitizeLandingContent(content)
  return {
    ...clean,
    about_highlights: clean.about_highlights.filter(Boolean).slice(0, LIMITS.max_highlights),
    programs: clean.programs
      .map((p) => ({ ...p, image_url: sanitizeProgramImageUrl(p.image_url, false) }))
      .filter((p) => p.title || p.description || p.image_url)
      .slice(0, LIMITS.max_programs),
  }
}

export const DEFAULT_ABOUT_HIGHLIGHTS = [
  'Quality teaching and practical skills',
  'Official certificates and transcripts',
  'A trusted place for students and partners',
]

export function filledAboutHighlights(content: LandingContent): string[] {
  return content.about_highlights.map((h) => String(h || '').trim()).filter(Boolean)
}

export function filledLandingPrograms(content: LandingContent): LandingProgramItem[] {
  return content.programs.filter(
    (p) =>
      String(p.title || '').trim() ||
      String(p.description || '').trim() ||
      String(p.image_url || '').trim(),
  )
}

/** About block is optional — only render what the institution actually wrote. */
export function landingAboutVisible(content: LandingContent): boolean {
  return Boolean(
    String(content.about_title || '').trim() ||
      String(content.about_body || '').trim() ||
      filledAboutHighlights(content).length,
  )
}

/** Programs block is optional — skipped copy stays off the public page. */
export function landingProgramsVisible(content: LandingContent): boolean {
  return Boolean(String(content.programs_intro || '').trim() || filledLandingPrograms(content).length)
}

export const DEFAULT_PROGRAMS: LandingProgramItem[] = [
  {
    title: 'Professional programs',
    description: 'Structured learning paths designed for career-ready skills and recognised credentials.',
    image_url: '',
    icon: 'graduation',
  },
  {
    title: 'Short courses',
    description: 'Focused training you can complete alongside work, with clear outcomes.',
    image_url: '',
    icon: 'book',
  },
  {
    title: 'Credentials',
    description: 'Institution-branded certificates and transcripts that employers can verify.',
    image_url: '',
    icon: 'award',
  },
  {
    title: 'Student support',
    description: 'Guidance from enrolment through attendance, exams, and graduation.',
    image_url: '',
    icon: 'users',
  },
]
