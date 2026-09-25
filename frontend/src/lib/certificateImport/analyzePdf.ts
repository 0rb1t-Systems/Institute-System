/**
 * Read a certificate PDF as vectors and text. The rendered bitmap is used only
 * to sample colors and, when needed, OCR. It is never returned as a background.
 */
import { mapFontFamily, paletteFromPixels, rgbToHex } from '@/lib/certificateImport/color'
import { applyContentMargins, pageFromPoints } from '@/lib/certificateImport/pageSize'
import {
  CertificateImportError,
  type ImportBrand,
  type ImportProgress,
  type RawCertificateScan,
  type ShapeBlock,
  type TextBlock,
} from '@/lib/certificateImport/types'
import {
  sanitizeScanTexts,
  unglueCamel,
} from '@/lib/certificateImport/untangle'

type Matrix = [number, number, number, number, number, number]

function mul(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1
  const [a2, b2, c2, d2, e2, f2] = m2
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

function apply(m: Matrix, x: number, y: number) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  return pdfjs
}

function dedupeRawItems(items: TextBlock[]): TextBlock[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x || b.fontSize - a.fontSize)
  const out: TextBlock[] = []
  for (const item of sorted) {
    const text = item.text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const dup = out.find((o) => {
      const sameSpot = Math.abs(o.y - item.y) <= 3 && Math.abs(o.x - item.x) <= 4
      if (!sameSpot) return false
      const a = o.text.toLowerCase()
      const b = text.toLowerCase()
      return a === b || a.includes(b) || b.includes(a)
    })
    if (dup) {
      if (text.length > dup.text.length) {
        const idx = out.indexOf(dup)
        out[idx] = { ...item, text }
      }
      continue
    }
    out.push({ ...item, text })
  }
  return out
}

function mergeLines(items: TextBlock[], tolerance: number, pageWidth: number): TextBlock[] {
  const sorted = dedupeRawItems(items).sort((a, b) => a.y - b.y || a.x - b.x)
  // Tight gap — never bridge left/right signature columns across the page
  const maxGap = Math.max(12, Math.min(28, pageWidth * 0.028))
  const columnBreak = pageWidth * 0.22
  const lines: TextBlock[][] = []
  for (const item of sorted) {
    // Skip tiny seal/logo shards before they glue into nonsense
    if (item.text.length <= 2 && item.fontSize < 14) continue
    const line = lines.find((group) => {
      const ref = group[0]
      const sameRow = Math.abs(ref.y - item.y) <= tolerance
      if (!sameRow) return false
      const sizeRatio =
        Math.max(ref.fontSize, item.fontSize) / Math.max(1, Math.min(ref.fontSize, item.fontSize))
      if (sizeRatio > 1.55) return false
      const right = Math.max(...group.map((g) => g.x + g.width))
      const left = Math.min(...group.map((g) => g.x))
      const gap = item.x - right
      // Duplicate layer sitting on top of existing glyphs — do not append
      const overlap =
        item.x < right && item.x + item.width > left && Math.abs(item.x - left) < item.fontSize * 0.6
      if (overlap && group.some((g) => g.text.toLowerCase() === item.text.toLowerCase())) {
        return false
      }
      const groupText = group.map((g) => g.text).join(' ')
      const itemText = item.text.trim()
      // Never glue ALL-CAPS person names into certify/body sentences
      const joiningNameIntoSentence =
        (/^[A-Z][A-Z\s]{4,}$/.test(itemText) && /[a-z]/.test(groupText)) ||
        (/^[A-Z][A-Z\s]{4,}$/.test(groupText.trim()) &&
          /this is to certify|having completed|academic board/i.test(itemText)) ||
        (/this is to certify|having completed/i.test(itemText) &&
          /^[A-Z][A-Z\s]{4,}$/.test(groupText.trim()))
      if (joiningNameIntoSentence) return false
      // Keep signatory titles / cert no in separate columns
      const groupIsTitle = /registrar|principal|director|dean|cert\.?\s*no/i.test(groupText)
      const itemIsTitle = /registrar|principal|director|dean|cert\.?\s*no/i.test(itemText)
      if ((groupIsTitle || itemIsTitle) && gap > item.fontSize * 1.2) return false
      if (gap > columnBreak) return false
      // Only glue nearby words on the same row
      if (gap < -item.fontSize * 0.35) return false
      return gap >= -2 && gap < maxGap
    })
    if (line) {
      // Skip exact duplicate token already in the row
      if (line.some((g) => g.text.toLowerCase() === item.text.toLowerCase() && Math.abs(g.x - item.x) < 6)) {
        continue
      }
      line.push(item)
    } else lines.push([item])
  }
  return lines
    .map((group): TextBlock => {
      const parts = group.sort((a, b) => a.x - b.x)
      const first = parts[0]
      const last = parts[parts.length - 1]
      const text = unglueCamel(parts.map((p) => p.text).join(' '))
      return {
        ...first,
        text,
        x: first.x,
        width: Math.max(12, last.x + last.width - first.x),
        height: Math.max(...parts.map((p) => p.height)),
        fontSize: Math.max(...parts.map((p) => p.fontSize)),
        fontWeight: parts.some((p) => p.fontWeight === 'bold') ? 'bold' : 'normal',
        fontStyle: parts.some((p) => p.fontStyle === 'italic') ? 'italic' : 'normal',
      }
    })
    .filter((block) => {
      const t = block.text
      if (t.length < 3) return false
      const letters = t.replace(/[^A-Za-z]/g, '')
      if (letters.length >= 5 && !/\s/.test(t)) {
        const vowels = (letters.match(/[aeiouAEIOU]/g) || []).length
        if (vowels / letters.length < 0.18) return false
      }
      return true
    })
}

/** Split jammed merged lines into separate text blocks for classification. */
function expandMergedTexts(blocks: TextBlock[]): TextBlock[] {
  return sanitizeScanTexts(blocks).map((block) => ({
    text: String(block.text || ''),
    x: Number(block.x) || 0,
    y: Number(block.y) || 0,
    width: Number(block.width) || 12,
    height: Math.max(Number(block.height) || 12, Math.round((Number(block.fontSize) || 14) * 1.2)),
    fontSize: Number(block.fontSize) || 14,
    fontFamily: String(block.fontFamily || 'Georgia, serif'),
    fontWeight: block.fontWeight === 'bold' ? 'bold' : 'normal',
    fontStyle: block.fontStyle === 'italic' ? 'italic' : 'normal',
    align: block.align === 'left' || block.align === 'right' ? block.align : 'center',
    color: String(block.color || '#0f172a'),
    letterSpacing: Number(block.letterSpacing) || 0,
    lineHeight: Number(block.lineHeight) || 1.15,
  }))
}

function guessAlign(block: TextBlock, canvasW: number): TextBlock['align'] {
  const mid = block.x + block.width / 2
  if (mid > canvasW * 0.38 && mid < canvasW * 0.62 && block.x > canvasW * 0.08) return 'center'
  if (block.x > canvasW * 0.55) return 'right'
  return 'left'
}

type Gfx = {
  ctm: Matrix
  fill: string
  stroke: string
  lineWidth: number
}

export async function analyzeCertificatePdf(
  file: File,
  brand: ImportBrand,
  onProgress: ImportProgress,
): Promise<RawCertificateScan> {
  onProgress('reading')
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>
  try {
    pdf = await pdfjs.getDocument({ data }).promise
  } catch {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }

  onProgress('layout')
  const pdfPage = await pdf.getPage(1)
  const unscaled = pdfPage.getViewport({ scale: 1 })
  const base = pageFromPoints(unscaled.width, unscaled.height)
  const sx = base.width / unscaled.width
  const sy = base.height / unscaled.height
  const content = await pdfPage.getTextContent()
  const raw: TextBlock[] = []

  for (const item of content.items as Array<Record<string, unknown>>) {
    if (!item || typeof item.str !== 'string') continue
    const text = item.str.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const transform = (item.transform as number[]) || [1, 0, 0, 1, 0, 0]
    const fontHeight = Math.max(1, Math.hypot(transform[2] || 0, transform[3] || 0))
    const [vx, vy] = unscaled.convertToViewportPoint(transform[4] || 0, transform[5] || 0)
    const fontSize = Math.max(8, Math.min(72, Math.round(fontHeight * sy)))
    const hScale = Math.max(0.01, Math.hypot(transform[0] || 1, transform[1] || 0))
    const advance =
      typeof item.width === 'number' && item.width > 0
        ? item.width * hScale
        : fontHeight * text.length * 0.5
    const fontName = String(item.fontName || '')
    raw.push({
      text,
      x: Math.max(0, vx * sx),
      y: Math.max(0, vy * sy - fontSize * 0.85),
      width: Math.max(8, advance * sx),
      height: fontSize * 1.25,
      fontSize,
      fontFamily: mapFontFamily(fontName),
      fontWeight: /bold|black|heavy|semibold/i.test(fontName) ? 'bold' : 'normal',
      fontStyle: /italic|oblique/i.test(fontName) ? 'italic' : 'normal',
      align: 'left',
      color: '#0f172a',
      letterSpacing: 0,
      lineHeight: 1.15,
    })
  }

  let texts = expandMergedTexts(
    mergeLines(raw, Math.max(2, base.height * 0.008), base.width),
  ).slice(0, 80)
  let scanned = false
  const warnings: string[] = []
  if (pdf.numPages > 1) {
    warnings.push('Only the first page was used to build the template.')
  }

  const renderScale = Math.min(1.25, 1000 / Math.max(1, unscaled.width))
  const paintViewport = pdfPage.getViewport({ scale: renderScale })
  const sample = document.createElement('canvas')
  sample.width = Math.max(1, Math.floor(paintViewport.width))
  sample.height = Math.max(1, Math.floor(paintViewport.height))
  const ctx = sample.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }
  await pdfPage.render({ canvasContext: ctx, viewport: paintViewport }).promise

  onProgress('typography')
  const charCount = texts.reduce((sum, t) => sum + t.text.length, 0)
  if (charCount < 20) {
    onProgress('typography', 'Reading scanned text…')
    scanned = true
    const ocrTexts = await readOcr(sample, base.width, base.height, onProgress)
    if (ocrTexts.length) texts = expandMergedTexts(ocrTexts)
  }
  texts = texts.map((block) => ({ ...block, align: guessAlign(block, base.width) }))

  onProgress('colors')
  const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data
  let colors = paletteFromPixels(pixels)
  if (!colors.fromDocument) {
    colors = {
      ...colors,
      accent: brand.accent || colors.accent,
      border: brand.primary || colors.border,
    }
    warnings.push('Document colors were not detected. Institution colors were used for accents and borders.')
  }
  texts = texts.map((block) => ({
    ...block,
    // Body copy stays dark. Accent colors are for lines/bars only.
    color: '#0f172a',
  }))

  onProgress('decorations')
  // Shapes are decorative clues only — generation rebuilds a clean layout.
  const shapes = await readVectors(pdfjs, pdfPage, unscaled, sx, sy, base.width, base.height)
  const pixelShapes = shapes.some((s) => s.kind === 'border' || s.kind === 'line')
    ? []
    : detectPixelDecor(pixels, sample.width, sample.height, base.width, base.height, colors.border)
  const keptShapes = [...shapes, ...pixelShapes]
    .filter((s) => !(s.width > base.width * 0.85 && s.height > base.height * 0.85 && s.kind !== 'border'))
    .map((s) =>
      s.kind === 'line' || s.kind === 'border'
        ? {
            ...s,
            strokeWidth: Math.min(4, Math.max(1, s.strokeWidth || 2)),
            height: s.kind === 'line' ? Math.min(4, Math.max(1, s.height)) : s.height,
          }
        : s,
    )
    .filter((s) => {
      // Drop fat solid bars that came from logo/image paint operators
      if (
        s.kind === 'rect' &&
        s.fill &&
        s.fill !== 'transparent' &&
        s.height > 12 &&
        s.height < 40 &&
        s.width > base.width * 0.4
      ) {
        return false
      }
      return true
    })
  if (shapes.some((s) => s.width > base.width * 0.85 && s.height > base.height * 0.85)) {
    warnings.push('A full-page embedded image was ignored so the template is not a flattened copy of the file.')
  }
  if (!keptShapes.some((s) => s.kind === 'border' || s.kind === 'line' || s.kind === 'seal')) {
    warnings.push('Borders and decorations could not be fully reconstructed.')
  }

  if (texts.length < 2) {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }

  const geometry = applyContentMargins(base, texts)
  return {
    sourceKind: 'pdf',
    page: geometry,
    colors,
    texts,
    shapes: keptShapes.slice(0, 48),
    warnings,
    scanned,
    pageCount: pdf.numPages,
  }
}

async function readOcr(
  canvas: HTMLCanvasElement,
  canvasW: number,
  canvasH: number,
  onProgress: ImportProgress,
): Promise<TextBlock[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress('typography', `Reading scanned text… ${Math.round(m.progress * 100)}%`)
      }
    },
  })
  try {
    const url = canvas.toDataURL('image/png')
    const result = await worker.recognize(url)
    const data = result?.data as {
      lines?: Array<{
        text?: string
        confidence?: number
        bbox?: { x0?: number; y0?: number; x1?: number; y1?: number }
      }>
    }
    const lines = data?.lines || []
    const out: TextBlock[] = []
    for (const line of lines) {
      const text = String(line.text || '').replace(/\s+/g, ' ').trim()
      if (text.length < 2) continue
      if (Number.isFinite(Number(line.confidence)) && Number(line.confidence) < 40) continue
      const b = line.bbox
      if (!b) continue
      const x = ((b.x0 || 0) / canvas.width) * canvasW
      const y = ((b.y0 || 0) / canvas.height) * canvasH
      const w = Math.max(8, (((b.x1 || 0) - (b.x0 || 0)) / canvas.width) * canvasW)
      const h = Math.max(8, (((b.y1 || 0) - (b.y0 || 0)) / canvas.height) * canvasH)
      out.push({
        text,
        x,
        y,
        width: w,
        height: h,
        fontSize: Math.min(64, Math.max(10, Math.round(h * 0.8))),
        fontFamily: 'Georgia, serif',
        fontWeight: h > canvasH * 0.04 ? 'bold' : 'normal',
        fontStyle: 'normal',
        align: 'left',
        color: '#0f172a',
        letterSpacing: 0,
        lineHeight: 1.2,
      })
    }
    return out.slice(0, 80)
  } catch {
    return []
  } finally {
    await worker.terminate()
  }
}

async function readVectors(
  pdfjs: Awaited<ReturnType<typeof loadPdfjs>>,
  page: { getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[] }> },
  viewport: { convertToViewportPoint: (x: number, y: number) => number[] },
  sx: number,
  sy: number,
  canvasW: number,
  canvasH: number,
): Promise<ShapeBlock[]> {
  const OPS = (pdfjs.OPS || {}) as Record<string, number>
  let list: { fnArray: number[]; argsArray: unknown[] }
  try {
    list = await page.getOperatorList()
  } catch {
    return []
  }
  const shapes: ShapeBlock[] = []
  const stack: Gfx[] = []
  let gfx: Gfx = { ctm: [1, 0, 0, 1, 0, 0], fill: '#000000', stroke: '#000000', lineWidth: 1 }
  let pending: { ops: number[]; args: number[] } | null = null

  const toCanvas = (x: number, y: number) => {
    const [ux, uy] = apply(gfx.ctm, x, y)
    const [vx, vy] = viewport.convertToViewportPoint(ux, uy)
    return { x: vx * sx, y: vy * sy }
  }

  const boxFrom = (x: number, y: number, w: number, h: number) => {
    const a = toCanvas(x, y)
    const b = toCanvas(x + w, y + h)
    const left = Math.min(a.x, b.x)
    const top = Math.min(a.y, b.y)
    return {
      x: left,
      y: top,
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    }
  }

  const flush = (mode: 'fill' | 'stroke' | 'both') => {
    if (!pending) return
    const extracted = pathShapes(pending.ops, pending.args, OPS, boxFrom, mode, gfx, canvasW, canvasH)
    shapes.push(...extracted)
    pending = null
  }

  const { fnArray, argsArray } = list
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]
    const args = argsArray[i] as unknown
    if (fn === OPS.save) stack.push({ ...gfx, ctm: [...gfx.ctm] as Matrix })
    else if (fn === OPS.restore) gfx = stack.pop() || gfx
    else if (fn === OPS.transform && Array.isArray(args)) {
      const m = args as number[]
      gfx = { ...gfx, ctm: mul(gfx.ctm, [m[0], m[1], m[2], m[3], m[4], m[5]]) }
    } else if (fn === OPS.setFillRGBColor && Array.isArray(args)) {
      const [r, g, b] = args as number[]
      gfx = { ...gfx, fill: rgbToHex(r * 255, g * 255, b * 255) }
    } else if (fn === OPS.setStrokeRGBColor && Array.isArray(args)) {
      const [r, g, b] = args as number[]
      gfx = { ...gfx, stroke: rgbToHex(r * 255, g * 255, b * 255) }
    } else if (fn === OPS.setFillGray && Array.isArray(args)) {
      const g = Number((args as number[])[0]) * 255
      gfx = { ...gfx, fill: rgbToHex(g, g, g) }
    } else if (fn === OPS.setStrokeGray && Array.isArray(args)) {
      const g = Number((args as number[])[0]) * 255
      gfx = { ...gfx, stroke: rgbToHex(g, g, g) }
    } else if (fn === OPS.setLineWidth && Array.isArray(args)) {
      gfx = { ...gfx, lineWidth: Number((args as number[])[0]) || 1 }
    } else if (fn === OPS.constructPath && Array.isArray(args)) {
      pending = { ops: (args as number[][])[0] || [], args: (args as number[][])[1] || [] }
    } else if (fn === OPS.rectangle && Array.isArray(args)) {
      const [x, y, w, h] = args as number[]
      pending = { ops: [OPS.rectangle], args: [x, y, w, h] }
    } else if (fn === OPS.fill || fn === OPS.eoFill) flush('fill')
    else if (fn === OPS.stroke || fn === OPS.closeStroke) flush('stroke')
    else if (fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke) flush('both')
    else if (fn === OPS.endPath) pending = null
    else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintJpegXObject ||
      fn === OPS.paintInlineImageXObject
    ) {
      const box = boxFrom(0, 0, 1, 1)
      const kind = classifyImageBox(box, canvasW, canvasH)
      if (kind) shapes.push({ kind, ...box, fill: 'transparent', stroke: 'transparent', strokeWidth: 0 })
    }
  }
  return shapes
}

function pathShapes(
  ops: number[],
  coords: number[],
  OPS: Record<string, number>,
  boxFrom: (x: number, y: number, w: number, h: number) => { x: number; y: number; width: number; height: number },
  mode: 'fill' | 'stroke' | 'both',
  gfx: Gfx,
  canvasW: number,
  canvasH: number,
): ShapeBlock[] {
  const out: ShapeBlock[] = []
  let i = 0
  let cx = 0
  let cy = 0
  let sx0 = 0
  let sy0 = 0
  let curves = 0
  let lines = 0
  const points: Array<{ x: number; y: number }> = []
  const pushPoint = (x: number, y: number) => {
    const p = boxFrom(x, y, 0, 0)
    points.push(p)
    cx = x
    cy = y
  }
  for (const op of ops) {
    if (op === OPS.rectangle) {
      const [x, y, w, h] = coords.slice(i, i + 4)
      i += 4
      const box = boxFrom(x, y, w, h)
      out.push(styleBox(box, mode, gfx, canvasW, canvasH, false))
    } else if (op === OPS.moveTo) {
      sx0 = coords[i]
      sy0 = coords[i + 1]
      pushPoint(sx0, sy0)
      i += 2
    } else if (op === OPS.lineTo) {
      const x = coords[i]
      const y = coords[i + 1]
      i += 2
      lines += 1
      const a = boxFrom(cx, cy, 0, 0)
      const b = boxFrom(x, y, 0, 0)
      const horizontal = Math.abs(a.y - b.y) < 3 && Math.abs(a.x - b.x) > 24
      const vertical = Math.abs(a.x - b.x) < 3 && Math.abs(a.y - b.y) > 24
      if (horizontal || vertical) {
        out.push({
          kind: 'line',
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          width: Math.max(2, Math.abs(b.x - a.x) || gfx.lineWidth),
          height: Math.max(2, Math.abs(b.y - a.y) || gfx.lineWidth),
          fill: gfx.stroke,
          stroke: gfx.stroke,
          strokeWidth: Math.max(1, gfx.lineWidth),
        })
      }
      pushPoint(x, y)
    } else if (op === OPS.curveTo) {
      curves += 1
      i += 6
    } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
      curves += 1
      i += 4
    } else if (op === OPS.closePath) {
      pushPoint(sx0, sy0)
    }
  }
  if (!out.length && points.length && curves >= 3 && lines === 0) {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const box = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }
    if (box.width > 16 && box.height > 16) out.push(styleBox(box, mode, gfx, canvasW, canvasH, true))
  }
  return out.filter((shape) => shape.width >= 2 && shape.height >= 2)
}

function styleBox(
  box: { x: number; y: number; width: number; height: number },
  mode: 'fill' | 'stroke' | 'both',
  gfx: Gfx,
  canvasW: number,
  canvasH: number,
  ellipse: boolean,
): ShapeBlock {
  const covers =
    box.width > canvasW * 0.9 && box.height > canvasH * 0.9
  if (covers && mode !== 'stroke') {
    return { kind: 'rect', x: 0, y: 0, width: 0, height: 0, fill: gfx.fill, stroke: 'transparent', strokeWidth: 0 }
  }
  const nearEdge =
    box.x < canvasW * 0.08 &&
    box.y < canvasH * 0.08 &&
    box.width > canvasW * 0.75 &&
    box.height > canvasH * 0.75
  const square = box.width > 20 && Math.abs(box.width - box.height) / Math.max(box.width, box.height) < 0.2
  let kind: ShapeBlock['kind'] = ellipse ? 'ellipse' : nearEdge ? 'border' : 'rect'
  if (ellipse && square && box.width < canvasW * 0.22) kind = 'seal'
  return {
    kind,
    ...box,
    fill: mode === 'stroke' || kind === 'border' ? 'transparent' : gfx.fill,
    stroke: mode === 'fill' && kind !== 'border' ? 'transparent' : gfx.stroke,
    strokeWidth: kind === 'border' ? Math.max(2, gfx.lineWidth) : Math.max(1, gfx.lineWidth),
  }
}

function classifyImageBox(
  box: { x: number; y: number; width: number; height: number },
  canvasW: number,
  canvasH: number,
): ShapeBlock['kind'] | null {
  const area = box.width * box.height
  const page = canvasW * canvasH
  if (area > page * 0.4) return 'decoration'
  if (area < page * 0.004) return null
  const aspect = box.height / Math.max(1, box.width)
  const inCorner =
    (box.x < canvasW * 0.2 || box.x > canvasW * 0.62) && box.y > canvasH * 0.62
  if (inCorner && aspect > 0.75 && aspect < 1.35 && box.width < canvasW * 0.22) return 'qr'
  if (aspect > 1.15 && aspect < 1.7 && box.y < canvasH * 0.55 && area < page * 0.12) return 'photo'
  if (box.y > canvasH * 0.7 && aspect < 0.45) return 'signature'
  if (box.y < canvasH * 0.32 && area < page * 0.18) return 'logo'
  if (aspect > 0.8 && aspect < 1.25 && area < page * 0.12) return 'seal'
  return null
}

function detectPixelDecor(
  px: Uint8ClampedArray,
  mw: number,
  mh: number,
  canvasW: number,
  canvasH: number,
  border: string,
): ShapeBlock[] {
  const darkAt = (x: number, y: number) => {
    const p = (y * mw + x) * 4
    if (px[p + 3] < 128) return false
    const lum = 0.2126 * px[p] + 0.7152 * px[p + 1] + 0.0722 * px[p + 2]
    return lum < 150
  }
  const band = Math.max(2, Math.round(mh * 0.015))
  const fracRow = (y0: number, y1: number) => {
    let ink = 0
    let n = 0
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < mw; x++) {
        n += 1
        if (darkAt(x, y)) ink += 1
      }
    }
    return n ? ink / n : 0
  }
  const fracCol = (x0: number, x1: number) => {
    let ink = 0
    let n = 0
    for (let x = x0; x < x1; x++) {
      for (let y = 0; y < mh; y++) {
        n += 1
        if (darkAt(x, y)) ink += 1
      }
    }
    return n ? ink / n : 0
  }
  const out: ShapeBlock[] = []
  if (fracRow(0, band) > 0.18 && fracRow(mh - band, mh) > 0.18 && fracCol(0, band) > 0.18 && fracCol(mw - band, mw) > 0.18) {
    const inset = Math.round((band / mh) * canvasH)
    out.push({
      kind: 'border',
      x: inset,
      y: inset,
      width: canvasW - inset * 2,
      height: canvasH - inset * 2,
      fill: 'transparent',
      stroke: border,
      strokeWidth: Math.max(2, Math.round(inset * 0.35)),
    })
  }
  const rowInk = new Float32Array(mh)
  for (let y = 0; y < mh; y++) {
    let ink = 0
    for (let x = 0; x < mw; x++) if (darkAt(x, y)) ink += 1
    rowInk[y] = ink / mw
  }
  for (let y = band; y < mh - band; y++) {
    if (rowInk[y] < 0.55) continue
    let y1 = y
    while (y1 < mh && rowInk[y1] >= 0.4) y1 += 1
    const h = y1 - y
    if (h >= 1 && h <= Math.max(4, mh * 0.012)) {
      out.push({
        kind: 'line',
        x: canvasW * 0.1,
        y: (y / mh) * canvasH,
        width: canvasW * 0.8,
        height: Math.max(2, (h / mh) * canvasH),
        fill: border,
        stroke: border,
        strokeWidth: Math.max(1, (h / mh) * canvasH),
      })
    }
    y = y1
  }
  return out.slice(0, 10)
}
