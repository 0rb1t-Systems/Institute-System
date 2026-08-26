/**
 * Extract primary / accent brand colors from an institution logo
 * and map them onto CSS variables used by the tenant shell.
 */

export const DEFAULT_BRAND_PRIMARY = '#002147'
export const DEFAULT_BRAND_ACCENT = '#D32F2F'
export const DEFAULT_BRAND_TERTIARY = '#0EA5E9'

const HEX6 = /^#([0-9a-f]{6})$/i

export function normalizeHexColor(value?: string | null, fallback = DEFAULT_BRAND_PRIMARY): string {
  const raw = String(value || '').trim()
  if (HEX6.test(raw)) return raw.toUpperCase()
  if (/^#([0-9a-f]{3})$/i.test(raw)) {
    const h = raw.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toUpperCase()
  }
  return fallback
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHexColor(hex)
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  }
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h: h * 360, s, l }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let rp = 0
  let gp = 0
  let bp = 0
  if (hue < 60) {
    rp = c
    gp = x
  } else if (hue < 120) {
    rp = x
    gp = c
  } else if (hue < 180) {
    gp = c
    bp = x
  } else if (hue < 240) {
    gp = x
    bp = c
  } else if (hue < 300) {
    rp = x
    bp = c
  } else {
    rp = c
    bp = x
  }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  }
}

/** shadcn/tailwind HSL channel string, e.g. "216 100% 14%" */
export function hexToHslChannels(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function hexForegroundHex(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const { l } = rgbToHsl(r, g, b)
  return l > 0.62 ? '#0F172A' : '#FFFFFF'
}

export function hexForegroundChannels(hex: string): string {
  return hexForegroundHex(hex) === '#0F172A' ? '222 47% 11%' : '210 40% 98%'
}

export function shadeHex(hex: string, deltaL: number): string {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  const next = Math.max(0.12, Math.min(0.88, l + deltaL))
  const rgb = hslToRgb(h, s, next)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

function pickDistinctSwatches(swatches: string[], max = 3): string[] {
  const picked: string[] = []
  for (const hex of swatches) {
    const far = picked.every((p) => colorDistance(hex, p) > 32 || hueDistance(hex, p) > 14)
    if (!picked.length || far) {
      picked.push(hex)
      if (picked.length >= max) break
    }
  }
  return picked
}

function colorDistance(a: string, b: string): number {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return Math.sqrt((A.r - B.r) ** 2 + (A.g - B.g) ** 2 + (A.b - B.b) ** 2)
}

function hueDistance(a: string, b: string): number {
  const ha = rgbToHsl(hexToRgb(a).r, hexToRgb(a).g, hexToRgb(a).b).h
  const hb = rgbToHsl(hexToRgb(b).r, hexToRgb(b).g, hexToRgb(b).b).h
  const d = Math.abs(ha - hb)
  return Math.min(d, 360 - d)
}

type Bucket = { hex: string; weight: number; r: number; g: number; b: number }

function quantize(v: number, step = 16): number {
  return Math.max(0, Math.min(255, Math.round(v / step) * step))
}

function paletteFromImageData(data: Uint8ClampedArray): string[] {
  const buckets = new Map<string, Bucket>()
  const step = data.length > 400_000 ? 16 : 8

  for (let i = 0; i < data.length; i += 4 * step) {
    const a = data[i + 3]
    if (a < 96) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const { s, l } = rgbToHsl(r, g, b)
    if (l > 0.93 || l < 0.06) continue
    const qr = quantize(r)
    const qg = quantize(g)
    const qb = quantize(b)
    const hex = rgbToHex(qr, qg, qb)
    const chromaBoost = s < 0.12 ? 0.35 : 0.55 + s
    const midBoost = 1 - Math.abs(l - 0.42)
    const weight = chromaBoost * (0.45 + midBoost)
    const prev = buckets.get(hex)
    if (prev) prev.weight += weight
    else buckets.set(hex, { hex, weight, r: qr, g: qg, b: qb })
  }

  const ranked = [...buckets.values()].sort((a, b) => b.weight - a.weight)
  const merged: Bucket[] = []
  for (const bucket of ranked) {
    const near = merged.find((m) => colorDistance(m.hex, bucket.hex) < 38)
    if (near) {
      const total = near.weight + bucket.weight
      near.r = (near.r * near.weight + bucket.r * bucket.weight) / total
      near.g = (near.g * near.weight + bucket.g * bucket.weight) / total
      near.b = (near.b * near.weight + bucket.b * bucket.weight) / total
      near.hex = rgbToHex(near.r, near.g, near.b)
      near.weight = total
    } else {
      merged.push({ ...bucket })
    }
    if (merged.length >= 8) break
  }

  return merged.map((m) => m.hex)
}

function loadImage(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cors) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('LOGO_IMAGE_LOAD_FAILED'))
    img.src = src
  })
}

function drawToCanvas(img: HTMLImageElement): ImageData | null {
  const max = 160
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return null
  const scale = Math.min(1, max / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, cw, ch)
  try {
    return ctx.getImageData(0, 0, cw, ch)
  } catch {
    return null
  }
}

export type LogoBrandPalette = {
  primary: string
  accent: string
  tertiary: string | null
  swatches: string[]
}

export async function extractLogoBrandPalette(
  source: File | Blob | string,
): Promise<LogoBrandPalette | null> {
  if (typeof document === 'undefined') return null

  let objectUrl: string | null = null
  try {
    let src: string
    let cors = false
    if (typeof source === 'string') {
      src = source
      cors = !src.startsWith('blob:') && !src.startsWith('data:')
    } else {
      objectUrl = URL.createObjectURL(source)
      src = objectUrl
    }

    const img = await loadImage(src, cors)
    const imageData = drawToCanvas(img)
    if (!imageData) return null

    const swatches = paletteFromImageData(imageData.data)
    if (!swatches.length) return null

    const distinct = pickDistinctSwatches(swatches, 3)
    const primary = normalizeHexColor(distinct[0])
    const accent = distinct[1]
      ? normalizeHexColor(distinct[1], DEFAULT_BRAND_ACCENT)
      : shadeHex(primary, 0.16)
    const tertiary = distinct[2] ? normalizeHexColor(distinct[2], DEFAULT_BRAND_TERTIARY) : null

    return {
      primary,
      accent,
      tertiary,
      swatches: distinct.map((c) => normalizeHexColor(c)),
    }
  } catch {
    return null
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

export function applyInstitutionBrandCss(
  primaryInput?: string | null,
  accentInput?: string | null,
  tertiaryInput?: string | null,
): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const primary = normalizeHexColor(primaryInput, DEFAULT_BRAND_PRIMARY)
  const accent = normalizeHexColor(accentInput, DEFAULT_BRAND_ACCENT)
  const tertiary = String(tertiaryInput || '').trim()
    ? normalizeHexColor(tertiaryInput, DEFAULT_BRAND_TERTIARY)
    : ''
  root.style.setProperty('--brand-primary', primary)
  root.style.setProperty('--brand-accent', accent)
  root.style.setProperty('--brand-on-primary', hexForegroundHex(primary))
  root.style.setProperty('--brand-on-accent', hexForegroundHex(accent))
  root.style.setProperty('--brand-soft', `color-mix(in srgb, ${primary} 12%, #ffffff)`)
  if (tertiary) root.style.setProperty('--brand-tertiary', tertiary)
  else root.style.removeProperty('--brand-tertiary')
  root.style.setProperty('--primary', hexToHslChannels(primary))
  root.style.setProperty('--primary-foreground', hexForegroundChannels(primary))
  root.style.setProperty('--ring', hexToHslChannels(primary))
}

export function clearInstitutionBrandCss(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty('--brand-primary')
  root.style.removeProperty('--brand-accent')
  root.style.removeProperty('--brand-on-primary')
  root.style.removeProperty('--brand-on-accent')
  root.style.removeProperty('--brand-soft')
  root.style.removeProperty('--brand-tertiary')
  root.style.removeProperty('--primary')
  root.style.removeProperty('--primary-foreground')
  root.style.removeProperty('--ring')
}
