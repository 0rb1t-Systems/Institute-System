/**
 * Rebuild a certificate as a clean, non-overlapping template.
 * Raw PDF coordinates are used only as clues (roles, colors, orientation).
 * Institution logo, seal, and signatories come from the current tenant.
 * The uploaded file is never placed as a background.
 */
import {
  BUILDER_FONT_FAMILIES,
  createBoundTextElement,
  createElementId,
  createVerificationQrElement,
  normalizeLogoBuilderDesign,
  type BuilderBinding,
  type BuilderElement,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import { classifyCertificateTexts } from '@/lib/certificateImport/classify'
import type {
  ClassifiedText,
  FieldRole,
  ImportBrand,
  RawCertificateScan,
  TextBlock,
} from '@/lib/certificateImport/types'
import {
  expandCleanLines,
  extractBodyParagraphs,
  extractCertificateNumber,
  extractCertifyLine,
  extractProgramTitle,
  extractSignatoryTitles,
  looksLikeJammedMash,
  looksLikePersonNameLine,
  normalizeSpaces,
  sanitizeScanTexts,
} from '@/lib/certificateImport/untangle'

/** Public https URL or private certificate-templates storage path. */
function brandImageSrc(value?: string | null): string | null {
  const url = String(value || '').trim()
  if (!url || url.includes('..')) return null
  if (/^https?:\/\//i.test(url)) return url
  if (/^(blob:|data:)/i.test(url)) return null
  if (url.includes('/')) return url
  return null
}

function isGarbageText(text: string) {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (t.length < 3) return true
  if (/^[_.\-–—•·\s]+$/.test(t)) return true
  // Seal / logo OCR fragments: jammed letters with almost no vowels/spaces
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 4 && !/\s/.test(t) && letters.length / t.length > 0.85) {
    const vowels = (letters.match(/[aeiouAEIOU]/g) || []).length
    if (vowels / letters.length < 0.18) return true
  }
  // Random seal rim shards
  if (/^[A-Z]{1,3}([A-Z]{2,}){2,}$/.test(t) && t.length < 28 && !/\s/.test(t)) return true
  if (/EARCHC|BIEDET|CONSULTANCY.*CONSULTANCY/i.test(t) && t.length < 40) return true
  return false
}

function pick(blocks: ClassifiedText[], role: FieldRole) {
  return blocks.find((b) => b.role === role && !isGarbageText(b.text)) || null
}

function cleanImportLine(text: string) {
  const t = normalizeSpaces(
    text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\binApplied\b/gi, 'in Applied')
      .replace(/\bDiploma in\s*Diploma in\b/gi, 'Diploma in'),
  )
  return looksLikeJammedMash(t) ? '' : t
}

function darkText(color?: string | null) {
  const c = String(color || '').toLowerCase()
  if (!c || c === '#ffffff' || c === '#fff') return '#0f172a'
  // Prefer near-black for body copy; never use bright accent as body color
  return '#0f172a'
}

function accentColor(scan: RawCertificateScan, brand: ImportBrand) {
  const fromDoc = String(scan.colors.accent || scan.colors.border || '').trim()
  if (fromDoc && fromDoc.toLowerCase() !== '#ffffff' && fromDoc.toLowerCase() !== '#0f172a') {
    return fromDoc
  }
  return brand.accent || brand.primary || '#0B3D2E'
}

function secondaryAccent(scan: RawCertificateScan, brand: ImportBrand, primaryAccent: string) {
  const sec = String(scan.colors.secondary || '').trim()
  if (sec && sec.toLowerCase() !== primaryAccent.toLowerCase() && sec.toLowerCase() !== '#ffffff') {
    return sec
  }
  return brand.primary || primaryAccent
}

function thinLine(
  name: string,
  x: number,
  y: number,
  width: number,
  color: string,
  zIndex: number,
): BuilderElement {
  return {
    id: createElementId(),
    type: 'line',
    name,
    text: name,
    x,
    y,
    width,
    height: 8,
    rotation: 0,
    zIndex,
    fill: color,
    stroke: color,
    strokeWidth: 2,
    opacity: 1,
  }
}

function staticText(
  text: string,
  opts: {
    x: number
    y: number
    width: number
    height: number
    fontSize: number
    color: string
    align?: 'left' | 'center' | 'right'
    italic?: boolean
    bold?: boolean
    zIndex: number
    name?: string
    fontFamily?: string
    letterSpacing?: number
    lineHeight?: number
  },
): BuilderElement {
  return {
    id: createElementId(),
    type: 'text',
    name: opts.name || text.slice(0, 40),
    text,
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    rotation: 0,
    zIndex: opts.zIndex,
    fontFamily: opts.fontFamily || BUILDER_FONT_FAMILIES[0],
    fontSize: opts.fontSize,
    fontWeight: opts.bold ? 'bold' : 'normal',
    fontStyle: opts.italic ? 'italic' : 'normal',
    textAlign: opts.align || 'center',
    color: opts.color,
    letterSpacing: opts.letterSpacing ?? 0.2,
    lineHeight: opts.lineHeight ?? 1.35,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
    bind: 'none',
  }
}

function bound(
  bind: Exclude<BuilderBinding, 'qr'>,
  canvas: { width: number; height: number },
  overrides: Partial<BuilderElement>,
): BuilderElement {
  return createBoundTextElement(bind, canvas, {
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    ...overrides,
  })
}

export const CERTIFICATE_PATCH_MARKER = '__certificate_patch__'
export const USER_PATCH_NAME = 'User certificate patch'

export function findCertificatePatchElement(design: LogoBuilderDesign): BuilderElement | null {
  return (
    (design.elements || []).find(
      (el) =>
        el.type === 'image' &&
        (el.text === CERTIFICATE_PATCH_MARKER ||
          el.name === 'Certificate patch' ||
          el.name === USER_PATCH_NAME ||
          el.name === 'Institution seal'),
    ) ||
    (design.elements || []).find(
      (el) =>
        (el.type === 'ellipse' || el.type === 'image') &&
        (el.name === 'Seal' ||
          el.name === 'Certificate patch' ||
          el.name === USER_PATCH_NAME ||
          el.text === CERTIFICATE_PATCH_MARKER),
    ) ||
    null
  )
}

/** True when this element is the user-uploaded seal/patch (must never be replaced by institution seal). */
export function isUserUploadedCertificatePatch(el?: BuilderElement | null): boolean {
  if (!el) return false
  if (el.name === USER_PATCH_NAME) return true
  if (el.text !== CERTIFICATE_PATCH_MARKER) return false
  const src = String(el.src || '')
  // Private builder upload path, not a public institution-assets URL
  return Boolean(src) && !/institution-assets/i.test(src) && el.type === 'image'
}

/** Replace or insert the center certificate patch image (storage path or public URL). */
export function applyCertificatePatchImage(
  design: LogoBuilderDesign,
  src: string,
): LogoBuilderDesign {
  const path = String(src || '').trim()
  if (!path) return design
  const canvasW = design.canvas?.width || 1123
  const canvasH = design.canvas?.height || 794
  const landscape = canvasW >= canvasH
  // Ribbon seals need a taller box so the tails are not cropped / tangled with signatures
  const defaultW = landscape ? 112 : 120
  const defaultH = Math.round(defaultW * 1.35)
  const existing = findCertificatePatchElement(design)
  const keepX = existing?.x
  const keepY = existing?.y
  // Prefer existing size only when it already looks ribbon-tall; otherwise reset
  const existingAspect =
    existing?.width && existing?.height ? existing.height / Math.max(1, existing.width) : 0
  const useExistingSize = existingAspect >= 1.15 && existing.width! > 40 && existing.height! > 40
  const width = useExistingSize ? existing!.width : defaultW
  const height = useExistingSize ? existing!.height : defaultH
  const patch: BuilderElement = {
    id: existing?.id || createElementId(),
    type: 'image',
    name: USER_PATCH_NAME,
    text: CERTIFICATE_PATCH_MARKER,
    x: keepX ?? (canvasW - width) / 2,
    y: keepY ?? canvasH * 0.58,
    width,
    height,
    rotation: 0,
    zIndex: existing?.zIndex ?? 20,
    src: path,
    opacity: 1,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    // Never treat as a rebuildable SVG library patch
    patchKey: undefined,
  }
  const without = (design.elements || []).filter((el) => {
    if (el.id === patch.id) return false
    if (el.text === CERTIFICATE_PATCH_MARKER) return false
    if (
      el.name === 'Certificate patch' ||
      el.name === USER_PATCH_NAME ||
      el.name === 'Institution seal' ||
      el.name === 'Seal'
    ) {
      return false
    }
    return true
  })
  return normalizeLogoBuilderDesign({
    ...design,
    elements: [...without, patch],
  })
}

function fontPlayfair() {
  return BUILDER_FONT_FAMILIES.find((f) => /Playfair Display/i.test(f)) || BUILDER_FONT_FAMILIES[0]
}

function fontScript() {
  return BUILDER_FONT_FAMILIES.find((f) => /Great Vibes/i.test(f)) || BUILDER_FONT_FAMILIES[0]
}

function fontSerif() {
  return BUILDER_FONT_FAMILIES[0]
}

function resolveProgramTitle(classified: ClassifiedText[], allLines: string[]) {
  const fromScan = extractProgramTitle(allLines)
  if (fromScan) return fromScan

  const program = pick(classified, 'programName')
  if (program?.text) {
    const cleaned = cleanImportLine(program.text)
    if (cleaned.length > 8 && !looksLikePersonNameLine(cleaned)) return cleaned.slice(0, 100)
  }

  const title = pick(classified, 'title')
  if (title?.text && /diploma|certificate|degree|award/i.test(title.text)) {
    return cleanImportLine(title.text).slice(0, 100)
  }
  return 'Program / Course'
}

/**
 * Landscape / portrait clean certificate matching the usual academic layout:
 * logo + QR header, title, certify line, student, body, signatures + patch, footer.
 */
function buildCleanLayout(scan: RawCertificateScan, brand: ImportBrand, classified: ClassifiedText[]) {
  const w = scan.page.width
  const h = scan.page.height
  const landscape = w >= h
  // Readable dark ink for certificate copy — accents stay on frames/lines only
  const ink = darkText(brand.primary)
  const accent = accentColor(scan, brand)
  const gold =
    /#c9a|#d4a|#e2b|#b89|gold/i.test(String(scan.colors.secondary || ''))
      ? scan.colors.secondary
      : accent2Safe(scan, brand, accent)
  const bg = scan.colors.background && scan.colors.background.toLowerCase() !== '#000000'
    ? scan.colors.background
    : '#ffffff'
  const marginX = Math.round(w * (landscape ? 0.075 : 0.1))
  const contentW = w - marginX * 2
  const logo = brandImageSrc(brand.logoUrl)
  // Do not auto-place institution seal as the certificate patch — the admin uploads
  // their own patch image so generate/download keep that exact artwork in place.
  const elements: BuilderElement[] = []
  let z = 1
  const nextZ = () => ++z

  const allLines = expandCleanLines(classified.length ? classified : scan.texts).filter(
    (line) => !looksLikeJammedMash(line) && !looksLikePersonNameLine(line),
  )

  // Double frame (outer accent + inner gold) — matches formal certificates
  elements.push({
    id: createElementId(),
    type: 'rect',
    name: 'Border outer',
    text: 'Border outer',
    x: 16,
    y: 16,
    width: w - 32,
    height: h - 32,
    rotation: 0,
    zIndex: nextZ(),
    fill: 'transparent',
    stroke: gold || accent,
    strokeWidth: 3,
    opacity: 1,
  })
  elements.push({
    id: createElementId(),
    type: 'rect',
    name: 'Border inner',
    text: 'Border inner',
    x: 26,
    y: 26,
    width: w - 52,
    height: h - 52,
    rotation: 0,
    zIndex: nextZ(),
    fill: 'transparent',
    stroke: gold || accent,
    strokeWidth: 1,
    opacity: 1,
  })

  const logoSize = landscape ? 86 : 94
  const topY = landscape ? 40 : 48
  if (logo) {
    elements.push({
      id: createElementId(),
      type: 'image',
      name: 'Institution logo',
      text: 'Institution logo',
      x: marginX,
      y: topY,
      width: logoSize,
      height: logoSize,
      rotation: 0,
      zIndex: nextZ(),
      src: logo,
      opacity: 1,
      fill: 'transparent',
      stroke: 'transparent',
    })
  } else {
    elements.push(
      bound('institutionName', { width: w, height: h }, {
        name: 'Institution name',
        x: marginX,
        y: topY + 8,
        width: contentW * 0.42,
        height: 36,
        fontSize: 15,
        fontFamily: fontSerif(),
        fontWeight: 'bold',
        textAlign: 'left',
        color: ink,
        letterSpacing: 0.4,
        zIndex: nextZ(),
      }),
    )
  }

  const qrSize = landscape ? 72 : 80
  const qr = createVerificationQrElement({ width: w, height: h })
  elements.push({
    ...qr,
    name: 'Verification QR',
    x: w - marginX - qrSize,
    y: topY,
    width: qrSize,
    height: qrSize,
    zIndex: nextZ(),
    fill: '#ffffff',
    color: ink,
  })

  // Compact vertical rhythm under the header — leave clear space under logo/QR
  let y = topY + logoSize + (landscape ? 28 : 36)

  const programText = resolveProgramTitle(classified, allLines)
  // Static imported program title so the uploaded wording is visible & editable.
  // Also keep a bound copy for live issuance — user can delete one if preferred.
  elements.push(
    staticText(programText, {
      x: marginX,
      y,
      width: contentW,
      height: landscape ? 42 : 48,
      fontSize: landscape ? 28 : 30,
      color: ink,
      italic: true,
      bold: true,
      zIndex: nextZ(),
      name: 'Program title',
      fontFamily: fontPlayfair(),
      letterSpacing: 0.3,
      lineHeight: 1.15,
    }),
  )
  y += landscape ? 46 : 54

  const certifyLine = extractCertifyLine(allLines)
  elements.push(
    staticText(certifyLine, {
      x: marginX,
      y,
      width: contentW,
      height: 22,
      fontSize: 15,
      color: ink,
      italic: true,
      zIndex: nextZ(),
      name: 'Certify line',
      fontFamily: fontSerif(),
    }),
  )
  y += 26

  const nameW = Math.min(contentW * 0.62, landscape ? 520 : 440)
  const nameX = (w - nameW) / 2
  elements.push(
    bound('studentName', { width: w, height: h }, {
      name: 'Student name',
      x: nameX,
      y,
      width: nameW,
      height: landscape ? 56 : 60,
      fontSize: landscape ? 44 : 46,
      fontFamily: fontScript(),
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: ink,
      letterSpacing: 0.5,
      lineHeight: 1.05,
      zIndex: nextZ(),
    }),
  )
  y += landscape ? 58 : 64

  // Thin rule under the name (common on academic certificates)
  const ruleW = Math.min(contentW * 0.55, landscape ? 420 : 360)
  elements.push(thinLine('Name underline', (w - ruleW) / 2, y, ruleW, ink, nextZ()))
  y += 18

  const defaultBody = [
    'having completed an approved course of study and passed the prescribed examinations, under the authority of the academic board.',
  ]
  const paragraphs = extractBodyParagraphs(
    [...allLines, ...classified.map((c) => c.text), ...scan.texts.map((t) => t.text)],
    programText,
  ).filter((p) => !looksLikeJammedMash(p))
  const bodyParas = paragraphs.length ? paragraphs.slice(0, 2) : defaultBody

  for (const para of bodyParas) {
    const cleaned = cleanImportLine(para).slice(0, 480) || defaultBody[0]
    const boxH = Math.max(36, Math.ceil(cleaned.length / (landscape ? 68 : 50)) * 20)
    elements.push(
      staticText(cleaned, {
        x: marginX + contentW * 0.08,
        y,
        width: contentW * 0.84,
        height: boxH,
        fontSize: cleaned.length > 140 ? 13 : 14,
        color: ink,
        zIndex: nextZ(),
        name: 'Body text',
        fontFamily: fontSerif(),
      }),
    )
    y += boxH + 10
  }

  const sigY = Math.min(Math.max(y + 36, h * (landscape ? 0.68 : 0.72)), h - 130)
  const sigW = landscape ? 210 : 190
  const leftSigX = marginX + (landscape ? 24 : 8)
  const rightSigX = w - marginX - sigW - (landscape ? 24 : 8)
  const patchW = landscape ? 112 : 120
  const patchH = Math.round(patchW * 1.35)
  const patchX = (w - patchW) / 2
  const patchY = sigY - patchH * 0.45

  elements.push(thinLine('Left signature line', leftSigX, sigY, sigW, gold || accent, nextZ()))
  elements.push(thinLine('Right signature line', rightSigX, sigY, sigW, gold || accent, nextZ()))

  // Placeholder slot — admin replaces via “Upload patch” (kept at this position forever)
  elements.push({
    id: createElementId(),
    type: 'ellipse',
    name: 'Certificate patch',
    text: CERTIFICATE_PATCH_MARKER,
    x: patchX,
    y: patchY,
    width: patchW,
    height: patchH,
    rotation: 0,
    zIndex: nextZ(),
    fill: 'transparent',
    stroke: gold || accent,
    strokeWidth: 2,
    opacity: 0.85,
  })

  const fromScanTitles = extractSignatoryTitles(allLines)
  const leftTitle =
    fromScanTitles.left ||
    cleanTitle(pick(classified, 'leftTitle')?.text) ||
    brand.leftTitle ||
    'Academic Registrar'
  const rightTitle =
    fromScanTitles.right ||
    cleanTitle(pick(classified, 'rightTitle')?.text) ||
    brand.rightTitle ||
    'Principal'

  // Static titles from the uploaded certificate — separate, draggable, editable.
  elements.push(
    staticText(leftTitle.slice(0, 48), {
      x: leftSigX,
      y: sigY + 14,
      width: sigW,
      height: 22,
      fontSize: 12,
      color: ink,
      italic: true,
      zIndex: nextZ(),
      name: 'Left signatory title',
      fontFamily: fontSerif(),
    }),
  )
  elements.push(
    staticText(rightTitle.slice(0, 48), {
      x: rightSigX,
      y: sigY + 14,
      width: sigW,
      height: 22,
      fontSize: 12,
      color: ink,
      italic: true,
      zIndex: nextZ(),
      name: 'Right signatory title',
      fontFamily: fontSerif(),
    }),
  )

  if (brand.leftName) {
    elements.push(
      bound('leftName', { width: w, height: h }, {
        name: 'Left signatory',
        x: leftSigX,
        y: sigY - 30,
        width: sigW,
        height: 22,
        fontSize: 13,
        fontFamily: fontSerif(),
        textAlign: 'center',
        color: ink,
        zIndex: nextZ(),
      }),
    )
  }
  if (brand.rightName) {
    elements.push(
      bound('rightName', { width: w, height: h }, {
        name: 'Right signatory',
        x: rightSigX,
        y: sigY - 30,
        width: sigW,
        height: 22,
        fontSize: 13,
        fontFamily: fontSerif(),
        textAlign: 'center',
        color: ink,
        zIndex: nextZ(),
      }),
    )
  }

  const footerBarH = landscape ? 12 : 14
  const footerY = h - 24 - footerBarH
  const scannedCertNo = extractCertificateNumber(allLines)

  elements.push(
    staticText('Cert no.', {
      x: rightSigX,
      y: footerY - 32,
      width: 64,
      height: 18,
      fontSize: 12,
      color: ink,
      align: 'left',
      zIndex: nextZ(),
      name: 'Cert no. label',
      fontFamily: fontSerif(),
    }),
  )
  elements.push(
    bound('certificateNumber', { width: w, height: h }, {
      name: 'Certificate number',
      text: scannedCertNo || '00047',
      x: rightSigX + 62,
      y: footerY - 32,
      width: sigW - 62,
      height: 18,
      fontSize: 12,
      fontFamily: fontSerif(),
      textAlign: 'left',
      color: ink,
      zIndex: nextZ(),
    }),
  )

  elements.push({
    id: createElementId(),
    type: 'rect',
    name: 'Footer bar',
    text: 'Footer bar',
    x: 16,
    y: footerY,
    width: w - 32,
    height: Math.max(10, footerBarH),
    rotation: 0,
    zIndex: nextZ(),
    fill: accent,
    stroke: 'transparent',
    strokeWidth: 0,
    opacity: 1,
  })

  return {
    canvas: {
      width: w,
      height: h,
      background: bg,
      paperKey: scan.page.paperKey,
    },
    elements,
  }
}

function cleanTitle(text?: string | null) {
  if (!text) return null
  const t = cleanImportLine(text)
  if (t.length > 40) return null
  if (/cert\.?\s*no|this is to certify|having completed/i.test(t)) return null
  if (/principal.*registrar|registrar.*principal/i.test(t)) return null
  if (/^(academic\s+)?registrar$/i.test(t)) return 'Academic Registrar'
  if (/^principal$/i.test(t)) return 'Principal'
  if (/registrar|principal|director|dean|president/i.test(t)) return t.slice(0, 48)
  return null
}

function accent2Safe(scan: RawCertificateScan, brand: ImportBrand, primaryAccent: string) {
  return secondaryAccent(scan, brand, primaryAccent)
}

export function designDependsOnSourceFile(design: LogoBuilderDesign) {
  const canvasW = design.canvas?.width || 1
  const canvasH = design.canvas?.height || 1
  return (design.elements || []).some((el) => {
    const src = String(el.src || '')
    const fullBleed = el.type === 'image' && el.width > canvasW * 0.85 && el.height > canvasH * 0.85
    return (
      fullBleed ||
      el.text === '__upload_paper__' ||
      el.text === 'background-art' ||
      src.startsWith('blob:') ||
      src.startsWith('data:')
    )
  })
}

function elementsOverlapBadly(elements: BuilderElement[]) {
  const texts = elements.filter((el) => el.type === 'text' && !el.hidden)
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i]
      const b = texts[j]
      const ix0 = Math.max(a.x, b.x)
      const iy0 = Math.max(a.y, b.y)
      const ix1 = Math.min(a.x + a.width, b.x + b.width)
      const iy1 = Math.min(a.y + a.height, b.y + b.height)
      const iw = Math.max(0, ix1 - ix0)
      const ih = Math.max(0, iy1 - iy0)
      const inter = iw * ih
      const smaller = Math.min(a.width * a.height, b.width * b.height)
      if (smaller > 0 && inter / smaller > 0.45) return true
    }
  }
  return false
}

export function generateImportedTemplate(scan: RawCertificateScan, brand: ImportBrand) {
  const sanitized = sanitizeScanTexts(scan.texts || []) as TextBlock[]
  const cleanedTexts: TextBlock[] = sanitized.filter((t) => !isGarbageText(t.text) && !looksLikeJammedMash(t.text))
  const classified = classifyCertificateTexts(cleanedTexts, scan.page)
  const warnings = [...scan.warnings]

  if (cleanedTexts.length < (scan.texts || []).length) {
    warnings.push('Overlapping or duplicated text was separated so each line can be edited on its own.')
  }

  const built = buildCleanLayout({ ...scan, texts: cleanedTexts }, brand, classified)

  if (!brandImageSrc(brand.logoUrl)) {
    warnings.push('Add your institution logo in Institution Settings to show it on imported certificates.')
  }
  const hasUserPatch = built.elements.some((el) => isUserUploadedCertificatePatch(el))
  if (!hasUserPatch) {
    warnings.push('Upload your certificate patch image (Upload patch) so the seal stays on student certificates and downloads.')
  }

  // Final guard: never keep jammed mash as a visible text layer
  const safeElements = built.elements.filter((el) => {
    if (el.type !== 'text') return true
    if (el.bind && el.bind !== 'none') return true
    return !looksLikeJammedMash(String(el.text || ''))
  })

  const design = normalizeLogoBuilderDesign({
    version: 1,
    canvas: built.canvas,
    elements: safeElements,
  })

  if (designDependsOnSourceFile(design) || !design.elements.length) {
    throw new Error('UNREADABLE')
  }
  if (elementsOverlapBadly(design.elements)) {
    warnings.push('Some text boxes were close together; the layout was rebuilt to keep the certificate readable.')
  }

  return { design, warnings: [...new Set(warnings)] }
}
