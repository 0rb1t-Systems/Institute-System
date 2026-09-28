/**
 * Lightweight editor for imported certificate templates only.
 * Does not touch Certificate Page Builder.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Award,
  ClipboardPaste,
  Copy,
  Frame,
  ImagePlus,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  BUILDER_FONT_FAMILIES,
  builderFontLabel,
  createBorderFrameElements,
  createDecorativeShapeElement,
  createElementId,
  DECORATIVE_SHAPES,
  decorativeImageSrc,
  extractCertStoragePath,
  getBuilderLayerLabel,
  isFullPageDecorElement,
  isPrivateCertStoragePath,
  isQrElement,
  normalizeLogoBuilderDesign,
  resolveBuilderText,
  type BuilderElement,
  type DecorativeShapeKey,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import {
  CERTIFICATE_PATCHES,
  createCertificatePatchElement,
  getCertificatePatchPreviewSrc,
  type CertificatePatchKey,
} from '@/lib/certificatePatches'
import {
  applyCertificatePatchImage,
  CERTIFICATE_PATCH_MARKER,
  USER_PATCH_NAME,
} from '@/lib/certificateImport/generateTemplate'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import {
  downloadCertificateTemplateAsDataUrl,
  getCertificateTemplateSignedUrl,
  uploadCertificateBuilderImage,
} from '@/lib/api'
import QRCode from 'react-qr-code'

type Props = {
  design: LogoBuilderDesign
  preview: CertificateRenderData
  onChange: (design: LogoBuilderDesign) => void
}

const CLIP_KEY = 'tvetflow.certificateImport.clipboard'
const MAX_HISTORY = 40

const BORDER_FRAMES = DECORATIVE_SHAPES.filter((s) => s.category === 'borders')
const CLASSIC_FRAME_KEY = '__classic_double__'

function clone(d: LogoBuilderDesign): LogoBuilderDesign {
  return JSON.parse(JSON.stringify(d)) as LogoBuilderDesign
}

function updateElement(
  design: LogoBuilderDesign,
  id: string,
  patch: Partial<BuilderElement>,
): LogoBuilderDesign {
  const next = clone(design)
  next.elements = (next.elements || []).map((el) => (el.id === id ? { ...el, ...patch, id: el.id } : el))
  return normalizeLogoBuilderDesign(next)
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

/** Full-page border frames — their empty center must not steal clicks from text/lines. */
function isPageFrameRect(el: BuilderElement, canvasW: number, canvasH: number) {
  if (el.type !== 'rect') return false
  const area = (Math.max(1, el.width) * Math.max(1, el.height)) / Math.max(1, canvasW * canvasH)
  if (area < 0.45) return false
  const fill = String(el.fill || '').trim().toLowerCase()
  return !fill || fill === 'transparent' || fill === 'rgba(0,0,0,0)' || fill === '#00000000'
}

/** Full-page decorative frame images + classic rect borders. */
function isPageFrameElement(el: BuilderElement, canvasW: number, canvasH: number) {
  if (isFullPageDecorElement(el)) return true
  if (el.text === 'border-outer' || el.text === 'border-inner') return true
  return isPageFrameRect(el, canvasW, canvasH)
}

function lineColor(el: BuilderElement) {
  return el.stroke || el.fill || el.color || '#0f172a'
}

function toColorInputValue(raw?: string | null) {
  const s = String(raw || '#0f172a').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  }
  return '#0f172a'
}

async function resolveImageDisplayUrl(src?: string | null): Promise<string | null> {
  const raw = String(src || '').trim()
  if (!raw) return null
  if (/^(blob:|data:)/i.test(raw)) return raw
  if (/^https?:\/\//i.test(raw) && !extractCertStoragePath(raw)) return raw
  const path = extractCertStoragePath(raw) || (isPrivateCertStoragePath(raw) ? raw : null)
  if (!path) return raw
  try {
    const dataUrl = String((await downloadCertificateTemplateAsDataUrl(path)) || '')
    if (dataUrl.startsWith('data:')) return dataUrl
  } catch {
    /* fall through */
  }
  try {
    return (await getCertificateTemplateSignedUrl(path)) || null
  } catch {
    return null
  }
}

const CertificateImportEditor = ({ design, preview, onChange }: Props) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const logoFileRef = useRef<HTMLInputElement | null>(null)
  const patchFileRef = useRef<HTMLInputElement | null>(null)
  const textEditRef = useRef<HTMLTextAreaElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({})
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [framePreviewKey, setFramePreviewKey] = useState<string>(CLASSIC_FRAME_KEY)
  const [patchPreviewKey, setPatchPreviewKey] = useState<string>(CERTIFICATE_PATCHES[0].key)
  const designRef = useRef(design)
  designRef.current = design
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const historyRef = useRef<LogoBuilderDesign[]>([])
  const futureRef = useRef<LogoBuilderDesign[]>([])
  const dragStartDesignRef = useRef<LogoBuilderDesign | null>(null)
  const dragRef = useRef<{
    id: string
    mode: 'move' | 'resize'
    handle?: 'nw' | 'ne' | 'sw' | 'se'
    startX: number
    startY: number
    origX: number
    origY: number
    origW: number
    origH: number
  } | null>(null)

  const canvasW = design.canvas?.width || 794
  const canvasH = design.canvas?.height || 1123
  const selected = (design.elements || []).find((el) => el.id === selectedId) || null
  const brandPrimary = preview.primary || '#002147'
  const brandAccent = preview.accent || '#c9a227'

  const frameThumbSrc = useMemo(() => {
    const map: Record<string, string> = {
      [CLASSIC_FRAME_KEY]: decorativeImageSrc('border_classic_double', brandPrimary, brandAccent),
    }
    for (const s of BORDER_FRAMES) {
      map[s.key] = decorativeImageSrc(s.key, brandPrimary, brandAccent)
    }
    return map
  }, [brandPrimary, brandAccent])

  const patchThumbSrc = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of CERTIFICATE_PATCHES) {
      map[s.key] = getCertificatePatchPreviewSrc(s.key, brandPrimary, brandAccent, '#ffffff')
    }
    return map
  }, [brandPrimary, brandAccent])

  const framePreviewLabel =
    framePreviewKey === CLASSIC_FRAME_KEY
      ? 'Classic double border'
      : BORDER_FRAMES.find((s) => s.key === framePreviewKey)?.label || 'Frame'
  const patchPreviewMeta =
    CERTIFICATE_PATCHES.find((s) => s.key === patchPreviewKey) || CERTIFICATE_PATCHES[0]

  const applyDesign = useCallback(
    (next: LogoBuilderDesign) => {
      onChange(normalizeLogoBuilderDesign(next))
    },
    [onChange],
  )

  const commitDesign = useCallback(
    (next: LogoBuilderDesign) => {
      historyRef.current = [
        ...historyRef.current.slice(-(MAX_HISTORY - 1)),
        clone(designRef.current),
      ]
      futureRef.current = []
      onChange(normalizeLogoBuilderDesign(next))
    },
    [onChange],
  )

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    futureRef.current.push(clone(designRef.current))
    applyDesign(prev)
  }, [applyDesign])

  const redo = useCallback(() => {
    const nxt = futureRef.current.pop()
    if (!nxt) return
    historyRef.current.push(clone(designRef.current))
    applyDesign(nxt)
  }, [applyDesign])

  // Ensure every imported layer is unlocked so drag/resize always works
  useEffect(() => {
    const locked = (design.elements || []).filter((el) => el.locked)
    if (!locked.length) return
    const next = clone(design)
    next.elements = (next.elements || []).map((el) => (el.locked ? { ...el, locked: false } : el))
    applyDesign(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design.elements])

  useEffect(() => {
    const host = canvasRef.current
    if (!host) return
    const update = () => {
      const w = host.getBoundingClientRect().width
      setScale(w / Math.max(1, canvasW))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(host)
    return () => ro.disconnect()
  }, [canvasW])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = { ...resolvedUrls }
      let changed = false
      for (const el of design.elements || []) {
        if (el.type !== 'image' || !el.src) continue
        if (next[el.id] && !brokenIds[el.id]) continue
        const url = await resolveImageDisplayUrl(el.src)
        if (cancelled) return
        if (url) {
          next[el.id] = url
          changed = true
        }
      }
      if (!cancelled && changed) {
        setResolvedUrls(next)
        setBrokenIds((prev) => {
          const cleaned = { ...prev }
          for (const id of Object.keys(next)) delete cleaned[id]
          return cleaned
        })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design])

  const sorted = useMemo(
    () => [...(design.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [design.elements],
  )

  const deleteSelected = (id = selectedIdRef.current) => {
    if (!id) return
    const current = designRef.current
    const next = clone(current)
    next.elements = (next.elements || []).filter((el) => el.id !== id)
    setSelectedId(null)
    commitDesign(next)
  }

  const copySelected = (cut = false) => {
    const id = selectedIdRef.current
    const current = designRef.current
    const el = (current.elements || []).find((e) => e.id === id)
    if (!el) return
    try {
      sessionStorage.setItem(CLIP_KEY, JSON.stringify(el))
    } catch {
      /* ignore */
    }
    if (cut) deleteSelected(id)
  }

  const pasteClipboard = () => {
    let raw = ''
    try {
      raw = sessionStorage.getItem(CLIP_KEY) || ''
    } catch {
      raw = ''
    }
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as BuilderElement
      if (!parsed || typeof parsed !== 'object') return
      const current = designRef.current
      const pasted: BuilderElement = {
        ...parsed,
        id: createElementId(),
        x: Math.min((parsed.x || 0) + 24, (current.canvas?.width || 794) - 40),
        y: Math.min((parsed.y || 0) + 24, (current.canvas?.height || 1123) - 40),
        zIndex: (current.elements || []).reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1,
      }
      commitDesign({
        ...current,
        elements: [...(current.elements || []), pasted],
      })
      setSelectedId(pasted.id)
    } catch {
      /* ignore */
    }
  }

  const addTextBox = () => {
    const current = designRef.current
    const el: BuilderElement = {
      id: createElementId(),
      type: 'text',
      name: 'Text',
      text: 'New text',
      x: Math.round((current.canvas?.width || 794) * 0.2),
      y: Math.round((current.canvas?.height || 1123) * 0.35),
      width: Math.round((current.canvas?.width || 794) * 0.6),
      height: 40,
      rotation: 0,
      zIndex: (current.elements || []).reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1,
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#0f172a',
      letterSpacing: 0.2,
      lineHeight: 1.3,
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      opacity: 1,
      bind: 'none',
    }
    commitDesign({
      ...current,
      elements: [...(current.elements || []), el],
    })
    setSelectedId(el.id)
    setTimeout(() => textEditRef.current?.focus(), 50)
  }

  const addCertificatePatch = (key: CertificatePatchKey) => {
    const current = designRef.current
    const canvas = {
      width: current.canvas?.width || 794,
      height: current.canvas?.height || 1123,
    }
    const el = createCertificatePatchElement(key, canvas, {
      primary: brandPrimary,
      accent: brandAccent,
      ink: '#ffffff',
    })
    el.zIndex = (current.elements || []).reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const next = clone(current)
    next.elements = [...(next.elements || []), el]
    commitDesign(next)
    setSelectedId(el.id)
  }

  const addClassicBorderFrame = () => {
    const current = designRef.current
    const canvas = {
      width: current.canvas?.width || 794,
      height: current.canvas?.height || 1123,
    }
    const frames = createBorderFrameElements(canvas, brandPrimary, brandAccent)
    const maxZ = (current.elements || []).reduce((m, e) => Math.max(m, e.zIndex || 0), 0)
    const next = clone(current)
    next.elements = [
      ...frames.map((f, i) => ({ ...f, zIndex: i + 1 })),
      ...(next.elements || []).map((e) => ({ ...e, zIndex: (e.zIndex || 0) + maxZ + 3 })),
    ]
    commitDesign(next)
    setSelectedId(frames[0]?.id || null)
  }

  const addDecorativeBorder = (key: DecorativeShapeKey) => {
    const current = designRef.current
    const canvas = {
      width: current.canvas?.width || 794,
      height: current.canvas?.height || 1123,
    }
    const el = createDecorativeShapeElement(key, canvas, {
      primary: brandPrimary,
      accent: brandAccent,
    })
    el.zIndex = 1
    const next = clone(current)
    next.elements = [el, ...(next.elements || []).map((e) => ({ ...e, zIndex: (e.zIndex || 0) + 1 }))]
    commitDesign(next)
    setSelectedId(el.id)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!rootRef.current) return
      const active = document.activeElement
      const inside = active === document.body || rootRef.current.contains(active)
      if (!inside) return

      const meta = event.ctrlKey || event.metaKey
      const typing = isTypingTarget(event.target)
      if (typing) return

      const key = event.key.toLowerCase()

      if (meta && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
        return
      }
      if ((meta && key === 'z' && event.shiftKey) || (meta && key === 'y')) {
        event.preventDefault()
        redo()
        return
      }
      if (meta && key === 'c') {
        event.preventDefault()
        copySelected(false)
        return
      }
      if (meta && key === 'x') {
        event.preventDefault()
        copySelected(true)
        return
      }
      if (meta && key === 'v') {
        event.preventDefault()
        pasteClipboard()
        return
      }
      if (meta && key === 'd') {
        event.preventDefault()
        copySelected(false)
        pasteClipboard()
        return
      }
      if (event.key === 'Escape') {
        setSelectedId(null)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selectedIdRef.current) return
        event.preventDefault()
        deleteSelected()
        return
      }
      if (selectedIdRef.current && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const current = designRef.current
        const el = (current.elements || []).find((e) => e.id === selectedIdRef.current)
        if (!el) return
        const step = event.shiftKey ? 10 : 1
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
        commitDesign(
          updateElement(current, el.id, {
            x: Math.round(Math.max(0, Math.min(canvasW - 8, el.x + dx))),
            y: Math.round(Math.max(0, Math.min(canvasH - 8, el.y + dy))),
          }),
        )
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, commitDesign, canvasW, canvasH])

  const onPointerDown = (
    event: React.PointerEvent,
    id: string,
    mode: 'move' | 'resize' = 'move',
    handle?: 'nw' | 'ne' | 'sw' | 'se',
  ) => {
    event.preventDefault()
    event.stopPropagation()
    rootRef.current?.focus?.({ preventScroll: true })
    const el = designRef.current.elements.find((e) => e.id === id)
    if (!el) return
    setSelectedId(id)
    dragStartDesignRef.current = clone(designRef.current)
    dragRef.current = {
      id,
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    const host = canvasRef.current
    if (!drag || !host) return
    const rect = host.getBoundingClientRect()
    const scaleX = canvasW / Math.max(1, rect.width)
    const scaleY = canvasH / Math.max(1, rect.height)
    const dx = (event.clientX - drag.startX) * scaleX
    const dy = (event.clientY - drag.startY) * scaleY
    const current = designRef.current

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
        x = drag.origX + dx
        w = drag.origW - dx
        h = drag.origH + dy
      } else if (handle === 'ne') {
        y = drag.origY + dy
        w = drag.origW + dx
        h = drag.origH - dy
      } else {
        x = drag.origX + dx
        y = drag.origY + dy
        w = drag.origW - dx
        h = drag.origH - dy
      }
      const minSize = 12
      if (w < minSize) {
        if (handle === 'sw' || handle === 'nw') x = drag.origX + drag.origW - minSize
        w = minSize
      }
      if (h < minSize) {
        if (handle === 'ne' || handle === 'nw') y = drag.origY + drag.origH - minSize
        h = minSize
      }
      applyDesign(
        updateElement(current, drag.id, {
          x: Math.round(Math.max(0, Math.min(canvasW - minSize, x))),
          y: Math.round(Math.max(0, Math.min(canvasH - minSize, y))),
          width: Math.round(Math.min(canvasW, Math.max(minSize, w))),
          height: Math.round(Math.min(canvasH, Math.max(minSize, h))),
        }),
      )
      return
    }

    applyDesign(
      updateElement(current, drag.id, {
        x: Math.round(Math.max(0, Math.min(canvasW - 8, drag.origX + dx))),
        y: Math.round(Math.max(0, Math.min(canvasH - 8, drag.origY + dy))),
      }),
    )
  }

  const onPointerUp = () => {
    const start = dragStartDesignRef.current
    const wasDragging = !!dragRef.current
    dragRef.current = null
    dragStartDesignRef.current = null
    if (!wasDragging || !start) return
    const changed =
      JSON.stringify(start.elements || []) !== JSON.stringify(designRef.current.elements || [])
    if (!changed) return
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), start]
    futureRef.current = []
  }

  const nudgeSpacing = (delta: number) => {
    if (!selected || selected.type !== 'text') return
    const current = Number(selected.letterSpacing) || 0
    commitDesign(updateElement(design, selected.id, { letterSpacing: Math.max(-2, Math.min(12, current + delta)) }))
  }

  const nudgeLineHeight = (delta: number) => {
    if (!selected || selected.type !== 'text') return
    const current = Number(selected.lineHeight) || 1.2
    commitDesign(
      updateElement(design, selected.id, {
        lineHeight: Math.max(0.9, Math.min(2.4, Math.round((current + delta) * 100) / 100)),
      }),
    )
  }

  const uploadImage = async (file: File | undefined, mode: 'replace' | 'patch' | 'logo') => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const localPreview = URL.createObjectURL(file)
    try {
      const { path, signedUrl } = await uploadCertificateBuilderImage(file)
      const displayUrl = signedUrl || localPreview
      if (mode === 'patch') {
        const next = applyCertificatePatchImage(design, path)
        const patch = (next.elements || []).find(
          (el) => el.text === CERTIFICATE_PATCH_MARKER || el.name === USER_PATCH_NAME,
        )
        if (patch) {
          setResolvedUrls((prev) => ({ ...prev, [patch.id]: displayUrl }))
          setBrokenIds((prev) => {
            const n = { ...prev }
            delete n[patch.id]
            return n
          })
          setSelectedId(patch.id)
        }
        commitDesign(next)
        return
      }
      if (mode === 'logo') {
        const existing = (design.elements || []).find((el) => el.name === 'Institution logo' && el.type === 'image')
        if (existing) {
          const next = updateElement(design, existing.id, { src: path, name: 'Institution logo', text: 'Institution logo' })
          setResolvedUrls((prev) => ({ ...prev, [existing.id]: displayUrl }))
          setBrokenIds((prev) => {
            const n = { ...prev }
            delete n[existing.id]
            return n
          })
          commitDesign(next)
          setSelectedId(existing.id)
        } else {
          const logo: BuilderElement = {
            id: createElementId(),
            type: 'image',
            name: 'Institution logo',
            text: 'Institution logo',
            x: 48,
            y: 40,
            width: 86,
            height: 86,
            rotation: 0,
            zIndex: 20,
            src: path,
            opacity: 1,
            fill: 'transparent',
            stroke: 'transparent',
          }
          const next = normalizeLogoBuilderDesign({
            ...design,
            elements: [...(design.elements || []), logo],
          })
          setResolvedUrls((prev) => ({ ...prev, [logo.id]: displayUrl }))
          commitDesign(next)
          setSelectedId(logo.id)
        }
        return
      }
      if (selected && selected.type === 'image') {
        const next = updateElement(design, selected.id, { src: path })
        setResolvedUrls((prev) => ({ ...prev, [selected.id]: displayUrl }))
        setBrokenIds((prev) => {
          const n = { ...prev }
          delete n[selected.id]
          return n
        })
        commitDesign(next)
        return
      }
      const next = applyCertificatePatchImage(design, path)
      const patch = (next.elements || []).find(
        (el) => el.text === CERTIFICATE_PATCH_MARKER || el.name === USER_PATCH_NAME,
      )
      if (patch) setResolvedUrls((prev) => ({ ...prev, [patch.id]: displayUrl }))
      commitDesign(next)
    } catch {
      URL.revokeObjectURL(localPreview)
      setUploadError('Image upload failed. Use PNG, JPG, or WebP under 10 MB.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className="space-y-4 outline-none"
      tabIndex={-1}
      onPointerDown={() => rootRef.current?.focus?.({ preventScroll: true })}
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={undo} title="Undo (Ctrl+Z)">
          <Undo2 className="mr-1.5 h-4 w-4" />
          Undo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={redo} title="Redo (Ctrl+Y)">
          <Redo2 className="mr-1.5 h-4 w-4" />
          Redo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addTextBox}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add text
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Award className="mr-1.5 h-4 w-4" />
              Patches
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-2">
            <div className="mb-2 rounded-md border border-[var(--ds-border,#DDE5DF)] bg-white p-2">
              <div className="flex h-36 items-center justify-center">
                {patchThumbSrc[patchPreviewMeta.key] ? (
                  <img
                    src={patchThumbSrc[patchPreviewMeta.key]}
                    alt=""
                    className="max-h-36 max-w-full object-contain"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-center text-[11px] font-medium text-[var(--ds-text-primary,#122018)]">
                {patchPreviewMeta.label}
              </p>
            </div>
            <div className="grid max-h-52 grid-cols-3 gap-1 overflow-y-auto">
              {CERTIFICATE_PATCHES.map((patch) => (
                <button
                  key={patch.key}
                  type="button"
                  onMouseEnter={() => setPatchPreviewKey(patch.key)}
                  onFocus={() => setPatchPreviewKey(patch.key)}
                  onClick={() => addCertificatePatch(patch.key)}
                  className={`rounded border p-1 ${
                    patchPreviewKey === patch.key
                      ? 'border-[var(--ds-accent,#1F8A5B)] bg-[var(--ds-accent,#1F8A5B)]/10'
                      : 'border-[var(--ds-border,#DDE5DF)] hover:border-[var(--ds-accent,#1F8A5B)]'
                  }`}
                  title={patch.label}
                >
                  <img
                    src={patchThumbSrc[patch.key]}
                    alt=""
                    className="mx-auto h-14 w-full object-contain bg-white"
                  />
                  <span className="mt-0.5 block truncate text-[9px] text-[var(--ds-text-secondary,#5B6B61)]">
                    {patch.label}
                  </span>
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Frame className="mr-1.5 h-4 w-4" />
              Frames
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-2">
            <div className="mb-2 rounded-md border border-[var(--ds-border,#DDE5DF)] bg-white p-2">
              <div className="flex h-40 items-center justify-center">
                {frameThumbSrc[framePreviewKey] ? (
                  <img
                    src={frameThumbSrc[framePreviewKey]}
                    alt=""
                    className="max-h-40 max-w-full object-contain"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-center text-[11px] font-medium text-[var(--ds-text-primary,#122018)]">
                {framePreviewLabel}
              </p>
            </div>
            <div className="grid max-h-52 grid-cols-3 gap-1 overflow-y-auto">
              <button
                type="button"
                onMouseEnter={() => setFramePreviewKey(CLASSIC_FRAME_KEY)}
                onFocus={() => setFramePreviewKey(CLASSIC_FRAME_KEY)}
                onClick={addClassicBorderFrame}
                className={`rounded border p-1 ${
                  framePreviewKey === CLASSIC_FRAME_KEY
                    ? 'border-[var(--ds-accent,#1F8A5B)] bg-[var(--ds-accent,#1F8A5B)]/10'
                    : 'border-[var(--ds-border,#DDE5DF)] hover:border-[var(--ds-accent,#1F8A5B)]'
                }`}
                title="Classic double border"
              >
                <img
                  src={frameThumbSrc[CLASSIC_FRAME_KEY]}
                  alt=""
                  className="mx-auto h-14 w-full object-contain bg-white"
                />
                <span className="mt-0.5 block truncate text-[9px] text-[var(--ds-text-secondary,#5B6B61)]">
                  Classic double
                </span>
              </button>
              {BORDER_FRAMES.filter((shape) => shape.key !== 'border_classic_double').map((shape) => (
                <button
                  key={shape.key}
                  type="button"
                  onMouseEnter={() => setFramePreviewKey(shape.key)}
                  onFocus={() => setFramePreviewKey(shape.key)}
                  onClick={() => addDecorativeBorder(shape.key as DecorativeShapeKey)}
                  className={`rounded border p-1 ${
                    framePreviewKey === shape.key
                      ? 'border-[var(--ds-accent,#1F8A5B)] bg-[var(--ds-accent,#1F8A5B)]/10'
                      : 'border-[var(--ds-border,#DDE5DF)] hover:border-[var(--ds-accent,#1F8A5B)]'
                  }`}
                  title={shape.label}
                >
                  <img
                    src={frameThumbSrc[shape.key]}
                    alt=""
                    className="mx-auto h-14 w-full object-contain bg-white"
                  />
                  <span className="mt-0.5 block truncate text-[9px] text-[var(--ds-text-secondary,#5B6B61)]">
                    {shape.label}
                  </span>
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => logoFileRef.current?.click()}>
          <ImagePlus className="mr-1.5 h-4 w-4" />
          Upload logo
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => patchFileRef.current?.click()}>
          <ImagePlus className="mr-1.5 h-4 w-4" />
          Upload patch
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || selected?.type !== 'image'}
          onClick={() => fileRef.current?.click()}
        >
          Replace image
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={() => copySelected(false)}>
          <Copy className="mr-1.5 h-4 w-4" />
          Copy
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={() => copySelected(true)}>
          <Scissors className="mr-1.5 h-4 w-4" />
          Cut
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={pasteClipboard}>
          <ClipboardPaste className="mr-1.5 h-4 w-4" />
          Paste
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={!selectedId} onClick={() => deleteSelected()}>
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            uploadImage(event.target.files?.[0], 'replace')
            event.target.value = ''
          }}
        />
        <input
          ref={logoFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            uploadImage(event.target.files?.[0], 'logo')
            event.target.value = ''
          }}
        />
        <input
          ref={patchFileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            uploadImage(event.target.files?.[0], 'patch')
            event.target.value = ''
          }}
        />
      </div>
      {uploadError ? <p className="text-sm text-red-700">{uploadError}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          ref={canvasRef}
          className="relative overflow-hidden rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-white"
          style={{ aspectRatio: `${canvasW} / ${canvasH}` }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={() => setSelectedId(null)}
        >
          <div className="absolute inset-0" style={{ background: design.canvas?.background || '#ffffff' }}>
            {sorted.map((el) => {
              if (el.hidden) return null
              const isSelected = el.id === selectedId
              const boxStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${(el.x / canvasW) * 100}%`,
                top: `${(el.y / canvasH) * 100}%`,
                width: `${(el.width / canvasW) * 100}%`,
                height: `${(el.height / canvasH) * 100}%`,
                zIndex: (el.zIndex || 0) + (isSelected ? 1000 : 0),
                boxSizing: 'border-box',
                opacity: el.opacity ?? 1,
                outline: isSelected ? '2px solid #1F8A5B' : undefined,
                cursor: 'move',
                touchAction: 'none',
              }

              const resizeHandles = isSelected ? (
                <>
                  {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                    <span
                      key={h}
                      className={`absolute z-40 h-3 w-3 rounded-sm bg-[#1F8A5B] shadow ${
                        h === 'nw'
                          ? '-top-1.5 -left-1.5 cursor-nwse-resize'
                          : h === 'ne'
                            ? '-top-1.5 -right-1.5 cursor-nesw-resize'
                            : h === 'sw'
                              ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                              : '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                      }`}
                      style={{ pointerEvents: 'auto' }}
                      onPointerDown={(event) => onPointerDown(event, el.id, 'resize', h)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ))}
                </>
              ) : null

              if (el.type === 'line') {
                const stroke = lineColor(el)
                const thickness = Math.max(1, el.strokeWidth || 2)
                const hitH = Math.max(14, thickness + 10)
                return (
                  <div
                    key={el.id}
                    style={{
                      ...boxStyle,
                      height: `${(hitH / canvasH) * 100}%`,
                      top: `${((el.y - (hitH - thickness) / 2) / canvasH) * 100}%`,
                      backgroundColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedId(el.id)
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: thickness,
                        backgroundColor: stroke,
                        borderRadius: 1,
                        pointerEvents: 'none',
                      }}
                    />
                    {resizeHandles}
                  </div>
                )
              }

              if (el.type === 'rect') {
                const frame = isPageFrameElement(el, canvasW, canvasH)
                return (
                  <div
                    key={el.id}
                    style={{
                      ...boxStyle,
                      backgroundColor: el.fill || 'transparent',
                      border: `${el.strokeWidth || 1}px solid ${el.stroke || 'transparent'}`,
                      pointerEvents: frame ? 'none' : 'auto',
                      overflow: frame ? 'visible' : undefined,
                    }}
                    onPointerDown={(event) => {
                      if (frame) return
                      onPointerDown(event, el.id, 'move')
                    }}
                    onClick={(event) => {
                      if (frame) return
                      event.stopPropagation()
                      setSelectedId(el.id)
                    }}
                  >
                    {frame ? (
                      <>
                        <span
                          className="absolute inset-x-0 top-0 z-20 min-h-[20px] cursor-move"
                          style={{ height: '8%', pointerEvents: 'auto' }}
                          onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(el.id)
                          }}
                        />
                        <span
                          className="absolute inset-x-0 bottom-0 z-20 min-h-[20px] cursor-move"
                          style={{ height: '8%', pointerEvents: 'auto' }}
                          onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(el.id)
                          }}
                        />
                        <span
                          className="absolute inset-y-0 left-0 z-20 min-w-[20px] cursor-move"
                          style={{ width: '8%', pointerEvents: 'auto' }}
                          onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(el.id)
                          }}
                        />
                        <span
                          className="absolute inset-y-0 right-0 z-20 min-w-[20px] cursor-move"
                          style={{ width: '8%', pointerEvents: 'auto' }}
                          onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(el.id)
                          }}
                        />
                      </>
                    ) : null}
                    {resizeHandles}
                  </div>
                )
              }

              if (el.type === 'ellipse') {
                return (
                  <div
                    key={el.id}
                    style={{
                      ...boxStyle,
                      borderRadius: '50%',
                      backgroundColor: el.fill || 'transparent',
                      border: `${el.strokeWidth || 1}px solid ${el.stroke || 'transparent'}`,
                    }}
                    onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedId(el.id)
                    }}
                  >
                    {resizeHandles}
                  </div>
                )
              }

              if (el.type === 'image') {
                const src =
                  resolvedUrls[el.id] ||
                  (!isPrivateCertStoragePath(el.src) && /^https?:\/\//i.test(String(el.src || ''))
                    ? String(el.src)
                    : '') ||
                  (/^(blob:|data:)/i.test(String(el.src || '')) ? String(el.src) : '')
                const pageFrame = isPageFrameElement(el, canvasW, canvasH)
                if (!src || brokenIds[el.id]) {
                  return (
                    <div
                      key={el.id}
                      style={{
                        ...boxStyle,
                        background: '#f1f5f4',
                        border: isSelected ? undefined : '1px dashed #94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        color: '#64748b',
                        textAlign: 'center',
                        padding: 4,
                        pointerEvents: pageFrame ? 'none' : 'auto',
                      }}
                      onPointerDown={(event) => {
                        if (pageFrame) return
                        onPointerDown(event, el.id, 'move')
                      }}
                      onClick={(event) => {
                        if (pageFrame) return
                        event.stopPropagation()
                        setSelectedId(el.id)
                      }}
                    >
                      {brokenIds[el.id] ? 'Image failed — replace' : 'Loading image…'}
                      {resizeHandles}
                    </div>
                  )
                }
                return (
                  <div
                    key={el.id}
                    style={{
                      ...boxStyle,
                      pointerEvents: pageFrame ? 'none' : 'auto',
                      overflow: pageFrame ? 'visible' : undefined,
                    }}
                    onPointerDown={(event) => {
                      if (pageFrame) return
                      onPointerDown(event, el.id, 'move')
                    }}
                    onClick={(event) => {
                      if (pageFrame) return
                      event.stopPropagation()
                      setSelectedId(el.id)
                    }}
                  >
                    <img
                      src={src}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: pageFrame ? 'fill' : 'contain',
                        pointerEvents: 'none',
                      }}
                      onError={() => setBrokenIds((prev) => ({ ...prev, [el.id]: true }))}
                      draggable={false}
                    />
                    {pageFrame ? (
                      <>
                        <span
                          className="absolute inset-x-0 top-0 z-20 min-h-[20px] cursor-move"
                          style={{ height: '8%', pointerEvents: 'auto' }}
                          onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(el.id)
                          }}
                        />
                        <span
                          className="absolute inset-x-0 bottom-0 z-20 min-h-[20px] cursor-move"
                          style={{ height: '8%', pointerEvents: 'auto' }}
                          onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(el.id)
                          }}
                        />
                        <span
                          className="absolute inset-y-0 left-0 z-20 min-w-[20px] cursor-move"
                          style={{ width: '8%', pointerEvents: 'auto' }}
                          onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(el.id)
                          }}
                        />
                        <span
                          className="absolute inset-y-0 right-0 z-20 min-w-[20px] cursor-move"
                          style={{ width: '8%', pointerEvents: 'auto' }}
                          onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(el.id)
                          }}
                        />
                      </>
                    ) : null}
                    {resizeHandles}
                  </div>
                )
              }

              if (isQrElement(el) || el.bind === 'qr') {
                return (
                  <div
                    key={el.id}
                    style={{ ...boxStyle, background: '#fff', padding: 2 }}
                    onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedId(el.id)
                    }}
                  >
                    <QRCode
                      value={preview.verificationUrl || 'https://verify.local/preview'}
                      size={128}
                      style={{ width: '100%', height: '100%' }}
                      fgColor={preview.primary || '#0f172a'}
                    />
                    {resizeHandles}
                  </div>
                )
              }

              return (
                <div
                  key={el.id}
                  style={{
                    ...boxStyle,
                    color: el.color || '#0f172a',
                    fontFamily: el.fontFamily || 'Georgia, serif',
                    fontSize: Math.max(8, (el.fontSize || 16) * scale),
                    fontWeight: el.fontWeight || 'normal',
                    fontStyle: el.fontStyle || 'normal',
                    textAlign: el.textAlign || 'center',
                    letterSpacing: el.letterSpacing ? `${(el.letterSpacing || 0) * scale}px` : undefined,
                    lineHeight: el.lineHeight || 1.25,
                    display: 'flex',
                    alignItems:
                      (el.height || 0) > (el.fontSize || 16) * 1.8 ? 'flex-start' : 'center',
                    justifyContent:
                      el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    padding: '0 2px',
                    backgroundColor: 'transparent',
                  }}
                  onPointerDown={(event) => onPointerDown(event, el.id, 'move')}
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    setSelectedId(el.id)
                    setTimeout(() => textEditRef.current?.focus(), 30)
                  }}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedId(el.id)
                  }}
                >
                  {resolveBuilderText(el, preview)}
                  {resizeHandles}
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-3">
          <p className="text-sm font-semibold text-[var(--ds-text-primary,#122018)]">
            {selected ? getBuilderLayerLabel(selected) : 'Select an element'}
          </p>
          {selected ? (
            <>
              {selected.type === 'text' ? (
                <div className="space-y-1.5">
                  <Label>Edit text</Label>
                  <Textarea
                    ref={textEditRef}
                    rows={4}
                    value={selected.text || ''}
                    onChange={(event) =>
                      commitDesign(updateElement(design, selected.id, { text: event.target.value }))
                    }
                  />
                  {selected.bind && selected.bind !== 'none' ? (
                    <p className="text-[11px] text-[var(--ds-text-secondary,#5B6B61)]">
                      Bound field: {selected.bind}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {selected.type === 'text' ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Font</Label>
                    <select
                      className="h-9 w-full rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-2 text-sm text-[var(--ds-text-primary,#122018)] outline-none focus:border-[var(--ds-accent,#1F8A5B)] focus:ring-1 focus:ring-[var(--ds-focus-ring,#1F8A5B)]"
                      value={selected.fontFamily || BUILDER_FONT_FAMILIES[0]}
                      onChange={(event) =>
                        commitDesign(updateElement(design, selected.id, { fontFamily: event.target.value }))
                      }
                    >
                      {BUILDER_FONT_FAMILIES.map((f) => (
                        <option key={f} value={f} style={{ fontFamily: f }}>
                          {builderFontLabel(f)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Font size</Label>
                      <Input
                        type="number"
                        min={8}
                        max={96}
                        value={selected.fontSize || 16}
                        onChange={(event) =>
                          commitDesign(
                            updateElement(design, selected.id, {
                              fontSize: Math.max(8, Math.min(96, Number(event.target.value) || 16)),
                            }),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Color</Label>
                      <input
                        type="color"
                        aria-label="Text color"
                        value={selected.color || '#0f172a'}
                        onChange={(event) =>
                          commitDesign(updateElement(design, selected.id, { color: event.target.value }))
                        }
                        className="h-9 w-full cursor-pointer rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-1"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        commitDesign(
                          updateElement(design, selected.id, {
                            fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold',
                          }),
                        )
                      }
                    >
                      {selected.fontWeight === 'bold' ? 'Bold on' : 'Bold'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        commitDesign(
                          updateElement(design, selected.id, {
                            fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic',
                          }),
                        )
                      }
                    >
                      {selected.fontStyle === 'italic' ? 'Italic on' : 'Italic'}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Letter spacing</Label>
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => nudgeSpacing(-0.5)}>
                        −
                      </Button>
                      <Input
                        type="number"
                        step="0.1"
                        value={Number(selected.letterSpacing) || 0}
                        onChange={(event) =>
                          commitDesign(
                            updateElement(design, selected.id, {
                              letterSpacing: Number(event.target.value) || 0,
                            }),
                          )
                        }
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => nudgeSpacing(0.5)}>
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Line height</Label>
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => nudgeLineHeight(-0.05)}>
                        −
                      </Button>
                      <Input
                        type="number"
                        step="0.05"
                        value={Number(selected.lineHeight) || 1.2}
                        onChange={(event) =>
                          commitDesign(
                            updateElement(design, selected.id, {
                              lineHeight: Number(event.target.value) || 1.2,
                            }),
                          )
                        }
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => nudgeLineHeight(0.05)}>
                        +
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
              {selected.type === 'line' || selected.type === 'rect' || selected.type === 'ellipse' ? (
                <div className="space-y-2 rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-2">
                  <p className="text-xs font-medium text-[var(--ds-text-primary,#122018)]">
                    {selected.type === 'line' ? 'Line style' : selected.type === 'rect' ? 'Frame / box style' : 'Shape style'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Color</Label>
                      <input
                        type="color"
                        aria-label="Line or frame color"
                        value={toColorInputValue(lineColor(selected))}
                        onChange={(event) =>
                          commitDesign(
                            updateElement(design, selected.id, {
                              stroke: event.target.value,
                              fill: selected.type === 'line' ? event.target.value : selected.fill,
                              color: event.target.value,
                            }),
                          )
                        }
                        className="h-9 w-full cursor-pointer rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Thickness</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={Math.max(1, selected.strokeWidth || 2)}
                        onChange={(event) =>
                          commitDesign(
                            updateElement(design, selected.id, {
                              strokeWidth: Math.max(1, Math.min(24, Number(event.target.value) || 2)),
                            }),
                          )
                        }
                      />
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(null)}>
                    Deselect
                  </Button>
                </div>
              ) : null}
              {selected.type === 'image' ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    Replace this image
                  </Button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>X</Label>
                  <Input
                    type="number"
                    value={Math.round(selected.x)}
                    onChange={(event) =>
                      commitDesign(updateElement(design, selected.id, { x: Number(event.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Y</Label>
                  <Input
                    type="number"
                    value={Math.round(selected.y)}
                    onChange={(event) =>
                      commitDesign(updateElement(design, selected.id, { y: Number(event.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Width</Label>
                  <Input
                    type="number"
                    value={Math.round(selected.width)}
                    onChange={(event) =>
                      commitDesign(
                        updateElement(design, selected.id, {
                          width: Math.max(8, Number(event.target.value) || 8),
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Height</Label>
                  <Input
                    type="number"
                    value={Math.round(selected.height)}
                    onChange={(event) =>
                      commitDesign(
                        updateElement(design, selected.id, {
                          height: Math.max(selected.type === 'line' ? 2 : 8, Number(event.target.value) || 8),
                        }),
                      )
                    }
                  />
                </div>
              </div>
              {selected.type === 'text' ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(null)}>
                  Deselect
                </Button>
              ) : null}
            </>
          ) : null}

          <div className="max-h-48 space-y-1 overflow-auto border-t border-[var(--ds-border,#DDE5DF)] pt-2">
            <p className="px-1 text-[11px] font-medium text-[var(--ds-text-tertiary,#8A978E)]">Layers</p>
            {sorted.map((el) => (
              <button
                key={el.id}
                type="button"
                className={`block w-full rounded px-2 py-1 text-left text-xs ${
                  el.id === selectedId
                    ? 'bg-[var(--ds-accent,#1F8A5B)]/10 text-[var(--ds-text-primary,#122018)]'
                    : 'text-[var(--ds-text-secondary,#5B6B61)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]'
                }`}
                onClick={() => setSelectedId(el.id)}
              >
                {getBuilderLayerLabel(el)}
                {el.type === 'line' ? ' · line' : el.type === 'rect' ? ' · frame' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CertificateImportEditor
