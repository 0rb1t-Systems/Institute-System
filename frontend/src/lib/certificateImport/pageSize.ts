import { getPaperSize } from '@/lib/certificateBuilder'
import type { PageGeometry } from '@/lib/certificateImport/types'

const PAPERS = [
  { key: 'a4-portrait', w: 210, h: 297, label: 'A4 portrait' },
  { key: 'a4-landscape', w: 297, h: 210, label: 'A4 landscape' },
  { key: 'letter-portrait', w: 215.9, h: 279.4, label: 'Letter portrait' },
  { key: 'letter-landscape', w: 279.4, h: 215.9, label: 'Letter landscape' },
] as const

export function pageFromPoints(widthPt: number, heightPt: number): PageGeometry {
  const widthMm = (widthPt * 25.4) / 72
  const heightMm = (heightPt * 25.4) / 72
  let best: (typeof PAPERS)[number] = PAPERS[0]
  let bestD = Infinity
  for (const paper of PAPERS) {
    const d = Math.abs(paper.w - widthMm) + Math.abs(paper.h - heightMm)
    if (d < bestD) {
      best = paper
      bestD = d
    }
  }
  const sized = getPaperSize(best.key)
  const orientation = widthPt >= heightPt ? 'landscape' : 'portrait'
  return {
    width: sized.width,
    height: sized.height,
    orientation,
    paperKey: best.key,
    pageSizeLabel: bestD > 28 ? `Custom ${Math.round(widthMm)}×${Math.round(heightMm)} mm` : best.label,
    widthMm: Math.round(widthMm * 10) / 10,
    heightMm: Math.round(heightMm * 10) / 10,
    marginTop: Math.round(sized.height * 0.08),
    marginRight: Math.round(sized.width * 0.08),
    marginBottom: Math.round(sized.height * 0.08),
    marginLeft: Math.round(sized.width * 0.08),
  }
}

export function pageFromPixels(widthPx: number, heightPx: number): PageGeometry {
  const widthPt = (widthPx * 72) / 96
  const heightPt = (heightPx * 72) / 96
  return pageFromPoints(widthPt, heightPt)
}

export function applyContentMargins(
  page: PageGeometry,
  boxes: Array<{ x: number; y: number; width: number; height: number }>,
): PageGeometry {
  if (!boxes.length) return page
  const minX = Math.min(...boxes.map((b) => b.x))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxR = Math.max(...boxes.map((b) => b.x + b.width))
  const maxB = Math.max(...boxes.map((b) => b.y + b.height))
  return {
    ...page,
    marginLeft: Math.max(0, Math.round(minX)),
    marginTop: Math.max(0, Math.round(minY)),
    marginRight: Math.max(0, Math.round(page.width - maxR)),
    marginBottom: Math.max(0, Math.round(page.height - maxB)),
  }
}
