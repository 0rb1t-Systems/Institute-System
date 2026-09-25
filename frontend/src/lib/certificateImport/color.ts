export function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function hexColor(raw?: string | null, fallback = '#0f172a') {
  const v = String(raw || '').trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`.toLowerCase()
  }
  return fallback
}

function lum(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function paletteFromPixels(data: Uint8ClampedArray): {
  background: string
  text: string
  accent: string
  secondary: string
  border: string
  fromDocument: boolean
} {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 200) continue
    const key = `${r >> 4},${g >> 4},${b >> 4}`
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 }
    bucket.n += 1
    bucket.r += r
    bucket.g += g
    bucket.b += b
    buckets.set(key, bucket)
  }
  const items = [...buckets.values()]
    .map((b) => ({ n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n }))
    .sort((a, b) => b.n - a.n)
  if (!items.length) {
    return {
      background: '#ffffff',
      text: '#0f172a',
      accent: '#002147',
      secondary: '#e2e8f0',
      border: '#002147',
      fromDocument: false,
    }
  }
  const background = items[0]
  const dark = items
    .filter((c) => lum(c.r, c.g, c.b) < 90)
    .sort((a, b) => b.n - a.n)[0]
  const sat = (c: { r: number; g: number; b: number }) => {
    const max = Math.max(c.r, c.g, c.b)
    const min = Math.min(c.r, c.g, c.b)
    return max === 0 ? 0 : (max - min) / max
  }
  const colorful = items
    .filter((c) => c !== background && sat(c) > 0.28 && lum(c.r, c.g, c.b) > 30 && lum(c.r, c.g, c.b) < 210)
    .sort((a, b) => b.n * sat(b) - a.n * sat(a))[0]
  const secondary = items.find((c) => c !== background && c !== colorful && c !== dark)
  // Text always trends toward near-black for readability on certificates.
  const text = dark && lum(dark.r, dark.g, dark.b) < 70 ? dark : { r: 15, g: 23, b: 42 }
  const accent = colorful || { r: 11, g: 61, b: 46 }
  const borderColor = colorful || dark || accent
  return {
    background: rgbToHex(background.r, background.g, background.b),
    text: '#0f172a',
    accent: rgbToHex(accent.r, accent.g, accent.b),
    secondary: secondary ? rgbToHex(secondary.r, secondary.g, secondary.b) : '#1F8A5B',
    border: rgbToHex(borderColor.r, borderColor.g, borderColor.b),
    fromDocument: true,
  }
}

export function mapFontFamily(fontName: string): string {
  const n = fontName.toLowerCase()
  if (/script|calligraphy|vibes|allura|tangerine|pinyon|italianno/.test(n)) {
    return '"Great Vibes", "Segoe Script", cursive'
  }
  if (/cinzel/.test(n)) return '"Cinzel", Palatino, serif'
  if (/garamond/.test(n)) return 'Garamond, serif'
  if (/palatino|book antiqua/.test(n)) return 'Palatino Linotype, Book Antiqua, Palatino, serif'
  if (/times|liberation serif|nimbusrom|cambria/.test(n)) return 'Times New Roman, Times, serif'
  if (/georgia|libre baskerville|merriweather/.test(n)) return 'Georgia, serif'
  if (/courier|mono|consolas/.test(n)) return 'Courier New, Courier, monospace'
  if (/arial|helvetica|calibri|liberation sans|nimbussan|carlito|segoe/.test(n)) {
    return 'Arial, Helvetica, sans-serif'
  }
  if (/sans/.test(n)) return 'Arial, Helvetica, sans-serif'
  return 'Georgia, serif'
}
