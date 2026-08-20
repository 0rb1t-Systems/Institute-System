/**
 * Decompose an uploaded certificate into a real reusable LogoBuilderDesign.
 * Keeps the uploaded design visually exact, then adds fully editable dynamic fields
 * positioned from a scan of the PDF/OCR text (no messy re-drawn overlapping text).
 */
import {
  BUILDER_FONT_FAMILIES,
  createBoundTextElement,
  createElementId,
  createVerificationQrElement,
  getPaperSize,
  normalizeVerificationQr,
  type BuilderBinding,
  type BuilderElement,
  type DocumentBuilderKind,
  type LogoBuilderDesign,
  type PaperSizeKey,
} from '@/lib/certificateBuilder'

export type ExtractProgress = (message: string, pct?: number) => void

export type UploadImageBlobFn = (
  blob: Blob,
  fileName: string,
) => Promise<{ path: string; signedUrl?: string | null }>

type BBox = { x: number; y: number; w: number; h: number }

type RawText = BBox & {
  text: string
  fontSize: number
  bold?: boolean
  italic?: boolean
  color?: string
  align?: 'left' | 'center' | 'right'
}

type RawImageRegion = BBox & {
  kind: 'logo' | 'qr' | 'signature' | 'stamp' | 'image' | 'decor'
  blob: Blob
}

function pickCanvasSize(aspectRatio?: number | null): {
  width: number
  height: number
  paperKey: PaperSizeKey
} {
  const ar = aspectRatio && aspectRatio > 0 ? aspectRatio : 1.414
  const paperKey: PaperSizeKey = ar >= 1 ? 'a4-landscape' : 'a4-portrait'
  const paper = getPaperSize(paperKey)
  // Prefer exact uploaded aspect over forced paper crop
  let width: number = paper.width
  let height: number = Math.round(width / ar)
  if (height > paper.height * 1.35 || height < paper.height * 0.55) {
    height = paper.height
    width = Math.round(height * ar)
  }
  return { width, height, paperKey }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    img.src = url
  })
}

function blobFromCanvas(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('BLOB_FAILED'))),
      type,
      quality,
    )
  })
}

function mergeLineItems(items: RawText[], yTol: number): RawText[] {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: RawText[] = []
  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - item.y) <= yTol && item.x >= last.x - 4) {
      const gap = item.x - (last.x + last.w)
      const joiner = gap > item.fontSize * 0.35 ? ' ' : gap > 0 ? ' ' : ''
      const right = item.x + item.w
      const bottom = Math.max(last.y + last.h, item.y + item.h)
      const top = Math.min(last.y, item.y)
      last.text = `${last.text}${joiner}${item.text}`.replace(/\s+/g, ' ').trim()
      last.x = Math.min(last.x, item.x)
      last.y = top
      last.w = Math.max(last.x + last.w, right) - last.x
      last.h = bottom - top
      last.fontSize = Math.max(last.fontSize, item.fontSize)
      if (item.bold) last.bold = true
      if (item.italic) last.italic = true
    } else {
      lines.push({ ...item })
    }
  }
  return lines
}

/** Merge consecutive lines into single paragraph/title blocks (one element each). */
function mergeTextIntoBlocks(texts: RawText[]): RawText[] {
  if (!texts.length) return []
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x)
  const blocks: RawText[] = []
  let i = 0

  while (i < sorted.length) {
    const seed = sorted[i]
    const label = seed.text.trim()
    const isShortLabel = /^(cert\s*no\.?|academic registrar|principal|this is to certify that)$/i.test(
      label,
    )

    let j = i + 1
    // Body paragraph: wrap several medium lines into one block
    const canParagraph =
      !isShortLabel &&
      seed.fontSize < 22 &&
      (seed.text.length >= 28 ||
        (i + 1 < sorted.length &&
          sorted[i + 1].fontSize < 22 &&
          sorted[i + 1].y - (seed.y + seed.h) < seed.fontSize * 1.5))

    if (canParagraph && !isShortLabel) {
      while (j < sorted.length) {
        const cur = sorted[j]
        const prev = sorted[j - 1]
        const gap = cur.y - (prev.y + prev.h)
        const same =
          gap >= -4 &&
          gap <= Math.max(18, prev.fontSize * 1.4) &&
          Math.abs(cur.fontSize - prev.fontSize) <= 4 &&
          cur.fontSize < 22 &&
          !/^(cert\s*no\.?|academic registrar|principal)$/i.test(cur.text.trim())
        if (!same) break
        j++
      }
    }

    // Title stack: "Diploma in" + next line
    if (j === i + 1 && /diploma|certificate|award|transcript/i.test(seed.text) && i + 1 < sorted.length) {
      const next = sorted[i + 1]
      const gap = next.y - (seed.y + seed.h)
      if (gap >= -4 && gap <= seed.fontSize * 1.6 && next.fontSize >= seed.fontSize * 0.85) {
        j = i + 2
      }
    }

    if (j > i + 1) {
      const slice = sorted.slice(i, j)
      const x = Math.min(...slice.map((t) => t.x))
      const y = Math.min(...slice.map((t) => t.y))
      const right = Math.max(...slice.map((t) => t.x + t.w))
      const bottom = Math.max(...slice.map((t) => t.y + t.h))
      blocks.push({
        x,
        y,
        w: right - x,
        h: bottom - y,
        text: slice.map((t) => t.text.trim()).join('\n'),
        fontSize: Math.max(...slice.map((t) => t.fontSize)),
        bold: slice.some((t) => t.bold),
        italic: slice.some((t) => t.italic) || true,
        align: 'center',
        color: slice[0].color || '#0f172a',
      })
    } else {
      blocks.push({ ...seed })
    }
    i = Math.max(i + 1, j)
  }

  return blocks
}

function guessBind(text: string): BuilderElement['bind'] {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/cert(ificate)?\s*(no|number|#)|credential\s*no|document\s*(no|number|#)/i.test(t)) {
    return 'certificateNumber'
  }
  if (/\b(date|issued on|dated|completion\s*date|date\s*of\s*completion)\b/i.test(t) && t.length < 64) {
    return 'dateIssued'
  }
  // Course / diploma / program — must be a real dynamic field at the original position
  if (
    /^(diploma|certificate|degree|award|bachelor|master|postgraduate)\s+(in|of)\b/i.test(t) ||
    /\b(diploma|certificate|degree|award)\s+(in|of)\b/i.test(t)
  ) {
    return 'programName'
  }
  if (/\b(program|course|programme|speciali[sz]ation)\b/i.test(t) && t.length < 90) {
    return 'programName'
  }
  if (/\b(grade\s*point|g\.?p\.?a\.?|cgpa)\b/i.test(t) && t.length < 40) return 'gpa'
  if (/\b(letter\s*)?grade\b/i.test(t) && t.length < 36) return 'gpa'
  if (/\bstudent\s*(id|no|number|#|code)\b/i.test(t) && t.length < 48) return 'studentId'
  if (/\binvoice\b/i.test(t) && t.length < 40) return 'invoiceNumber'
  if (/^academic\s+registrar$/i.test(t)) return 'leftName'
  if (/^principal$/i.test(t)) return 'rightName'
  // Likely a person name sitting in the student slot (Title Case, short)
  if (
    /^[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,4}$/.test(text.trim()) &&
    text.trim().length >= 6 &&
    text.trim().length <= 56 &&
    !/certif|diploma|registrar|principal|research|consultancy/i.test(t)
  ) {
    return 'studentName'
  }
  return 'none'
}

function guessTextAlign(t: RawText, canvasW: number): 'left' | 'center' | 'right' {
  const mid = t.x + t.w / 2
  if (mid > canvasW * 0.35 && mid < canvasW * 0.65 && t.w < canvasW * 0.85) return 'center'
  if (t.x > canvasW * 0.55) return 'right'
  return 'left'
}

function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function dedupeOverlappingTexts(texts: RawText[]): RawText[] {
  const sorted = [...texts].sort((a, b) => b.w * b.h - a.w * a.h || a.y - b.y)
  const kept: RawText[] = []
  for (const t of sorted) {
    const hit = kept.some((k) => {
      const ix0 = Math.max(k.x, t.x)
      const iy0 = Math.max(k.y, t.y)
      const ix1 = Math.min(k.x + k.w, t.x + t.w)
      const iy1 = Math.min(k.y + k.h, t.y + t.h)
      const iw = Math.max(0, ix1 - ix0)
      const ih = Math.max(0, iy1 - iy0)
      const inter = iw * ih
      const smaller = Math.min(k.w * k.h, t.w * t.h)
      return smaller > 0 && inter / smaller > 0.55
    })
    if (!hit) kept.push(t)
  }
  return kept.sort((a, b) => a.y - b.y || a.x - b.x)
}

async function extractPdfText(
  file: File,
  canvasW: number,
  canvasH: number,
): Promise<RawText[]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const unscaled = page.getViewport({ scale: 1 })
  // Fit page into canvas while preserving aspect (no stretch)
  const fit = Math.min(canvasW / unscaled.width, canvasH / unscaled.height)
  const viewport = page.getViewport({ scale: fit })
  const content = await page.getTextContent()
  const raw: RawText[] = []
  const ox = (canvasW - viewport.width) / 2
  const oy = (canvasH - viewport.height) / 2

  for (const item of content.items as Array<Record<string, unknown>>) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue
    const str = String(item.str || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (str.length < 1) continue
    const transform = (item.transform as number[]) || [1, 0, 0, 1, 0, 0]
    const tx = pdfjs.Util.transform(viewport.transform, transform)
    const fontSize = Math.max(7, Math.hypot(tx[2], tx[3]))
    // Horizontal scale from the transformed basis vector
    const hScale = Math.max(0.01, Math.hypot(tx[0], tx[1]))
    const advance =
      typeof item.width === 'number' && item.width > 0
        ? item.width * hScale
        : fontSize * str.length * 0.5
    const x = ox + tx[4]
    const y = oy + tx[5] - fontSize * 0.85
    const width = Math.max(fontSize * 0.4, advance)
    const height = fontSize * 1.2
    if (width < 3 || height < 3) continue
    const fontName = String(item.fontName || '').toLowerCase()
    raw.push({
      x: Math.max(0, Math.min(canvasW - 4, x)),
      y: Math.max(0, Math.min(canvasH - 4, y)),
      w: Math.min(canvasW - 4, width),
      h: Math.min(canvasH - 4, height),
      text: str,
      fontSize: Math.min(64, Math.round(fontSize)),
      bold: /bold|black|heavy|semibold/i.test(fontName),
      italic: /italic|oblique/i.test(fontName),
      align: 'left',
      color: '#0f172a',
    })
  }

  // Merge only same-line fragments (words), never glue separate paragraphs
  const merged = mergeLineItems(raw, Math.max(2, canvasH * 0.004))
  return dedupeOverlappingTexts(merged)
}

async function extractOcrText(
  imageUrl: string,
  canvasW: number,
  canvasH: number,
  onProgress?: ExtractProgress,
): Promise<RawText[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.('Reading text…', Math.round(m.progress * 100))
      }
    },
  })
  try {
    const result = await worker.recognize(imageUrl)
    const data = result?.data as {
      lines?: Array<{
        text?: string
        confidence?: number
        bbox?: { x0?: number; y0?: number; x1?: number; y1?: number }
      }>
      imageWidth?: number
      imageHeight?: number
    }
    const lines = data?.lines || []
    const imgW = Number(data?.imageWidth) || 0
    const imgH = Number(data?.imageHeight) || 0
    let maxR = imgW
    let maxB = imgH
    if (!maxR || !maxB) {
      for (const line of lines) {
        const b = line.bbox
        if (!b) continue
        maxR = Math.max(maxR, b.x1 || 0)
        maxB = Math.max(maxB, b.y1 || 0)
      }
    }
    if (maxR < 1 || maxB < 1) return []

    const raw: RawText[] = []
    for (const line of lines) {
      const text = String(line.text || '')
        .replace(/\s+/g, ' ')
        .trim()
      if (text.length < 2) continue
      const conf = Number(line.confidence)
      if (Number.isFinite(conf) && conf < 35) continue
      const b = line.bbox
      if (!b) continue
      const padX = 3
      const padY = 2
      const x0 = Math.max(0, (b.x0 || 0) - padX)
      const y0 = Math.max(0, (b.y0 || 0) - padY)
      const x1 = Math.min(maxR, (b.x1 || 0) + padX)
      const y1 = Math.min(maxB, (b.y1 || 0) + padY)
      const wPx = x1 - x0
      const hPx = y1 - y0
      if (wPx < 8 || hPx < 6) continue
      raw.push({
        x: (x0 / maxR) * canvasW,
        y: (y0 / maxB) * canvasH,
        w: (wPx / maxR) * canvasW,
        h: (hPx / maxB) * canvasH,
        text,
        fontSize: Math.min(64, Math.max(10, Math.round((hPx / maxB) * canvasH * 0.92))),
        align: 'left',
        color: '#0f172a',
      })
    }
    return mergeLineItems(raw, Math.max(4, canvasH * 0.008)).slice(0, 90)
  } finally {
    await worker.terminate()
  }
}

type RawShape =
  | (RawImageRegion & { shape: 'image' })
  | (BBox & { shape: 'line'; color: string; strokeWidth: number })
  | (BBox & { shape: 'bar'; color: string })

/**
 * Detect horizontal rules + solid footer bars as separate shape elements
 * (not merged into logo/QR crops).
 */
function detectLinesAndBars(
  px: Uint8ClampedArray,
  mw: number,
  mh: number,
  canvasW: number,
  canvasH: number,
  blocked: Uint8Array,
): RawShape[] {
  const out: RawShape[] = []
  const rowInk = new Float32Array(mh)
  const rowR = new Float32Array(mh)
  const rowG = new Float32Array(mh)
  const rowB = new Float32Array(mh)

  for (let y = 0; y < mh; y++) {
    let ink = 0
    let rs = 0
    let gs = 0
    let bs = 0
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x
      if (blocked[i]) continue
      const p = i * 4
      const r = px[p]
      const g = px[p + 1]
      const b = px[p + 2]
      if (px[p + 3] < 40) continue
      if (r > 245 && g > 245 && b > 245) continue
      ink++
      rs += r
      gs += g
      bs += b
    }
    rowInk[y] = ink / mw
    if (ink > 0) {
      rowR[y] = rs / ink
      rowG[y] = gs / ink
      rowB[y] = bs / ink
    }
  }

  // Thick solid bars (footer accent): high fill fraction across width
  let y = 0
  while (y < mh) {
    if (rowInk[y] < 0.55) {
      y++
      continue
    }
    const y0 = y
    let rs = 0
    let gs = 0
    let bs = 0
    let n = 0
    while (y < mh && rowInk[y] >= 0.45) {
      rs += rowR[y]
      gs += rowG[y]
      bs += rowB[y]
      n++
      y++
    }
    const y1 = y
    const h = y1 - y0
    if (h >= Math.max(6, mh * 0.012) && h <= mh * 0.12 && n > 0) {
      // Prefer bars near bottom or full-width accent bands
      const cy = (y0 + y1) / 2 / mh
      if (cy > 0.82 || (rowInk[y0] > 0.7 && h >= mh * 0.018)) {
        out.push({
          shape: 'bar',
          x: 0,
          y: (y0 / mh) * canvasH,
          w: canvasW,
          h: Math.max(8, (h / mh) * canvasH),
          color: rgbToHex(rs / n, gs / n, bs / n),
        })
        // Block these rows so they aren't cropped as images
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = 0; xx < mw; xx++) blocked[yy * mw + xx] = 1
        }
      }
    }
  }

  // Thin horizontal lines: moderate fill, very short height
  y = 0
  while (y < mh) {
    if (rowInk[y] < 0.18 || rowInk[y] > 0.92) {
      y++
      continue
    }
    const y0 = y
    let rs = 0
    let gs = 0
    let bs = 0
    let n = 0
    let maxFill = rowInk[y]
    while (y < mh && rowInk[y] >= 0.15 && rowInk[y] <= 0.95 && y - y0 < Math.max(5, mh * 0.01)) {
      maxFill = Math.max(maxFill, rowInk[y])
      rs += rowR[y]
      gs += rowG[y]
      bs += rowB[y]
      n++
      y++
    }
    const y1 = y
    const h = y1 - y0
    if (h >= 1 && h <= Math.max(4, mh * 0.008) && maxFill >= 0.22 && n > 0) {
      // Find horizontal span of ink on middle row
      const mid = Math.floor((y0 + y1) / 2)
      let x0 = mw
      let x1 = 0
      for (let x = 0; x < mw; x++) {
        const i = mid * mw + x
        if (blocked[i]) continue
        const p = i * 4
        const r = px[p]
        const g = px[p + 1]
        const b = px[p + 2]
        if (px[p + 3] < 40) continue
        if (r > 245 && g > 245 && b > 245) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
      }
      const span = x1 - x0 + 1
      if (span >= mw * 0.18) {
        const pad = Math.max(2, Math.round(mw * 0.01))
        out.push({
          shape: 'line',
          x: Math.max(0, ((x0 - pad) / mw) * canvasW),
          y: (y0 / mh) * canvasH,
          w: Math.min(canvasW, ((span + pad * 2) / mw) * canvasW),
          h: Math.max(2, (Math.max(2, h) / mh) * canvasH),
          color: rgbToHex(rs / n, gs / n, bs / n),
          strokeWidth: Math.max(1, Math.round((h / mh) * canvasH)),
        })
        for (let yy = Math.max(0, y0 - 1); yy < Math.min(mh, y1 + 1); yy++) {
          for (let xx = Math.max(0, x0 - pad); xx <= Math.min(mw - 1, x1 + pad); xx++) {
            blocked[yy * mw + xx] = 1
          }
        }
      }
    }
    if (y === y0) y++
  }

  return out
}

function classifyRegion(
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  srcW: number,
  srcH: number,
  canvasW: number,
  canvasH: number,
  pxSample?: { entropy: number },
): RawImageRegion['kind'] {
  const aspect = sw / Math.max(1, sh)
  const areaFrac = (sw * sh) / (srcW * srcH)
  const cx = ((sx + sw / 2) / srcW) * canvasW
  const cy = ((sy + sh / 2) / srcH) * canvasH
  const square = aspect > 0.72 && aspect < 1.38

  // QR: square, moderate size, high contrast pattern — top-right OR any corner
  if (square && areaFrac >= 0.008 && areaFrac <= 0.12) {
    const topRight = cx > canvasW * 0.55 && cy < canvasH * 0.28
    const anyQrZone = (pxSample?.entropy || 0) > 0.35
    if (topRight || (anyQrZone && cy < canvasH * 0.4)) return 'qr'
  }

  // Logo: upper area, not too large
  if (cy < canvasH * 0.28 && areaFrac < 0.14 && aspect > 0.5 && aspect < 2.2) {
    if (cx < canvasW * 0.45) return 'logo'
  }

  // Seal / medal: lower-middle, roughly round
  if (square && cy > canvasH * 0.55 && cy < canvasH * 0.9 && areaFrac >= 0.015 && areaFrac <= 0.14) {
    return 'stamp'
  }

  if (aspect > 1.9 && sh / srcH < 0.1 && cy > canvasH * 0.6) return 'signature'
  if (areaFrac < 0.06) return 'decor'
  return 'image'
}

function regionEntropy(
  px: Uint8ClampedArray,
  mw: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  // Cheap contrast proxy: fraction of pixels far from local mean luminance
  let n = 0
  let sum = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * mw + x) * 4
      const lum = (px[p] + px[p + 1] + px[p + 2]) / 3
      sum += lum
      n++
    }
  }
  if (n < 10) return 0
  const mean = sum / n
  let far = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * mw + x) * 4
      const lum = (px[p] + px[p + 1] + px[p + 2]) / 3
      if (Math.abs(lum - mean) > 40) far++
    }
  }
  return far / n
}

/**
 * Find logos, QR, seals as SEPARATE crops — never merge distant shapes together.
 */
async function detectGraphicElements(
  imageUrl: string,
  canvasW: number,
  canvasH: number,
  textBoxes: BBox[],
): Promise<RawShape[]> {
  const img = await loadImage(imageUrl)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  if (srcW < 8 || srcH < 8) return []

  const maxDim = 720
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH))
  const mw = Math.max(1, Math.round(srcW * scale))
  const mh = Math.max(1, Math.round(srcH * scale))
  const mask = document.createElement('canvas')
  mask.width = mw
  mask.height = mh
  const mctx = mask.getContext('2d', { willReadFrequently: true })
  if (!mctx) return []
  mctx.drawImage(img, 0, 0, mw, mh)
  const data = mctx.getImageData(0, 0, mw, mh)
  const px = data.data
  const blocked = new Uint8Array(mw * mh)

  // Mask OCR text so letterforms are not cropped as “images”
  for (const t of textBoxes) {
    const x0 = Math.max(0, Math.floor((t.x / canvasW) * mw) - 1)
    const y0 = Math.max(0, Math.floor((t.y / canvasH) * mh) - 1)
    const x1 = Math.min(mw, Math.ceil(((t.x + t.w) / canvasW) * mw) + 1)
    const y1 = Math.min(mh, Math.ceil(((t.y + t.h) / canvasH) * mh) + 1)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) blocked[y * mw + x] = 1
    }
  }

  const shapes = detectLinesAndBars(px, mw, mh, canvasW, canvasH, blocked)

  const ink = new Uint8Array(mw * mh)
  for (let i = 0, p = 0; i < mw * mh; i++, p += 4) {
    if (blocked[i]) continue
    const r = px[p]
    const g = px[p + 1]
    const b = px[p + 2]
    if (px[p + 3] < 40) continue
    if (r > 242 && g > 242 && b > 242) continue
    const maxc = Math.max(r, g, b)
    const minc = Math.min(r, g, b)
    if (maxc - minc > 22 || maxc < 232) ink[i] = 1
  }

  const visited = new Uint8Array(mw * mh)
  const regions: Array<BBox & { pixels: number }> = []
  const qx = new Int32Array(mw * mh)
  const qy = new Int32Array(mw * mh)

  for (let start = 0; start < mw * mh; start++) {
    if (!ink[start] || visited[start]) continue
    let head = 0
    let tail = 0
    const sy0 = Math.floor(start / mw)
    const sx0 = start % mw
    qx[tail] = sx0
    qy[tail] = sy0
    tail++
    visited[start] = 1
    let minX = sx0
    let maxX = sx0
    let minY = sy0
    let maxY = sy0
    let count = 0
    while (head < tail) {
      const x = qx[head]
      const y = qy[head]
      head++
      count++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= mw || ny >= mh) continue
        const ni = ny * mw + nx
        if (!ink[ni] || visited[ni]) continue
        visited[ni] = 1
        qx[tail] = nx
        qy[tail] = ny
        tail++
      }
    }
    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    const area = bw * bh
    const pageArea = mw * mh
    if (count < Math.max(60, pageArea * 0.0005)) continue
    if (area > pageArea * 0.4) continue
    // Skip ultra-thin leftovers (lines already extracted)
    if (bh <= 3 && bw > mw * 0.15) continue
    if (bw < 10 || bh < 10) continue
    regions.push({ x: minX, y: minY, w: bw, h: bh, pixels: count })
  }

  // Merge ONLY when boxes heavily overlap (same object) — never glue logo+QR+seal
  regions.sort((a, b) => b.pixels - a.pixels)
  const merged: typeof regions = []
  for (const r of regions) {
    const hit = merged.find((m) => {
      const ix0 = Math.max(m.x, r.x)
      const iy0 = Math.max(m.y, r.y)
      const ix1 = Math.min(m.x + m.w, r.x + r.w)
      const iy1 = Math.min(m.y + m.h, r.y + r.h)
      const iw = Math.max(0, ix1 - ix0)
      const ih = Math.max(0, iy1 - iy0)
      const inter = iw * ih
      const smaller = Math.min(m.w * m.h, r.w * r.h)
      return inter > smaller * 0.35
    })
    if (hit) {
      const x1 = Math.min(hit.x, r.x)
      const y1 = Math.min(hit.y, r.y)
      const x2 = Math.max(hit.x + hit.w, r.x + r.w)
      const y2 = Math.max(hit.y + hit.h, r.y + r.h)
      // Refuse merge if result would span most of the page width AND height (glued layout)
      const nw = x2 - x1
      const nh = y2 - y1
      if (nw > mw * 0.55 && nh > mh * 0.35) {
        merged.push({ ...r })
        continue
      }
      hit.x = x1
      hit.y = y1
      hit.w = nw
      hit.h = nh
      hit.pixels += r.pixels
    } else {
      merged.push({ ...r })
    }
  }

  const full = document.createElement('canvas')
  full.width = srcW
  full.height = srcH
  const fctx = full.getContext('2d')
  if (!fctx) return shapes
  fctx.drawImage(img, 0, 0)

  for (const r of merged.slice(0, 30)) {
    let sx = Math.max(0, Math.floor((r.x / mw) * srcW) - 2)
    let sy = Math.max(0, Math.floor((r.y / mh) * srcH) - 2)
    let sw = Math.min(srcW - sx, Math.ceil((r.w / mw) * srcW) + 4)
    let sh = Math.min(srcH - sy, Math.ceil((r.h / mh) * srcH) + 4)
    if (sw < 14 || sh < 14) continue

    const entropy = regionEntropy(px, mw, r.x, r.y, r.x + r.w, r.y + r.h)
    let kind = classifyRegion(sx, sy, sw, sh, srcW, srcH, canvasW, canvasH, { entropy })

    // Keep seal + ribbon intact (extra bottom/side padding, never split)
    if (kind === 'stamp' || kind === 'logo') {
      const padX = Math.round(sw * 0.08)
      const padTop = Math.round(sh * 0.06)
      const padBot = kind === 'stamp' ? Math.round(sh * 0.28) : Math.round(sh * 0.08)
      sx = Math.max(0, sx - padX)
      sy = Math.max(0, sy - padTop)
      sw = Math.min(srcW - sx, sw + padX * 2)
      sh = Math.min(srcH - sy, sh + padTop + padBot)
    }

    const crop = document.createElement('canvas')
    crop.width = sw
    crop.height = sh
    const cctx = crop.getContext('2d')
    if (!cctx) continue
    cctx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh)
    let blob: Blob
    try {
      blob = await blobFromCanvas(crop)
    } catch {
      continue
    }

    shapes.push({
      shape: 'image',
      x: (sx / srcW) * canvasW,
      y: (sy / srcH) * canvasH,
      w: (sw / srcW) * canvasW,
      h: (sh / srcH) * canvasH,
      kind,
      blob,
    })
  }

  return shapes
}

/** Punch extracted element boxes out of the page → residual decorative background. */
async function buildResidualBackground(
  imageUrl: string,
  canvasW: number,
  canvasH: number,
  holes: BBox[],
): Promise<Blob | null> {
  const img = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasW, canvasH)
  ctx.drawImage(img, 0, 0, canvasW, canvasH)
  ctx.fillStyle = '#ffffff'
  for (const h of holes) {
    const pad = 3
    ctx.fillRect(
      Math.max(0, h.x - pad),
      Math.max(0, h.y - pad),
      Math.min(canvasW, h.w + pad * 2),
      Math.min(canvasH, h.h + pad * 2),
    )
  }
  try {
    return await blobFromCanvas(canvas)
  } catch {
    return null
  }
}

function ensureRequiredDynamicFields(
  elements: BuilderElement[],
  canvasW: number,
  canvasH: number,
  kind: DocumentBuilderKind,
): BuilderElement[] {
  const out = [...elements]
  let z = out.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
  const hasBind = (b: BuilderElement['bind']) => out.some((e) => e.bind === b)

  const pushField = (
    bind: Exclude<BuilderElement['bind'], 'qr' | undefined>,
    defaults: Partial<BuilderElement>,
  ) => {
    if (!bind || bind === 'none' || hasBind(bind)) return
    out.push({
      id: createElementId(),
      type: 'text',
      x: canvasW * 0.15,
      y: canvasH * 0.4,
      width: canvasW * 0.7,
      height: 36,
      rotation: 0,
      zIndex: z++,
      text:
        bind === 'studentName'
          ? 'Student Name'
          : bind === 'programName'
            ? 'Program / Course'
            : bind === 'certificateNumber'
              ? 'Certificate No.'
              : bind === 'dateIssued'
                ? 'YYYY-MM-DD'
                : bind === 'studentId'
                  ? 'Student ID'
                  : bind === 'gpa'
                    ? 'GPA'
                    : 'Text',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: bind === 'studentName' ? 28 : 16,
      fontWeight: bind === 'studentName' || bind === 'programName' ? 'bold' : 'normal',
      fontStyle: bind === 'studentName' ? 'italic' : 'normal',
      textAlign: 'center',
      color: '#0f172a',
      fill: 'transparent',
      opacity: 1,
      bind,
      locked: false,
      ...defaults,
    })
  }

  // Bind existing diploma/course title in place — do not duplicate
  if (!hasBind('programName')) {
    const diplomaLike = out.find(
      (e) =>
        e.type === 'text' &&
        /diploma|certificate of|programme|program in|course in|award in/i.test(
          String(e.text || ''),
        ),
    )
    if (diplomaLike) {
      diplomaLike.bind = 'programName'
    } else {
      const certify = out.find(
        (e) => e.type === 'text' && /this is to certify that/i.test(String(e.text || '')),
      )
      pushField('programName', {
        y: certify ? Math.max(canvasH * 0.22, certify.y - canvasH * 0.12) : canvasH * 0.28,
        fontSize: 18,
      })
    }
  }

  if (!hasBind('studentName')) {
    const certify = out.find(
      (e) => e.type === 'text' && /this is to certify that/i.test(String(e.text || '')),
    )
    // Prefer binding a mid-page Title-Case name already extracted
    const nameLike = out.find(
      (e) =>
        e.type === 'text' &&
        e.bind === 'none' &&
        /^[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,4}$/.test(String(e.text || '').trim()) &&
        !/registrar|principal|research|consultancy|benaadir/i.test(String(e.text || '')),
    )
    if (nameLike) {
      nameLike.bind = 'studentName'
      nameLike.fontWeight = 'bold'
      nameLike.fontStyle = 'italic'
    } else {
      pushField('studentName', {
        y: certify
          ? Math.min(canvasH * 0.55, certify.y + certify.height + 10)
          : canvasH * 0.4,
      })
    }
  }

  if (!hasBind('certificateNumber')) {
    const certNo = out.find(
      (e) => e.type === 'text' && /cert\s*no|certificate\s*no|credential/i.test(String(e.text || '')),
    )
    if (certNo) {
      // Bind a sibling value line if this is only a label
      if (/^cert\s*no\.?:?\s*$/i.test(String(certNo.text || '').trim())) {
        pushField('certificateNumber', {
          x: certNo.x + certNo.width + 6,
          y: certNo.y,
          width: canvasW * 0.35,
          height: Math.max(18, certNo.height),
          fontSize: certNo.fontSize || 12,
          textAlign: 'left',
        })
      } else {
        certNo.bind = 'certificateNumber'
      }
    } else {
      pushField('certificateNumber', {
        x: canvasW * 0.1,
        y: canvasH * 0.72,
        width: canvasW * 0.4,
        height: 22,
        fontSize: 12,
        textAlign: 'left',
      })
    }
  }

  if (!hasBind('dateIssued')) {
    pushField('dateIssued', {
      x: canvasW * 0.55,
      y: canvasH * 0.72,
      width: canvasW * 0.35,
      height: 22,
      fontSize: 12,
      textAlign: 'right',
    })
  }

  if (kind === 'transcript' && !hasBind('gpa')) {
    pushField('gpa', { y: canvasH * 0.58, fontSize: 14 })
  }

  if (!out.some((e) => e.bind === 'qr')) {
    out.push({
      ...createVerificationQrElement({ width: canvasW, height: canvasH }),
      zIndex: z++,
    })
  }

  return out
}

/**
 * Scan uploaded PDF/image → real reusable LogoBuilderDesign (editable layers).
 * Text becomes editable elements; decorative art (logo, seal, borders) stays on
 * residual background so the design is not flattened into one locked photo with overlays.
 */
export async function extractCertificateDesign(opts: {
  file: File
  imageUrl: string
  aspectRatio?: number | null
  kind?: DocumentBuilderKind
  uploadImageBlob: UploadImageBlobFn
  onProgress?: ExtractProgress
}): Promise<LogoBuilderDesign> {
  const { file, imageUrl, aspectRatio, uploadImageBlob, onProgress } = opts
  const kind: DocumentBuilderKind = opts.kind || 'certificate'
  const { width: canvasW, height: canvasH, paperKey } = pickCanvasSize(aspectRatio)
  const mime = String(file.type || '').toLowerCase()
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(file.name)

  onProgress?.('Scanning certificate…', 5)

  let texts: RawText[] = []
  if (isPdf) {
    try {
      onProgress?.('Reading PDF text layers…', 20)
      texts = await extractPdfText(file, canvasW, canvasH)
    } catch {
      texts = []
    }
  }
  if (texts.length < 3) {
    onProgress?.('Scanning text…', 30)
    try {
      texts = await extractOcrText(imageUrl, canvasW, canvasH, onProgress)
      texts = dedupeOverlappingTexts(texts)
    } catch {
      if (!texts.length) texts = []
    }
  }

  // Keep line-level text (clean layout). Only lightly stack diploma title lines.
  let textBlocks = texts
  const diplomaIdx = texts.findIndex((t) =>
    /^(diploma|certificate|degree|award)\s+(in|of)\b/i.test(t.text.trim()),
  )
  if (diplomaIdx >= 0 && diplomaIdx + 1 < texts.length) {
    const a = texts[diplomaIdx]
    const b = texts[diplomaIdx + 1]
    const gap = b.y - (a.y + a.h)
    if (gap >= -4 && gap <= a.fontSize * 1.5) {
      textBlocks = [
        ...texts.slice(0, diplomaIdx),
        {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x),
          h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y),
          text: `${a.text.trim()}\n${b.text.trim()}`,
          fontSize: Math.max(a.fontSize, b.fontSize),
          bold: a.bold || b.bold,
          italic: true,
          align: 'center',
          color: a.color || '#0f172a',
        },
        ...texts.slice(diplomaIdx + 2),
      ]
    }
  }

  onProgress?.('Preparing template layers…', 55)
  const holes: BBox[] = textBlocks.map((t) => ({
    x: t.x,
    y: t.y,
    w: Math.max(t.w, t.fontSize * Math.min(40, t.text.length) * 0.35),
    h: Math.max(t.h, t.fontSize * (t.text.includes('\n') ? 2.2 : 1.15)),
  }))

  // Residual decorative background (logo, seal, borders, lines) — text punched out
  let paperPath: string | null = null
  try {
    const residual = await buildResidualBackground(imageUrl, canvasW, canvasH, holes)
    if (residual && residual.size > 500) {
      const up = await uploadImageBlob(residual, 'certificate-paper.png')
      paperPath = up.path
    }
  } catch {
    paperPath = null
  }
  if (!paperPath) {
    try {
      const img = await loadImage(imageUrl)
      const c = document.createElement('canvas')
      c.width = canvasW
      c.height = canvasH
      const ctx = c.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvasW, canvasH)
        ctx.drawImage(img, 0, 0, canvasW, canvasH)
        ctx.fillStyle = '#ffffff'
        for (const h of holes) {
          ctx.fillRect(Math.max(0, h.x - 2), Math.max(0, h.y - 2), h.w + 4, h.h + 4)
        }
        const blob = await blobFromCanvas(c)
        const up = await uploadImageBlob(blob, 'certificate-paper.png')
        paperPath = up.path
      }
    } catch {
      paperPath = null
    }
  }

  const elements: BuilderElement[] = []
  let z = 0

  if (paperPath) {
    elements.push({
      id: createElementId(),
      type: 'image',
      x: 0,
      y: 0,
      width: canvasW,
      height: canvasH,
      rotation: 0,
      zIndex: z++,
      src: paperPath,
      opacity: 1,
      bind: 'none',
      text: 'background-art',
      locked: true,
    })
  }

  for (const t of textBlocks) {
    const flat = t.text.replace(/\n/g, ' ')
    let bind = guessBind(flat)
    if (
      bind === 'none' &&
      /\n/.test(t.text) &&
      /diploma|certificate|programme|program|course|award/i.test(t.text)
    ) {
      bind = 'programName'
    }
    const isTitle =
      t.fontSize >= 24 ||
      (!!t.bold && t.fontSize >= 16) ||
      (/\n/.test(t.text) && /diploma/i.test(t.text))
    const isBrand =
      /research,\s*consultancy|evaluation center|evaluation centre/i.test(flat) ||
      (t.y < canvasH * 0.2 && t.x < canvasW * 0.55 && t.fontSize >= 13 && bind === 'none')
    const isSerifBody =
      /diploma|certify|having completed|applied research|academic|principal|cert no/i.test(t.text)
    const isProgram = bind === 'programName'
    const lineCount = (t.text.match(/\n/g) || []).length + 1

    elements.push({
      id: createElementId(),
      type: 'text',
      x: t.x,
      y: t.y,
      width: Math.max(28, isProgram ? Math.max(t.w, canvasW * 0.5) : t.w + 4),
      height: Math.max(t.fontSize * 1.15 * lineCount, t.h),
      rotation: 0,
      zIndex: z++,
      text: t.text,
      fontFamily:
        isBrand && !isSerifBody ? BUILDER_FONT_FAMILIES[4] : BUILDER_FONT_FAMILIES[0],
      fontSize: t.fontSize,
      fontWeight: t.bold || isTitle || isProgram ? 'bold' : 'normal',
      fontStyle: t.italic || isSerifBody || bind === 'studentName' ? 'italic' : 'normal',
      textAlign:
        isSerifBody || isProgram || bind === 'studentName'
          ? 'center'
          : isBrand
            ? 'left'
            : guessTextAlign(t, canvasW),
      color: isBrand && /research|consultancy/i.test(flat) ? '#1a5c3a' : t.color || '#0f172a',
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: 1,
      bind: bind || 'none',
      locked: false,
    })
  }

  const withFields = ensureRequiredDynamicFields(elements, canvasW, canvasH, kind)
  const capped = withFields.slice(0, 180)
  onProgress?.('Done', 100)

  return normalizeVerificationQr({
    version: 1,
    canvas: {
      width: canvasW,
      height: canvasH,
      background: '#ffffff',
      paperKey,
    },
    elements: capped,
  })
}
