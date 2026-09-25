import React, { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import {
  resolveBuilderText,
  resolveBuilderImageSrc,
  isFullPageDecorElement,
  isPrivateCertStoragePath,
  isStudentPhotoElement,
  extractCertStoragePath,
  type BuilderElement,
  type LogoBuilderDesign,
  type PaperContentLayer,
  type UploadFieldLayout,
  type UploadFieldSlot,
} from '@/lib/certificateBuilder'
import { resolveCertificateDesignImages } from '@/lib/certificateGenerator'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import CertificateAppreciationLayout from '@/components/certificates/CertificateAppreciationLayout'

type Props = {
  data: CertificateRenderData
  design?: LogoBuilderDesign | null
  backgroundUrl?: string | null
  compact?: boolean
  /** Upload Own — render uploaded artwork + matched fields (not a separate layout). */
  composeUpload?: boolean
  /** PDF capture — fill host box exactly */
  forPdf?: boolean
  /** When true (certificates), hide bound institution name if a logo is present. Transcripts show both. */
  hideInstitutionNameWhenLogo?: boolean
}

function sortedElements(elements: BuilderElement[]) {
  return [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
}

function fieldValue(slot: UploadFieldSlot, data: CertificateRenderData): string {
  switch (slot.key) {
    case 'studentName':
      return data.studentName || ''
    case 'programName':
      return data.programName || data.className || ''
    case 'certificateNumber':
      return data.certificateNumber
        ? `No. ${data.certificateNumber}`
        : data.invoiceNumber
          ? `No. ${data.invoiceNumber}`
          : ''
    case 'dateIssued':
      return data.dateIssued ? String(data.dateIssued).slice(0, 10) : ''
    case 'studentId':
      return data.studentId || ''
    case 'gpa':
      return data.gpa ? `GPA: ${data.gpa}` : ''
    case 'gradesSummary':
      return data.gradesSummary || ''
    case 'totalDue':
      return data.totalDue ? `Total due: ${data.totalDue}` : ''
    case 'amountPaid':
      return data.amountPaid ? `Paid: ${data.amountPaid}` : ''
    case 'balance':
      return data.balance ? `Balance: ${data.balance}` : ''
    case 'lineItemsSummary':
      return data.lineItemsSummary || ''
    default:
      return ''
  }
}

function paperLayerText(layer: PaperContentLayer, data: CertificateRenderData): string {
  const bind = layer.bind
  if (!bind || bind === 'none') return layer.text || ''
  const fakeSlot = { key: bind, x: 0, y: 0, w: 0, h: 0, fontSize: 14, color: '', enabled: true } as UploadFieldSlot
  return fieldValue(fakeSlot, data) || layer.text || ''
}

/**
 * Renders Upload Own: 100% uploaded artwork + editable paper layers + matched fields.
 */
function UploadFieldOverlay({
  data,
  backgroundUrl,
  layout,
  paperLayers = [],
  compact,
  forPdf = false,
}: {
  data: CertificateRenderData
  backgroundUrl: string
  layout: UploadFieldLayout
  paperLayers?: PaperContentLayer[]
  compact: boolean
  forPdf?: boolean
}) {
  const aspect =
    data.customAspectRatio && data.customAspectRatio > 0
      ? Math.min(2.4, Math.max(0.5, data.customAspectRatio))
      : 297 / 210

  const s = (n: number) => (compact ? Math.max(7, Math.round(n * 0.48)) : n)

  return (
    <div
      className={`w-full relative overflow-hidden bg-white ${
        compact
          ? 'rounded border border-slate-200'
          : forPdf
            ? ''
            : 'rounded-lg shadow-xl border border-slate-200'
      }`}
      style={
        forPdf
          ? { width: '100%', height: '100%', aspectRatio: 'auto' }
          : { aspectRatio: `${aspect}`, width: '100%' }
      }
      data-cert-mode="custom-upload"
      data-cert-pdf={forPdf ? '1' : undefined}
    >
      <img
        src={backgroundUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-fill select-none"
        crossOrigin="anonymous"
        draggable={false}
      />

      {(paperLayers || [])
        .filter((l) => l.enabled !== false)
        .map((layer) => (
          <div
            key={layer.id}
            style={{
              position: 'absolute',
              left: `${layer.x}%`,
              top: `${layer.y}%`,
              width: `${layer.w}%`,
              height: `${layer.h}%`,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                layer.align === 'left'
                  ? 'flex-start'
                  : layer.align === 'right'
                    ? 'flex-end'
                    : 'center',
              background: layer.coverColor || '#ffffff',
              color: layer.color || '#111827',
              fontSize: s(layer.fontSize || 14),
              fontWeight: layer.fontWeight || 'normal',
              fontStyle: layer.fontStyle || 'normal',
              textAlign: layer.align || 'center',
              overflow: 'hidden',
              lineHeight: 1.2,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              padding: '0 4px',
              pointerEvents: 'none',
            }}
          >
            {paperLayerText(layer, data)}
          </div>
        ))}

      {(layout.fields || [])
        .filter((f) => f.enabled !== false)
        .map((slot) => {
          const box: React.CSSProperties = {
            position: 'absolute',
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            width: `${slot.w}%`,
            height: `${slot.h}%`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              slot.align === 'left' ? 'flex-start' : slot.align === 'right' ? 'flex-end' : 'center',
            pointerEvents: 'none',
          }

          if (slot.key === 'qr') {
            const qrValue = data.verificationUrl || 'https://verify.local/preview'
            return (
              <div key={slot.key} style={{ ...box, background: '#ffffff', padding: 2 }}>
                <QRCode
                  value={qrValue}
                  size={256}
                  level="H"
                  fgColor={slot.color || '#0f172a'}
                  bgColor="#FFFFFF"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            )
          }

          return (
            <div
              key={slot.key}
              style={{
                ...box,
                color: slot.color || '#111827',
                fontFamily:
                  slot.key === 'studentName'
                    ? '"Great Vibes", "Segoe Script", Georgia, serif'
                    : 'Georgia, serif',
                fontSize: s(slot.fontSize || 14),
                fontWeight: slot.key === 'programName' ? 600 : 400,
                textAlign: slot.align || 'center',
                overflow: 'hidden',
                lineHeight: 1.2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: '0 4px',
              }}
              title={fieldValue(slot, data)}
            >
              {fieldValue(slot, data)}
            </div>
          )
        })}
    </div>
  )
}

/**
 * Renders custom certificate designs (logo builder layers and/or uploaded background).
 */
const CertificateDesignRenderer = ({
  data,
  design,
  backgroundUrl,
  compact = false,
  composeUpload = false,
  forPdf = false,
  hideInstitutionNameWhenLogo = true,
}: Props) => {
  // Resolve private storage paths inside the renderer so preview always shows the
  // patch even when a parent forgot to hydrate (PDF path already inlines separately).
  const imageKey = useMemo(() => {
    return (design?.elements || [])
      .filter((el) => el.type === 'image' && el.src)
      .map((el) => `${el.id}:${String(el.src).slice(0, 120)}`)
      .join('|')
  }, [design])

  const [liveDesign, setLiveDesign] = useState<LogoBuilderDesign | null | undefined>(design)

  useEffect(() => {
    let cancelled = false
    setLiveDesign(design)
    const needsResolve = (design?.elements || []).some((el) => {
      if (el.type !== 'image' || !el.src) return false
      const raw = String(el.src)
      if (/^(data:|blob:|https?:)/i.test(raw) && !extractCertStoragePath(raw)) return false
      return Boolean(extractCertStoragePath(raw) || isPrivateCertStoragePath(raw))
    })
    if (!needsResolve) return
    ;(async () => {
      try {
        const resolved = await resolveCertificateDesignImages(design)
        if (!cancelled) setLiveDesign(resolved)
      } catch {
        if (!cancelled) setLiveDesign(design)
      }
    })()
    return () => {
      cancelled = true
    }
    // imageKey captures src changes without depending on unstable object identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey])

  if (composeUpload) {
    if (backgroundUrl && data.customFieldLayout) {
      return (
        <UploadFieldOverlay
          data={data}
          backgroundUrl={backgroundUrl}
          layout={data.customFieldLayout}
          paperLayers={data.customPaperLayers || []}
          compact={compact}
          forPdf={forPdf}
        />
      )
    }
    if (backgroundUrl) {
      return (
        <UploadFieldOverlay
          data={data}
          backgroundUrl={backgroundUrl}
          layout={
            data.customFieldLayout || {
              version: 1,
              fields: [],
            }
          }
          paperLayers={data.customPaperLayers || []}
          compact={compact}
          forPdf={forPdf}
        />
      )
    }
    // Fallback only when no uploaded artwork is available
    return <CertificateAppreciationLayout data={data} compact={compact} />
  }

  const activeDesign = liveDesign || design
  const canvasW = activeDesign?.canvas?.width || 794
  const canvasH = activeDesign?.canvas?.height || 1123
  const canvasBg = activeDesign?.canvas?.background || '#ffffff'
  const elements = sortedElements(activeDesign?.elements || [])

  return (
    <div
      className={`w-full relative overflow-hidden text-slate-900 ${
        compact
          ? 'rounded border border-slate-200'
          : forPdf
            ? 'h-full'
            : 'h-full rounded-lg shadow-xl border border-slate-200'
      }`}
      style={
        forPdf
          ? {
              width: '100%',
              height: '100%',
              aspectRatio: 'auto',
              backgroundColor: canvasBg,
            }
          : {
              aspectRatio: `${canvasW}/${canvasH}`,
              backgroundColor: canvasBg,
              width: '100%',
            }
      }
      data-cert-mode="logo-builder"
      data-cert-pdf={forPdf ? '1' : undefined}
    >
      <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : null}

        {elements.map((el) => {
          if (el.hidden) return null
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${(el.x / canvasW) * 100}%`,
            top: `${(el.y / canvasH) * 100}%`,
            width: `${(el.width / canvasW) * 100}%`,
            height: `${(el.height / canvasH) * 100}%`,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            transformOrigin: 'center center',
            zIndex: el.zIndex || 0,
            boxSizing: 'border-box',
            opacity: el.opacity ?? 1,
          }

          if (el.type === 'rect' || el.type === 'line') {
            const g = el.type === 'rect' ? el.fillGradient : null
            return (
              <div
                key={el.id}
                style={{
                  ...style,
                  backgroundColor: el.type === 'line' ? el.stroke || '#002147' : g ? undefined : el.fill || 'transparent',
                  backgroundImage:
                    el.type === 'rect' && g
                      ? `linear-gradient(${g.angle ?? 180}deg, ${g.from}, ${g.to})`
                      : undefined,
                  border:
                    el.type === 'rect'
                      ? `${el.strokeWidth || 1}px solid ${el.stroke || 'transparent'}`
                      : undefined,
                  height: el.type === 'line' ? Math.max(2, el.strokeWidth || 2) : style.height,
                }}
              />
            )
          }

          if (el.type === 'ellipse') {
            const g = el.fillGradient
            return (
              <div
                key={el.id}
                style={{
                  ...style,
                  borderRadius: '50%',
                  backgroundColor: g ? undefined : el.fill || 'transparent',
                  backgroundImage: g
                    ? `linear-gradient(${g.angle ?? 180}deg, ${g.from}, ${g.to})`
                    : undefined,
                  border: `${el.strokeWidth || 1}px solid ${el.stroke || 'transparent'}`,
                }}
              />
            )
          }

          if (el.type === 'image' && (el.src || isStudentPhotoElement(el))) {
            const src = isStudentPhotoElement(el)
              ? resolveBuilderImageSrc(el, { studentPhotoUrl: data.studentPhotoUrl })
              : el.src || ''
            if (!src) return null
            const isData = String(src).startsWith('data:')
            const isBlob = String(src).startsWith('blob:')
            const isRemote = /^https?:\/\//i.test(src)
            // Never paint raw private storage paths — resolve effect will replace them.
            // Painting them as relative URLs caused a blank hole between signatures.
            if (!isData && !isBlob && !isRemote) return null
            // Uploaded certificate paper must fill the canvas 100% (no letterboxing)
            const isPaper =
              el.text === '__upload_paper__' ||
              el.text === 'background-art' ||
              (el.locked &&
                el.x === 0 &&
                el.y === 0 &&
                Math.abs(el.width - canvasW) < 2 &&
                Math.abs(el.height - canvasH) < 2)
            const fillBox = isPaper || isFullPageDecorElement(el)
            // No crossOrigin on screen preview — private signed URLs break under CORS
            // and hide the certificate patch. PDF capture already inlines to data URLs.
            return (
              <img
                key={el.id}
                src={src}
                alt=""
                style={{
                  ...style,
                  objectFit: isStudentPhotoElement(el) ? 'cover' : fillBox ? 'fill' : 'contain',
                }}
              />
            )
          }

          if (el.bind === 'qr') {
            const qrValue = data.verificationUrl || 'https://verify.local/preview'
            return (
              <div
                key={el.id}
                style={{ ...style, background: '#fff', padding: 2 }}
                title="Institution verification QR"
              >
                <QRCode
                  value={qrValue}
                  size={256}
                  level="H"
                  fgColor={data.primary || '#0f172a'}
                  bgColor="#FFFFFF"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            )
          }

          if (el.bind === 'institutionName' && hideInstitutionNameWhenLogo && String(data.logoUrl || '').trim()) {
            return null
          }

          const text = resolveBuilderText(el, data)
          // Text fill is unused in the page builder (always transparent there).
          // Never paint it as a highlight box in preview/PDF — that caused the
          // light blue/grey rectangles behind titles and body copy.
          return (
            <div
              key={el.id}
              style={{
                ...style,
                color: el.color || '#0f172a',
                fontFamily: el.fontFamily || 'Georgia, serif',
                fontSize: compact
                  ? Math.max(6, Math.round((el.fontSize || 16) * 0.45))
                  : el.fontSize || 16,
                fontWeight: el.fontWeight || 'normal',
                fontStyle: el.fontStyle || 'normal',
                textDecoration: el.textDecoration === 'underline' ? 'underline' : 'none',
                textAlign: el.textAlign || 'center',
                letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : undefined,
                display: 'flex',
                alignItems:
                  (el.height || 0) > (el.fontSize || 16) * 1.8 ? 'flex-start' : 'center',
                justifyContent:
                  el.textAlign === 'left'
                    ? 'flex-start'
                    : el.textAlign === 'right'
                      ? 'flex-end'
                      : 'center',
                paddingTop:
                  (el.height || 0) > (el.fontSize || 16) * 1.8 ? 2 : undefined,
                lineHeight: el.lineHeight || 1.2,
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                backgroundColor: 'transparent',
                boxSizing: 'border-box',
              }}
            >
              {text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CertificateDesignRenderer
