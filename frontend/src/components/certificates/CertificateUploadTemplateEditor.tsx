import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Lock, Save, Trash2, Unlock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import {
  getCertificateTemplateSignedUrl,
  getDocumentTemplate,
  saveDocumentUploadBuilder,
  type DocumentTemplateType,
} from '@/lib/api'
import {
  BUILDER_FONT_FAMILIES,
  builderFontLabel,
  createBoundPhotoElement,
  createBoundTextElement,
  createElementId,
  createVerificationQrElement,
  customUploadHasGeneratedDesign,
  getBuilderLayerLabel,
  getDocumentBuilderQuickFields,
  hasVerificationQr,
  isPrivateCertStoragePath,
  isQrElement,
  isUploadPaperElement,
  normalizeLogoBuilderDesign,
  normalizeVerificationQr,
  resolveBuilderText,
  type BuilderBinding,
  type BuilderElement,
  type CustomUploadMeta,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder'
import {
  getCertificateFooterText,
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getSignatoryLeftName,
  getSignatoryLeftTitle,
  getSignatoryRightName,
  getSignatoryRightTitle,
  getTranscriptFooterText,
  getInvoiceFooterText,
} from '@/lib/institution'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

function cloneDesign(d: LogoBuilderDesign): LogoBuilderDesign {
  return JSON.parse(JSON.stringify(d)) as LogoBuilderDesign
}

/**
 * Standalone upload-template editor. It only edits the scanned upload design
 * (custom_upload.design). Page Builder designs are never read or written here.
 */
const CertificateUploadTemplateEditor = ({
  documentType = 'certificate',
  remountKey,
}: {
  documentType?: DocumentTemplateType
  remountKey?: string | number
}) => {
  const docType = (documentType || 'certificate') as DocumentTemplateType
  const docLabel =
    docType === 'transcript' ? 'Transcript' : docType === 'invoice' ? 'Invoice' : 'Certificate'
  const { institution } = useAuth()
  const { toast } = useToast()
  const [design, setDesign] = useState<LogoBuilderDesign | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({})
  const canvasRef = useRef<HTMLDivElement | null>(null)
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
  const designRef = useRef(design)
  designRef.current = design

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const tpl = await getDocumentTemplate(docType)
        if (cancelled) return
        const upload = tpl?.config?.custom_upload as CustomUploadMeta | undefined
        if (customUploadHasGeneratedDesign(upload)) {
          setDesign(normalizeLogoBuilderDesign(upload!.design))
        } else {
          setDesign(null)
        }
      } catch {
        if (!cancelled) setDesign(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [institution?.id, docType, remountKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!design) return
      const images = design.elements.filter(
        (e) => e.type === 'image' && e.src && isPrivateCertStoragePath(e.src),
      )
      const updates: Record<string, string> = {}
      for (const el of images) {
        if (resolvedUrls[el.id]) continue
        try {
          const url = await getCertificateTemplateSignedUrl(el.src!)
          if (url) updates[el.id] = url
        } catch {
          /* skip */
        }
      }
      if (!cancelled && Object.keys(updates).length) {
        setResolvedUrls((prev) => ({ ...prev, ...updates }))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.elements.map((e) => `${e.id}:${e.src}`).join('|')])

  const previewDesign = useMemo(() => {
    if (!design) return null
    return normalizeVerificationQr({
      ...design,
      elements: design.elements.map((el) =>
        el.type === 'image' && isPrivateCertStoragePath(el.src)
          ? { ...el, src: resolvedUrls[el.id] || el.src }
          : el,
      ),
    })
  }, [design, resolvedUrls])

  const selected = useMemo(
    () => design?.elements.find((e) => e.id === selectedId) || null,
    [design, selectedId],
  )

  const sampleData: CertificateRenderData = useMemo(() => {
    const base = {
      layoutKey: 'custom_upload' as const,
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
      logoBuilderDesign: previewDesign || undefined,
    }
    if (docType === 'transcript') {
      return {
        ...base,
        programName: 'Diploma in Professional Studies',
        certificateNumber: 'TRN-0000042',
        verificationUrl: 'https://example.com/verify/previewcode12345678',
        footerText: getTranscriptFooterText(institution) || undefined,
        gpa: '3.40',
        gradesSummary: 'Intro to Practice                 3      A',
      } as CertificateRenderData
    }
    if (docType === 'invoice') {
      return {
        ...base,
        programName: 'Tuition & fees',
        certificateNumber: 'INV-STU-001',
        invoiceNumber: 'INV-STU-001',
        totalDue: '175.00',
        amountPaid: '150.00',
        balance: '25.00',
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

  const pushDesign = useCallback((next: LogoBuilderDesign) => {
    setDesign(normalizeVerificationQr(next))
  }, [])

  const updateSelected = (patch: Record<string, unknown>) => {
    if (!design || !selectedId) return
    const next = cloneDesign(design)
    next.elements = next.elements.map((e) => (e.id === selectedId ? { ...e, ...patch } : e))
    pushDesign(next)
  }

  const onPointerDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize') => {
    e.stopPropagation()
    e.preventDefault()
    canvasRef.current?.focus?.()
    if (!design || !canvasRef.current) return
    const el = design.elements.find((x) => x.id === id)
    if (!el) return
    setSelectedId(id)
    if (el.locked) return
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
    if (!dragRef.current || !canvasRef.current || !design) return
    const rect = canvasRef.current.getBoundingClientRect()
    if (rect.width < 1) return
    const scaleX = design.canvas.width / rect.width
    const scaleY = design.canvas.height / rect.height
    const dx = (e.clientX - dragRef.current.startX) * scaleX
    const dy = (e.clientY - dragRef.current.startY) * scaleY
    const drag = dragRef.current
    setDesign((prev) => {
      if (!prev) return prev
      const next = cloneDesign(prev)
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
    dragRef.current = null
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const el = designRef.current?.elements.find((x) => x.id === selectedId)
        if (!el || el.locked) return
        e.preventDefault()
        setDesign((prev) => {
          if (!prev) return prev
          const next = cloneDesign(prev)
          next.elements = next.elements.filter((x) => x.id !== selectedId)
          return next
        })
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const addField = (key: Exclude<BuilderBinding, 'qr' | 'none'>) => {
    if (!design) return
    if (design.elements.some((e) => e.bind === key)) {
      const existing = design.elements.find((e) => e.bind === key)
      if (existing) setSelectedId(existing.id)
      return
    }
    const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const el =
      key === 'studentPhoto'
        ? createBoundPhotoElement(design.canvas, { zIndex: z })
        : createBoundTextElement(key, design.canvas, { zIndex: z, fill: 'transparent' })
    const next = cloneDesign(design)
    next.elements.push(el)
    pushDesign(next)
    setSelectedId(el.id)
  }

  const addFreeText = () => {
    if (!design) return
    const z = design.elements.reduce((m, e) => Math.max(m, e.zIndex || 0), 0) + 1
    const el: BuilderElement = {
      id: createElementId(),
      type: 'text',
      x: Math.round(design.canvas.width * 0.18),
      y: Math.round(design.canvas.height * 0.42),
      width: Math.round(design.canvas.width * 0.64),
      height: 48,
      rotation: 0,
      zIndex: z,
      text: 'New text',
      fontFamily: BUILDER_FONT_FAMILIES[0],
      fontSize: 22,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#0f172a',
      fill: 'transparent',
      bind: 'none',
    }
    const next = cloneDesign(design)
    next.elements.push(el)
    pushDesign(next)
    setSelectedId(el.id)
  }

  const setCanvasBackground = (color: string) => {
    if (!design) return
    const next = cloneDesign(design)
    next.canvas = { ...next.canvas, background: color }
    pushDesign(next)
  }

  const addQr = () => {
    if (!design) return
    if (hasVerificationQr(design)) {
      const q = design.elements.find((e) => isQrElement(e))
      if (q) setSelectedId(q.id)
      return
    }
    const next = cloneDesign(design)
    next.elements.push(createVerificationQrElement(design.canvas))
    pushDesign(next)
  }

  const handleSave = async () => {
    if (!design) return
    setSaving(true)
    try {
      await saveDocumentUploadBuilder(docType, normalizeLogoBuilderDesign(design), true)
      toast({
        title: 'Upload template saved',
        description: `This upload template is live. Page Builder is unchanged.`,
      })
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

  if (loading) {
    return (
      <div className="flex justify-center rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] py-10">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
      </div>
    )
  }

  if (!design) return null

  const layers = design.elements.slice().sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))

  const freeText = !!selected && selected.type === 'text' && (!selected.bind || selected.bind === 'none')

  return (
    <Card className="overflow-hidden border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)]">
      <CardHeader className="border-b border-[var(--ds-border,#DDE5DF)] pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ds-primary,#1F8A5B)]">
              Upload template
            </p>
            <CardTitle className="mt-1 text-base text-[var(--ds-text-primary,#122018)]">
              Edit the scanned {docLabel.toLowerCase()}
            </CardTitle>
            <CardDescription className="mt-1">
              Add text on the scanned page, change colors, then save. This template stays separate
              from Page Builder.
            </CardDescription>
          </div>
          <Badge variant="outline">Own template</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={addFreeText}>
            + Text
          </Button>
          {getDocumentBuilderQuickFields(docType).map((f) => (
            <Button
              key={f.key}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => addField(f.key)}
            >
              + {f.label}
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={addQr}>
            + QR
          </Button>
          <label className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--ds-text-secondary,#5B6B61)]">
            Paper
            <input
              type="color"
              aria-label="Paper color"
              value={design.canvas.background || '#ffffff'}
              onChange={(e) => setCanvasBackground(e.target.value)}
              className="h-7 w-8 cursor-pointer rounded border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-0.5"
            />
          </label>
          <span className="flex-1" />
          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save template
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div
            ref={canvasRef}
            tabIndex={0}
            className="relative mx-auto w-full max-w-2xl overflow-hidden rounded border border-[var(--ds-border,#DDE5DF)] outline-none focus:ring-2 focus:ring-[var(--ds-primary,#1F8A5B)]/30"
            style={{
              aspectRatio: `${design.canvas.width}/${design.canvas.height}`,
              backgroundColor: design.canvas.background || '#ffffff',
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClick={() => setSelectedId(null)}
          >
            {design.elements
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map((el) => {
                const isPaper = isUploadPaperElement(el)
                const isSel = el.id === selectedId
                const isQr = isQrElement(el)
                const src =
                  el.type === 'image' && isPrivateCertStoragePath(el.src)
                    ? resolvedUrls[el.id] || ''
                    : el.src
                return (
                  <div
                    key={el.id}
                    onPointerDown={(e) => onPointerDown(e, el.id, 'move')}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute ${el.locked ? 'cursor-default' : 'cursor-move'} ${
                      isSel ? (isQr ? 'ring-2 ring-amber-400' : 'ring-2 ring-indigo-500') : ''
                    }`}
                    style={{
                      left: `${(el.x / design.canvas.width) * 100}%`,
                      top: `${(el.y / design.canvas.height) * 100}%`,
                      width: `${(el.width / design.canvas.width) * 100}%`,
                      height: `${(el.height / design.canvas.height) * 100}%`,
                      zIndex: el.zIndex,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      background: isQr
                        ? '#fff'
                        : el.fill && String(el.fill).toLowerCase() !== 'transparent'
                          ? el.fill
                          : 'transparent',
                      color: el.color,
                      fontFamily: el.fontFamily,
                      fontSize: Math.max(8, (el.fontSize || 16) * 0.55),
                      fontWeight: el.fontWeight,
                      fontStyle: el.fontStyle,
                      textAlign: el.textAlign,
                    }}
                  >
                    {el.type === 'image' && src ? (
                      <img
                        src={src}
                        alt=""
                        className={`w-full h-full pointer-events-none ${
                          isPaper ? 'object-fill' : 'object-contain'
                        }`}
                      />
                    ) : isQr ? (
                      <span className="text-[10px] font-semibold text-amber-700">QR</span>
                    ) : el.type === 'text' ? (
                      <span
                        className="w-full px-1 leading-tight"
                        style={{ textAlign: el.textAlign || 'center' }}
                      >
                        {resolveBuilderText(el, sampleData)}
                      </span>
                    ) : null}
                    {isSel && !el.locked ? (
                      <span
                        className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-sm bg-indigo-500 cursor-se-resize"
                        onPointerDown={(e) => onPointerDown(e, el.id, 'resize')}
                      />
                    ) : null}
                  </div>
                )
              })}
          </div>

          <div className="space-y-2 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-3">
            <p className="text-xs text-[var(--ds-text-secondary,#5B6B61)]">Layers ({layers.length})</p>
            <div className="max-h-52 overflow-auto space-y-1">
              {layers.map((el) => (
                <div
                  key={el.id}
                  className={`flex items-center gap-1 rounded px-1 ${
                    el.id === selectedId ? 'bg-[var(--ds-primary,#1F8A5B)]/15' : 'bg-white'
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 truncate px-1 py-1.5 text-left text-[11px] text-[var(--ds-text-primary,#122018)]"
                    onClick={() => setSelectedId(el.id)}
                  >
                    {isUploadPaperElement(el) ? 'Certificate design' : getBuilderLayerLabel(el)}
                    {el.locked ? ' 🔒' : ''}
                  </button>
                  <button
                    type="button"
                    className="p-1 text-[var(--ds-text-tertiary,#8A978E)] hover:text-[var(--ds-text-primary,#122018)]"
                    title={el.locked ? 'Unlock' : 'Lock'}
                    onClick={() => {
                      const next = cloneDesign(design)
                      next.elements = next.elements.map((e) =>
                        e.id === el.id ? { ...e, locked: !e.locked } : e,
                      )
                      pushDesign(next)
                    }}
                  >
                    {el.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                  {!isQrElement(el) && !el.locked ? (
                    <button
                      type="button"
                      className="p-1 text-[var(--ds-text-tertiary,#8A978E)] hover:text-red-600"
                      onClick={() => {
                        const next = cloneDesign(design)
                        next.elements = next.elements.filter((e) => e.id !== el.id)
                        pushDesign(next)
                        if (selectedId === el.id) setSelectedId(null)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {selected && selected.type === 'text' && !isQrElement(selected) ? (
              <div className="space-y-2 border-t border-[var(--ds-border,#DDE5DF)] pt-2">
                {freeText ? (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">Text</Label>
                    <Input
                      value={selected.text || ''}
                      onChange={(e) => updateSelected({ text: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                ) : null}
                <div className="space-y-1">
                  <Label className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">Font</Label>
                  <select
                    className="h-8 w-full rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-2 text-xs text-[var(--ds-text-primary,#122018)] outline-none focus:border-[var(--ds-accent,#1F8A5B)]"
                    value={selected.fontFamily || BUILDER_FONT_FAMILIES[0]}
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
                    <Label className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">Size</Label>
                    <Input
                      type="number"
                      min={8}
                      max={96}
                      value={selected.fontSize || 16}
                      onChange={(e) =>
                        updateSelected({ fontSize: Math.max(8, Number(e.target.value) || 16) })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">Color</Label>
                    <input
                      type="color"
                      aria-label="Text color"
                      value={selected.color || '#0f172a'}
                      onChange={(e) => updateSelected({ color: e.target.value })}
                      className="h-8 w-full cursor-pointer rounded border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-0.5"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() =>
                    updateSelected({ fontWeight: selected.fontWeight === 'bold' ? 'normal' : 'bold' })
                  }
                >
                  {selected.fontWeight === 'bold' ? 'Bold on' : 'Bold'}
                </Button>
              </div>
            ) : null}

            <p className="border-t border-[var(--ds-border,#DDE5DF)] pt-1 text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">
              Drag · resize · change color · Del to remove · Save template when ready
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CertificateUploadTemplateEditor
