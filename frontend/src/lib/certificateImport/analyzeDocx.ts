/**
 * Read a DOCX certificate as paragraphs, styles, tables, and drawing boxes.
 * The file is not rasterized into a template background.
 */
import { hexColor, mapFontFamily } from '@/lib/certificateImport/color'
import { applyContentMargins, pageFromPixels } from '@/lib/certificateImport/pageSize'
import {
  CertificateImportError,
  type ImportBrand,
  type ImportProgress,
  type RawCertificateScan,
  type ShapeBlock,
  type TextAlign,
  type TextBlock,
} from '@/lib/certificateImport/types'
import { sanitizeScanTexts } from '@/lib/certificateImport/untangle'
import { readZip, zipText } from '@/lib/certificateImport/zip'

const TWIP = 96 / 1440
const EMU = 96 / 914400

type RunStyle = {
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  color: string
  align: TextAlign
}

const DEFAULT_RUN: RunStyle = {
  fontSize: 16,
  fontFamily: 'Georgia, serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#0f172a',
  align: 'left',
}

function locals(root: Document | Element, name: string): Element[] {
  const out: Element[] = []
  const all = root.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    if (el.localName === name) out.push(el)
  }
  return out
}

function direct(el: Element, name: string): Element[] {
  return [...el.children].filter((child) => child.localName === name)
}

function attr(el: Element | null | undefined, names: string[]): string {
  if (!el) return ''
  for (const name of names) {
    const value = el.getAttribute(name) || el.getAttribute(`w:${name}`)
    if (value) return value
  }
  for (const { name, value } of [...el.attributes]) {
    const local = name.includes(':') ? name.split(':').pop() : name
    if (local && names.includes(local) && value) return value
  }
  return ''
}

function child(el: Element, name: string): Element | null {
  return direct(el, name)[0] || locals(el, name)[0] || null
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }
  return doc
}

function readStyles(xml: string | null): Map<string, RunStyle> {
  const map = new Map<string, RunStyle>()
  if (!xml) return map
  const doc = parseXml(xml)
  for (const style of locals(doc, 'style')) {
    const id = attr(style, ['styleId'])
    if (!id) continue
    const rPr = child(style, 'rPr')
    const pPr = child(style, 'pPr')
    map.set(id, readRun(rPr, pPr, DEFAULT_RUN))
  }
  return map
}

function readRun(rPr: Element | null, pPr: Element | null, base: RunStyle): RunStyle {
  const next = { ...base }
  const jc = pPr ? child(pPr, 'jc') : null
  const align = attr(jc, ['val'])
  if (align === 'center') next.align = 'center'
  else if (align === 'right' || align === 'end') next.align = 'right'
  else if (align === 'left' || align === 'start' || align === 'both') next.align = 'left'
  if (!rPr) return next
  if (child(rPr, 'b')) next.fontWeight = 'bold'
  if (child(rPr, 'i')) next.fontStyle = 'italic'
  const sz = attr(child(rPr, 'sz'), ['val'])
  if (sz && Number(sz) > 0) next.fontSize = Math.max(8, Math.min(72, Math.round((Number(sz) / 2) * (96 / 72))))
  const color = attr(child(rPr, 'color'), ['val'])
  if (color && color.toLowerCase() !== 'auto') next.color = hexColor(color, next.color)
  const fonts = child(rPr, 'rFonts')
  const family = attr(fonts, ['ascii', 'hAnsi'])
  if (family) next.fontFamily = mapFontFamily(family)
  return next
}

function paragraphText(p: Element, styles: Map<string, RunStyle>): { text: string; style: RunStyle; rule: boolean } | null {
  const pPr = child(p, 'pPr')
  const styleId = attr(pPr ? child(pPr, 'pStyle') : null, ['val'])
  const base = styles.get(styleId) || DEFAULT_RUN
  const style = readRun(pPr ? child(pPr, 'rPr') : null, pPr, base)
  const chunks: string[] = []
  const runs = [...direct(p, 'r'), ...locals(p, 'hyperlink').flatMap((link) => direct(link, 'r'))]
  let runStyle = style
  for (const run of runs) {
    const rPr = child(run, 'rPr')
    if (rPr) runStyle = readRun(rPr, pPr, style)
    for (const node of locals(run, 't')) chunks.push(node.textContent || '')
  }
  const text = chunks.join('').replace(/\s+/g, ' ').trim()
  const rule = Boolean(pPr && child(pPr, 'pBdr') && child(child(pPr, 'pBdr') as Element, 'bottom'))
  if (!text && !rule) return null
  return { text, style: runStyle, rule }
}

function pageSetup(doc: Document): { page: ReturnType<typeof pageFromPixels>; border: ShapeBlock | null } {
  const sect = locals(doc, 'sectPr')[0]
  const pgSz = sect ? child(sect, 'pgSz') : null
  const pgMar = sect ? child(sect, 'pgMar') : null
  const wTwip = Number(attr(pgSz, ['w'])) || 11906
  const hTwip = Number(attr(pgSz, ['h'])) || 16838
  const orient = attr(pgSz, ['orient'])
  let width = wTwip * TWIP
  let height = hTwip * TWIP
  if (orient === 'landscape' && width < height) [width, height] = [height, width]
  const page = pageFromPixels(width, height)
  const ml = Number(attr(pgMar, ['left']))
  const mr = Number(attr(pgMar, ['right']))
  const mt = Number(attr(pgMar, ['top']))
  const mb = Number(attr(pgMar, ['bottom']))
  if (ml) page.marginLeft = Math.round(ml * TWIP * (page.width / width))
  if (mr) page.marginRight = Math.round(mr * TWIP * (page.width / width))
  if (mt) page.marginTop = Math.round(mt * TWIP * (page.height / height))
  if (mb) page.marginBottom = Math.round(mb * TWIP * (page.height / height))

  const borders = sect ? child(sect, 'pgBorders') : null
  let border: ShapeBlock | null = null
  if (borders && ['top', 'left', 'bottom', 'right'].every((side) => child(borders, side))) {
    const color = hexColor(attr(child(borders, 'top'), ['color']), '#002147')
    const sz = Number(attr(child(borders, 'top'), ['sz'])) || 12
    const inset = Math.max(18, Math.round(Math.min(page.marginLeft, page.marginTop) * 0.45))
    border = {
      kind: 'border',
      x: inset,
      y: inset,
      width: page.width - inset * 2,
      height: page.height - inset * 2,
      fill: 'transparent',
      stroke: color,
      strokeWidth: Math.max(1, Math.round((sz / 8) * (96 / 72))),
    }
  }
  return { page, border }
}

function flowParagraphs(
  paragraphs: Array<{ text: string; style: RunStyle; rule: boolean }>,
  page: ReturnType<typeof pageFromPixels>,
  startY: number,
): { texts: TextBlock[]; shapes: ShapeBlock[]; endY: number; overflow: boolean } {
  const texts: TextBlock[] = []
  const shapes: ShapeBlock[] = []
  const contentW = Math.max(80, page.width - page.marginLeft - page.marginRight)
  let y = startY
  let overflow = false
  for (const para of paragraphs) {
    const height = Math.max(para.style.fontSize * 1.35, 18)
    if (y + height > page.height - page.marginBottom) {
      overflow = true
      break
    }
    if (para.text) {
      texts.push({
        text: para.text,
        x: page.marginLeft,
        y,
        width: contentW,
        height,
        fontSize: para.style.fontSize,
        fontFamily: para.style.fontFamily,
        fontWeight: para.style.fontWeight,
        fontStyle: para.style.fontStyle,
        align: para.style.align,
        color: para.style.color,
        letterSpacing: 0,
        lineHeight: 1.2,
      })
    }
    if (para.rule) {
      shapes.push({
        kind: 'line',
        x: page.marginLeft,
        y: y + height,
        width: contentW,
        height: 2,
        fill: para.style.color,
        stroke: para.style.color,
        strokeWidth: 2,
      })
    }
    y += height + 8
  }
  return { texts, shapes, endY: y, overflow }
}

function drawingBoxes(doc: Document, page: ReturnType<typeof pageFromPixels>): ShapeBlock[] {
  const shapes: ShapeBlock[] = []
  for (const extent of locals(doc, 'extent')) {
    const cx = Number(attr(extent, ['cx']))
    const cy = Number(attr(extent, ['cy']))
    if (!cx || !cy) continue
    const width = Math.max(12, cx * EMU)
    const height = Math.max(12, cy * EMU)
    const anchor = extent.parentElement?.parentElement
    const posH = anchor ? locals(anchor, 'posOffset') : []
    const x = posH[0] ? Number(posH[0].textContent || 0) * EMU : page.marginLeft
    const y = posH[1] ? Number(posH[1].textContent || 0) * EMU : page.marginTop
    const box = {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(width, page.width * 0.5),
      height: Math.min(height, page.height * 0.4),
    }
    const area = box.width * box.height
    const pageArea = page.width * page.height
    if (area > pageArea * 0.4) continue
    const aspect = box.height / Math.max(1, box.width)
    let kind: ShapeBlock['kind'] = 'decoration'
    if (box.y < page.height * 0.3 && aspect < 1.2) kind = 'logo'
    else if (aspect > 0.8 && aspect < 1.3 && box.width < page.width * 0.22) kind = 'seal'
    else if (aspect > 1.15 && aspect < 1.7) kind = 'photo'
    else if (box.y > page.height * 0.65 && aspect < 0.5) kind = 'signature'
    shapes.push({ kind, ...box, fill: 'transparent', stroke: 'transparent', strokeWidth: 0 })
  }
  return shapes
}

function collectColors(texts: TextBlock[]): string[] {
  return texts.map((t) => t.color.toLowerCase()).filter((c) => c && c !== '#auto')
}

export async function analyzeCertificateDocx(
  file: File,
  brand: ImportBrand,
  onProgress: ImportProgress,
): Promise<RawCertificateScan> {
  onProgress('reading')
  let entries: Map<string, Uint8Array>
  try {
    entries = await readZip(await file.arrayBuffer())
  } catch {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }
  const documentXml = zipText(entries, 'word/document.xml')
  if (!documentXml) {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }
  const doc = parseXml(documentXml)
  const styles = readStyles(zipText(entries, 'word/styles.xml'))

  onProgress('layout')
  const setup = pageSetup(doc)
  const paragraphs = locals(doc, 'p')
    .map((p) => paragraphText(p, styles))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  // Join "Diploma in" + next line into one program title when Word splits them
  const joined: Array<{ text: string; style: RunStyle; rule: boolean }> = []
  for (let i = 0; i < paragraphs.length; i++) {
    const cur = paragraphs[i]
    const next = paragraphs[i + 1]
    if (
      next &&
      /^(diploma|certificate|degree)\s+in$/i.test(cur.text.trim()) &&
      next.text.trim().length > 3 &&
      !/certify|having|awarded|registrar|principal/i.test(next.text)
    ) {
      joined.push({
        text: `${cur.text.trim()} ${next.text.trim()}`,
        style: {
          ...next.style,
          fontSize: Math.max(cur.style.fontSize, next.style.fontSize),
          fontStyle: 'italic',
          fontWeight: 'bold',
          align: 'center',
        },
        rule: cur.rule || next.rule,
      })
      i += 1
      continue
    }
    joined.push(cur)
  }
  const headerParas: Array<{ text: string; style: RunStyle; rule: boolean }> = []
  const footerParas: Array<{ text: string; style: RunStyle; rule: boolean }> = []
  for (const [name, bytes] of entries) {
    if (!/^word\/header\d*\.xml$/i.test(name) && !/^word\/footer\d*\.xml$/i.test(name)) continue
    const extra = parseXml(new TextDecoder('utf-8').decode(bytes))
    const paras = locals(extra, 'p')
      .map((p) => paragraphText(p, styles))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
    if (/header/i.test(name)) headerParas.push(...paras)
    else footerParas.push(...paras)
  }

  onProgress('typography')
  const headerFlow = flowParagraphs(headerParas, setup.page, setup.page.marginTop)
  const bodyFlow = flowParagraphs(joined, setup.page, Math.max(setup.page.marginTop, headerFlow.endY))
  const footerHeight = footerParas.length * 22
  const footerFlow = flowParagraphs(
    footerParas,
    setup.page,
    Math.max(bodyFlow.endY + 12, setup.page.height - setup.page.marginBottom - footerHeight),
  )
  const texts = sanitizeScanTexts([
    ...headerFlow.texts,
    ...bodyFlow.texts,
    ...footerFlow.texts,
  ]).slice(0, 80) as TextBlock[]
  if (texts.length < 2) {
    throw new CertificateImportError(
      'UNREADABLE',
      "We couldn't analyze this certificate. Please try another PDF or DOCX file.",
    )
  }

  onProgress('colors')
  const used = collectColors(texts)
  const counts = new Map<string, number>()
  for (const color of used) counts.set(color, (counts.get(color) || 0) + 1)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([color]) => color)
  const text = ranked[0] || '#0f172a'
  const accent = ranked.find((c) => c !== text && c !== '#000000' && c !== '#ffffff') || ''
  const fromDocument = Boolean(accent || (text && text !== '#0f172a'))
  const warnings: string[] = []
  const colors = {
    background: '#ffffff',
    text: text || '#0f172a',
    accent: accent || brand.accent || brand.primary || '#002147',
    secondary: ranked[2] || '#e2e8f0',
    border: accent || brand.primary || '#002147',
    fromDocument,
  }
  if (!fromDocument) {
    warnings.push('Document colors were not specified. Institution colors were used for accents and borders.')
  }

  onProgress('decorations')
  const shapes = [
    ...(setup.border ? [setup.border] : []),
    ...headerFlow.shapes,
    ...bodyFlow.shapes,
    ...footerFlow.shapes,
    ...drawingBoxes(doc, setup.page),
  ]
  if (!shapes.length) warnings.push('Borders and decorations could not be fully reconstructed.')
  if (bodyFlow.overflow || footerFlow.overflow) {
    warnings.push('Some document content extended past the page and was not placed.')
  }

  return {
    sourceKind: 'docx',
    page: applyContentMargins(setup.page, texts),
    colors,
    texts,
    shapes: shapes.slice(0, 48),
    warnings,
    scanned: false,
    pageCount: 1,
  }
}
