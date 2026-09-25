/**
 * Read an uploaded certificate (size, colors, rules, and text positions) and
 * rebuild it as a real template. Institution name, logo, seal, and signatories
 * come from institution settings. The scanned picture is not placed on the page.
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

/** Upload the full certificate page unchanged — exact design / format match. */
async function uploadExactPaper(
  imageUrl: string,
  canvasW: number,
  canvasH: number,
  uploadImageBlob: UploadImageBlobFn,
): Promise<string | null> {
  const img = await loadImage(imageUrl)
  const c = document.createElement('canvas')
  c.width = canvasW
  c.height = canvasH
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasW, canvasH)
  // Fill the template canvas — aspect already matched to the upload
  ctx.drawImage(img, 0, 0, canvasW, canvasH)
  const blob = await blobFromCanvas(c, 'image/png')
  const up = await uploadImageBlob(blob, 'certificate-paper.png')
  return up.path || null
}

/**
 * Sample paper (light) + ink (dark) colors around a text box so overlay
 * covers match the uploaded design instead of harsh white rectangles.
 */
async function samplePaperAndInk(
  imageUrl: string,
  canvasW: number,
  canvasH: number,
  box: BBox,
): Promise<{ paper: string; ink: string }> {
  const fallback = { paper: '#ffffff', ink: '#0f172a' }
  try {
    const img = await loadImage(imageUrl)
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    if (iw < 4 || ih < 4) return fallback

    const c = document.createElement('canvas')
    const mw = Math.min(640, iw)
    const mh = Math.max(1, Math.round((mw / iw) * ih))
    c.width = mw
    c.height = mh
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return fallback
    ctx.drawImage(img, 0, 0, mw, mh)
    const data = ctx.getImageData(0, 0, mw, mh).data

    const x0 = Math.max(0, Math.floor((box.x / canvasW) * mw) - 2)
    const y0 = Math.max(0, Math.floor((box.y / canvasH) * mh) - 2)
    const x1 = Math.min(mw, Math.ceil(((box.x + box.w) / canvasW) * mw) + 2)
    const y1 = Math.min(mh, Math.ceil(((box.y + box.h) / canvasH) * mh) + 2)

    const lights: Array<[number, number, number]> = []
    const darks: Array<[number, number, number]> = []
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const p = (y * mw + x) * 4
        const r = data[p]
        const g = data[p + 1]
        const b = data[p + 2]
        const a = data[p + 3]
        if (a < 40) continue
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        if (lum >= 175) lights.push([r, g, b])
        else if (lum <= 120) darks.push([r, g, b])
      }
    }

    const avg = (arr: Array<[number, number, number]>) => {
      if (!arr.length) return null
      let r = 0
      let g = 0
      let b = 0
      for (const c3 of arr) {
        r += c3[0]
        g += c3[1]
        b += c3[2]
      }
      return rgbToHex(r / arr.length, g / arr.length, b / arr.length)
    }

    return {
      paper: avg(lights) || fallback.paper,
      ink: avg(darks) || fallback.ink,
    }
  } catch {
    return fallback
  }
}

function fieldPlaceholder(bind: BuilderBinding): string {
  switch (bind) {
    case 'studentName':
      return 'Student Name'
    case 'programName':
      return 'Program / Course'
    case 'certificateNumber':
      return 'Certificate No.'
    case 'dateIssued':
      return 'YYYY-MM-DD'
    case 'studentId':
      return 'Student ID'
    case 'gpa':
      return 'GPA'
    case 'className':
      return 'Class Name'
    case 'invoiceNumber':
      return 'Invoice No.'
    case 'totalDue':
      return 'Total Due'
    default:
      return 'Text'
  }
}

/** Pick the best OCR/PDF line for each dynamic bind (one slot each). */
function pickDynamicSlots(texts: RawText[]): Array<RawText & { bind: Exclude<BuilderBinding, 'qr' | 'none'> }> {
  type Dyn = Exclude<BuilderBinding, 'qr' | 'none'>
  const scored: Array<{ bind: Dyn; t: RawText; score: number }> = []

  for (const t of texts) {
    const flat = t.text.replace(/\n/g, ' ').trim()
    if (flat.length < 2) continue
    // Skip pure labels that are not values
    if (/^(cert\s*no\.?:?|date:?|student\s*id:?|gpa:?)$/i.test(flat)) continue

    let bind = guessBind(flat) as BuilderBinding
    if (
      bind === 'none' &&
      /\n/.test(t.text) &&
      /diploma|certificate|programme|program|course|award/i.test(t.text)
    ) {
      bind = 'programName'
    }
    if (!bind || bind === 'none' || bind === 'qr') continue

    let score = t.w * t.h + t.fontSize * 20
    if (bind === 'studentName') {
      score += 8000
      // Prefer mid-page name slots over header branding
      if (t.y > 80) score += 2000
    }
    if (bind === 'programName') score += 6000 + t.fontSize * 25
    if (bind === 'certificateNumber') score += 2500
    if (bind === 'dateIssued') score += 2000
    if (bind === 'studentId') score += 1800
    if (bind === 'gpa') score += 1500
    scored.push({ bind: bind as Dyn, t, score })
  }

  scored.sort((a, b) => b.score - a.score)
  const used = new Set<Dyn>()
  const out: Array<RawText & { bind: Dyn }> = []
  for (const s of scored) {
    if (used.has(s.bind)) continue
    used.add(s.bind)
    out.push({ ...s.t, bind: s.bind })
  }
  return out
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
  paperFill = '#ffffff',
  inkColor = '#0f172a',
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
      text: fieldPlaceholder(bind),
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: bind === 'studentName' ? 28 : 16,
      fontWeight: bind === 'studentName' || bind === 'programName' ? 'bold' : 'normal',
      fontStyle: bind === 'studentName' ? 'italic' : 'normal',
      textAlign: 'center',
      color: inkColor,
      fill: paperFill,
      opacity: 1,
      bind,
      locked: false,
      ...defaults,
    })
  }

  // Prefer binding an already-placed text layer in its original scanned position
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
      pushField('programName', {
        y: canvasH * 0.28,
        fontSize: 18,
        fill: paperFill,
        color: inkColor,
      })
    }
  }

  if (!hasBind('studentName')) {
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
        y: canvasH * 0.4,
        fill: paperFill,
        color: inkColor,
      })
    }
  }

  if (!hasBind('certificateNumber')) {
    pushField('certificateNumber', {
      x: canvasW * 0.1,
      y: canvasH * 0.72,
      width: canvasW * 0.4,
      height: 22,
      fontSize: 12,
      textAlign: 'left',
      fill: paperFill,
      color: inkColor,
    })
  }

  if (!hasBind('dateIssued')) {
    pushField('dateIssued', {
      x: canvasW * 0.55,
      y: canvasH * 0.72,
      width: canvasW * 0.35,
      height: 22,
      fontSize: 12,
      textAlign: 'right',
      fill: paperFill,
      color: inkColor,
    })
  }

  if (kind === 'transcript' && !hasBind('gpa')) {
    pushField('gpa', { y: canvasH * 0.58, fontSize: 14, fill: paperFill, color: inkColor })
  }

  if (!out.some((e) => e.bind === 'qr')) {
    out.push({
      ...createVerificationQrElement({ width: canvasW, height: canvasH }),
      zIndex: z++,
    })
  }

  return out
}

export type ScanInstitutionProfile = {
  name?: string
  primary?: string
  accent?: string
  logoUrl?: string | null
  sealUrl?: string | null
  signatureUrl?: string | null
  motto?: string | null
  leftTitle?: string
  rightTitle?: string
  leftName?: string
  rightName?: string
}

function pushText(
  out: BuilderElement[],
  z: number,
  box: BBox & { fontSize?: number; bold?: boolean; italic?: boolean; align?: 'left' | 'center' | 'right' },
  patch: Partial<BuilderElement>,
): number {
  out.push({
    id: createElementId(),
    type: 'text',
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.max(24, box.w),
    height: Math.max(18, box.h),
    rotation: 0,
    zIndex: z,
    fontFamily: BUILDER_FONT_FAMILIES[0],
    fontSize: box.fontSize || 16,
    fontWeight: box.bold ? 'bold' : 'normal',
    fontStyle: box.italic ? 'italic' : 'normal',
    textAlign: box.align || 'center',
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    locked: false,
    ...patch,
  })
  return z + 1
}

/**
 * Rebuild the scanned page as template elements: same size, colors, rules,
 * and text positions, with institution records in the identity slots.
 */
function composeInstitutionTemplate(args: {
  texts: RawText[]
  shapes: RawShape[]
  canvasW: number
  canvasH: number
  paperKey: PaperSizeKey
  paper: string
  ink: string
  kind: DocumentBuilderKind
  institution?: ScanInstitutionProfile
}): LogoBuilderDesign {
  const { texts, shapes, canvasW, canvasH, paperKey, paper, ink, kind, institution } = args
  const inst = institution || {}
  const bar = shapes.find((s) => s.shape === 'bar')
  const rule = shapes.find((s) => s.shape === 'line')
  const scannedPrimary =
    (bar && bar.shape === 'bar' ? bar.color : null) ||
    (rule && rule.shape === 'line' ? rule.color : null) ||
    ''
  const primary = scannedPrimary || inst.primary || ink || '#0f172a'
  const elements: BuilderElement[] = []
  let z = 1
  const used = new Set<string>()

  for (const shape of shapes) {
    if (shape.shape === 'bar') {
      elements.push({
        id: createElementId(),
        type: 'rect',
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        rotation: 0,
        zIndex: z++,
        fill: shape.color || primary,
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
        bind: 'none',
        text: 'accent-bar',
      })
      continue
    }
    if (shape.shape === 'line') {
      elements.push({
        id: createElementId(),
        type: 'line',
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: Math.max(2, shape.h),
        rotation: 0,
        zIndex: z++,
        stroke: shape.color || primary,
        strokeWidth: shape.strokeWidth || 2,
        fill: shape.color || primary,
        opacity: 1,
        bind: 'none',
        text: 'rule',
      })
      continue
    }
    if (shape.kind === 'logo' && inst.logoUrl && !used.has('logo')) {
      used.add('logo')
      elements.push({
        id: createElementId(),
        type: 'image',
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        rotation: 0,
        zIndex: z++,
        src: inst.logoUrl,
        opacity: 1,
        bind: 'none',
        text: 'logo',
      })
      continue
    }
    if (shape.kind === 'stamp' && inst.sealUrl && !used.has('seal')) {
      used.add('seal')
      elements.push({
        id: createElementId(),
        type: 'image',
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        rotation: 0,
        zIndex: z++,
        src: inst.sealUrl,
        opacity: 1,
        bind: 'none',
        text: 'seal',
      })
      continue
    }
    if (shape.kind === 'signature' && inst.signatureUrl) {
      elements.push({
        id: createElementId(),
        type: 'image',
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        rotation: 0,
        zIndex: z++,
        src: inst.signatureUrl,
        opacity: 1,
        bind: 'none',
        text: 'signature',
      })
      continue
    }
    if (shape.kind === 'qr' && !used.has('qr')) {
      used.add('qr')
      elements.push({
        ...createVerificationQrElement({ width: canvasW, height: canvasH }),
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        zIndex: z++,
      })
    }
  }

  if (inst.logoUrl && !used.has('logo')) {
    const size = Math.round(Math.min(canvasW, canvasH) * 0.12)
    elements.push({
      id: createElementId(),
      type: 'image',
      x: canvasW * 0.08,
      y: canvasH * 0.05,
      width: size,
      height: size,
      rotation: 0,
      zIndex: z++,
      src: inst.logoUrl,
      opacity: 1,
      bind: 'none',
      text: 'logo',
    })
  }

  const header = texts
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => t.y < canvasH * 0.26 && t.text.trim().length > 2)
    .sort((a, b) => a.t.y - b.t.y || b.t.fontSize - a.t.fontSize)
  const identityLine = header.find(
    ({ t }) => !/certificate|diploma|transcript|invoice|award/i.test(t.text),
  )

  const skip = new Set<number>()
  if (identityLine) {
    skip.add(identityLine.index)
    z = pushText(elements, z, { ...identityLine.t, w: Math.max(identityLine.t.w, canvasW * 0.5), bold: true }, {
      text: inst.name || identityLine.t.text,
      color: primary,
      bind: 'institutionName',
      textAlign: guessTextAlign(identityLine.t, canvasW),
    })
    used.add('institutionName')
  }
  const mottoLine = header.find(
    ({ index, t }) =>
      !skip.has(index) &&
      !/certificate|diploma|transcript|invoice|this is to certify/i.test(t.text),
  )
  if (mottoLine && String(inst.motto || '').trim()) {
    skip.add(mottoLine.index)
    z = pushText(elements, z, mottoLine.t, {
      text: String(inst.motto),
      color: inst.accent || primary,
      bind: 'motto',
      textAlign: guessTextAlign(mottoLine.t, canvasW),
    })
    used.add('motto')
  } else if (mottoLine && mottoLine.t.y < canvasH * 0.18) {
    skip.add(mottoLine.index)
  }

  for (let i = 0; i < texts.length; i++) {
    if (skip.has(i)) continue
    const t = texts[i]
    const flat = t.text.replace(/\n/g, ' ').trim()
    if (flat.length < 2) continue

    let bind = guessBind(flat)
    if (bind === 'studentName' && t.y > canvasH * 0.62) {
      bind = t.x + t.w / 2 < canvasW * 0.5 ? 'leftName' : 'rightName'
    }
    if (/^academic\s+registrar$/i.test(flat)) bind = 'leftTitle'
    if (/^principal$/i.test(flat)) bind = 'rightTitle'
    if (
      bind === 'none' &&
      /university|institute|college|academy/i.test(flat) &&
      t.y < canvasH * 0.32
    ) {
      bind = used.has('institutionName') ? 'none' : 'institutionName'
      if (used.has('institutionName')) continue
    }
    if (bind && bind !== 'none' && bind !== 'qr' && used.has(bind)) {
      continue
    }

    const align = t.align || guessTextAlign(t, canvasW)
    if (!bind || bind === 'none') {
      z = pushText(elements, z, { ...t, align }, {
        text: t.text,
        color: t.color || ink,
        bind: 'none',
      })
      continue
    }

    used.add(bind)
    z = pushText(
      elements,
      z,
      {
        ...t,
        w: Math.max(t.w, bind === 'studentName' || bind === 'programName' ? canvasW * 0.55 : t.w),
        bold: t.bold || bind === 'studentName' || bind === 'programName' || bind === 'institutionName',
        italic: t.italic || bind === 'studentName' || bind === 'programName',
        align:
          bind === 'studentName' || bind === 'programName' || bind === 'institutionName'
            ? 'center'
            : align,
      },
      {
        text: fieldPlaceholder(bind),
        color: bind === 'institutionName' ? primary : t.color || ink,
        bind,
      },
    )
  }

  const withFields = ensureRequiredDynamicFields(elements, canvasW, canvasH, kind, 'transparent', ink)
  return normalizeVerificationQr({
    version: 1,
    canvas: {
      width: canvasW,
      height: canvasH,
      background: paper || '#ffffff',
      paperKey,
    },
    elements: withFields.slice(0, 180),
  })
}

/**
 * Scan an uploaded PDF/image and rebuild the same layout as a template.
 * Size, colors, rules, and wording positions come from the file.
 * Identity fields use the institution profile. The picture itself is not kept.
 */
export async function extractCertificateDesign(opts: {
  file: File
  imageUrl: string
  aspectRatio?: number | null
  kind?: DocumentBuilderKind
  uploadImageBlob?: UploadImageBlobFn
  institution?: ScanInstitutionProfile
  onProgress?: ExtractProgress
}): Promise<LogoBuilderDesign> {
  const { file, imageUrl, aspectRatio, onProgress } = opts
  const kind: DocumentBuilderKind = opts.kind || 'certificate'

  // Prefer the real image aspect so the template paper matches the upload format
  let ar = aspectRatio && aspectRatio > 0 ? aspectRatio : null
  try {
    const img = await loadImage(imageUrl)
    const iw = img.naturalWidth || img.width
    const ih = img.naturalHeight || img.height
    if (iw > 0 && ih > 0) ar = iw / ih
  } catch {
    /* keep provided aspect */
  }
  const { width: canvasW, height: canvasH, paperKey } = pickCanvasSize(ar)
  const mime = String(file.type || '').toLowerCase()
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(file.name)

  onProgress?.('Reading size, colors, and layout…', 8)

  let texts: RawText[] = []
  if (isPdf) {
    try {
      onProgress?.('Reading PDF text & positions…', 30)
      texts = await extractPdfText(file, canvasW, canvasH)
    } catch {
      texts = []
    }
  }
  if (texts.length < 3) {
    onProgress?.('Reading design text (OCR)…', 40)
    try {
      texts = await extractOcrText(imageUrl, canvasW, canvasH, onProgress)
      texts = dedupeOverlappingTexts(texts)
    } catch {
      if (!texts.length) texts = []
    }
  }

  // Lightly stack diploma title + next line into one program slot
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
          align: 'center' as const,
          color: a.color || '#0f172a',
        },
        ...texts.slice(diplomaIdx + 2),
      ]
    }
  }

  onProgress?.('Matching the document to your institution…', 70)
  const pageSample = await samplePaperAndInk(imageUrl, canvasW, canvasH, {
    x: canvasW * 0.35,
    y: canvasH * 0.35,
    w: canvasW * 0.3,
    h: canvasH * 0.2,
  })

  let shapes: RawShape[] = []
  try {
    shapes = await detectGraphicElements(
      imageUrl,
      canvasW,
      canvasH,
      textBlocks.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h })),
    )
  } catch {
    shapes = []
  }

  onProgress?.('Building template…', 90)
  const design = composeInstitutionTemplate({
    texts: textBlocks,
    shapes,
    canvasW,
    canvasH,
    paperKey,
    paper: pageSample.paper,
    ink: pageSample.ink,
    kind,
    institution: opts.institution,
  })
  onProgress?.('Template ready', 100)
  return design
}
