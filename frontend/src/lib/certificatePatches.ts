import type { BuilderElement } from '@/lib/certificateBuilder'

function createPatchId() {
  return `pt_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

function esc(text: string) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`
}

export const CERTIFICATE_PATCHES = [
  { key: 'certificate_seal', label: 'Certificate Seal', defaultText: 'SEAL', w: 150, h: 150 },
  { key: 'achievement_badge', label: 'Achievement Badge', defaultText: 'ACHIEVE', w: 136, h: 136 },
  { key: 'award_rosette', label: 'Award Rosette', defaultText: 'CERTIFICATE OF AWARD', w: 180, h: 230 },
  { key: 'academic_emblem', label: 'Academic Emblem', defaultText: 'ACADEMY', w: 140, h: 150 },
  { key: 'certificate_medallion', label: 'Certificate Medallion', defaultText: 'CERTIFICATE OF MERIT', w: 180, h: 230 },
  { key: 'laurel_wreath_badge', label: 'Laurel Wreath Badge', defaultText: 'HONOR', w: 160, h: 154 },
  { key: 'certificate_crest', label: 'Certificate Crest', defaultText: 'CREST', w: 128, h: 148 },
  { key: 'gold_foil_seal', label: 'Gold Foil Seal', defaultText: 'FOIL', w: 148, h: 148 },
  { key: 'ribbon_badge', label: 'Ribbon Badge', defaultText: 'CERTIFICATE OF HONOR', w: 180, h: 230 },
  { key: 'guilloche_seal', label: 'Guilloche Seal', defaultText: 'SECURE', w: 150, h: 150 },
] as const

export type CertificatePatchKey = (typeof CERTIFICATE_PATCHES)[number]['key']

export function isCertificatePatchElement(el?: BuilderElement | null): boolean {
  return !!el?.patchKey
}

export function getCertificatePatchMeta(key?: string | null) {
  return CERTIFICATE_PATCHES.find((p) => p.key === key)
}

function rings(cx: number, cy: number, count: number, start: number, step: number, p: string, a: string) {
  return Array.from({ length: count }, (_, i) => {
    const r = start + i * step
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i % 2 ? a : p}" stroke-width="0.7"/>`
  }).join('')
}

function glossDefs(id: string, primary: string, accent: string) {
  return `<defs>
    <radialGradient id="${id}core" cx="32%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="28%" stop-color="${primary}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${primary}"/>
    </radialGradient>
    <linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff4b8"/>
      <stop offset="45%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="#7a5a10"/>
    </linearGradient>
    <linearGradient id="${id}rib" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${primary}"/>
    </linearGradient>
    <linearGradient id="${id}pet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="40%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${primary}"/>
    </linearGradient>
  </defs>`
}

function rosettePetals(cx: number, cy: number, count: number, radius: number, rx: number, ry: number, fill: string) {
  return Array.from({ length: count }, (_, i) => {
    const deg = (i * 360) / count
    const rad = (deg * Math.PI) / 180
    const x = cx + Math.cos(rad) * radius
    const y = cy + Math.sin(rad) * radius
    return `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${rx}" ry="${ry}" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${fill}"/>`
  }).join('')
}

function goldBeads(cx: number, cy: number, r: number, count: number, fill: string) {
  return Array.from({ length: count }, (_, i) => {
    const rad = (i * 2 * Math.PI) / count
    return `<circle cx="${(cx + Math.cos(rad) * r).toFixed(2)}" cy="${(cy + Math.sin(rad) * r).toFixed(2)}" r="1.7" fill="${fill}"/>`
  }).join('')
}

function svgOpen(viewBox: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${viewBox}">`
}

function starBurst(cx: number, cy: number, spikes: number, rOuter: number, rInner: number, fill: string) {
  const pts: string[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const ang = (i * Math.PI) / spikes - Math.PI / 2
    pts.push(`${(cx + Math.cos(ang) * r).toFixed(2)},${(cy + Math.sin(ang) * r).toFixed(2)}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`
}

function knurlRing(cx: number, cy: number, r: number, count: number, fill: string) {
  return Array.from({ length: count }, (_, i) => {
    const deg = (i * 360) / count
    const rad = (deg * Math.PI) / 180
    const x = cx + Math.cos(rad) * r
    const y = cy + Math.sin(rad) * r
    return `<rect x="${(x - 1.1).toFixed(2)}" y="${(y - 3.2).toFixed(2)}" width="2.2" height="6.4" rx="0.4" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="${fill}"/>`
  }).join('')
}

function laurelWreath(cx: number, cy: number, color: string) {
  const leaf = (side: 1 | -1) =>
    Array.from({ length: 7 }, (_, i) => {
      const t = i / 6
      const x = cx + side * (8 + t * 22)
      const y = cy + 18 - t * 34
      const rot = side * (28 - t * 50)
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="5.2" ry="2.4" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${color}"/>`
    }).join('')
  return `${leaf(-1)}${leaf(1)}<path d="M${cx - 6} ${cy + 20} H${cx + 6} M${cx - 4} ${cy + 23} H${cx + 4}" stroke="${color}" stroke-width="1.2" fill="none"/>`
}

function twinRibbons(cx: number, top: number, fill: string, gold: string) {
  const left = `M${cx - 4} ${top} C${cx - 18} ${top + 28} ${cx - 28} ${top + 62} ${cx - 36} ${top + 96} L${cx - 22} ${top + 84} L${cx - 16} ${top + 98} C${cx - 10} ${top + 64} ${cx - 4} ${top + 28} ${cx + 1} ${top + 8} Z`
  const right = `M${cx + 4} ${top} C${cx + 18} ${top + 28} ${cx + 28} ${top + 62} ${cx + 36} ${top + 96} L${cx + 22} ${top + 84} L${cx + 16} ${top + 98} C${cx + 10} ${top + 64} ${cx + 4} ${top + 28} ${cx - 1} ${top + 8} Z`
  return `<path d="${left}" fill="${fill}" stroke="${gold}" stroke-width="1.8"/><path d="${right}" fill="${fill}" stroke="${gold}" stroke-width="1.8"/>`
}

function circularText(pathId: string, cx: number, cy: number, r: number, text: string, fill: string, size = 6.4) {
  return `<path id="${pathId}" fill="none" d="M ${(cx - r).toFixed(1)},${cy} a ${r},${r} 0 1,1 ${(r * 2).toFixed(1)},0 a ${r},${r} 0 1,1 -${(r * 2).toFixed(1)},0"/><text font-family="Georgia, serif" font-size="${size}" font-weight="700" letter-spacing="1.8" fill="${fill}"><textPath href="#${pathId}" xlink:href="#${pathId}" startOffset="25%">${text}</textPath></text>`
}

function buildPatchSvg(
  key: string,
  text: string,
  primary: string,
  accent: string,
  ink: string,
): { svg: string; viewW: number; viewH: number } {
  const t = esc(text || ' ')
  const p = primary
  const a = accent
  const c = ink

  switch (key) {
    case 'certificate_seal':
      return {
        viewW: 150,
        viewH: 150,
        svg: `${svgOpen('0 0 150 150')}${glossDefs('cs', p, a)}<circle cx="75" cy="77" r="68" fill="#000" opacity="0.12"/><circle cx="75" cy="75" r="68" fill="url(#csgold)"/><circle cx="75" cy="75" r="58" fill="url(#cscore)"/><circle cx="75" cy="75" r="50" fill="none" stroke="url(#csgold)" stroke-width="3.5"/>${goldBeads(75, 75, 44, 28, a)}${circularText('csArc', 75, 75, 38, t, c, 6.2)}${laurelWreath(75, 78, a)}</svg>`,
      }
    case 'achievement_badge':
      return {
        viewW: 136,
        viewH: 136,
        svg: `${svgOpen('0 0 136 136')}${glossDefs('ab', p, a)}<polygon points="68,8 83,44 122,48 93,76 101,114 68,94 35,114 43,76 14,48 53,44" fill="url(#abgold)"/><polygon points="68,16 80,44 114,48 90,72 96,104 68,88 40,104 46,72 22,48 56,44" fill="url(#abcore)"/><circle cx="68" cy="66" r="24" fill="url(#abgold)"/><circle cx="68" cy="66" r="18" fill="${p}"/>${circularText('abArc', 68, 66, 13.5, t, a, 4.6)}</svg>`,
      }
    case 'award_rosette':
      return {
        viewW: 200,
        viewH: 240,
        svg: `${svgOpen('0 0 200 240')}${glossDefs('ar', p, a)}${twinRibbons(100, 148, p, a)}${starBurst(100, 96, 22, 78, 64, `url(#argold)`)}<circle cx="100" cy="96" r="52" fill="url(#argold)"/><circle cx="100" cy="96" r="42" fill="${p}"/><circle cx="100" cy="96" r="36" fill="none" stroke="url(#argold)" stroke-width="3"/>${circularText('arArc', 100, 96, 30, t, a, 6)}${laurelWreath(100, 100, a)}</svg>`,
      }
    case 'academic_emblem':
      return {
        viewW: 140,
        viewH: 150,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 150">${glossDefs('ae', p, a)}<path d="M70 12 L124 34 V80 C124 114 96 134 70 144 C44 134 16 114 16 80 V34 Z" fill="url(#aegold)"/><path d="M70 22 L114 40 V78 C114 106 90 124 70 132 C50 124 26 106 26 78 V40 Z" fill="url(#aecore)"/><path d="M46 80 L70 70 L94 80 V94 L70 104 L46 94 Z" fill="url(#aegold)"/><text x="70" y="124" text-anchor="middle" font-family="Georgia, serif" font-size="8" font-weight="700" fill="${c}">${t}</text></svg>`,
      }
    case 'certificate_medallion':
      return {
        viewW: 200,
        viewH: 240,
        svg: `${svgOpen('0 0 200 240')}${glossDefs('cm', p, a)}${twinRibbons(100, 150, p, a)}<circle cx="100" cy="98" r="76" fill="#000" opacity="0.1"/><circle cx="100" cy="96" r="74" fill="url(#cmgold)"/>${knurlRing(100, 96, 70, 36, a)}<circle cx="100" cy="96" r="58" fill="url(#cmgold)"/><circle cx="100" cy="96" r="52" fill="#f3d56a"/><circle cx="100" cy="96" r="48" fill="none" stroke="#c9a227" stroke-width="1.4"/>${circularText('cmArc', 100, 96, 40, t, p, 6.2)}${laurelWreath(100, 100, p)}</svg>`,
      }
    case 'laurel_wreath_badge':
      return {
        viewW: 160,
        viewH: 154,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 154">${glossDefs('lw', p, a)}<path d="M80 134 C24 110 14 54 36 22 C50 46 58 74 62 104 C50 82 34 54 32 36 C20 74 32 116 80 134 Z" fill="url(#lwgold)"/><path d="M80 134 C136 110 146 54 124 22 C110 46 102 74 98 104 C110 82 126 54 128 36 C140 74 128 116 80 134 Z" fill="url(#lwgold)"/><circle cx="80" cy="72" r="30" fill="url(#lwcore)"/><circle cx="80" cy="72" r="24" fill="none" stroke="url(#lwgold)" stroke-width="2.4"/><text x="80" y="76" text-anchor="middle" font-family="Georgia, serif" font-size="8" font-weight="700" fill="${c}">${t}</text></svg>`,
      }
    case 'certificate_crest':
      return {
        viewW: 128,
        viewH: 148,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 148">${glossDefs('cc', p, a)}<path d="M18 38 H110 L118 54 H10 Z" fill="url(#ccgold)"/><path d="M64 8 L80 38 H48 Z" fill="url(#cccore)"/><path d="M22 54 H106 V94 C106 122 84 138 64 146 C44 138 22 122 22 94 Z" fill="url(#ccgold)"/><path d="M32 64 H96 V92 C96 114 78 128 64 134 C50 128 32 114 32 92 Z" fill="url(#cccore)"/><text x="64" y="98" text-anchor="middle" font-family="Georgia, serif" font-size="10" font-weight="700" fill="${c}">${t}</text></svg>`,
      }
    case 'gold_foil_seal':
      return {
        viewW: 148,
        viewH: 148,
        svg: `${svgOpen('0 0 148 148')}${glossDefs('gf', p, a)}<circle cx="74" cy="76" r="70" fill="#000" opacity="0.12"/><circle cx="74" cy="74" r="70" fill="url(#gfgold)"/><circle cx="74" cy="74" r="58" fill="url(#gfcore)"/><circle cx="74" cy="74" r="50" fill="url(#gfgold)"/><circle cx="74" cy="74" r="40" fill="url(#gfcore)"/><circle cx="74" cy="74" r="34" fill="none" stroke="url(#gfgold)" stroke-width="2.2"/>${goldBeads(74, 74, 34, 20, a)}${circularText('gfArc', 74, 74, 26, t, c, 5.6)}</svg>`,
      }
    case 'ribbon_badge':
      return {
        viewW: 200,
        viewH: 240,
        svg: `${svgOpen('0 0 200 240')}${glossDefs('rb', p, a)}${twinRibbons(100, 148, p, a)}${starBurst(100, 96, 16, 76, 66, `url(#rbgold)`)}<circle cx="100" cy="96" r="54" fill="url(#rbgold)"/><circle cx="100" cy="96" r="48" fill="#f0c84a"/><circle cx="100" cy="96" r="44" fill="none" stroke="#d4a017" stroke-width="1.2"/><circle cx="100" cy="96" r="40" fill="none" stroke="#d4a017" stroke-width="0.8"/>${circularText('rbArc', 100, 96, 33, t, p, 6)}${laurelWreath(100, 100, '#c98912')}</svg>`,
      }
    case 'guilloche_seal':
      return {
        viewW: 150,
        viewH: 150,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">${glossDefs('gs', p, a)}<circle cx="75" cy="75" r="70" fill="url(#gscore)"/>${rings(75, 75, 10, 16, 5, a, c)}${Array.from({ length: 24 }, (_, i) => {
          const ang = (i * 15 * Math.PI) / 180
          return `<line x1="${(75 + Math.cos(ang) * 18).toFixed(1)}" y1="${(75 + Math.sin(ang) * 18).toFixed(1)}" x2="${(75 + Math.cos(ang) * 62).toFixed(1)}" y2="${(75 + Math.sin(ang) * 62).toFixed(1)}" stroke="${a}" stroke-width="0.45"/>`
        }).join('')}<circle cx="75" cy="75" r="20" fill="url(#gsgold)"/><circle cx="75" cy="75" r="16" fill="url(#gscore)"/><text x="75" y="79" text-anchor="middle" font-family="Georgia, serif" font-size="8" font-weight="700" fill="${c}">${t}</text></svg>`,
      }
    default:
      return {
        viewW: 150,
        viewH: 150,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150"><circle cx="75" cy="75" r="68" fill="${p}"/><circle cx="75" cy="75" r="58" fill="none" stroke="${a}" stroke-width="3"/><text x="75" y="80" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-weight="700" fill="${c}">${t}</text></svg>`,
      }
  }
}

export function rebuildCertificatePatch(el: BuilderElement): BuilderElement {
  if (!el.patchKey) return el
  const primary = el.fill && el.fill !== 'transparent' ? el.fill : '#002147'
  const accent = el.stroke || '#c9a227'
  const ink = el.color || '#ffffff'
  const built = buildPatchSvg(el.patchKey, el.text || '', primary, accent, ink)
  return {
    ...el,
    type: 'image',
    src: svgDataUri(built.svg),
    fill: primary,
    stroke: accent,
    color: ink,
  }
}

export function createCertificatePatchElement(
  key: CertificatePatchKey,
  canvas: { width: number; height: number },
  colors: { primary?: string; accent?: string; ink?: string } = {},
): BuilderElement {
  const meta = getCertificatePatchMeta(key) || CERTIFICATE_PATCHES[0]
  const primary = colors.primary || '#002147'
  const accent = colors.accent || '#c9a227'
  const ink = colors.ink || '#ffffff'
  const el: BuilderElement = {
    id: createPatchId(),
    type: 'image',
    x: Math.round(canvas.width / 2 - meta.w / 2),
    y: Math.round(canvas.height * 0.72 - meta.h / 2),
    width: meta.w,
    height: meta.h,
    rotation: 0,
    zIndex: 55,
    text: meta.defaultText,
    name: meta.label,
    fill: primary,
    stroke: accent,
    color: ink,
    opacity: 1,
    bind: 'none',
    patchKey: key,
  }
  return rebuildCertificatePatch(el)
}
