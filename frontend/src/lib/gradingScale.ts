/**
 * Institution grading scale — single source of truth for letter grades,
 * grade points, pass mark, and transcript Key-to-Grades display.
 * Null / missing custom scale → platform default (A–F / 4.0).
 */

export type GradeBand = {
  min: number
  max: number
  letter: string
  points: number
  label: string
}

export type GradeClassification = {
  name: string
  min: number
  max: number
}

export type GradingScale = {
  version: number
  source: 'default' | 'manual' | 'upload'
  pass_mark: number
  scale_max: number
  bands: GradeBand[]
  classifications: GradeClassification[]
  source_file_url?: string | null
  updated_at?: string | null
}

export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { min: 90, max: 100, letter: 'A', points: 4.0, label: '90 - 100' },
  { min: 80, max: 89.9, letter: 'B', points: 3.0, label: '80 - 89.9' },
  { min: 70, max: 79.9, letter: 'C', points: 2.0, label: '70 - 79.9' },
  { min: 60, max: 69.9, letter: 'D', points: 1.0, label: '60 - 69.9' },
  { min: 0, max: 59.9, letter: 'F', points: 0.0, label: 'Below 60' },
]

export const DEFAULT_CLASSIFICATIONS: GradeClassification[] = [
  { name: 'First Class', min: 3.5, max: 4.0 },
  { name: 'Second Class – Upper Division', min: 3.0, max: 3.49 },
  { name: 'Second Class – Lower Division', min: 2.5, max: 2.99 },
  { name: 'Pass', min: 2.0, max: 2.49 },
]

export function getDefaultGradingScale(): GradingScale {
  return {
    version: 1,
    source: 'default',
    pass_mark: 60,
    scale_max: 4.0,
    bands: DEFAULT_GRADE_BANDS.map((b) => ({ ...b })),
    classifications: DEFAULT_CLASSIFICATIONS.map((c) => ({ ...c })),
    source_file_url: null,
    updated_at: null,
  }
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function cleanLetter(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 24)
}

/** Normalize stored JSON or return default. */
export function normalizeGradingScale(raw: unknown): GradingScale {
  const def = getDefaultGradingScale()
  if (!raw || typeof raw !== 'object') return def
  const o = raw as Record<string, unknown>
  const bandsIn = Array.isArray(o.bands) ? o.bands : null
  if (!bandsIn || bandsIn.length === 0) return def

  const bands: GradeBand[] = bandsIn
    .map((row) => {
      const r = (row || {}) as Record<string, unknown>
      const min = num(r.min)
      const max = num(r.max, min)
      const letter = cleanLetter(r.letter)
      const points = num(r.points)
      const label =
        String(r.label || '').trim() ||
        (min <= 0 && max < 60 ? `Below ${Math.ceil(max + 0.1)}` : `${min} - ${max}`)
      return { min, max, letter, points, label }
    })
    .filter((b) => b.letter)
    .sort((a, b) => b.min - a.min)

  if (bands.length === 0) return def

  const classificationsIn = Array.isArray(o.classifications) ? o.classifications : null
  const classifications: GradeClassification[] =
    classificationsIn && classificationsIn.length > 0
      ? classificationsIn
          .map((row) => {
            const r = (row || {}) as Record<string, unknown>
            return {
              name: String(r.name || '').trim() || 'Classification',
              min: num(r.min),
              max: num(r.max),
            }
          })
          .filter((c) => c.name)
      : def.classifications.map((c) => ({ ...c }))

  const source =
    o.source === 'manual' || o.source === 'upload' || o.source === 'default'
      ? o.source
      : 'manual'

  const passMark = num(o.pass_mark, def.pass_mark)
  const scaleMax = num(o.scale_max, Math.max(...bands.map((b) => b.points), def.scale_max))

  return {
    version: 1,
    source,
    pass_mark: passMark >= 0 && passMark <= 100 ? passMark : def.pass_mark,
    scale_max: scaleMax > 0 ? scaleMax : def.scale_max,
    bands,
    classifications,
    source_file_url: o.source_file_url ? String(o.source_file_url) : null,
    updated_at: o.updated_at ? String(o.updated_at) : null,
  }
}

/** Active scale for an institution row (custom if set, else default). */
export function getInstitutionGradeScale(
  institution?: { grading_scale?: unknown } | null,
): GradingScale {
  if (!institution?.grading_scale) return getDefaultGradingScale()
  return normalizeGradingScale(institution.grading_scale)
}

export function isCustomGradingScale(
  institution?: { grading_scale?: unknown } | null,
): boolean {
  return institution?.grading_scale != null
}

function matchBand(percentage: number, scale: GradingScale): GradeBand | null {
  const p = Number(percentage)
  if (!Number.isFinite(p)) return null
  const sorted = [...scale.bands].sort((a, b) => b.min - a.min)
  for (const band of sorted) {
    if (p >= band.min) return band
  }
  return sorted[sorted.length - 1] || null
}

export function getLetterGradeFromScale(percentage: number, scale?: GradingScale | null): string {
  const s = scale || getDefaultGradingScale()
  const p = Number(percentage)
  if (!Number.isFinite(p)) return '-'
  return matchBand(p, s)?.letter || '-'
}

export function getGradePointsFromScale(percentage: number, scale?: GradingScale | null): number {
  const s = scale || getDefaultGradingScale()
  const p = Number(percentage)
  if (!Number.isFinite(p)) return 0
  return matchBand(p, s)?.points ?? 0
}

export function isCoursePassedFromScale(
  percentage: number,
  scale?: GradingScale | null,
): boolean {
  const s = scale || getDefaultGradingScale()
  return Number(percentage) >= s.pass_mark
}

export function formatClassificationRange(c: GradeClassification): string {
  const a = Number(c.min).toFixed(2)
  const b = Number(c.max).toFixed(2)
  return `${a} - ${b}`
}

/** Validate bands before save. Returns error message or null. */
export function validateGradingScale(scale: GradingScale): string | null {
  if (!scale.bands?.length) return 'Add at least one grade band.'
  for (const b of scale.bands) {
    if (!b.letter?.trim()) return 'Every band needs a letter grade.'
    if (!Number.isFinite(b.min) || !Number.isFinite(b.max)) return 'Mark ranges must be numbers.'
    if (b.min < 0 || b.max > 100) return 'Mark ranges must be between 0 and 100.'
    if (b.min > b.max) return `Invalid range for ${b.letter}: min > max.`
    if (!Number.isFinite(b.points) || b.points < 0) return 'Grade points must be non-negative numbers.'
  }
  const sorted = [...scale.bands].sort((a, b) => a.min - b.min)
  if (sorted[0].min > 0.05) return 'Bands should cover down to 0 (failing range).'
  const top = sorted[sorted.length - 1]
  if (top.max < 99.5) return 'Bands should cover up to 100.'
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (cur.min < prev.max - 0.15) {
      return `Overlapping ranges: ${prev.letter} and ${cur.letter}.`
    }
    if (cur.min - prev.max > 1.5) {
      return `Gap between ${prev.letter} and ${cur.letter}. Cover 0–100 without gaps.`
    }
  }
  if (!Number.isFinite(scale.pass_mark) || scale.pass_mark < 0 || scale.pass_mark > 100) {
    return 'Pass mark must be between 0 and 100.'
  }
  return null
}

export function buildGradingScalePayload(
  scale: GradingScale,
  source: GradingScale['source'],
): GradingScale {
  const normalized = normalizeGradingScale({
    ...scale,
    source,
    updated_at: new Date().toISOString(),
  })
  return normalized
}
