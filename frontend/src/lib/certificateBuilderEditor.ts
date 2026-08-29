/**
 * Geometry helpers for the existing Certificate Page Builder.
 * Not a separate builder — used by CertificateLogoPageBuilder only.
 */
import type { BuilderElement } from '@/lib/certificateBuilder'

export const BUILDER_GRID_PX = 8

export function snapCoord(n: number, enabled: boolean, step = BUILDER_GRID_PX) {
  if (!enabled) return n
  return Math.round(n / step) * step
}

export type AlignMode =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'page-center'
  | 'h-center'
  | 'v-center'

export function alignElementsToPage(
  el: BuilderElement,
  canvas: { width: number; height: number },
  mode: AlignMode,
): { x: number; y: number } {
  const { width: cw, height: ch } = canvas
  let x = el.x
  let y = el.y
  if (mode === 'left') x = 0
  if (mode === 'center' || mode === 'h-center' || mode === 'page-center') {
    x = Math.max(0, (cw - el.width) / 2)
  }
  if (mode === 'right') x = Math.max(0, cw - el.width)
  if (mode === 'top') y = 0
  if (mode === 'middle' || mode === 'v-center' || mode === 'page-center') {
    y = Math.max(0, (ch - el.height) / 2)
  }
  if (mode === 'bottom') y = Math.max(0, ch - el.height)
  return { x, y }
}

export function alignSelection(
  elements: BuilderElement[],
  ids: string[],
  canvas: { width: number; height: number },
  mode: AlignMode,
): BuilderElement[] {
  const set = new Set(ids)
  const targets = elements.filter((e) => set.has(e.id) && !e.locked)
  if (!targets.length) return elements
  if (targets.length === 1) {
    const p = alignElementsToPage(targets[0], canvas, mode)
    return elements.map((e) => (e.id === targets[0].id ? { ...e, ...p } : e))
  }
  const minX = Math.min(...targets.map((e) => e.x))
  const maxX = Math.max(...targets.map((e) => e.x + e.width))
  const minY = Math.min(...targets.map((e) => e.y))
  const maxY = Math.max(...targets.map((e) => e.y + e.height))
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  return elements.map((e) => {
    if (!set.has(e.id) || e.locked) return e
    let x = e.x
    let y = e.y
    if (mode === 'left') x = minX
    if (mode === 'center' || mode === 'h-center') x = midX - e.width / 2
    if (mode === 'right') x = maxX - e.width
    if (mode === 'top') y = minY
    if (mode === 'middle' || mode === 'v-center') y = midY - e.height / 2
    if (mode === 'bottom') y = maxY - e.height
    if (mode === 'page-center') {
      const p = alignElementsToPage(e, canvas, 'page-center')
      x = p.x
      y = p.y
    }
    return { ...e, x, y }
  })
}

export function distributeSelection(
  elements: BuilderElement[],
  ids: string[],
  axis: 'h' | 'v',
): BuilderElement[] {
  const set = new Set(ids)
  const targets = elements
    .filter((e) => set.has(e.id) && !e.locked)
    .sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y))
  if (targets.length < 3) return elements
  const first = targets[0]
  const last = targets[targets.length - 1]
  if (axis === 'h') {
    const span = last.x - first.x
    const step = span / (targets.length - 1)
    const byId = new Map(targets.map((e, i) => [e.id, first.x + step * i]))
    return elements.map((e) => (byId.has(e.id) ? { ...e, x: byId.get(e.id)! } : e))
  }
  const span = last.y - first.y
  const step = span / (targets.length - 1)
  const byId = new Map(targets.map((e, i) => [e.id, first.y + step * i]))
  return elements.map((e) => (byId.has(e.id) ? { ...e, y: byId.get(e.id)! } : e))
}

export function stepZIndex(
  elements: BuilderElement[],
  id: string,
  dir: 'forward' | 'backward' | 'front' | 'back',
): BuilderElement[] {
  const zs = elements.map((e) => e.zIndex || 0)
  const max = Math.max(...zs, 0)
  const min = Math.min(...zs, 0)
  const current = elements.find((e) => e.id === id)
  if (!current) return elements
  const z = current.zIndex || 0
  if (dir === 'front') {
    return elements.map((e) => (e.id === id ? { ...e, zIndex: max + 1 } : e))
  }
  if (dir === 'back') {
    return elements.map((e) => (e.id === id ? { ...e, zIndex: min - 1 } : e))
  }
  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  const idx = sorted.findIndex((e) => e.id === id)
  if (idx < 0) return elements
  const swapWith = dir === 'forward' ? sorted[idx + 1] : sorted[idx - 1]
  if (!swapWith) return elements
  return elements.map((e) => {
    if (e.id === id) return { ...e, zIndex: swapWith.zIndex || 0 }
    if (e.id === swapWith.id) return { ...e, zIndex: z }
    return e
  })
}

export function snapToGuides(
  x: number,
  y: number,
  w: number,
  h: number,
  canvas: { width: number; height: number },
  others: Array<{ x: number; y: number; width: number; height: number }>,
  threshold = 6,
): { x: number; y: number; guideX: number | null; guideY: number | null } {
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const centers = [
    { vx: 0, hy: 0 },
    { vx: cx, hy: cy },
    { vx: canvas.width, hy: canvas.height },
  ]
  const vLines = [0, cx, canvas.width, ...others.flatMap((o) => [o.x, o.x + o.width / 2, o.x + o.width])]
  const hLines = [0, cy, canvas.height, ...others.flatMap((o) => [o.y, o.y + o.height / 2, o.y + o.height])]
  void centers
  let nx = x
  let ny = y
  let guideX: number | null = null
  let guideY: number | null = null
  const candidatesX = [x, x + w / 2, x + w]
  for (const line of vLines) {
    for (let i = 0; i < candidatesX.length; i++) {
      if (Math.abs(candidatesX[i] - line) <= threshold) {
        nx = i === 0 ? line : i === 1 ? line - w / 2 : line - w
        guideX = line
        break
      }
    }
    if (guideX != null) break
  }
  const candidatesY = [y, y + h / 2, y + h]
  for (const line of hLines) {
    for (let i = 0; i < candidatesY.length; i++) {
      if (Math.abs(candidatesY[i] - line) <= threshold) {
        ny = i === 0 ? line : i === 1 ? line - h / 2 : line - h
        guideY = line
        break
      }
    }
    if (guideY != null) break
  }
  return { x: nx, y: ny, guideX, guideY }
}

export const ELEMENT_LIBRARY: Array<{
  id: string
  label: string
  category:
    | 'text'
    | 'shapes'
    | 'lines'
    | 'borders'
    | 'ornaments'
    | 'guilloche'
    | 'watermarks'
    | 'geometric'
    | 'flourishes'
    | 'badges'
    | 'images'
  action:
    | { kind: 'text' }
    | { kind: 'heading' }
    | { kind: 'rect' }
    | { kind: 'ellipse' }
    | { kind: 'line' }
    | { kind: 'border' }
    | { kind: 'qr' }
    | { kind: 'image' }
    | { kind: 'background' }
    | { kind: 'logo' }
    | { kind: 'seal' }
    | { kind: 'signature' }
    | { kind: 'decor'; key: string }
}> = [
  { id: 'text', label: 'Text', category: 'text', action: { kind: 'text' } },
  { id: 'heading', label: 'Heading', category: 'text', action: { kind: 'heading' } },
  { id: 'line', label: 'Line', category: 'lines', action: { kind: 'line' } },
  { id: 'rect', label: 'Rectangle', category: 'shapes', action: { kind: 'rect' } },
  { id: 'circle', label: 'Circle', category: 'shapes', action: { kind: 'ellipse' } },
  { id: 'border', label: 'Border frame', category: 'borders', action: { kind: 'border' } },
  { id: 'qr', label: 'QR code', category: 'images', action: { kind: 'qr' } },
  { id: 'image', label: 'Image', category: 'images', action: { kind: 'image' } },
  { id: 'logo', label: 'Logo', category: 'images', action: { kind: 'logo' } },
  { id: 'seal', label: 'Seal / stamp', category: 'badges', action: { kind: 'seal' } },
  { id: 'signature', label: 'Signature', category: 'images', action: { kind: 'signature' } },
  { id: 'bg', label: 'Background image', category: 'images', action: { kind: 'background' } },
]
