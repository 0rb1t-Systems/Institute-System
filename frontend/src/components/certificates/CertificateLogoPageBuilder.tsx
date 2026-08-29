import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BringToFront,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePlus,
  Frame,
  ImagePlus,
  Italic,
  LayoutTemplate,
  Loader2,
  Lock,
  Unlock,
  Redo2,
  Save,
  SendToBack,
  Square,
  Circle,
  Minus,
  Trash2,
  Type,
  Undo2,
  QrCode,
  ChevronDown,
  Shapes,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  applyPaperSize,
  createBoundTextElement,
  createBorderFrameElements,
  createDecorativeShapeElement,
  createDefaultBuilderDesign,
  createElementId,
  createStarterDocumentDesign,
  createVerificationQrElement,
  hasVerificationQr,
  isDecorativeElement,
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

const MAX_HISTORY = 40

function cloneDesign(d: LogoBuilderDesign): LogoBuilderDesign {
  return JSON.parse(JSON.stringify(d)) as LogoBuilderDesign
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
  const [shapesOpen, setShapesOpen] = useState(false)
  const [insertTab, setInsertTab] = useState<'text' | 'shapes' | 'images'>('text')
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
    /** Snapshot of group member origins when moving a group */
    groupOrigins?: Array<{ id: string; x: number; y: number }>
    mode: 'move' | 'resize'
  } | null>(null)
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

  const addElement = (type: BuilderElementType) => {
    const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const base: BuilderElement = {
      id: createElementId(),
      type,
      x: 80 + (design.elements.length % 5) * 24,
      y: 160 + (design.elements.length % 5) * 24,
      width: type === 'line' ? 400 : type === 'text' ? 420 : 160,
      height: type === 'line' ? 4 : type === 'text' ? 48 : 120,
      rotation: 0,
      zIndex: z,
      text: type === 'text' ? 'Type anything…' : undefined,
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 22,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#0f172a',
      fill: type === 'rect' || type === 'ellipse' ? '#e2e8f0' : 'transparent',
      stroke: '#002147',
      strokeWidth: 2,
      opacity: 1,
      bind: 'none',
    }
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
    setShapesOpen(false)
    toast({
      title: 'Decoration added',
      description: 'Rotate, recolor, move, or resize on the page.',
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
  }

  const applyStarterLayout = () => {
    if (design.elements.length > 0) {
      const ok = window.confirm(
        `Replace the current design with a ready ${docLabel.toLowerCase()} starter layout? You can still edit everything after.`,
      )
      if (!ok) return
    }
    const starter = createStarterDocumentDesign(
      docType,
      (design.canvas.paperKey as PaperSizeKey) || 'a4-portrait',
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
        setShapesOpen(false)
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
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
    pushHistory(applyPaperSize(design, paperKey))
  }

  const alignSelected = (mode: 'h-center' | 'v-center' | 'page-center') => {
    if (!selected) return
    const { width: cw, height: ch } = design.canvas
    let x = selected.x
    let y = selected.y
    if (mode === 'h-center' || mode === 'page-center') x = Math.max(0, (cw - selected.width) / 2)
    if (mode === 'v-center' || mode === 'page-center') y = Math.max(0, (ch - selected.height) / 2)
    updateSelected({ x, y })
  }

  const bring = (dir: 'front' | 'back') => {
    if (!selectedId) return
    const next = cloneDesign(design)
    const zs = next.elements.map((e) => e.zIndex || 0)
    const max = Math.max(...zs, 0)
    const min = Math.min(...zs, 0)
    next.elements = next.elements.map((e) => {
      if (e.id !== selectedId) return e
      return { ...e, zIndex: dir === 'front' ? max + 1 : min - 1 }
    })
    pushHistory(next)
  }

  const onPointerDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.stopPropagation()
    e.preventDefault()
    // Keep keyboard focus on canvas so Delete/Backspace works without using Layers
    canvasRef.current?.focus?.()
    const el = design.elements.find((x) => x.id === id)
    if (!el || !canvasRef.current || el.hidden) return
    setSelectedId(id)

    // Grouped: first click selects group (move together); Enter group for individuals
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

    const groupOrigins =
      inGroup && el.groupId
        ? design.elements
            .filter((x) => x.groupId === el.groupId && !x.locked)
            .map((x) => ({ id: x.id, x: x.x, y: x.y }))
        : undefined

    dragRef.current = {
      id,
      groupId: inGroup ? el.groupId : null,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
      groupOrigins,
      mode: inGroup && mode === 'resize' ? 'move' : mode,
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
    setDesign((prev) => {
      const next = cloneDesign(prev)
      if (drag.mode === 'move' && drag.groupOrigins?.length) {
        const byId = new Map(drag.groupOrigins.map((g) => [g.id, g]))
        next.elements = next.elements.map((el) => {
          const orig = byId.get(el.id)
          if (!orig) return el
          return {
            ...el,
            x: Math.max(0, Math.min(prev.canvas.width - 20, orig.x + dx)),
            y: Math.max(0, Math.min(prev.canvas.height - 20, orig.y + dy)),
          }
        })
        return normalizeVerificationQr(next)
      }
      next.elements = next.elements.map((el) => {
        if (el.id !== drag.id) return el
        if (drag.mode === 'resize') {
          return {
            ...el,
            width: Math.max(isQrElement(el) ? 64 : 16, drag.origW + dx),
            height: Math.max(isQrElement(el) ? 64 : 16, drag.origH + dy),
          }
        }
        return {
          ...el,
          x: Math.max(0, Math.min(prev.canvas.width - 20, drag.origX + dx)),
          y: Math.max(0, Math.min(prev.canvas.height - 20, drag.origY + dy)),
        }
      })
      return normalizeVerificationQr(next)
    })
  }

  const onPointerUp = () => {
    if (!dragRef.current) return
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), cloneDesign(design)]
    futureRef.current = []
    dragRef.current = null
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

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2 pt-4 px-4 space-y-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <CardTitle className="text-white text-base">
              {isUploadEdit ? 'Edit uploaded design' : 'Page builder'}
            </CardTitle>
            {activeLayout === 'logo_builder' ? (
              <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40 text-[10px]">
                Active
              </Badge>
            ) : hasSavedDesign ? (
              <Badge className="bg-amber-600/20 text-amber-200 border-amber-700/40 text-[10px]">
                Draft
              </Badge>
            ) : null}
            {isUploadEdit ? (
              <Badge className="bg-indigo-600/25 text-indigo-200 border-indigo-500/40 text-[10px]">
                Editable template
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="h-8 border-slate-600 text-slate-200"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="h-8 bg-indigo-600 hover:bg-indigo-500"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save & use
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs text-slate-500 mt-1">
          {isUploadEdit
            ? 'Drag · resize · bind fields · then Save & use'
            : 'Paper · insert · brand · edit — canvas is the page'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 pt-0">
        {/* Compact tools: Page + Brand + Edit */}
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/90 px-1.5 py-1"
          title={
            isUploadEdit
              ? 'Del · drag · Ctrl+Z · Esc exits group'
              : 'Del · Ctrl+C/X/V/D · Ctrl+Z/Y · arrows'
          }
        >
          {!isUploadEdit ? (
            <>
              <select
                className="h-7 rounded-md bg-slate-900 border border-slate-700 text-xs text-white px-1.5 max-w-[9rem]"
                value={design.canvas.paperKey || 'a4-portrait'}
                onChange={(e) => changePaperSize(e.target.value as PaperSizeKey)}
                title="Paper size"
              >
                {PAPER_SIZES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={handleNewBlank} title="New blank">
                <FilePlus className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={applyStarterLayout} title="Starter layout">
                <LayoutTemplate className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-indigo-300"
                disabled={loadingSaved || !hasSavedDesign}
                onClick={() => loadSavedDesignFromServer()}
                title="Open saved design"
              >
                Saved
              </Button>
              <span className="w-px h-4 bg-slate-700 mx-0.5" />
            </>
          ) : null}

          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => addInstitutionAsset('logo')} title="Logo">
            Logo
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => addInstitutionAsset('seal')} title="Stamp">
            Stamp
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => addInstitutionAsset('signature')} title="Signature">
            Sign
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`h-7 px-2 ${hasVerificationQr(design) ? 'text-amber-200' : ''}`}
            onClick={() => {
              if (hasVerificationQr(design)) {
                const existing = design.elements.find((e) => isQrElement(e))
                if (existing) setSelectedId(existing.id)
                return
              }
              addVerificationQr()
            }}
            title={
              hasVerificationQr(design)
                ? 'QR already on page — click to select'
                : 'Add verification QR'
            }
          >
            <QrCode className="h-3.5 w-3.5" />
          </Button>

          <span className="w-px h-4 bg-slate-700 mx-0.5" />

          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={undo} title="Undo (Ctrl+Z)">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={redo} title="Redo (Ctrl+Y)">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            disabled={!selected || selectedIsQr}
            onClick={duplicateSelected}
            title="Duplicate (Ctrl+D)"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            disabled={!selected}
            onClick={() => bring('front')}
            title="Bring to front"
          >
            <BringToFront className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            disabled={!selected}
            onClick={() => bring('back')}
            title="Send to back"
          >
            <SendToBack className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            disabled={!selected || selected?.locked || selectedIsPaper}
            onClick={deleteSelected}
            title={
              selected?.locked || selectedIsPaper
                ? 'Unlock before deleting'
                : 'Delete (Del / Backspace)'
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>

          <span className="w-px h-4 bg-slate-700 mx-0.5" />

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setPreviewOpen((v) => !v)}
            title="Preview"
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Preview
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            disabled={downloadingPdf}
            onClick={() => handleDownloadPdf()}
            title="Download PDF"
          >
            {downloadingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1" />
            )}
            PDF
          </Button>
        </div>

        {/* Insert: Text | Shapes | Images */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/90 overflow-hidden">
          <div className="flex border-b border-slate-800">
            {(
              [
                ['text', 'Text', Type],
                ['shapes', 'Shapes', Shapes],
                ['images', 'Images', ImagePlus],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setInsertTab(key)
                  setShapesOpen(false)
                }}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                  insertTab === key
                    ? 'bg-indigo-600/25 text-indigo-200 border-b-2 border-indigo-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="p-1.5 flex flex-wrap items-center gap-1">
            {insertTab === 'text' ? (
              <>
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => addElement('text')}>
                  <Type className="h-3.5 w-3.5 mr-1" /> Free text
                </Button>
                {getDocumentBuilderQuickFields(docType).map((f) => (
                  <Button
                    key={f.key}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] border-slate-700 text-slate-300"
                    onClick={() => addBoundField(f.key)}
                  >
                    {f.label}
                  </Button>
                ))}
              </>
            ) : null}
            {insertTab === 'shapes' ? (
              <>
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={addBorderFrame}>
                  <Frame className="h-3.5 w-3.5 mr-1" /> Border
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => addElement('rect')}>
                  <Square className="h-3.5 w-3.5 mr-1" /> Box
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => addElement('ellipse')}>
                  <Circle className="h-3.5 w-3.5 mr-1" /> Circle
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => addElement('line')}>
                  <Minus className="h-3.5 w-3.5 mr-1" /> Line
                </Button>
                <div className="relative">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={() => setShapesOpen((v) => !v)}
                  >
                    More
                    <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
                  </Button>
                  {shapesOpen ? (
                    <div className="absolute left-0 top-full mt-1 z-30 w-80 max-h-96 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 shadow-xl p-1">
                      {DECORATIVE_SHAPE_CATEGORIES.map((cat) => (
                        <div key={cat.id}>
                          <p className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-amber-400/80">
                            {cat.label}
                          </p>
                          {DECORATIVE_SHAPES.filter((s) => s.category === cat.id).map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              className="w-full text-left px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800 rounded"
                              onClick={() => {
                                addDecorativeShape(s.key)
                                setShapesOpen(false)
                              }}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
            {insertTab === 'images' ? (
              <>
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
                <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="h-3.5 w-3.5 mr-1" /> Image
                </Button>
                {!isUploadEdit ? (
                  <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => bgFileRef.current?.click()}>
                    Background
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
          <div
            ref={canvasRef}
            tabIndex={0}
            className="relative mx-auto w-full max-w-2xl rounded border border-slate-700 overflow-hidden touch-none shadow-inner bg-white outline-none focus:ring-2 focus:ring-indigo-500/40"
            style={{
              aspectRatio: `${design.canvas.width}/${design.canvas.height}`,
              backgroundColor: design.canvas.background || '#ffffff',
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => {
              setSelectedId(null)
              setActiveGroupId(null)
              setShapesOpen(false)
            }}
          >
            {design.elements
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .filter((el) => !el.hidden)
              .map((el) => {
                const isSel = el.id === selectedId
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
                return (
                  <div
                    key={el.id}
                    onPointerDown={(e) => onPointerDown(e, el.id, 'move')}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute ${
                      el.locked ? 'cursor-default' : 'cursor-move'
                    } ${
                      isSel
                        ? isQr
                          ? 'ring-2 ring-amber-400'
                          : 'ring-2 ring-indigo-500'
                        : inActiveGroup
                          ? 'ring-2 ring-sky-400/80'
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
                      // Background art / full-page frames must not steal clicks from logo, seal, text
                      pointerEvents: (isFullPageDecor || isBgArt) && !isSel ? 'none' : undefined,
                      background:
                        el.type === 'rect' || el.type === 'ellipse'
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
                      fontSize: Math.max(8, (el.fontSize || 16) * 0.55),
                      fontWeight: el.fontWeight,
                      fontStyle: el.fontStyle,
                      textAlign: el.textAlign,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent:
                        el.textAlign === 'left'
                          ? 'flex-start'
                          : el.textAlign === 'right'
                            ? 'flex-end'
                            : 'center',
                      overflow: 'hidden',
                      padding: 2,
                      userSelect: 'none',
                    }}
                  >
                    {el.type === 'image' && imageSrcFor(el) ? (
                      <img src={imageSrcFor(el)} alt="" className="w-full h-full object-contain pointer-events-none" />
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
                          lineHeight: 1.15,
                          overflow: 'hidden',
                          maxHeight: '100%',
                        }}
                      >
                        {editorLabelFor(el)}
                      </span>
                    ) : null}
                    {isSel && !el.locked ? (
                      <span
                        className={`absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-sm cursor-se-resize ${
                          isQr ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}
                        onPointerDown={(e) => onPointerDown(e, el.id, 'resize')}
                      />
                    ) : null}
                  </div>
                )
              })}
          </div>

          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950 p-2.5">
            {!isUploadEdit ? (
              <div className="space-y-1">
                <Label className="text-xs text-slate-400">Page background</Label>
                <Input
                  type="color"
                  value={design.canvas.background || '#ffffff'}
                  onChange={(e) => {
                    const next = cloneDesign(design)
                    next.canvas.background = e.target.value
                    pushHistory(next)
                  }}
                  className="bg-slate-900 border-slate-700 h-7 p-0.5"
                />
              </div>
            ) : null}

            <p className="text-xs font-medium text-slate-300">Selected</p>
            {!selected ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                {isUploadEdit
                  ? 'Click a text box, QR, stamp, or shape on the page, then drag it. Use Layers below to pick one.'
                  : (
                    <>
                      Use <span className="text-slate-300">Starter layout</span> for a real{' '}
                      {docLabel.toLowerCase()} page, then add {docLabel.toLowerCase()} fields, logo,
                      and branding. Click any element to edit.
                    </>
                  )}
              </p>
            ) : selectedIsQr ? (
              <div className="space-y-2">
                <Badge className="bg-amber-600/20 text-amber-200 border-amber-700/40">
                  System verification QR
                </Badge>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  This QR uses your institution’s verify link for each student. If your design already
                  has its own QR image, delete this one so it is not replaced or duplicated.
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button type="button" size="sm" variant="secondary" onClick={() => alignSelected('h-center')}>
                    Center H
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => alignSelected('page-center')}>
                    Center page
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={deleteSelected}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove QR
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {selected.type === 'text' ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Your text (free)</Label>
                      <textarea
                        value={selected.text || ''}
                        onChange={(e) => updateSelected({ text: e.target.value })}
                        rows={3}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 text-sm text-white px-2 py-1.5 resize-y"
                        placeholder="Write anything…"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Auto-fill (optional)</Label>
                      <select
                        className="w-full h-8 rounded-md bg-slate-900 border border-slate-700 text-sm text-white px-2"
                        value={selected.bind || 'none'}
                        onChange={(e) =>
                          updateSelected({ bind: e.target.value as BuilderElement['bind'] })
                        }
                      >
                        {[{ key: 'none', label: 'Static text (free)' }, ...getDocumentBuilderQuickFields(docType)].map(
                          (b) => (
                          <option key={b.key} value={b.key}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Font</Label>
                      <select
                        className="w-full h-8 rounded-md bg-slate-900 border border-slate-700 text-sm text-white px-2"
                        value={selected.fontFamily}
                        onChange={(e) => updateSelected({ fontFamily: e.target.value })}
                      >
                        {BUILDER_FONT_FAMILIES.map((f) => (
                          <option key={f} value={f} style={{ fontFamily: f }}>
                            {builderFontLabel(f)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Size</Label>
                        <Input
                          type="number"
                          min={8}
                          max={120}
                          value={selected.fontSize || 16}
                          onChange={(e) => updateSelected({ fontSize: Number(e.target.value) || 16 })}
                          className="bg-slate-900 border-slate-700 h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Color</Label>
                        <Input
                          type="color"
                          value={selected.color || '#0f172a'}
                          onChange={(e) => updateSelected({ color: e.target.value })}
                          className="bg-slate-900 border-slate-700 h-8 p-1"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant={selected.fontWeight === 'bold' ? 'default' : 'secondary'}
                        onClick={() =>
                          updateSelected({
                            fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold',
                          })
                        }
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={selected.fontStyle === 'italic' ? 'default' : 'secondary'}
                        onClick={() =>
                          updateSelected({
                            fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic',
                          })
                        }
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => updateSelected({ textAlign: 'left' })}
                      >
                        <AlignLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => updateSelected({ textAlign: 'center' })}
                      >
                        <AlignCenter className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => updateSelected({ textAlign: 'right' })}
                      >
                        <AlignRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                ) : null}

                {(selected.type === 'rect' ||
                  selected.type === 'ellipse' ||
                  selected.type === 'line') && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Fill</Label>
                        <Input
                          type="color"
                          value={selected.fill === 'transparent' ? '#ffffff' : selected.fill || '#e2e8f0'}
                          onChange={(e) => updateSelected({ fill: e.target.value })}
                          className="bg-slate-900 border-slate-700 h-8 p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Stroke</Label>
                        <Input
                          type="color"
                          value={selected.stroke || '#002147'}
                          onChange={(e) => updateSelected({ stroke: e.target.value })}
                          className="bg-slate-900 border-slate-700 h-8 p-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Stroke width</Label>
                      <Input
                        type="number"
                        min={0}
                        max={40}
                        value={selected.strokeWidth ?? 2}
                        onChange={(e) =>
                          updateSelected({ strokeWidth: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="bg-slate-900 border-slate-700 h-8 text-sm"
                      />
                    </div>
                  </div>
                )}

                {selected.type === 'image' && !selectedIsPaper ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Image</Label>
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
                              fallback: {
                                title: 'Replace failed',
                                description: 'Could not upload the new image.',
                              },
                            }),
                            variant: 'destructive',
                          })
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => document.getElementById('replace-builder-image')?.click()}
                    >
                      <ImagePlus className="h-3.5 w-3.5 mr-1" /> Replace image
                    </Button>
                  </div>
                ) : null}

                {isDecorativeElement(selected) ? (
                  <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                    <p className="text-[11px] text-amber-200/90">
                      Certificate ornament — change colors & rotate freely
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Primary</Label>
                        <Input
                          type="color"
                          value={selected.fill || '#002147'}
                          onChange={(e) => updateSelected({ fill: e.target.value })}
                          className="bg-slate-900 border-slate-700 h-8 p-1"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-400">Accent / gold</Label>
                        <Input
                          type="color"
                          value={selected.stroke || '#c9a227'}
                          onChange={(e) => updateSelected({ stroke: e.target.value })}
                          className="bg-slate-900 border-slate-700 h-8 p-1"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">X</Label>
                    <Input
                      type="number"
                      value={Math.round(selected.x)}
                      onChange={(e) => updateSelected({ x: Number(e.target.value) || 0 })}
                      className="bg-slate-900 border-slate-700 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Y</Label>
                    <Input
                      type="number"
                      value={Math.round(selected.y)}
                      onChange={(e) => updateSelected({ y: Number(e.target.value) || 0 })}
                      className="bg-slate-900 border-slate-700 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Width</Label>
                    <Input
                      type="number"
                      min={8}
                      value={Math.round(selected.width)}
                      onChange={(e) =>
                        updateSelected({ width: Math.max(8, Number(e.target.value) || 8) })
                      }
                      className="bg-slate-900 border-slate-700 h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Height</Label>
                    <Input
                      type="number"
                      min={8}
                      value={Math.round(selected.height)}
                      onChange={(e) =>
                        updateSelected({ height: Math.max(8, Number(e.target.value) || 8) })
                      }
                      className="bg-slate-900 border-slate-700 h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Rotate°</Label>
                    <Input
                      type="number"
                      min={-180}
                      max={180}
                      value={selected.rotation || 0}
                      onChange={(e) => updateSelected({ rotation: Number(e.target.value) || 0 })}
                      className="bg-slate-900 border-slate-700 h-8 text-sm"
                    />
                    {isDecorativeElement(selected) ? (
                      <div className="flex gap-1 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            let r = (selected.rotation || 0) - 90
                            if (r < -180) r += 360
                            updateSelected({ rotation: r })
                          }}
                        >
                          −90°
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            let r = (selected.rotation || 0) + 90
                            if (r > 180) r -= 360
                            updateSelected({ rotation: r })
                          }}
                        >
                          +90°
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">Opacity</Label>
                    <Input
                      type="number"
                      min={0.1}
                      max={1}
                      step={0.1}
                      value={selected.opacity ?? 1}
                      onChange={(e) => updateSelected({ opacity: Number(e.target.value) || 1 })}
                      className="bg-slate-900 border-slate-700 h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  <Button type="button" size="sm" variant="secondary" onClick={() => alignSelected('h-center')}>
                    Center H
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => alignSelected('v-center')}>
                    Center V
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => alignSelected('page-center')}>
                    Center page
                  </Button>
                </div>
              </>
            )}

            <div className="pt-2 border-t border-slate-800 space-y-2">
              {selected?.groupId ? (
                <div className="flex flex-wrap gap-1">
                  {enteredGroupId === selected.groupId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setEnteredGroupId(null)
                        setActiveGroupId(selected.groupId!)
                      }}
                    >
                      Exit group
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setEnteredGroupId(selected.groupId!)
                        setActiveGroupId(null)
                      }}
                    >
                      Enter group
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] border-slate-700"
                    onClick={() => {
                      const next = cloneDesign(design)
                      next.elements = next.elements.map((e) =>
                        e.id === selected.id ? { ...e, groupId: undefined } : e,
                      )
                      pushHistory(next)
                    }}
                  >
                    Ungroup item
                  </Button>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Layers ({design.elements.length})</p>
                {selected ? (
                  <div className="flex gap-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title={selected.hidden ? 'Show' : 'Hide'}
                      onClick={() => updateSelected({ hidden: !selected.hidden })}
                    >
                      {selected.hidden ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title={selected.locked ? 'Unlock' : 'Lock'}
                      onClick={() => updateSelected({ locked: !selected.locked })}
                    >
                      {selected.locked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="max-h-48 overflow-auto space-y-0.5">
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
                    const label = isGroupRep
                      ? getGroupLabel(el.groupId!, design.elements)
                      : getBuilderLayerLabel(el)
                    return (
                      <div
                        key={el.id}
                        className={`flex items-center gap-1 rounded px-1 py-0.5 ${
                          el.id === selectedId ||
                          (isGroupRep && activeGroupId === el.groupId)
                            ? 'bg-indigo-600/30'
                            : 'bg-slate-900 hover:bg-slate-800/80'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(el.id)
                            if (isGroupRep) {
                              setActiveGroupId(el.groupId!)
                              setEnteredGroupId(null)
                            } else if (el.groupId && enteredGroupId === el.groupId) {
                              setActiveGroupId(null)
                            } else {
                              setActiveGroupId(null)
                            }
                          }}
                          className={`flex-1 min-w-0 text-left text-[11px] px-1 py-1 font-mono truncate ${
                            el.id === selectedId ? 'text-white' : 'text-slate-400'
                          } ${el.hidden ? 'opacity-40 line-through' : ''}`}
                        >
                          {isGroupRep ? `▸ ${label}` : label}
                          {el.locked ? ' 🔒' : ''}
                        </button>
                        <button
                          type="button"
                          className="p-1 text-slate-500 hover:text-slate-200"
                          title={el.hidden ? 'Show' : 'Hide'}
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
                          {el.hidden ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="p-1 text-slate-500 hover:text-slate-200"
                          title={el.locked ? 'Unlock' : 'Lock'}
                          onClick={() => {
                            const next = cloneDesign(design)
                            next.elements = next.elements.map((e) =>
                              e.id === el.id ? { ...e, locked: !e.locked } : e,
                            )
                            pushHistory(next)
                            if (selectedId === el.id) setSelectedId(el.id)
                          }}
                        >
                          {el.locked ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            <Unlock className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="p-1 text-slate-500 hover:text-red-300"
                          title="Delete"
                          disabled={el.locked}
                          onClick={() => {
                            if (el.locked) return
                            const next = cloneDesign(design)
                            if (isGroupRep && el.groupId) {
                              next.elements = next.elements.filter((e) => e.groupId !== el.groupId)
                            } else {
                              next.elements = next.elements.filter((e) => e.id !== el.id)
                            }
                            pushHistory(next)
                            if (selectedId === el.id) setSelectedId(null)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
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
      </CardContent>
    </Card>
  )
}

export default CertificateLogoPageBuilder
