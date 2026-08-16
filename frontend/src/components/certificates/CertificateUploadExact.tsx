import React, { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import type { CertificateRenderData } from '@/lib/certificateTemplates'

type Props = {
  data: CertificateRenderData
  backgroundUrl?: string | null
  compact?: boolean
}

type Slot = {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Prepared template from the uploaded certificate.
 * Keeps the upload’s artwork 100% (colors, shapes, gold bar, seal, size).
 * Only covers placeholder text areas and writes real institution/student data there.
 */
const CertificateUploadExact = ({ data, backgroundUrl, compact = false }: Props) => {
  const [aspect, setAspect] = useState<number>(
    data.customAspectRatio && data.customAspectRatio > 0 ? data.customAspectRatio : 297 / 210,
  )

  useEffect(() => {
    if (data.customAspectRatio && data.customAspectRatio > 0) {
      setAspect(data.customAspectRatio)
    }
    if (!backgroundUrl) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const w = img.naturalWidth || 0
      const h = img.naturalHeight || 0
      if (w > 0 && h > 0) setAspect(w / h)
    }
    img.src = backgroundUrl
    return () => {
      cancelled = true
    }
  }, [backgroundUrl, data.customAspectRatio])

  // Exact uploaded page proportions (no forced A4 crop)
  const pageAspect = Math.min(2.4, Math.max(0.5, aspect || 297 / 210))
  const landscape = pageAspect >= 1
  const s = (n: number) => (compact ? Math.max(7, Math.round(n * 0.48)) : n)

  const dateLabel = data.dateIssued ? String(data.dateIssued).slice(0, 10) : ''
  const bodyText =
    data.footerText ||
    data.description ||
    data.motto ||
    'in recognition of outstanding dedication, professional growth, and valuable contribution.'

  /**
   * Slot map matched to the landscape appreciation upload
   * (navy header ~28%, gold bar, white body, seal center, signatures).
   */
  const slots = useMemo(() => {
    if (!landscape) {
      return {
        companyCover: { x: 12, y: 4, w: 76, h: 4 } as Slot,
        nameCover: { x: 10, y: 36, w: 80, h: 8 } as Slot,
        bodyCover: { x: 10, y: 46, w: 80, h: 14 } as Slot,
        leftCover: { x: 6, y: 78, w: 30, h: 10 } as Slot,
        rightCover: { x: 64, y: 78, w: 30, h: 10 } as Slot,
        qr: { x: 84, y: 84, w: 12, h: 9 } as Slot,
      }
    }
    return {
      // Cover "YOUR COMPANY NAME S.L" only — keep CERTIFICATE / OF APPRECIATION artwork
      companyCover: { x: 18, y: 3.5, w: 64, h: 5.5 } as Slot,
      // Cover "Donald Draper" script area
      nameCover: { x: 14, y: 38.5, w: 72, h: 9 } as Slot,
      // Cover "YOUR HEADLINE HERE" + lorem block
      bodyCover: { x: 14, y: 49, w: 72, h: 15 } as Slot,
      // Cover left signature name + title (William Bell / Founder)
      leftCover: { x: 6, y: 76, w: 28, h: 12 } as Slot,
      // Cover right signature name + title (Walter Bishop / Founder)
      rightCover: { x: 66, y: 76, w: 28, h: 12 } as Slot,
      qr: { x: 89, y: 80, w: 8, h: 13 } as Slot,
    }
  }, [landscape])

  const box = (slot: Slot, extra: React.CSSProperties = {}): React.CSSProperties => ({
    position: 'absolute',
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    width: `${slot.w}%`,
    height: `${slot.h}%`,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    ...extra,
  })

  if (!backgroundUrl) {
    return (
      <div
        className={`w-full flex items-center justify-center bg-slate-100 text-slate-400 text-sm ${
          compact ? 'rounded border' : 'rounded-lg border shadow-xl'
        }`}
        style={{ aspectRatio: `${pageAspect}` }}
      >
        Upload a certificate design first
      </div>
    )
  }

  return (
    <div
      className={`w-full relative overflow-hidden bg-white ${
        compact ? 'rounded border border-slate-200' : 'rounded-lg shadow-xl border border-slate-200'
      }`}
      style={{ aspectRatio: `${pageAspect}` }}
      data-upload-aspect={String(pageAspect)}
      data-cert-mode="upload-exact"
    >
      {/* 100% uploaded artwork — shapes, gold bar, seal, navy, swirls, size */}
      <img
        src={backgroundUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-fill select-none"
        crossOrigin="anonymous"
        draggable={false}
      />

      {/* --- Erase placeholder text only (match local background colors) --- */}
      <div style={box(slots.companyCover, { background: '#001f3f' })} />
      <div style={box(slots.nameCover, { background: '#ffffff' })} />
      <div style={box(slots.bodyCover, { background: '#ffffff' })} />
      <div style={box(slots.leftCover, { background: '#ffffff' })} />
      <div style={box(slots.rightCover, { background: '#ffffff' })} />
      {/* Clear corner for live QR (hide any sample QR in artwork) */}
      <div style={box(slots.qr, { background: '#ffffff' })} />

      {/* Institution name (replaces YOUR COMPANY NAME) */}
      <div
        style={box(slots.companyCover, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: 'Montserrat, Arial, sans-serif',
          fontSize: s(11),
          fontWeight: 500,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '0 4px',
        })}
        title={data.institutionName}
      >
        <span className="truncate w-full">{data.institutionName}</span>
      </div>

      {/* Student name (replaces Donald Draper) */}
      <div
        style={box(slots.nameCover, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#111827',
          fontFamily: '"Great Vibes", "Segoe Script", cursive',
          fontSize: s(landscape ? 40 : 32),
          textAlign: 'center',
          padding: '0 6px',
        })}
        title={data.studentName}
      >
        <span className="truncate w-full">{data.studentName}</span>
      </div>

      {/* Program + description (replaces headline + lorem) */}
      <div
        style={box(slots.bodyCover, {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          textAlign: 'center',
          padding: '2px 8px',
          overflow: 'hidden',
        })}
      >
        <p
          style={{
            margin: 0,
            color: '#9ca3af',
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: s(9),
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {data.programName ? 'Awarded for' : ''}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            color: '#374151',
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: s(14),
            fontWeight: 600,
            maxWidth: '100%',
          }}
          className="line-clamp-2"
          title={data.programName}
        >
          {data.programName}
        </p>
        <p
          style={{
            margin: '6px 0 0',
            color: '#6b7280',
            fontFamily: 'Georgia, serif',
            fontSize: s(11),
            lineHeight: 1.35,
            maxWidth: '92%',
          }}
          className="line-clamp-3"
        >
          {bodyText}
        </p>
        <p
          style={{
            margin: '6px 0 0',
            color: '#6b7280',
            fontFamily: 'ui-monospace, monospace',
            fontSize: s(10),
          }}
        >
          {data.certificateNumber ? `No. ${data.certificateNumber}` : ''}
          {data.certificateNumber && dateLabel ? '  ·  ' : ''}
          {dateLabel || ''}
        </p>
      </div>

      {/* Left signatory */}
      <div
        style={box(slots.leftCover, {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '2px',
        })}
      >
        {data.signatureUrl ? (
          <img
            src={data.signatureUrl}
            alt=""
            style={{ height: s(22), width: 'auto', objectFit: 'contain', marginBottom: 2 }}
          />
        ) : null}
        <p
          style={{
            margin: 0,
            fontFamily: '"Great Vibes", cursive',
            fontSize: s(16),
            color: '#111827',
            maxWidth: '100%',
          }}
          className="truncate"
        >
          {data.leftName || 'Authorized Signatory'}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: s(9),
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {data.leftTitle || 'Registrar'}
        </p>
      </div>

      {/* Right signatory */}
      <div
        style={box(slots.rightCover, {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '2px',
        })}
      >
        <p
          style={{
            margin: 0,
            fontFamily: '"Great Vibes", cursive',
            fontSize: s(16),
            color: '#111827',
            maxWidth: '100%',
          }}
          className="truncate"
        >
          {data.rightName || 'Authorized Signatory'}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: s(9),
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {data.rightTitle || 'Principal'}
        </p>
      </div>

      {/* Live verification QR */}
      {data.verificationUrl ? (
        <div style={box(slots.qr, { background: '#ffffff', padding: 2 })}>
          <QRCode
            value={data.verificationUrl}
            size={256}
            level="H"
            fgColor="#0f172a"
            bgColor="#FFFFFF"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      ) : null}
    </div>
  )
}

export default CertificateUploadExact
