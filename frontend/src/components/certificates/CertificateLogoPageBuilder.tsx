import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Award,
  Bold,
  BringToFront,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePlus,
  Frame,
  Grid3x3,
  ImagePlus,
  Italic,
  LayoutTemplate,
  Layers,
  Loader2,
  Lock,
  Magnet,
  QrCode,
  RectangleHorizontal,
  RectangleVertical,
  Redo2,
  Ruler,
  Save,
  Sparkles,
  SendToBack,
  Square,
  Circle,
  Trash2,
  Type,
  Underline,
  Undo2,
  Unlock,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  getDocumentTemplate,
  saveDocumentLogoBuilder,
  uploadCertificateBuilderImage,
  getCertificateTemplateSignedUrl,
  type DocumentTemplateType,
} from '@/lib/api'
import {
  BUILDER_BINDINGS,
  BUILDER_FONT_FAMILIES,
  builderFontLabel,
  DECORATIVE_SHAPES,
  DECORATIVE_SHAPE_CATEGORIES,
  PAPER_SIZES,
  applyCustomPaperSize,
  applyPaperSize,
  getDesignPdfPageMm,
  createBoundTextElement,
  createBorderFrameElements,
  createDecorativeShapeElement,
  createDefaultBuilderDesign,
  createElementId,
  createStarterDocumentDesign,
  createVerificationQrElement,
  hasVerificationQr,
  isDecorativeElement,
  isFullPageDecorElement,
  isPrivateCertStoragePath,
  isQrElement,
  isUploadPaperElement,
  isBackgroundArtElement,
  getBuilderLayerLabel,
  getGroupLabel,
  getDocumentBuilderQuickFields,
  normalizeLogoBuilderDesign,
  normalizeVerificationQr,
  extractCertStoragePath,
  recolorDecorativeElement,
  resolveBuilderText,
  type BuilderBinding,
  type BuilderElement,
  type BuilderElementType,
  type DecorativeShapeKey,
  type LogoBuilderDesign,
  type PaperSizeKey,
} from '@/lib/certificateBuilder'
import {
  CERTIFICATE_PATCHES,
  createCertificatePatchElement,
  isCertificatePatchElement,
  rebuildCertificatePatch,
  type CertificatePatchKey,
} from '@/lib/certificatePatches'
import CertificateCanvas from '@/components/certificates/CertificateCanvas'
import { downloadCertificatePDF } from '@/lib/certificateGenerator'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import {
  getCertificateFooterText,
  getTranscriptFooterText,
  getInvoiceFooterText,
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
} from '@/lib/institution'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import {
  alignSelection,
  distributeSelection,
  snapCoord,
  snapToGuides,
  stepZIndex,
  type AlignMode,
} from '@/lib/certificateBuilderEditor'

const MAX_HISTORY = 40
const RULER_SIZE = 22

function cloneDesign(d: LogoBuilderDesign): LogoBuilderDesign {
  return JSON.parse(JSON.stringify(d)) as LogoBuilderDesign
}

/** Full-page / hollow frames: click the visible edge, not the empty center. */
function isPageFrameElement(
  el: BuilderElement,
  canvas: { width: number; height: number },
): boolean {
  if (isFullPageDecorElement(el)) return true
  if (el.text === 'border-outer' || el.text === 'border-inner') return true
  if (el.type !== 'rect') return false
  const hollow = !el.fill || el.fill === 'transparent' || el.fill === 'none'
  return hollow && el.width >= canvas.width * 0.62 && el.height >= canvas.height * 0.62
}

function ToolBtn({
  title,
  onClick,
  active,
  disabled,
  children,
}: {
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
        active
          ? 'bg-violet-600 text-white'
          : 'text-[var(--builder-text,#cbd5e1)] hover:bg-slate-800 hover:text-[var(--builder-text,#fff)]'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Document Page Builder — design certificate / transcript / invoice layouts.
 * Stored on document_templates.config.logo_builder for the given documentType.
 * variant "upload-edit": editing an uploaded paper (Text / Shapes / Images tabs).
 */
const CertificateLogoPageBuilder = ({
  documentType = 'certificate',
  variant = 'page-builder',
  remountKey,
}: {
  documentType?: DocumentTemplateType
  variant?: 'page-builder' | 'upload-edit'
  /** Change to force reload after a new upload seeds the design. */
  remountKey?: string | number
} = {}) => {
  const docType = (documentType || 'certificate') as DocumentTemplateType
  const docLabel =
    docType === 'transcript' ? 'Transcript' : docType === 'invoice' ? 'Invoice' : 'Certificate'
  const isUploadEdit = variant === 'upload-edit'
  const { institution } = useAuth()
  const { toast } = useToast()
  const [design, setDesign] = useState<LogoBuilderDesign>(() => createDefaultBuilderDesign())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** When set, grouped elements move together until user enters the group. */
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [enteredGroupId, setEnteredGroupId] = useState<string | null>(null)
  const enteredGroupIdRef = useRef<string | null>(null)
  useEffect(() => {
    enteredGroupIdRef.current = enteredGroupId
  }, [enteredGroupId])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [elementSearch, setElementSearch] = useState('')
  const [libraryCategory, setLibraryCategory] = useState<string>('all')
  const [showGrid, setShowGrid] = useState(true)
  const [showRulers, setShowRulers] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [zoomMode, setZoomMode] = useState<'width' | 'page' | 'manual'>('page')
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [starterOpen, setStarterOpen] = useState(false)
  const [toolbarMenu, setToolbarMenu] = useState<'none' | 'fields' | 'decor' | 'layers' | 'patches' | 'fonts'>('none')
  const [chromeTab, setChromeTab] = useState<'insert' | 'design' | 'format'>('insert')
  const [draftTick, setDraftTick] = useState(0)
  const [activeLayout, setActiveLayout] = useState<string>('classic')
  /** True when institution already has a Page Builder design saved (draft or active). */
  const [hasSavedDesign, setHasSavedDesign] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const historyRef = useRef<LogoBuilderDesign[]>([])
  const futureRef = useRef<LogoBuilderDesign[]>([])
  const dragRef = useRef<{
    id: string
    groupId?: string | null
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
    origRot?: number
    startAngle?: number
    /** Snapshot of group member origins when moving a group */
    groupOrigins?: Array<{ id: string; x: number; y: number; width: number; height: number }>
    selectedOrigins?: Array<{ id: string; x: number; y: number }>
    mode: 'move' | 'resize' | 'rotate'
    handle?: 'se' | 'sw' | 'ne' | 'nw'
  } | null>(null)
  const dragStartDesignRef = useRef<LogoBuilderDesign | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const bgFileRef = useRef<HTMLInputElement | null>(null)
  /** Signed URLs for private storage paths — never persisted into the design. */
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({})

  const selected = useMemo(
    () => design.elements.find((e) => e.id === selectedId) || null,
    [design.elements, selectedId],
  )
  const selectedIsQr = isQrElement(selected)
  const selectedIsPaper = isUploadPaperElement(selected)

  useEffect(() => {
    if (selectedId && !selectedIds.includes(selectedId)) {
      setSelectedIds([selectedId])
    }
    if (!selectedId) setSelectedIds([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const computeFitZoom = useCallback(
    (mode: 'width' | 'page') => {
      const box = workspaceRef.current
      if (!box) return 1
      const pad = 28
      const ruler = showRulers ? RULER_SIZE : 0
      const availW = Math.max(200, box.clientWidth - pad - ruler)
      const availH = Math.max(200, box.clientHeight - pad - ruler)
      const zW = availW / Math.max(1, design.canvas.width)
      const zH = availH / Math.max(1, design.canvas.height)
      const z = mode === 'width' ? zW : Math.min(zW, zH)
      return Math.round(Math.max(0.15, Math.min(2.8, z)) * 100) / 100
    },
    [design.canvas.width, design.canvas.height, showRulers],
  )

  const zoomIn = useCallback(() => {
    setZoomMode('manual')
    setZoom((z) => Math.min(2.8, Math.round((z + 0.1) * 100) / 100))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomMode('manual')
    setZoom((z) => Math.max(0.15, Math.round((z - 0.1) * 100) / 100))
  }, [])

  const fitWholePage = useCallback(() => {
    setZoomMode('page')
  }, [])

  useEffect(() => {
    if (zoomMode === 'manual') return
    const apply = () => setZoom(computeFitZoom(zoomMode))
    apply()
    const box = workspaceRef.current
    if (!box || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', apply)
      return () => window.removeEventListener('resize', apply)
    }
    const ro = new ResizeObserver(() => apply())
    ro.observe(box)
    return () => ro.disconnect()
  }, [zoomMode, computeFitZoom])

  const clipboardRef = useRef<BuilderElement | null>(null)
  const designRef = useRef(design)
  const selectedRef = useRef(selected)
  const selectedIdRef = useRef(selectedId)
  const selectedIsQrRef = useRef(selectedIsQr)

  useEffect(() => {
    designRef.current = design
  }, [design])
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])
  useEffect(() => {
    selectedIsQrRef.current = selectedIsQr
  }, [selectedIsQr])

  const imageSrcFor = useCallback(
    (el: BuilderElement) => {
      if (!el.src) return ''
      if (isPrivateCertStoragePath(el.src)) return resolvedImageUrls[el.id] || ''
      return el.src
    },
    [resolvedImageUrls],
  )

  const pushHistory = useCallback((next: LogoBuilderDesign) => {
    historyRef.current = [
      ...historyRef.current.slice(-(MAX_HISTORY - 1)),
      cloneDesign(designRef.current),
    ]
    futureRef.current = []
    setDesign(normalizeVerificationQr(next))
  }, [])

  const updateSelected = (patch: Partial<BuilderElement>) => {
    const id = selectedIdRef.current
    if (!id) return
    const current = designRef.current.elements.find((e) => e.id === id)
    if (!current) return
    // Verification QR keeps bind=qr (system verify URL) — user can still move/resize/delete
    let safePatch = patch
    if (isQrElement(current) && patch.bind && patch.bind !== 'qr') {
      const { bind: _b, ...rest } = patch
      safePatch = rest
    }
    const next = cloneDesign(designRef.current)
    next.elements = next.elements.map((el) => {
      if (el.id !== id) return el
      const merged = { ...el, ...safePatch }
      if (
        isDecorativeElement(merged) &&
        (safePatch.fill !== undefined || safePatch.stroke !== undefined)
      ) {
        return recolorDecorativeElement(
          merged,
          merged.fill || '#002147',
          merged.stroke || '#c9a227',
        )
      }
      if (
        isCertificatePatchElement(merged) &&
        (safePatch.text !== undefined ||
          safePatch.fill !== undefined ||
          safePatch.stroke !== undefined ||
          safePatch.color !== undefined)
      ) {
        return rebuildCertificatePatch(merged)
      }
      return merged
    })
    pushHistory(next)
  }

  const loadSavedDesignFromServer = useCallback(
    async (opts?: { silent?: boolean }) => {
      setLoadingSaved(true)
      try {
        const tpl = await getDocumentTemplate(docType)
        setActiveLayout(String(tpl?.layout_key || 'classic'))
        const raw = tpl?.config?.logo_builder
        const has =
          !!raw &&
          typeof raw === 'object' &&
          Array.isArray((raw as { elements?: unknown }).elements) &&
          (raw as { elements: unknown[] }).elements.length > 0
        setHasSavedDesign(!!raw && typeof raw === 'object')
        if (raw && typeof raw === 'object') {
          setDesign(normalizeLogoBuilderDesign(raw))
          setSelectedId(null)
          setResolvedImageUrls({})
          if (!opts?.silent) {
            toast({
              title: 'Saved design opened',
              description: has
                ? 'Your last Save draft / Save & use design is on the canvas.'
                : 'Saved design loaded.',
            })
          }
          return true
        }
        if (!opts?.silent) {
          toast({
            title: 'No saved design',
            description: 'Nothing is saved yet. Design something, then click Save draft.',
            variant: 'destructive',
          })
        }
        return false
      } catch (err) {
        if (!opts?.silent) {
          toast({
            title: 'Could not open saved design',
            description: getUserMessage(err, { fallback: MESSAGES.LOAD_FAILED }),
            variant: 'destructive',
          })
        }
        return false
      } finally {
        setLoadingSaved(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const tpl = await getDocumentTemplate(docType)
        if (cancelled) return
        setActiveLayout(String(tpl?.layout_key || 'classic'))
        if (tpl?.config?.logo_builder) {
          setHasSavedDesign(true)
          setDesign(normalizeLogoBuilderDesign(tpl.config.logo_builder))
        } else {
          setHasSavedDesign(false)
          setDesign(createDefaultBuilderDesign())
        }
      } catch {
        if (!cancelled) {
          setHasSavedDesign(false)
          setDesign(createDefaultBuilderDesign())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [institution?.id, docType, remountKey])

  const addElement = (type: BuilderElementType, extras?: Partial<BuilderElement>) => {
    const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const isHeading = extras?.name === 'Heading' || (extras?.fontSize || 0) >= 36
    const base: BuilderElement = {
      id: createElementId(),
      type,
      x: 80 + (design.elements.length % 5) * 24,
      y: 160 + (design.elements.length % 5) * 24,
      width: type === 'line' ? 400 : type === 'text' ? (isHeading ? 520 : 420) : 160,
      height: type === 'line' ? 4 : type === 'text' ? (isHeading ? 64 : 48) : 120,
      rotation: 0,
      zIndex: z,
      text: type === 'text' ? (isHeading ? 'Certificate Title' : 'Type anything…') : undefined,
      fontFamily: isHeading ? BUILDER_FONT_FAMILIES[10] : BUILDER_FONT_FAMILIES[0],
      fontSize: isHeading ? 42 : type === 'text' ? 22 : 16,
      fontWeight: isHeading ? 'bold' : 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      letterSpacing: isHeading ? 1 : 0,
      lineHeight: 1.2,
      textAlign: 'center',
      color: '#0f172a',
      fill: type === 'rect' || type === 'ellipse' ? '#e2e8f0' : 'transparent',
      stroke: '#002147',
      strokeWidth: 2,
      opacity: 1,
      bind: 'none',
      ...extras,
    }
    if (extras?.id) base.id = extras.id
    const next = cloneDesign(design)
    next.elements.push(base)
    pushHistory(next)
    setSelectedId(base.id)
  }

  const addBoundField = (bind: Exclude<BuilderBinding, 'qr'>) => {
    const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const el = createBoundTextElement(bind, design.canvas, { zIndex: z })
    el.y = Math.min(design.canvas.height - 60, el.y + (design.elements.length % 6) * 28)
    const next = cloneDesign(design)
    next.elements.push(el)
    pushHistory(next)
    setSelectedId(el.id)
    toast({
      title: 'Field added',
      description: `“${getDocumentBuilderQuickFields(docType).find((f) => f.key === bind)?.label || BUILDER_BINDINGS.find((b) => b.key === bind)?.label}” will fill from live ${docLabel.toLowerCase()} data.`,
    })
  }

  const addDecorativeShape = (key: DecorativeShapeKey) => {
    const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const meta = DECORATIVE_SHAPES.find((s) => s.key === key)
    const el = createDecorativeShapeElement(key, design.canvas, {
      primary: getInstitutionPrimary(institution) || '#002147',
      accent: getInstitutionAccent(institution) || '#c9a227',
    })
    el.zIndex = z
    // Full-page borders/accents stay edge-to-edge and behind content.
    const isFullPage = Boolean(meta && 'fullPage' in meta && meta.fullPage)
    if (!isFullPage) {
      el.x = Math.min(design.canvas.width - el.width - 20, el.x + (design.elements.length % 5) * 16)
      el.y = Math.min(design.canvas.height - el.height - 20, el.y + (design.elements.length % 5) * 16)
    } else {
      el.zIndex = 1
    }
    const next = cloneDesign(design)
    next.elements.push(el)
    pushHistory(next)
    setSelectedId(el.id)
    toast({
      title: 'Decoration added',
      description: 'Rotate, recolor, move, or resize on the page.',
    })
  }

  const addCertificatePatch = (key: CertificatePatchKey) => {
    const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const el = createCertificatePatchElement(key, design.canvas, {
      primary: getInstitutionPrimary(institution) || '#002147',
      accent: getInstitutionAccent(institution) || '#c9a227',
      ink: '#ffffff',
    })
    el.zIndex = z
    const next = cloneDesign(design)
    next.elements.push(el)
    pushHistory(next)
    setSelectedId(el.id)
    setChromeTab('format')
    toast({
      title: 'Patch added',
      description: 'Change the wording and colors in Format. Drag the top handle to rotate.',
    })
  }

  const samplePreviewData = useMemo(() => {
    const base = {
      studentName: 'Amina Hassan',
      studentId: 'STU-001',
      className: 'Morning Cohort',
      dateIssued: new Date().toISOString(),
      institutionName: getInstitutionDisplayName(institution),
      verifyCode: 'previewcode12345678',
      leftName: getSignatoryLeftName(institution) || 'Registrar',
      leftTitle: getSignatoryLeftTitle(institution) || 'Academic Registrar',
      rightName: getSignatoryRightName(institution) || 'Principal',
      rightTitle: getSignatoryRightTitle(institution) || 'Principal',
    }
    if (docType === 'transcript') {
      return {
        ...base,
        programName: 'Diploma in Professional Studies',
        certificateNumber: 'TRN-0000042',
        gpa: '3.40',
        gradesSummary:
          'Intro to Practice                 3      A\nResearch Methods                   3      B+\nProfessional Ethics                2      A-',
      }
    }
    if (docType === 'invoice') {
      return {
        ...base,
        programName: 'Tuition & fees',
        certificateNumber: 'INV-STU-001',
        invoiceNumber: 'INV-STU-001-202608',
        totalDue: '175.00',
        amountPaid: '150.00',
        balance: '25.00',
      }
    }
    return {
      ...base,
      programName: 'Professional Training Certificate',
      certificateNumber: 'CERT-PREVIEW-001',
    }
  }, [institution, docType])

  const editorLabelFor = useCallback(
    (el: BuilderElement) => {
      if (isQrElement(el)) return 'QR'
      if (el.bind && el.bind !== 'none') {
        return resolveBuilderText(el, samplePreviewData)
      }
      return el.text || el.type
    },
    [samplePreviewData],
  )

  const addBorderFrame = () => {
    const frames = createBorderFrameElements(
      design.canvas,
      getInstitutionPrimary(institution) || '#002147',
      getInstitutionAccent(institution) || '#c9a227',
    )
    const maxZ = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0)
    // Put borders behind content
    const next = cloneDesign(design)
    next.elements = [
      ...frames.map((f, i) => ({ ...f, zIndex: i + 1 })),
      ...next.elements.map((e) => ({ ...e, zIndex: (e.zIndex || 0) + maxZ + 3 })),
    ]
    pushHistory(next)
    setSelectedId(frames[0]?.id || null)
    if (frames[0]?.groupId) setActiveGroupId(frames[0].groupId)
  }

  const applyStarterLayout = (paperOverride?: PaperSizeKey) => {
    if (design.elements.length > 0) {
      const ok = window.confirm(
        `Replace the current design with a ready ${docLabel.toLowerCase()} starter layout? You can still edit everything after.`,
      )
      if (!ok) return
    }
    const paperKey = (paperOverride ||
      (design.canvas.paperKey as PaperSizeKey) ||
      'a4-portrait') as PaperSizeKey
    const starter = createStarterDocumentDesign(
      docType,
      paperKey === 'custom' ? 'a4-portrait' : paperKey,
    )
    // Inject institution branding assets with clear layer names
    if (institution?.logo_url) {
      starter.elements.push({
        id: createElementId(),
        type: 'image',
        x: starter.canvas.width / 2 - 50,
        y: 48,
        width: 100,
        height: 100,
        rotation: 0,
        zIndex: 50,
        src: String(institution.logo_url),
        opacity: 1,
        bind: 'none',
        text: 'logo-image',
      })
      // Logo XOR name — drop institution name layers when logo is present
      starter.elements = starter.elements.filter((el) => el.bind !== 'institutionName')
    }
    if (institution?.seal_url) {
      starter.elements.push({
        id: createElementId(),
        type: 'image',
        x: starter.canvas.width / 2 - 40,
        y: starter.canvas.height * 0.62,
        width: 80,
        height: 80,
        rotation: 0,
        zIndex: 50,
        src: String(institution.seal_url),
        opacity: 1,
        bind: 'none',
        text: 'stamp-image',
      })
    }
    if (institution?.signature_url) {
      starter.elements.push({
        id: createElementId(),
        type: 'image',
        x: starter.canvas.width * 0.14,
        y: starter.canvas.height * 0.72,
        width: 160,
        height: 48,
        rotation: 0,
        zIndex: 50,
        src: String(institution.signature_url),
        opacity: 1,
        bind: 'none',
        text: 'signature-image',
      })
    }
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), cloneDesign(design)]
    futureRef.current = []
    setDesign(normalizeVerificationQr(starter))
    setSelectedId(null)
    setPreviewOpen(true)
    setStarterOpen(false)
    toast({
      title: `${docLabel} starter ready`,
      description: `This is a ${docLabel.toLowerCase()} layout (not a certificate). Edit fields, branding, and spacing as needed.`,
    })
  }

  const handleBackgroundImage = async (file: File | null) => {
    if (!file) return
    try {
      const { signedUrl, path } = await uploadCertificateBuilderImage(file)
      // Full-bleed background image behind everything
      const bgEl: BuilderElement = {
        id: createElementId(),
        type: 'image',
        x: 0,
        y: 0,
        width: design.canvas.width,
        height: design.canvas.height,
        rotation: 0,
        zIndex: 0,
        src: path,
        opacity: 1,
        bind: 'none',
      }
      if (signedUrl) {
        setResolvedImageUrls((prev) => ({ ...prev, [bgEl.id]: signedUrl }))
      }
      const next = cloneDesign(design)
      // Remove previous full-bleed bg (zIndex 0 covering canvas)
      next.elements = next.elements.filter(
        (e) =>
          !(
            e.type === 'image' &&
            e.zIndex === 0 &&
            e.x === 0 &&
            e.y === 0 &&
            Math.abs(e.width - design.canvas.width) < 2
          ),
      )
      next.elements = next.elements.map((e) =>
        e.zIndex === 0 ? { ...e, zIndex: 1 } : e,
      )
      next.elements.unshift(bgEl)
      // Keep page background light so gaps aren't dark
      next.canvas.background = '#ffffff'
      pushHistory(next)
      setSelectedId(bgEl.id)
      toast({ title: 'Background added', description: 'Full-page background image placed behind your design.' })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: getUserMessage(err, {
          fallback: { title: 'Upload failed', description: 'Could not upload background image.' },
        }),
        variant: 'destructive',
      })
    }
  }

  const duplicateSelected = () => {
    const current = selectedRef.current
    if (!current || selectedIsQrRef.current) return
    const d = designRef.current
    const z = d.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const copy: BuilderElement = {
      ...cloneDesign({ version: 1, canvas: d.canvas, elements: [current] }).elements[0],
      id: createElementId(),
      x: current.x + 20,
      y: current.y + 20,
      zIndex: z,
      locked: false,
    }
    if (copy.bind === 'qr') copy.bind = 'none'
    const next = cloneDesign(d)
    next.elements.push(copy)
    pushHistory(next)
    setSelectedId(copy.id)
  }

  const copySelectedToClipboard = () => {
    const current = selectedRef.current
    if (!current || selectedIsQrRef.current) return false
    const cloned = cloneDesign({
      version: 1,
      canvas: designRef.current.canvas,
      elements: [current],
    }).elements[0]
    clipboardRef.current = { ...cloned, locked: false }
    try {
      void navigator.clipboard?.writeText(
        JSON.stringify({ brceCertElement: true, element: clipboardRef.current }),
      )
    } catch {
      /* internal clipboard still works */
    }
    return true
  }

  const pasteFromClipboard = () => {
    const src = clipboardRef.current
    if (!src) return false
    const d = designRef.current
    const z = d.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const el: BuilderElement = {
      ...cloneDesign({ version: 1, canvas: d.canvas, elements: [src] }).elements[0],
      id: createElementId(),
      x: Math.min(d.canvas.width - src.width - 8, src.x + 24),
      y: Math.min(d.canvas.height - src.height - 8, src.y + 24),
      zIndex: z,
      locked: false,
    }
    if (el.bind === 'qr') el.bind = 'none'
    // Keep decorative recolor metadata; offset so paste is visible
    clipboardRef.current = { ...el, id: src.id }
    const next = cloneDesign(d)
    next.elements.push(el)
    pushHistory(next)
    setSelectedId(el.id)
    return true
  }

  const deleteSelected = () => {
    const id = selectedIdRef.current
    const current = selectedRef.current
    if (!id || !current) return
    if (current.locked) {
      toast({
        title: 'Element locked',
        description: 'Unlock the layer before deleting it.',
        variant: 'destructive',
      })
      return
    }
    if (isUploadPaperElement(current)) {
      toast({
        title: 'Paper is locked',
        description: 'Unlock this layer first, or delete other extracted elements.',
        variant: 'destructive',
      })
      return
    }
    const next = cloneDesign(designRef.current)
    // Collapsed group (e.g. brand logo lockup) → delete the whole unit in one Delete key
    if (
      current.groupId &&
      enteredGroupIdRef.current !== current.groupId &&
      next.elements.filter((e) => e.groupId === current.groupId).length > 1
    ) {
      next.elements = next.elements.filter((e) => e.groupId !== current.groupId)
    } else {
      next.elements = next.elements.filter((e) => e.id !== id)
    }
    pushHistory(next)
    setSelectedId(null)
    setActiveGroupId(null)
    if (isQrElement(current)) {
      toast({
        title: 'Verification QR removed',
        description:
          'OK if your design already has a QR. Add “Verification QR” again only if you need this system’s verify code.',
      })
    }
  }

  const cutSelected = () => {
    if (!copySelectedToClipboard()) return
    deleteSelected()
  }

  const nudgeSelected = (dx: number, dy: number) => {
    const current = selectedRef.current
    if (!current || current.locked) return
    if (
      current.groupId &&
      enteredGroupIdRef.current !== current.groupId &&
      designRef.current.elements.filter((e) => e.groupId === current.groupId).length > 1
    ) {
      const next = cloneDesign(designRef.current)
      next.elements = next.elements.map((el) => {
        if (el.groupId !== current.groupId || el.locked) return el
        return {
          ...el,
          x: Math.max(0, el.x + dx),
          y: Math.max(0, el.y + dy),
        }
      })
      pushHistory(next)
      return
    }
    updateSelected({
      x: Math.max(0, current.x + dx),
      y: Math.max(0, current.y + dy),
    })
  }

  const rotateSelected = (delta: number) => {
    const current = selectedRef.current
    if (!current || current.locked) return
    updateSelected({ rotation: Math.round(((current.rotation || 0) + delta) * 10) / 10 })
  }

  const undo = () => {
    const prev = historyRef.current.pop()
    if (!prev) return
    futureRef.current.push(cloneDesign(designRef.current))
    setDesign(normalizeVerificationQr(prev))
  }

  const redo = () => {
    const nxt = futureRef.current.pop()
    if (!nxt) return
    historyRef.current.push(cloneDesign(designRef.current))
    setDesign(normalizeVerificationQr(nxt))
  }

  const shortcutActionsRef = useRef({
    undo,
    redo,
    copySelectedToClipboard,
    cutSelected,
    pasteFromClipboard,
    duplicateSelected,
    deleteSelected,
    nudgeSelected,
    rotateSelected,
    zoomIn,
    zoomOut,
    fitWholePage,
  })
  shortcutActionsRef.current = {
    undo,
    redo,
    copySelectedToClipboard,
    cutSelected,
    pasteFromClipboard,
    duplicateSelected,
    deleteSelected,
    nudgeSelected,
    rotateSelected,
    zoomIn,
    zoomOut,
    fitWholePage,
  }

  // Keyboard shortcuts while editing the certificate canvas
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = (el.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
      if (el.isContentEditable) return true
      return !!el.closest('input, textarea, select, [contenteditable="true"]')
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      const a = shortcutActionsRef.current
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        a.undo()
        return
      }
      if ((mod && key === 'z' && e.shiftKey) || (mod && key === 'y')) {
        e.preventDefault()
        a.redo()
        return
      }
      if (mod && key === 'c') {
        if (a.copySelectedToClipboard()) e.preventDefault()
        return
      }
      if (mod && key === 'x') {
        if (selectedRef.current) {
          e.preventDefault()
          a.cutSelected()
        }
        return
      }
      if (mod && key === 'v') {
        if (clipboardRef.current) {
          e.preventDefault()
          a.pasteFromClipboard()
        }
        return
      }
      if (mod && key === 'd') {
        e.preventDefault()
        a.duplicateSelected()
        return
      }
      if (mod && key === 'a') {
        e.preventDefault()
        const ids = designRef.current.elements.filter((el) => !el.hidden).map((el) => el.id)
        if (ids.length) {
          setSelectedIds(ids)
          setSelectedId(ids[ids.length - 1])
        }
        return
      }
      if (mod && key === 'l') {
        e.preventDefault()
        const cur = selectedRef.current
        if (cur) updateSelected({ locked: !cur.locked })
        return
      }
      if (mod && key === 'g') {
        e.preventDefault()
        setSnapEnabled((v) => !v)
        return
      }
      if (mod && (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault()
        a.zoomIn()
        return
      }
      if (mod && (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault()
        a.zoomOut()
        return
      }
      if (mod && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault()
        a.fitWholePage()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedIdRef.current) return
        e.preventDefault()
        a.deleteSelected()
        return
      }

      if (e.key === 'Escape') {
        setSelectedId(null)
        setActiveGroupId(null)
        setEnteredGroupId(null)
        setStarterOpen(false)
        setToolbarMenu('none')
        return
      }

      const step = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        a.nudgeSelected(-step, 0)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        a.nudgeSelected(step, 0)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        a.nudgeSelected(0, -step)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        a.nudgeSelected(0, step)
        return
      }
      if (e.key === '[' || e.key === '{') {
        e.preventDefault()
        a.rotateSelected(e.shiftKey ? -15 : -1)
        return
      }
      if (e.key === ']' || e.key === '}') {
        e.preventDefault()
        a.rotateSelected(e.shiftKey ? 15 : 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      if (e.deltaY < 0) shortcutActionsRef.current.zoomIn()
      else shortcutActionsRef.current.zoomOut()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [loading])

  const addVerificationQr = () => {
    if (hasVerificationQr(design)) {
      const existing = design.elements.find((e) => isQrElement(e))
      if (existing) setSelectedId(existing.id)
      toast({
        title: 'Verification QR already on page',
        description: 'Move or resize it. Delete it if your design already includes its own QR.',
      })
      return
    }
    const next = cloneDesign(design)
    const qr = createVerificationQrElement(design.canvas)
    next.elements.push(qr)
    pushHistory(next)
    setSelectedId(qr.id)
  }

  const changePaperSize = (paperKey: PaperSizeKey) => {
    if (paperKey === 'custom') {
      const next = cloneDesign(design)
      next.canvas.paperKey = 'custom'
      pushHistory(next)
      return
    }
    pushHistory(applyPaperSize(design, paperKey))
  }

  const applyCustomSizeMm = (wmm: number, hmm: number) => {
    const wpx = Math.round((Math.max(50, wmm) * 96) / 25.4)
    const hpx = Math.round((Math.max(50, hmm) * 96) / 25.4)
    pushHistory(applyCustomPaperSize(design, wpx, hpx))
  }

  const alignSelected = (mode: AlignMode) => {
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : []
    if (!ids.length) return
    const next = cloneDesign(design)
    next.elements = alignSelection(next.elements, ids, design.canvas, mode)
    pushHistory(next)
  }

  const distributeSelected = (axis: 'h' | 'v') => {
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : []
    if (ids.length < 3) {
      toast({
        title: 'Select 3 or more layers',
        description: 'Hold Shift and click extra elements, then distribute.',
      })
      return
    }
    const next = cloneDesign(design)
    next.elements = distributeSelection(next.elements, ids, axis)
    pushHistory(next)
  }

  const bring = (dir: 'front' | 'back' | 'forward' | 'backward') => {
    if (!selectedId) return
    const next = cloneDesign(design)
    next.elements = stepZIndex(next.elements, selectedId, dir)
    pushHistory(next)
  }

  const selectElement = (id: string, additive: boolean) => {
    if (additive) {
      setSelectedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        return next.length ? next : [id]
      })
      setSelectedId(id)
    } else {
      setSelectedId(id)
      setSelectedIds([id])
    }
    setChromeTab('format')
  }

  const onPointerDown = (
    e: React.PointerEvent,
    id: string,
    mode: 'move' | 'resize' | 'rotate',
    handle?: 'se' | 'sw' | 'ne' | 'nw',
  ) => {
    e.stopPropagation()
    e.preventDefault()
    canvasRef.current?.focus?.()
    const el = design.elements.find((x) => x.id === id)
    if (!el || !canvasRef.current || el.hidden) return
    selectElement(id, e.shiftKey)

    const inGroup =
      !!el.groupId &&
      enteredGroupId !== el.groupId &&
      design.elements.filter((x) => x.groupId === el.groupId).length > 1
    if (inGroup) {
      setActiveGroupId(el.groupId!)
    } else {
      setActiveGroupId(null)
    }

    if (el.locked || isUploadPaperElement(el)) {
      return
    }

    dragStartDesignRef.current = cloneDesign(design)

    const groupOrigins =
      inGroup && el.groupId
        ? design.elements
            .filter((x) => x.groupId === el.groupId && !x.locked)
            .map((x) => ({ id: x.id, x: x.x, y: x.y, width: x.width, height: x.height }))
        : undefined

    const moveIds = !e.shiftKey && selectedIds.length > 1 ? selectedIds : [id]
    const selectedOrigins =
      mode === 'move' && moveIds.length > 1
        ? design.elements
            .filter((x) => moveIds.includes(x.id) && !x.locked)
            .map((x) => ({ id: x.id, x: x.x, y: x.y }))
        : undefined

    let startAngle: number | undefined
    if (mode === 'rotate') {
      const box = canvasRef.current.getBoundingClientRect()
      const sx = design.canvas.width / box.width
      const sy = design.canvas.height / box.height
      const px = (e.clientX - box.left) * sx
      const py = (e.clientY - box.top) * sy
      startAngle = (Math.atan2(py - (el.y + el.height / 2), px - (el.x + el.width / 2)) * 180) / Math.PI
    }

    dragRef.current = {
      id,
      groupId: inGroup ? el.groupId : null,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
      origRot: el.rotation || 0,
      startAngle,
      groupOrigins,
      selectedOrigins,
      mode,
      handle,
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    const scaleX = design.canvas.width / rect.width
    const scaleY = design.canvas.height / rect.height
    const dx = (e.clientX - dragRef.current.startX) * scaleX
    const dy = (e.clientY - dragRef.current.startY) * scaleY
    const drag = dragRef.current
    const others = design.elements.filter((el) => el.id !== drag.id && !el.hidden)
    setDesign((prev) => {
      const next = cloneDesign(prev)
      if (drag.mode === 'rotate') {
        const el = prev.elements.find((x) => x.id === drag.id)
        if (!el) return prev
        const cx = el.x + el.width / 2
        const cy = el.y + el.height / 2
        const px = (e.clientX - rect.left) * scaleX
        const py = (e.clientY - rect.top) * scaleY
        const live = (Math.atan2(py - cy, px - cx) * 180) / Math.PI
        let rot = (drag.origRot || 0) + (live - (drag.startAngle || 0))
        if (e.shiftKey) rot = Math.round(rot / 15) * 15
        else rot = Math.round(rot * 10) / 10
        next.elements = next.elements.map((item) =>
          item.id === drag.id ? { ...item, rotation: rot } : item,
        )
        return normalizeVerificationQr(next)
      }
      if (drag.mode === 'move' && drag.groupOrigins?.length) {
        const byId = new Map(drag.groupOrigins.map((g) => [g.id, g]))
        next.elements = next.elements.map((el) => {
          const orig = byId.get(el.id)
          if (!orig) return el
          let nx = orig.x + dx
          let ny = orig.y + dy
          if (snapEnabled) {
            nx = snapCoord(nx, true)
            ny = snapCoord(ny, true)
          }
          return {
            ...el,
            x: Math.max(0, Math.min(prev.canvas.width - 20, nx)),
            y: Math.max(0, Math.min(prev.canvas.height - 20, ny)),
          }
        })
        return normalizeVerificationQr(next)
      }
      if (drag.mode === 'move' && drag.selectedOrigins?.length) {
        const byId = new Map(drag.selectedOrigins.map((g) => [g.id, g]))
        next.elements = next.elements.map((el) => {
          const orig = byId.get(el.id)
          if (!orig) return el
          let nx = orig.x + dx
          let ny = orig.y + dy
          if (snapEnabled) {
            nx = snapCoord(nx, true)
            ny = snapCoord(ny, true)
          }
          return {
            ...el,
            x: Math.max(0, Math.min(prev.canvas.width - 20, nx)),
            y: Math.max(0, Math.min(prev.canvas.height - 20, ny)),
          }
        })
        return normalizeVerificationQr(next)
      }
      if (drag.mode === 'resize' && drag.groupOrigins && drag.groupOrigins.length > 1) {
        const members = drag.groupOrigins
        const origX = Math.min(...members.map((m) => m.x))
        const origY = Math.min(...members.map((m) => m.y))
        const origW = Math.max(...members.map((m) => m.x + m.width)) - origX
        const origH = Math.max(...members.map((m) => m.y + m.height)) - origY
        const handle = drag.handle || 'se'
        let x = origX
        let y = origY
        let w = origW
        let h = origH
        if (handle === 'se') {
          w = origW + dx
          h = origH + dy
        } else if (handle === 'sw') {
          w = origW - dx
          h = origH + dy
          x = origX + dx
        } else if (handle === 'ne') {
          w = origW + dx
          h = origH - dy
          y = origY + dy
        } else {
          w = origW - dx
          h = origH - dy
          x = origX + dx
          y = origY + dy
        }
        w = Math.max(24, w)
        h = Math.max(24, h)
        const byId = new Map(members.map((m) => [m.id, m]))
        next.elements = next.elements.map((item) => {
          const orig = byId.get(item.id)
          if (!orig) return item
          const rx = (orig.x - origX) / Math.max(1, origW)
          const ry = (orig.y - origY) / Math.max(1, origH)
          const rw = orig.width / Math.max(1, origW)
          const rh = orig.height / Math.max(1, origH)
          return {
            ...item,
            x: x + rx * w,
            y: y + ry * h,
            width: Math.max(8, rw * w),
            height: Math.max(8, rh * h),
          }
        })
        return normalizeVerificationQr(next)
      }
      next.elements = next.elements.map((el) => {
        if (el.id !== drag.id) return el
        if (drag.mode === 'resize') {
          const handle = drag.handle || 'se'
          let x = drag.origX
          let y = drag.origY
          let w = drag.origW
          let h = drag.origH
          if (handle === 'se') {
            w = drag.origW + dx
            h = drag.origH + dy
          } else if (handle === 'sw') {
            w = drag.origW - dx
            h = drag.origH + dy
            x = drag.origX + dx
          } else if (handle === 'ne') {
            w = drag.origW + dx
            h = drag.origH - dy
            y = drag.origY + dy
          } else {
            w = drag.origW - dx
            h = drag.origH - dy
            x = drag.origX + dx
            y = drag.origY + dy
          }
          const min = isQrElement(el) ? 64 : 16
          w = Math.max(min, w)
          h = Math.max(min, h)
          if (snapEnabled) {
            x = snapCoord(x, true)
            y = snapCoord(y, true)
            w = snapCoord(w, true)
            h = snapCoord(h, true)
          }
          return { ...el, x, y, width: w, height: h }
        }
        let nx = drag.origX + dx
        let ny = drag.origY + dy
        if (snapEnabled) {
          const g = snapToGuides(nx, ny, el.width, el.height, prev.canvas, others)
          nx = g.x
          ny = g.y
          setGuides({ x: g.guideX, y: g.guideY })
          nx = snapCoord(nx, true)
          ny = snapCoord(ny, true)
        }
        return {
          ...el,
          x: Math.max(0, Math.min(prev.canvas.width - 20, nx)),
          y: Math.max(0, Math.min(prev.canvas.height - 20, ny)),
        }
      })
      return normalizeVerificationQr(next)
    })
  }

  const onPointerUp = () => {
    if (!dragRef.current) return
    const start = dragStartDesignRef.current
    if (start) {
      historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), start]
      futureRef.current = []
    }
    dragRef.current = null
    dragStartDesignRef.current = null
    setGuides({ x: null, y: null })
  }

  const handleImageUpload = async (file: File | null) => {
    if (!file) return
    try {
      const { signedUrl, path } = await uploadCertificateBuilderImage(file)
      const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
      const el: BuilderElement = {
        id: createElementId(),
        type: 'image',
        x: 200,
        y: 140,
        width: 220,
        height: 140,
        rotation: 0,
        zIndex: z,
        // Persist private path only — signed URL is for display
        src: path,
        opacity: 1,
        bind: 'none',
      }
      if (signedUrl) {
        setResolvedImageUrls((prev) => ({ ...prev, [el.id]: signedUrl }))
      }
      const next = cloneDesign(design)
      next.elements.push(el)
      pushHistory(next)
      setSelectedId(el.id)
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: getUserMessage(err, {
          fallback: { title: 'Upload failed', description: 'We could not upload your file. Please try again.' },
        }),
        variant: 'destructive',
      })
    }
  }

  const addInstitutionAsset = (kind: 'logo' | 'seal' | 'signature') => {
    const url =
      kind === 'logo'
        ? institution?.logo_url
        : kind === 'seal'
          ? institution?.seal_url
          : institution?.signature_url
    if (!url) {
      toast({
        title: 'Not configured',
        description: `Set your institution ${kind} in Institution Settings first.`,
        variant: 'destructive',
      })
      return
    }
    const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const size = kind === 'signature' ? { width: 220, height: 80 } : { width: 140, height: 140 }
    const layerName =
      kind === 'logo' ? 'logo-image' : kind === 'seal' ? 'stamp-image' : 'signature-image'
    const el: BuilderElement = {
      id: createElementId(),
      type: 'image',
      x: kind === 'seal' ? design.canvas.width / 2 - 70 : 80,
      y: kind === 'signature' ? design.canvas.height - 160 : 80,
      ...size,
      rotation: 0,
      zIndex: z,
      src: String(url),
      opacity: 1,
      bind: 'none',
      text: layerName,
    }
    const next = cloneDesign(design)
    next.elements.push(el)
    pushHistory(next)
    setSelectedId(el.id)
  }

  const prepareDesignForPersist = () => {
    const safeElements = design.elements.map((el) => {
      if (el.type !== 'image' || !el.src) return el
      if (isPrivateCertStoragePath(el.src)) return el
      const recovered = extractCertStoragePath(el.src)
      return recovered ? { ...el, src: recovered } : el
    })
    return normalizeVerificationQr({
      version: 1,
      canvas: design.canvas,
      elements: safeElements,
    })
  }

  const handleSave = async (activate: boolean) => {
    setSaving(true)
    try {
      const hasStudent = design.elements.some((e) => e.bind === 'studentName')
      const hasProgram = design.elements.some((e) => e.bind === 'programName')
      if (!design.elements.length) {
        toast({
          title: 'Empty design',
          description: 'Add fields or use “Starter layout” before saving.',
          variant: 'destructive',
        })
        setSaving(false)
        return
      }
      if (activate && (!hasStudent || (docType !== 'invoice' && !hasProgram))) {
        const ok = window.confirm(
          docType === 'invoice'
            ? 'This invoice design is missing Student name auto-fill. Save & activate anyway?'
            : `This ${docLabel.toLowerCase()} design is missing Student name and/or Program auto-fill fields. Save & activate anyway?`,
        )
        if (!ok) {
          setSaving(false)
          return
        }
      }

      const safe = prepareDesignForPersist()
      setDesign(safe)
      const row = await saveDocumentLogoBuilder(
        docType,
        {
          version: 1,
          canvas: safe.canvas,
          elements: safe.elements,
        },
        activate,
      )
      setHasSavedDesign(true)
      setDraftTick((n) => n + 1)
      if (activate) {
        setActiveLayout(String(row?.layout_key || 'logo_builder'))
        toast({
          title: 'Saved — now in use',
          description:
            `Page Builder is the active ${docLabel.toLowerCase()} design. Issued/live documents will use it until you activate a library template.`,
        })
      } else {
        toast({
          title: 'Draft saved',
          description:
            `Saved in ${docLabel} Page Builder. Open it anytime with “Open saved design”.`,
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleNewBlank = () => {
    const ok = window.confirm(
      `Start a new blank ${docLabel.toLowerCase()} document? Unsaved changes on this canvas will be lost (use Save draft first if needed).`,
    )
    if (!ok) return
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), cloneDesign(design)]
    futureRef.current = []
    const blank = createDefaultBuilderDesign()
    setDesign(blank)
    setSelectedId(null)
    toast({
      title: 'New blank document',
      description: 'Empty canvas ready. Add fields, shapes, then Save draft or Save & use.',
    })
  }

  const previewDesign = useMemo(() => {
    return normalizeVerificationQr({
      ...design,
      elements: design.elements.map((el) =>
        el.type === 'image' && isPrivateCertStoragePath(el.src)
          ? { ...el, src: resolvedImageUrls[el.id] || el.src }
          : el,
      ),
    })
  }, [design, resolvedImageUrls])

  const sampleData: CertificateRenderData = useMemo(() => {
    const base = {
      layoutKey: 'logo_builder' as const,
      institutionName: getInstitutionDisplayName(institution),
      primary: getInstitutionPrimary(institution),
      accent: getInstitutionAccent(institution),
      logoUrl: institution?.logo_url,
      sealUrl: institution?.seal_url,
      signatureUrl: institution?.signature_url,
      studentName: 'Amina Hassan',
      studentId: 'STU-001',
      className: 'Morning Cohort',
      verifyCode: 'previewcode12345678',
      dateIssued: new Date().toISOString(),
      leftTitle: getSignatoryLeftTitle(institution) || 'Academic Registrar',
      rightTitle: getSignatoryRightTitle(institution) || 'Principal',
      leftName: getSignatoryLeftName(institution) || undefined,
      rightName: getSignatoryRightName(institution) || undefined,
      logoBuilderDesign: previewDesign,
    }
    if (docType === 'transcript') {
      return {
        ...base,
        programName: 'Diploma in Professional Studies',
        certificateNumber: 'TRN-0000042',
        verificationUrl: 'https://example.com/verify/previewcode12345678',
        footerText: getTranscriptFooterText(institution) || undefined,
        gpa: '3.40',
        gradesSummary:
          'Intro to Practice                 3      A\nResearch Methods                   3      B+\nProfessional Ethics                2      A-',
      } as CertificateRenderData
    }
    if (docType === 'invoice') {
      return {
        ...base,
        programName: 'Tuition & fees',
        certificateNumber: 'INV-STU-001',
        invoiceNumber: 'INV-STU-001-202608',
        totalDue: '175.00',
        amountPaid: '150.00',
        balance: '25.00',
        lineItemsSummary:
          'Registration Fee                            25.00\nTuition Fee — current month                150.00',
        verificationUrl: undefined,
        footerText: getInvoiceFooterText(institution) || undefined,
      } as CertificateRenderData
    }
    return {
      ...base,
      programName: 'Professional Training Certificate',
      certificateNumber: 'CERT-PREVIEW-001',
      verificationUrl: 'https://example.com/verify-certificate/previewcode12345678',
      footerText: getCertificateFooterText(institution) || undefined,
    }
  }, [institution, previewDesign, docType])

  const handleDownloadPdf = async () => {
    if (!design.elements.length) {
      toast({
        title: 'Nothing to download',
        description: `Add content to the ${docLabel.toLowerCase()} first.`,
        variant: 'destructive',
      })
      return
    }
    setDownloadingPdf(true)
    try {
      await downloadCertificatePDF(
        {
          ...sampleData,
          layoutKey: 'logo_builder',
          logoBuilderDesign: previewDesign,
          skipLiveActiveTemplate: true,
          useCurrentDesign: true,
          student: { name: sampleData.studentName, student_code: sampleData.studentId },
          studentCode: sampleData.studentId || 'PREVIEW',
        },
        `Certificate_Builder_Preview_${new Date().toISOString().slice(0, 10)}.pdf`,
      )
      toast({
        title: 'PDF downloaded',
        description: `Full ${docLabel.toLowerCase()} page PDF (current canvas design).`,
      })
    } catch (err) {
      toast({
        title: 'Download failed',
        description: getUserMessage(err, { fallback: `Could not create ${docLabel.toLowerCase()} PDF.` }),
        variant: 'destructive',
      })
    } finally {
      setDownloadingPdf(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const images = design.elements.filter(
        (e) => e.type === 'image' && e.src && isPrivateCertStoragePath(e.src),
      )
      if (!images.length) return
      const updates: Record<string, string> = {}
      for (const el of images) {
        if (resolvedImageUrls[el.id]) continue
        try {
          const url = await getCertificateTemplateSignedUrl(el.src!)
          if (url) updates[el.id] = url
        } catch {
          /* keep unresolved */
        }
      }
      if (cancelled || !Object.keys(updates).length) return
      setResolvedImageUrls((prev) => ({ ...prev, ...updates }))
    })()
    return () => {
      cancelled = true
    }
    // Re-resolve when design element set changes (paths), not on every resolved URL update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institution?.id, design.elements.map((e) => `${e.id}:${e.src}`).join('|')])

  const pdfMm = getDesignPdfPageMm(design.canvas)
  const brandPrimary = getInstitutionPrimary(institution) || '#002147'
  const brandAccent = getInstitutionAccent(institution) || '#c9a227'

  const filteredDecor = DECORATIVE_SHAPES.filter((s) => {
    const q = elementSearch.trim().toLowerCase()
    const catOk = libraryCategory === 'all' || s.category === libraryCategory
    const qOk = !q || s.label.toLowerCase().includes(q) || s.category.includes(q)
    return catOk && qOk
  })

  if (loading) {
    return (
      <Card className="cert-page-builder bg-[var(--builder-chrome)] border-[var(--builder-line)]">
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="cert-page-builder overflow-hidden rounded-xl border border-slate-800 bg-[var(--builder-chrome)] text-[var(--builder-text)]">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          handleImageUpload(e.target.files?.[0] || null)
          e.target.value = ''
        }}
      />
      <input
        ref={bgFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          handleBackgroundImage(e.target.files?.[0] || null)
          e.target.value = ''
        }}
      />

      <div className="relative z-40 border-b border-slate-800 bg-[var(--builder-bar)]">
        <div className="flex flex-wrap items-center gap-1 px-2 py-1">
          <span className="hidden text-[11px] font-semibold text-[var(--builder-text)] sm:inline">
            {isUploadEdit ? 'Edit upload' : `${docLabel} Builder`}
          </span>
          {activeLayout === 'logo_builder' ? (
            <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40 text-[10px]">Active</Badge>
          ) : hasSavedDesign ? (
            <Badge className="bg-amber-600/20 text-amber-200 border-amber-700/40 text-[10px]">Draft</Badge>
          ) : null}
          <span className="mx-0.5 hidden h-4 w-px bg-slate-700 sm:inline" />
          {([
            ['insert', 'Insert'],
            ['design', 'Design'],
            ['format', 'Format'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setChromeTab(id)
                setToolbarMenu('none')
                setStarterOpen(false)
              }}
              className={`h-7 rounded-md px-2.5 text-[11px] font-semibold ${
                chromeTab === id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-[var(--builder-text)]'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-0.5">
            <ToolBtn title="Undo (Ctrl+Z)" onClick={undo}><Undo2 className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn title="Redo (Ctrl+Y)" onClick={redo}><Redo2 className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn title="Fit page (Ctrl+0)" active={zoomMode === 'page'} onClick={fitWholePage}><Maximize2 className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn title="Zoom out" onClick={zoomOut}><ZoomOut className="h-3.5 w-3.5" /></ToolBtn>
            <span className="w-8 text-center text-[10px] text-slate-400">{Math.round(zoom * 100)}%</span>
            <ToolBtn title="Zoom in" onClick={zoomIn}><ZoomIn className="h-3.5 w-3.5" /></ToolBtn>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setPreviewOpen((v) => !v)}>
              <Eye className="h-3.5 w-3.5 mr-1" /> Preview
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => handleSave(false)} className="h-7 px-2 text-[10px] border-slate-600">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => handleSave(true)} className="h-7 px-2 text-[10px] bg-violet-600 hover:bg-violet-500">
              Use
            </Button>
            <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" disabled={downloadingPdf} onClick={() => handleDownloadPdf()}>
              {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
              PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-0.5 border-t border-slate-800/80 px-2 py-1">
          {chromeTab === 'insert' ? (
            <>
              <ToolBtn title="Text" onClick={() => addElement('text')}><Type className="h-3.5 w-3.5" /> Text</ToolBtn>
              <ToolBtn title="Rectangle" onClick={() => addElement('rect')}><Square className="h-3.5 w-3.5" /></ToolBtn>
              <ToolBtn title="Circle" onClick={() => addElement('ellipse')}><Circle className="h-3.5 w-3.5" /></ToolBtn>
              <ToolBtn title="Border frame" onClick={addBorderFrame}><Frame className="h-3.5 w-3.5" /></ToolBtn>
              <ToolBtn title="Image" onClick={() => fileRef.current?.click()}><ImagePlus className="h-3.5 w-3.5" /></ToolBtn>
              <ToolBtn title="QR code" active={hasVerificationQr(design)} onClick={addVerificationQr}><QrCode className="h-3.5 w-3.5" /></ToolBtn>
              <ToolBtn title="Institution logo" onClick={() => addInstitutionAsset('logo')}>Logo</ToolBtn>
              <div className="relative z-50">
                <ToolBtn title="Live fields" active={toolbarMenu === 'fields'} onClick={() => setToolbarMenu((m) => (m === 'fields' ? 'none' : 'fields'))}>
                  <Type className="h-3.5 w-3.5" /> Fields
                </ToolBtn>
                {toolbarMenu === 'fields' ? (
                  <div className="absolute left-0 top-full z-[60] mt-1 w-56 overflow-hidden rounded-md border border-slate-700 bg-[#0b0d14] p-1 shadow-2xl">
                    <Input
                      value={elementSearch}
                      onChange={(e) => setElementSearch(e.target.value)}
                      placeholder="Search fields…"
                      className="mb-1 h-7 bg-slate-900 border-slate-700 text-xs"
                    />
                    <div className="max-h-60 overflow-y-auto">
                      {getDocumentBuilderQuickFields(docType)
                        .filter((f) => {
                          const q = elementSearch.trim().toLowerCase()
                          return !q || f.label.toLowerCase().includes(q)
                        })
                        .map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => {
                              addBoundField(f.key)
                              setToolbarMenu('none')
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-xs text-violet-200 hover:bg-violet-600/20"
                          >
                            {f.label}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative z-50">
                <ToolBtn title="Decorations" active={toolbarMenu === 'decor'} onClick={() => setToolbarMenu((m) => (m === 'decor' ? 'none' : 'decor'))}>
                  <Sparkles className="h-3.5 w-3.5" /> Decor
                </ToolBtn>
                {toolbarMenu === 'decor' ? (
                  <div className="absolute left-0 top-full z-[60] mt-1 w-64 overflow-hidden rounded-md border border-slate-700 bg-[#0b0d14] p-1.5 shadow-2xl">
                    <select
                      className="mb-1 h-7 w-full rounded bg-slate-900 border border-slate-700 text-[11px] px-1"
                      value={libraryCategory}
                      onChange={(e) => setLibraryCategory(e.target.value)}
                    >
                      <option value="all">All decorations</option>
                      {DECORATIVE_SHAPE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <Input
                      value={elementSearch}
                      onChange={(e) => setElementSearch(e.target.value)}
                      placeholder="Search ornaments…"
                      className="mb-1 h-7 bg-slate-900 border-slate-700 text-xs"
                    />
                    <div className="max-h-52 overflow-y-auto space-y-0.5">
                      {filteredDecor.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => {
                            addDecorativeShape(s.key)
                            setToolbarMenu('none')
                          }}
                          className="w-full rounded px-2 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-800"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative z-50">
                <ToolBtn title="Certificate patches" active={toolbarMenu === 'patches'} onClick={() => setToolbarMenu((m) => (m === 'patches' ? 'none' : 'patches'))}>
                  <Award className="h-3.5 w-3.5" /> Patches
                </ToolBtn>
                {toolbarMenu === 'patches' ? (
                  <div className="absolute left-0 top-full z-[60] mt-1 w-64 overflow-hidden rounded-md border border-slate-700 bg-[#0b0d14] p-1.5 shadow-2xl">
                    <p className="px-1 pb-1 text-[10px] text-slate-500">Ready badges — edit text &amp; colors after placing</p>
                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                      {CERTIFICATE_PATCHES.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => {
                            addCertificatePatch(s.key)
                            setToolbarMenu('none')
                          }}
                          className="w-full rounded px-2 py-1.5 text-left text-[11px] text-amber-100 hover:bg-amber-600/20"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {chromeTab === 'design' ? (
            <>
              <ToolBtn title="Grid" active={showGrid} onClick={() => setShowGrid((v) => !v)}><Grid3x3 className="h-3.5 w-3.5" /></ToolBtn>
              <ToolBtn title="Rulers" active={showRulers} onClick={() => setShowRulers((v) => !v)}><Ruler className="h-3.5 w-3.5" /></ToolBtn>
              <ToolBtn title="Snap (Ctrl+G)" active={snapEnabled} onClick={() => setSnapEnabled((v) => !v)}><Magnet className="h-3.5 w-3.5" /></ToolBtn>
              {!isUploadEdit ? (
                <>
                  <select
                    className="h-7 max-w-[9rem] rounded-md bg-slate-900 border border-slate-700 text-xs text-white px-1.5"
                    value={design.canvas.paperKey || 'a4-portrait'}
                    onChange={(e) => changePaperSize(e.target.value as PaperSizeKey)}
                    title="Canvas size"
                  >
                    {PAPER_SIZES.map((paper) => (
                      <option key={paper.key} value={paper.key}>{paper.label}</option>
                    ))}
                  </select>
                  <ToolBtn
                    title="Portrait"
                    active={String(design.canvas.paperKey || '').includes('portrait')}
                    onClick={() => {
                      const key = String(design.canvas.paperKey || 'a4-portrait')
                      const nextKey = (key.includes('letter') ? 'letter-portrait' : 'a4-portrait') as PaperSizeKey
                      changePaperSize(nextKey)
                    }}
                  >
                    <RectangleVertical className="h-3.5 w-3.5" />
                  </ToolBtn>
                  <ToolBtn
                    title="Landscape"
                    active={String(design.canvas.paperKey || '').includes('landscape')}
                    onClick={() => {
                      const key = String(design.canvas.paperKey || 'a4-portrait')
                      const nextKey = (key.includes('letter') ? 'letter-landscape' : 'a4-landscape') as PaperSizeKey
                      changePaperSize(nextKey)
                    }}
                  >
                    <RectangleHorizontal className="h-3.5 w-3.5" />
                  </ToolBtn>
                  {design.canvas.paperKey === 'custom' ? (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Input className="h-7 w-14 bg-slate-900 border-slate-700 text-xs" type="number" min={80} value={Math.round(pdfMm.wmm)} onChange={(e) => applyCustomSizeMm(Number(e.target.value) || pdfMm.wmm, pdfMm.hmm)} />
                      ×
                      <Input className="h-7 w-14 bg-slate-900 border-slate-700 text-xs" type="number" min={80} value={Math.round(pdfMm.hmm)} onChange={(e) => applyCustomSizeMm(pdfMm.wmm, Number(e.target.value) || pdfMm.hmm)} />
                    </span>
                  ) : null}
                  <Input
                    type="color"
                    title="Page background"
                    value={/^#[0-9a-fA-F]{6}$/i.test(design.canvas.background || '') ? (design.canvas.background as string) : '#ffffff'}
                    onChange={(e) => {
                      const next = cloneDesign(design)
                      next.canvas.background = e.target.value
                      pushHistory(next)
                    }}
                    className="h-7 w-8 bg-slate-900 border-slate-700 p-0.5"
                  />
                  <button type="button" className="h-6 w-6 rounded border border-slate-600" style={{ background: brandPrimary }} title="Brand primary" onClick={() => {
                    const next = cloneDesign(design)
                    next.canvas.background = brandPrimary
                    pushHistory(next)
                  }} />
                  <button type="button" className="h-6 w-6 rounded border border-slate-600" style={{ background: brandAccent }} title="Brand accent" onClick={() => {
                    const next = cloneDesign(design)
                    next.canvas.background = brandAccent
                    pushHistory(next)
                  }} />
                  <ToolBtn title="New blank" onClick={handleNewBlank}><FilePlus className="h-3.5 w-3.5" /></ToolBtn>
                  <div className="relative z-50">
                    <ToolBtn
                      title="Starter templates"
                      active={starterOpen}
                      onClick={() => {
                        setToolbarMenu('none')
                        setStarterOpen((v) => !v)
                      }}
                    >
                      <LayoutTemplate className="h-3.5 w-3.5" /> Starters
                    </ToolBtn>
                    {starterOpen ? (
                      <div className="absolute left-0 top-full z-[60] mt-1 w-56 overflow-hidden rounded-md border border-slate-700 bg-[#0b0d14] p-1 shadow-2xl">
                        <button type="button" className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800" onClick={() => applyStarterLayout('a4-portrait')}>Classic A4 Portrait</button>
                        <button type="button" className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800" onClick={() => applyStarterLayout('a4-landscape')}>Classic A4 Landscape</button>
                        <button type="button" className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800" onClick={() => applyStarterLayout('letter-portrait')}>Classic Letter</button>
                        <button type="button" className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-800" onClick={handleNewBlank}>Blank canvas</button>
                      </div>
                    ) : null}
                  </div>
                  <ToolBtn title="Open saved design" disabled={loadingSaved || !hasSavedDesign} onClick={() => loadSavedDesignFromServer()}>Saved</ToolBtn>
                  <div className="relative z-50">
                    <ToolBtn title="Fonts" active={toolbarMenu === 'fonts'} onClick={() => setToolbarMenu((m) => (m === 'fonts' ? 'none' : 'fonts'))}>
                      <Type className="h-3.5 w-3.5" /> Fonts
                    </ToolBtn>
                    {toolbarMenu === 'fonts' ? (
                      <div className="absolute left-0 top-full z-[60] mt-1 max-h-64 w-52 overflow-y-auto rounded-md border border-slate-700 bg-[#0b0d14] p-1 shadow-2xl">
                        {BUILDER_FONT_FAMILIES.map((f) => (
                          <button
                            key={f}
                            type="button"
                            className="w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-slate-800"
                            style={{ fontFamily: f }}
                            onClick={() => {
                              if (selected?.type === 'text') updateSelected({ fontFamily: f })
                              setToolbarMenu('none')
                            }}
                          >
                            {builderFontLabel(f)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
              <div className="relative z-50">
                <ToolBtn title="Layers" active={toolbarMenu === 'layers'} onClick={() => setToolbarMenu((m) => (m === 'layers' ? 'none' : 'layers'))}>
                  <Layers className="h-3.5 w-3.5" /> Layers
                </ToolBtn>
                {toolbarMenu === 'layers' ? (
                  <div className="absolute left-0 top-full z-[60] mt-1 w-72 overflow-hidden rounded-md border border-slate-700 bg-[#0b0d14] p-1.5 shadow-2xl">
                    <p className="px-1 pb-1 text-[10px] text-slate-500">Layers ({design.elements.length})</p>
                    <div className="max-h-72 overflow-y-auto">
                      {design.elements
                        .slice()
                        .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
                        .map((el) => {
                          const groupMembers = el.groupId
                            ? design.elements.filter((e) => e.groupId === el.groupId)
                            : []
                          const topInGroup =
                            groupMembers.length > 1
                              ? [...groupMembers].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))[0]
                              : null
                          const isGroupRep =
                            !!el.groupId &&
                            !!topInGroup &&
                            topInGroup.id === el.id &&
                            enteredGroupId !== el.groupId
                          if (
                            el.groupId &&
                            groupMembers.length > 1 &&
                            enteredGroupId !== el.groupId &&
                            !isGroupRep
                          ) {
                            return null
                          }
                          const layerLabel = isGroupRep
                            ? getGroupLabel(el.groupId!, design.elements)
                            : getBuilderLayerLabel(el)
                          return (
                            <div
                              key={el.id}
                              className={`flex items-center gap-1 rounded px-1 py-0.5 ${
                                el.id === selectedId || (isGroupRep && activeGroupId === el.groupId)
                                  ? 'bg-indigo-600/30'
                                  : 'hover:bg-slate-800/80'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedId(el.id)
                                  if (isGroupRep) {
                                    setActiveGroupId(el.groupId!)
                                    setEnteredGroupId(null)
                                  } else {
                                    setActiveGroupId(null)
                                  }
                                }}
                                className={`min-w-0 flex-1 truncate text-left text-[11px] ${el.hidden ? 'opacity-40 line-through' : ''} ${el.id === selectedId ? 'text-white' : 'text-slate-400'}`}
                              >
                                {isGroupRep ? `▸ ${layerLabel}` : layerLabel}
                                {el.locked ? ' 🔒' : ''}
                              </button>
                              <button
                                type="button"
                                className="p-1 text-slate-500 hover:text-slate-200"
                                onClick={() => {
                                  const next = cloneDesign(design)
                                  if (isGroupRep && el.groupId) {
                                    next.elements = next.elements.map((e) =>
                                      e.groupId === el.groupId ? { ...e, hidden: !el.hidden } : e,
                                    )
                                  } else {
                                    next.elements = next.elements.map((e) =>
                                      e.id === el.id ? { ...e, hidden: !e.hidden } : e,
                                    )
                                  }
                                  pushHistory(next)
                                }}
                              >
                                {el.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {chromeTab === 'format' ? (
            !selected ? (
              <span className="text-[11px] text-slate-500">Select an item on the page to format it.</span>
            ) : (
              <>
                <span className="max-w-[7rem] truncate text-[11px] font-medium text-slate-300">{getBuilderLayerLabel(selected)}</span>
                <Input
                  value={selected.name || ''}
                  placeholder="Layer name"
                  onChange={(e) => updateSelected({ name: e.target.value })}
                  className="h-7 w-24 bg-slate-900 border-slate-700 text-xs"
                />
                <ToolBtn title="Align left" onClick={() => alignSelected('left')}><AlignLeft className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn title="Align center" onClick={() => alignSelected('center')}><AlignCenter className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn title="Align right" onClick={() => alignSelected('right')}><AlignRight className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn title="Center on page" onClick={() => alignSelected('page-center')}>Center</ToolBtn>
                <ToolBtn title="Duplicate (Ctrl+D)" disabled={!selected || selectedIsQr} onClick={duplicateSelected}><Copy className="h-3.5 w-3.5" /></ToolBtn>
                <ToolBtn title="Delete" disabled={!selected || selected?.locked || selectedIsPaper} onClick={deleteSelected}><Trash2 className="h-3.5 w-3.5" /></ToolBtn>
                <span className="text-[10px] text-slate-500">X</span>
                <Input type="number" value={Math.round(selected.x)} onChange={(e) => updateSelected({ x: Number(e.target.value) || 0 })} className="h-7 w-12 bg-slate-900 border-slate-700 text-xs" />
                <span className="text-[10px] text-slate-500">Y</span>
                <Input type="number" value={Math.round(selected.y)} onChange={(e) => updateSelected({ y: Number(e.target.value) || 0 })} className="h-7 w-12 bg-slate-900 border-slate-700 text-xs" />
                <span className="text-[10px] text-slate-500">W</span>
                <Input type="number" min={8} value={Math.round(selected.width)} onChange={(e) => updateSelected({ width: Math.max(8, Number(e.target.value) || 8) })} className="h-7 w-12 bg-slate-900 border-slate-700 text-xs" />
                <span className="text-[10px] text-slate-500">H</span>
                <Input type="number" min={8} value={Math.round(selected.height)} onChange={(e) => updateSelected({ height: Math.max(8, Number(e.target.value) || 8) })} className="h-7 w-12 bg-slate-900 border-slate-700 text-xs" />
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={((selected.rotation || 0) % 360 + 360) % 360}
                  onChange={(e) => updateSelected({ rotation: Number(e.target.value) })}
                  className="w-16 accent-violet-600"
                  title="Rotate"
                />
                <Input type="number" step={0.5} value={selected.rotation || 0} onChange={(e) => updateSelected({ rotation: Number(e.target.value) || 0 })} className="h-7 w-12 bg-slate-900 border-slate-700 text-xs" />
                <span className="text-[10px] text-slate-500">°</span>
                <Input type="number" min={0} max={1} step={0.1} title="Opacity" value={selected.opacity ?? 1} onChange={(e) => updateSelected({ opacity: Number(e.target.value) || 1 })} className="h-7 w-11 bg-slate-900 border-slate-700 text-xs" />
                {selectedIsQr ? (
                  <Badge className="bg-amber-600/20 text-amber-200 border-amber-700/40">Verify QR</Badge>
                ) : isCertificatePatchElement(selected) ? (
                  <>
                    <Input
                      value={selected.text || ''}
                      onChange={(e) => updateSelected({ text: e.target.value })}
                      placeholder="Patch text"
                      className="h-7 w-36 bg-slate-900 border-slate-700 text-xs"
                    />
                    <Input type="color" title="Patch color" value={selected.fill === 'transparent' ? '#002147' : selected.fill || '#002147'} onChange={(e) => updateSelected({ fill: e.target.value })} className="h-7 w-7 bg-slate-900 border-slate-700 p-0.5" />
                    <Input type="color" title="Accent" value={selected.stroke || '#c9a227'} onChange={(e) => updateSelected({ stroke: e.target.value })} className="h-7 w-7 bg-slate-900 border-slate-700 p-0.5" />
                    <Input type="color" title="Text color" value={selected.color || '#ffffff'} onChange={(e) => updateSelected({ color: e.target.value })} className="h-7 w-7 bg-slate-900 border-slate-700 p-0.5" />
                  </>
                ) : selected.type === 'text' ? (
                  <>
                    <Input value={selected.text || ''} onChange={(e) => updateSelected({ text: e.target.value })} placeholder="Text" className="h-7 w-32 bg-slate-900 border-slate-700 text-xs" />
                    <select className="h-7 max-w-[8rem] rounded-md bg-slate-900 border border-slate-700 text-xs text-white px-1" value={selected.bind || 'none'} onChange={(e) => updateSelected({ bind: e.target.value as BuilderElement['bind'] })}>
                      {[{ key: 'none', label: 'Static' }, ...getDocumentBuilderQuickFields(docType)].map((b) => (
                        <option key={b.key} value={b.key}>{b.label}</option>
                      ))}
                    </select>
                    <select className="h-7 max-w-[7rem] rounded-md bg-slate-900 border border-slate-700 text-xs text-white px-1" value={selected.fontFamily} onChange={(e) => updateSelected({ fontFamily: e.target.value })}>
                      {BUILDER_FONT_FAMILIES.map((f) => (
                        <option key={f} value={f}>{builderFontLabel(f)}</option>
                      ))}
                    </select>
                    <Input type="number" min={8} max={200} value={selected.fontSize || 16} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) || 16 })} className="h-7 w-12 bg-slate-900 border-slate-700 text-xs" title="Size" />
                    <Input type="color" value={selected.color || '#0f172a'} onChange={(e) => updateSelected({ color: e.target.value })} className="h-7 w-7 bg-slate-900 border-slate-700 p-0.5" />
                    <ToolBtn title="Bold" active={selected.fontWeight === 'bold'} onClick={() => updateSelected({ fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold' })}><Bold className="h-3.5 w-3.5" /></ToolBtn>
                    <ToolBtn title="Italic" active={selected.fontStyle === 'italic'} onClick={() => updateSelected({ fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic className="h-3.5 w-3.5" /></ToolBtn>
                    <ToolBtn title="Underline" active={selected.textDecoration === 'underline'} onClick={() => updateSelected({ textDecoration: selected.textDecoration === 'underline' ? 'none' : 'underline' })}><Underline className="h-3.5 w-3.5" /></ToolBtn>
                  </>
                ) : (selected.type === 'rect' || selected.type === 'ellipse' || selected.type === 'line' || isDecorativeElement(selected)) ? (
                  <>
                    <Input type="color" title="Fill" value={selected.fill === 'transparent' ? '#ffffff' : selected.fill || '#002147'} onChange={(e) => updateSelected({ fill: e.target.value })} className="h-7 w-7 bg-slate-900 border-slate-700 p-0.5" />
                    <Input type="color" title="Stroke" value={selected.stroke || '#c9a227'} onChange={(e) => updateSelected({ stroke: e.target.value })} className="h-7 w-7 bg-slate-900 border-slate-700 p-0.5" />
                  </>
                ) : selected.type === 'image' && !selectedIsPaper ? (
                  <Button type="button" size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => document.getElementById('replace-builder-image')?.click()}>Replace</Button>
                ) : null}
                {selected.groupId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      if (enteredGroupId === selected.groupId) {
                        setEnteredGroupId(null)
                        setActiveGroupId(selected.groupId!)
                      } else {
                        setEnteredGroupId(selected.groupId!)
                        setActiveGroupId(null)
                      }
                    }}
                  >
                    {enteredGroupId === selected.groupId ? 'Exit group' : 'Enter group'}
                  </Button>
                ) : null}
              </>
            )
          ) : null}

        </div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          id="replace-builder-image"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file || !selectedId) return
            try {
              const { signedUrl, path } = await uploadCertificateBuilderImage(file)
              updateSelected({ src: path })
              if (signedUrl) {
                setResolvedImageUrls((prev) => ({ ...prev, [selectedId]: signedUrl }))
              }
            } catch (err) {
              toast({
                title: 'Replace failed',
                description: getUserMessage(err, {
                  fallback: { title: 'Replace failed', description: 'Could not upload the new image.' },
                }),
                variant: 'destructive',
              })
            }
          }}
        />
      </div>

      <div className="relative z-0 flex h-[calc(100vh-8.5rem)] min-h-[520px] min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <div
            ref={workspaceRef}
            className={`relative min-h-0 flex-1 bg-[var(--builder-desk)] ${
              zoomMode === 'page' ? 'overflow-hidden' : 'overflow-auto'
            }`}
          >
            <div
              className={`flex w-full justify-center p-3 ${
                zoomMode === 'page' ? 'h-full items-center' : 'min-h-full items-start'
              }`}
            >
          <div
            ref={canvasRef}
            tabIndex={0}
            className="relative overflow-visible touch-none bg-white outline-none shadow-2xl ring-1 ring-black/40 focus:ring-2 focus:ring-violet-500/50"
            style={{
              width: design.canvas.width * zoom,
              height: design.canvas.height * zoom,
              backgroundColor: design.canvas.background || '#ffffff',
              backgroundImage: showGrid
                ? `linear-gradient(to right, rgba(15,23,42,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.08) 1px, transparent 1px)`
                : undefined,
              backgroundSize: showGrid
                ? `${(8 / design.canvas.width) * design.canvas.width * zoom}px ${(8 / design.canvas.height) * design.canvas.height * zoom}px`
                : undefined,
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => {
              setSelectedId(null)
              setActiveGroupId(null)
              setStarterOpen(false)
              setToolbarMenu('none')
            }}
          >
            {guides.x != null ? (
              <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-violet-400/80" style={{ left: `${(guides.x / design.canvas.width) * 100}%` }} />
            ) : null}
            {guides.y != null ? (
              <div className="pointer-events-none absolute left-0 right-0 h-px bg-violet-400/80" style={{ top: `${(guides.y / design.canvas.height) * 100}%` }} />
            ) : null}
            {design.elements
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .filter((el) => !el.hidden)
              .map((el) => {
                const isSel = selectedIds.includes(el.id) || el.id === selectedId
                const inActiveGroup = !!(
                  activeGroupId &&
                  el.groupId === activeGroupId &&
                  enteredGroupId !== activeGroupId
                )
                const isQr = isQrElement(el)
                const decorMeta = el.decorKey
                  ? DECORATIVE_SHAPES.find((s) => s.key === el.decorKey)
                  : undefined
                const isFullPageDecor = !!(decorMeta && 'fullPage' in decorMeta && decorMeta.fullPage)
                const isBgArt = isBackgroundArtElement(el)
                const isPageFrame = isPageFrameElement(el, design.canvas)
                return (
                  <div
                    key={el.id}
                    onPointerDown={isPageFrame || isBgArt ? undefined : (e) => onPointerDown(e, el.id, 'move')}
                    onClick={isPageFrame || isBgArt ? undefined : (e) => e.stopPropagation()}
                    className={`absolute ${
                      el.locked ? 'cursor-default' : isPageFrame ? 'cursor-default' : 'cursor-move'
                    } ${
                      isSel
                        ? isQr
                          ? 'ring-2 ring-amber-400'
                          : 'ring-2 ring-violet-500'
                        : inActiveGroup
                          ? 'ring-2 ring-sky-400/80'
                          : isPageFrame
                            ? 'ring-1 ring-transparent'
                            : 'ring-1 ring-transparent hover:ring-slate-300'
                    }`}
                    style={{
                      left: `${(el.x / design.canvas.width) * 100}%`,
                      top: `${(el.y / design.canvas.height) * 100}%`,
                      width: `${(el.width / design.canvas.width) * 100}%`,
                      height: `${(el.height / design.canvas.height) * 100}%`,
                      transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                      zIndex: el.zIndex,
                      opacity: el.opacity ?? 1,
                      pointerEvents: isPageFrame || isBgArt ? 'none' : undefined,
                      background:
                        el.fillGradient && (el.type === 'rect' || el.type === 'ellipse')
                          ? `linear-gradient(${el.fillGradient.angle ?? 180}deg, ${el.fillGradient.from}, ${el.fillGradient.to})`
                          : el.type === 'rect' || el.type === 'ellipse'
                          ? el.fill || 'transparent'
                          : el.type === 'line'
                            ? el.stroke || '#002147'
                            : isQr
                              ? '#fff'
                              : 'transparent',
                      border:
                        el.type === 'rect' || el.type === 'ellipse'
                          ? `${el.strokeWidth || 1}px solid ${el.stroke || 'transparent'}`
                          : isQr
                            ? '1px dashed #f59e0b'
                            : undefined,
                      borderRadius: el.type === 'ellipse' ? '50%' : undefined,
                      color: el.color,
                      fontFamily: el.fontFamily,
                      fontSize: Math.max(6, (el.fontSize || 16) * zoom),
                      fontWeight: el.fontWeight,
                      fontStyle: el.fontStyle,
                      textDecoration: el.textDecoration,
                      letterSpacing: el.letterSpacing ? `${el.letterSpacing * zoom * 0.35}px` : undefined,
                      textAlign: el.textAlign,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent:
                        el.textAlign === 'left'
                          ? 'flex-start'
                          : el.textAlign === 'right'
                            ? 'flex-end'
                            : 'center',
                      overflow: isPageFrame || isSel ? 'visible' : 'hidden',
                      padding: 2,
                      userSelect: 'none',
                    }}
                  >
                    {isPageFrame && !el.locked ? (
                      <>
                        <span
                          className="absolute inset-x-0 top-0 z-20 min-h-[22px] cursor-move"
                          style={{ height: '9%', pointerEvents: 'auto' }}
                          title="Drag to move · Delete to remove"
                          onPointerDown={(e) => onPointerDown(e, el.id, 'move')}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span
                          className="absolute inset-x-0 bottom-0 z-20 min-h-[22px] cursor-move"
                          style={{ height: '9%', pointerEvents: 'auto' }}
                          title="Drag to move · Delete to remove"
                          onPointerDown={(e) => onPointerDown(e, el.id, 'move')}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span
                          className="absolute inset-y-0 left-0 z-20 min-w-[22px] cursor-move"
                          style={{ width: '9%', pointerEvents: 'auto' }}
                          title="Drag to move · Delete to remove"
                          onPointerDown={(e) => onPointerDown(e, el.id, 'move')}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span
                          className="absolute inset-y-0 right-0 z-20 min-w-[22px] cursor-move"
                          style={{ width: '9%', pointerEvents: 'auto' }}
                          title="Drag to move · Delete to remove"
                          onPointerDown={(e) => onPointerDown(e, el.id, 'move')}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </>
                    ) : null}
                    {el.type === 'image' && imageSrcFor(el) ? (
                      <img src={imageSrcFor(el)} alt="" className={`w-full h-full pointer-events-none ${isPageFrame ? 'object-fill' : 'object-contain'}`} />
                    ) : el.type === 'image' ? (
                      <span className="w-full text-center text-[9px] text-slate-400">Image</span>
                    ) : isQr ? (
                      <span className="w-full text-center text-[10px] font-semibold text-amber-700">QR</span>
                    ) : el.type === 'text' ? (
                      <span
                        className="w-full px-1"
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: el.lineHeight || 1.15,
                          overflow: 'hidden',
                          maxHeight: '100%',
                        }}
                      >
                        {editorLabelFor(el)}
                      </span>
                    ) : null}
                    {isSel && !el.locked ? (
                      <>
                        {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                          <span
                            key={h}
                            className={`absolute z-30 rounded-sm cursor-${h}-resize ${
                              isPageFrame ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'
                            } ${
                              isQr ? 'bg-amber-500' : 'bg-violet-500'
                            } ${
                              h === 'nw'
                                ? '-top-1 -left-1'
                                : h === 'ne'
                                  ? '-top-1 -right-1'
                                  : h === 'sw'
                                    ? '-bottom-1 -left-1'
                                    : '-bottom-1 -right-1'
                            }`}
                            style={{ pointerEvents: 'auto' }}
                            onPointerDown={(e) => onPointerDown(e, el.id, 'resize', h)}
                          />
                        ))}
                        <span
                          className="absolute -top-8 left-1/2 z-30 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full bg-violet-500 text-[10px] text-white shadow"
                          title="Drag to rotate — hold Shift to snap 15°"
                          style={{ pointerEvents: 'auto' }}
                          onPointerDown={(e) => onPointerDown(e, el.id, 'rotate')}
                        >
                          ↻
                        </span>
                      </>
                    ) : null}
                  </div>
                )
              })}
          </div>
            </div>
          </div>
        </div>

      </div>


        {previewOpen ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-slate-300">Preview</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
                  Same as issued
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={downloadingPdf}
                  onClick={() => handleDownloadPdf()}
                >
                  {downloadingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1" />
                  )}
                  Download full PDF
                </Button>
              </div>
            </div>
            <div className="mx-auto w-full max-w-xl bg-white rounded-md overflow-hidden shadow-lg border border-slate-700">
              <CertificateCanvas data={sampleData} />
            </div>
          </div>
        ) : null}
    </div>
  )
}

export default CertificateLogoPageBuilder
