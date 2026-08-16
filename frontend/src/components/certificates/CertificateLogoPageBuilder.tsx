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
  FilePlus,
  Frame,
  ImagePlus,
  Italic,
  LayoutTemplate,
  Loader2,
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
  getBuilderLayerLabel,
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
 */
const CertificateLogoPageBuilder = ({
  documentType = 'certificate',
}: {
  documentType?: DocumentTemplateType
} = {}) => {
  const docType = (documentType || 'certificate') as DocumentTemplateType
  const docLabel =
    docType === 'transcript' ? 'Transcript' : docType === 'invoice' ? 'Invoice' : 'Certificate'
  const { institution } = useAuth()
  const { toast } = useToast()
  const [design, setDesign] = useState<LogoBuilderDesign>(() => createDefaultBuilderDesign())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const [activeLayout, setActiveLayout] = useState<string>('classic')
  /** True when institution already has a Page Builder design saved (draft or active). */
  const [hasSavedDesign, setHasSavedDesign] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const historyRef = useRef<LogoBuilderDesign[]>([])
  const futureRef = useRef<LogoBuilderDesign[]>([])
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
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
  }, [institution?.id, docType])

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
      // Keep institution name below the logo
      starter.elements = starter.elements.map((el) =>
        el.bind === 'institutionName' ? { ...el, y: Math.max(el.y, 150) } : el,
      )
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
    const next = cloneDesign(designRef.current)
    next.elements = next.elements.filter((e) => e.id !== id)
    pushHistory(next)
    setSelectedId(null)
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
    if (!current) return
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
    const el = design.elements.find((x) => x.id === id)
    if (!el || !canvasRef.current) return
    setSelectedId(id)
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
      mode,
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
    setDesign((prev) => {
      const next = cloneDesign(prev)
      next.elements = next.elements.map((el) => {
        if (el.id !== dragRef.current!.id) return el
        if (dragRef.current!.mode === 'resize') {
          return {
            ...el,
            width: Math.max(isQrElement(el) ? 64 : 16, dragRef.current!.origW + dx),
            height: Math.max(isQrElement(el) ? 64 : 16, dragRef.current!.origH + dy),
          }
        }
        return {
          ...el,
          x: Math.max(0, Math.min(prev.canvas.width - 20, dragRef.current!.origX + dx)),
          y: Math.max(0, Math.min(prev.canvas.height - 20, dragRef.current!.origY + dy)),
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
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white text-base">{docLabel} Page Builder</CardTitle>
            <CardDescription>
              Design a real {docLabel.toLowerCase()} page — starter layout, {docLabel.toLowerCase()}{' '}
              fields, branding, and shapes. Not a certificate template.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeLayout === 'logo_builder' ? (
              <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40">
                Active for institution
              </Badge>
            ) : hasSavedDesign ? (
              <Badge className="bg-amber-600/20 text-amber-200 border-amber-700/40">
                Draft saved (not active)
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>
            Shortcuts:{' '}
            <span className="text-slate-300">Del · Ctrl+C/X/V/D · Ctrl+Z/Y · arrows</span>
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span>
            Saved design:{' '}
            <button
              type="button"
              className="text-indigo-300 hover:text-indigo-200 underline-offset-2 hover:underline disabled:opacity-40"
              disabled={loadingSaved || !hasSavedDesign}
              onClick={() => loadSavedDesignFromServer()}
            >
              Open saved design
            </button>
          </span>
        </div>

        <div className="space-y-2">
          {/* Document */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 w-14 shrink-0">Doc</span>
            <Button type="button" size="sm" variant="secondary" onClick={handleNewBlank}>
              <FilePlus className="h-3.5 w-3.5 mr-1" /> New blank
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={applyStarterLayout}>
              <LayoutTemplate className="h-3.5 w-3.5 mr-1" /> Starter layout
            </Button>
            <span className="w-px h-5 bg-slate-700 mx-0.5" />
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              Paper
              <select
                className="h-8 rounded-md bg-slate-900 border border-slate-700 text-sm text-white px-2"
                value={design.canvas.paperKey || 'a4-portrait'}
                onChange={(e) => changePaperSize(e.target.value as PaperSizeKey)}
              >
                {PAPER_SIZES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Insert */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 w-14 shrink-0">Insert</span>
            <Button type="button" size="sm" variant="secondary" onClick={addBorderFrame}>
              <Frame className="h-3.5 w-3.5 mr-1" /> Border
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addElement('text')}>
              <Type className="h-3.5 w-3.5 mr-1" /> Text
            </Button>
            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShapesOpen((v) => !v)}
              >
                <Shapes className="h-3.5 w-3.5 mr-1" /> Shapes
                <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
              </Button>
              {shapesOpen ? (
                <div className="absolute left-0 top-full mt-1 z-30 w-72 max-h-80 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 shadow-xl p-1">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">Basic</p>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800 rounded"
                    onClick={() => {
                      addElement('rect')
                      setShapesOpen(false)
                    }}
                  >
                    <Square className="h-3.5 w-3.5" /> Box
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800 rounded"
                    onClick={() => {
                      addElement('ellipse')
                      setShapesOpen(false)
                    }}
                  >
                    <Circle className="h-3.5 w-3.5" /> Circle
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800 rounded"
                    onClick={() => {
                      addElement('line')
                      setShapesOpen(false)
                    }}
                  >
                    <Minus className="h-3.5 w-3.5" /> Line
                  </button>
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
                          onClick={() => addDecorativeShape(s.key)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
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
            <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5 mr-1" /> Image
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => bgFileRef.current?.click()}>
              Background
            </Button>
          </div>

          {/* Branding — single place for logo / stamp / signature / QR */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 w-14 shrink-0">Brand</span>
            <Button type="button" size="sm" variant="secondary" onClick={() => addInstitutionAsset('logo')}>
              Logo
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => addInstitutionAsset('seal')}>
              Stamp
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => addInstitutionAsset('signature')}
            >
              Signature
            </Button>
            <Button
              type="button"
              size="sm"
              variant={hasVerificationQr(design) ? 'outline' : 'secondary'}
              className={
                hasVerificationQr(design)
                  ? 'border-amber-700/60 text-amber-200'
                  : undefined
              }
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
                  : 'Add system verification QR'
              }
            >
              <QrCode className="h-3.5 w-3.5 mr-1" />
              {hasVerificationQr(design) ? 'QR on page' : 'Add QR'}
            </Button>
          </div>

          {/* Edit + save */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 px-2 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-500 w-14 shrink-0">Edit</span>
            <Button type="button" size="sm" variant="ghost" onClick={undo} title="Undo (Ctrl+Z)">
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={redo} title="Redo (Ctrl+Y)">
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
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
              disabled={!selected}
              onClick={deleteSelected}
              title="Delete (Del / Backspace)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <span className="w-px h-5 bg-slate-700 mx-0.5" />
            <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewOpen((v) => !v)}>
              <Eye className="h-3.5 w-3.5 mr-1" /> Preview
            </Button>
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
              PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="border-slate-600 text-slate-200"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save & use
            </Button>
          </div>

          {/* Quick document-specific fields */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-indigo-900/40 bg-indigo-950/15 px-2 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-indigo-300/80 w-14 shrink-0">Fields</span>
            {getDocumentBuilderQuickFields(docType).map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[11px] border-slate-700 text-slate-200"
                onClick={() => addBoundField(key)}
              >
                + {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div
            ref={canvasRef}
            className="relative mx-auto w-full max-w-2xl rounded border border-slate-700 overflow-hidden touch-none shadow-inner bg-white"
            style={{
              aspectRatio: `${design.canvas.width}/${design.canvas.height}`,
              backgroundColor: design.canvas.background || '#ffffff',
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => {
              setSelectedId(null)
              setShapesOpen(false)
            }}
          >
            {design.elements
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map((el) => {
                const isSel = el.id === selectedId
                const isQr = isQrElement(el)
                const decorMeta = el.decorKey
                  ? DECORATIVE_SHAPES.find((s) => s.key === el.decorKey)
                  : undefined
                const isFullPageDecor = !!(decorMeta && 'fullPage' in decorMeta && decorMeta.fullPage)
                return (
                  <div
                    key={el.id}
                    onPointerDown={(e) => onPointerDown(e, el.id, 'move')}
                    className={`absolute cursor-move ${
                      isSel
                        ? isQr
                          ? 'ring-2 ring-amber-400'
                          : 'ring-2 ring-indigo-500'
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
                      // Full-page frames shouldn't steal clicks from text/fields unless selected
                      pointerEvents: isFullPageDecor && !isSel ? 'none' : undefined,
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
                    {isSel ? (
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

          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
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
                className="bg-slate-900 border-slate-700 h-8 p-1"
              />
            </div>

            <p className="text-xs font-medium text-slate-300">Selected</p>
            {!selected ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                Use <span className="text-slate-300">Starter layout</span> for a real{' '}
                {docLabel.toLowerCase()} page, then add {docLabel.toLowerCase()} fields, logo, and
                branding. Click any element to edit.
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
                          <option key={f} value={f}>
                            {f.split(',')[0]}
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

            <div className="pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-2">Layers ({design.elements.length})</p>
              <div className="max-h-52 overflow-auto space-y-1">
                {design.elements
                  .slice()
                  .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
                  .map((el) => (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => setSelectedId(el.id)}
                      className={`w-full text-left text-[11px] px-2 py-1.5 rounded font-mono ${
                        el.id === selectedId
                          ? 'bg-indigo-600/30 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {getBuilderLayerLabel(el)}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {previewOpen ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-slate-300">Final preview (sample student data)</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
                  Same look as issued {docLabel.toLowerCase()}s
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
