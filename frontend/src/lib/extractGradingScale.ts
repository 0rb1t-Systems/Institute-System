/**
 * OCR / text extraction of institution "KEY TO GRADES" documents
 * into structured grading bands for admin review before save.
 */
import type { GradeBand, GradeClassification, GradingScale } from '@/lib/gradingScale'
import { getDefaultGradingScale } from '@/lib/gradingScale'

function normalizeDashes(s: string): string {
  return s
    .replace(/[–—−‒]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract raw text from image (or data URL) via Tesseract. */
export async function ocrGradingDocumentText(
  imageUrl: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const result = await worker.recognize(imageUrl)
    return String(result?.data?.text || '')
  } finally {
    await worker.terminate()
  }
}

/** Extract text from first page of a PDF as image-like OCR via pdf.js canvas. */
export async function ocrGradingPdfFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE')
  await page.render({ canvasContext: ctx, viewport }).promise
  const dataUrl = canvas.toDataURL('image/png')
  return ocrGradingDocumentText(dataUrl, onProgress)
}

type ParsedRow = { min: number; max: number; letter: string; points: number; label: string }

function parseRangeLabel(raw: string): { min: number; max: number; label: string } | null {
  const t = normalizeDashes(raw)
  const below = t.match(/^(?:below|under|<)\s*(\d+(?:\.\d+)?)/i)
  if (below) {
    const max = Number(below[1]) - 0.1
    return { min: 0, max: Math.max(0, max), label: `Below ${below[1]}` }
  }
  const range = t.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
  if (range) {
    const a = Number(range[1])
    const b = Number(range[2])
    return { min: Math.min(a, b), max: Math.max(a, b), label: `${Math.min(a, b)} - ${Math.max(a, b)}` }
  }
  const single = t.match(/^(\d+(?:\.\d+)?)\+?$/)
  if (single) {
    const n = Number(single[1])
    return { min: n, max: 100, label: `${n} - 100` }
  }
  return null
}

function looksLikeHeader(line: string): boolean {
  const l = line.toLowerCase()
  return (
    (l.includes('mark') && l.includes('grade')) ||
    l.includes('letter grade') ||
    l.includes('grade point') ||
    l.includes('key to grades') ||
    l.includes('grading system')
  )
}

/**
 * Parse OCR / pasted text into grade bands.
 * Handles table-like lines: "90 - 100 A 4.0" or "Below 60 F 0.0"
 */
export function parseGradingKeyText(text: string): GradeBand[] {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => normalizeDashes(l))
    .filter((l) => l.length >= 3)

  const rows: ParsedRow[] = []

  for (const line of lines) {
    if (looksLikeHeader(line) && !/\d/.test(line)) continue

    // Pattern: range + letter + points
    // e.g. "90 - 100 A 4.0" | "Below 60 F 0.0" | "80-89.9 B 3"
    const m = line.match(
      /((?:below|under|<)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\+)\s+([A-Za-z][A-Za-z+\-.]{0,12})\s+(\d+(?:\.\d+)?)/i,
    )
    if (m) {
      const range = parseRangeLabel(m[1])
      if (!range) continue
      rows.push({
        ...range,
        letter: m[2].toUpperCase().replace(/[^A-Z+\-.]/g, '') || m[2].trim(),
        points: Number(m[3]),
      })
      continue
    }

    // Looser: find numbers and a letter token
    const tokens = line.split(/\s+/).filter(Boolean)
    if (tokens.length < 2) continue
    let letterTok = ''
    let pointsTok = ''
    let rangeTok = ''
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]
      if (/^(?:below|under)$/i.test(tok) && tokens[i + 1]) {
        rangeTok = `${tok} ${tokens[i + 1]}`
        i++
        continue
      }
      if (/\d+\s*-\s*\d+/.test(tok) || /^\d+(?:\.\d+)?-\d/.test(tok)) {
        rangeTok = tok
        continue
      }
      if (/^[A-Za-z][A-Za-z+\-.]{0,8}$/.test(tok) && !/^(mark|letter|grade|point|points|the|system|is|as|follows)$/i.test(tok)) {
        letterTok = tok
        continue
      }
      if (/^\d+(?:\.\d+)?$/.test(tok) && letterTok) {
        pointsTok = tok
      }
    }
    if (rangeTok && letterTok && pointsTok) {
      const range = parseRangeLabel(rangeTok)
      if (range) {
        rows.push({
          ...range,
          letter: letterTok.toUpperCase(),
          points: Number(pointsTok),
        })
      }
    }
  }

  // Deduplicate by letter keeping first
  const seen = new Set<string>()
  const bands: GradeBand[] = []
  for (const r of rows.sort((a, b) => b.min - a.min)) {
    const key = r.letter.toUpperCase()
    if (seen.has(key)) continue
    seen.add(key)
    bands.push({
      min: r.min,
      max: r.max,
      letter: r.letter,
      points: r.points,
      label: r.label,
    })
  }
  return bands
}

export function parseClassificationText(text: string): GradeClassification[] {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => normalizeDashes(l))
  const out: GradeClassification[] = []
  for (const line of lines) {
    const m = line.match(
      /(.+?)\s+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/i,
    )
    if (!m) continue
    const name = m[1]
      .replace(/class\/classification/i, '')
      .replace(/cgpa\s*range/i, '')
      .trim()
    if (!name || name.length < 3) continue
    if (/key to|grading|mark\s*%/i.test(name)) continue
    out.push({
      name,
      min: Number(m[2]),
      max: Number(m[3]),
    })
  }
  return out
}

export async function extractGradingScaleFromFile(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Partial<GradingScale> & { rawText: string; bands: GradeBand[] }> {
  let text = ''
  const type = file.type || ''
  if (type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    text = await ocrGradingPdfFile(file, onProgress)
  } else {
    const url = URL.createObjectURL(file)
    try {
      text = await ocrGradingDocumentText(url, onProgress)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const bands = parseGradingKeyText(text)
  const classifications = parseClassificationText(text)
  const def = getDefaultGradingScale()

  // Infer pass mark from lowest non-fail band or "Below X"
  let passMark = def.pass_mark
  const below = bands.find((b) => /^below/i.test(b.label) || b.min === 0)
  if (below && below.max > 0) {
    passMark = Math.round(below.max + 0.1)
  } else if (bands.length) {
    const sorted = [...bands].sort((a, b) => a.min - b.min)
    const second = sorted[1]
    if (second) passMark = second.min
  }

  const scaleMax =
    bands.length > 0 ? Math.max(...bands.map((b) => b.points), 0) : def.scale_max

  return {
    rawText: text,
    bands,
    classifications: classifications.length ? classifications : undefined,
    pass_mark: passMark,
    scale_max: scaleMax || def.scale_max,
    source: 'upload',
  }
}
