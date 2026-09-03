import React from 'react'
import QRCode from 'react-qr-code'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import { getCertificatePatchMeta, getCertificatePatchPreviewSrc } from '@/lib/certificatePatches'

type LayoutProps = {
  data: CertificateRenderData
  compact?: boolean
  forPdf?: boolean
}

const QrMini = ({ url, size, color }: { url?: string; size: number; color: string }) => {
  if (!url) return null
  return (
    <div className="bg-white shrink-0" style={{ width: size, height: size, padding: 2 }}>
      <QRCode value={url} size={size * 2} level="H" fgColor={color} bgColor="#FFFFFF" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

function fs(compact: boolean, n: number) {
  return compact ? Math.max(7, Math.round(n * 0.48)) : n
}

function brandLabel(data: CertificateRenderData) {
  return String(data.logoUrl || '').trim() ? '' : data.institutionName || ''
}

function extraFacts(data: CertificateRenderData) {
  return [
    data.studentId ? `ID ${data.studentId}` : null,
    data.className || null,
    data.startMonth && data.completionMonth
      ? `${data.startMonth} – ${data.completionMonth}`
      : data.completionMonth || data.startMonth || null,
  ].filter(Boolean) as string[]
}

function CertFacts({ data, compact, className = '' }: { data: CertificateRenderData; compact: boolean; className?: string }) {
  const bits = extraFacts(data)
  if (!bits.length) return null
  return (
    <p className={`text-slate-500 ${className}`} style={{ fontSize: fs(compact, 9) }}>
      {bits.join('  ·  ')}
    </p>
  )
}

function SignBlock({
  data,
  compact,
  lineColor = '#1e293b',
  hideSeal = false,
}: {
  data: CertificateRenderData
  compact: boolean
  lineColor?: string
  hideSeal?: boolean
}) {
  return (
    <div className="flex items-end justify-center gap-4 w-full px-2">
      <div className="text-center flex-1 min-w-0">
        {data.signatureUrl ? (
          <img src={data.signatureUrl} alt="" className="mx-auto object-contain" style={{ height: fs(compact, 28) }} />
        ) : (
          <div style={{ height: fs(compact, 16) }} />
        )}
        <div className="mx-auto mb-0.5" style={{ borderTop: `1.5px solid ${lineColor}`, width: '88%' }} />
        <p className="uppercase tracking-wide text-slate-500" style={{ fontSize: fs(compact, 8) }}>
          {data.leftTitle}
        </p>
      </div>
      {!hideSeal && data.sealUrl ? (
        <img src={data.sealUrl} alt="" className="object-contain shrink-0" style={{ height: fs(compact, 52), width: fs(compact, 52) }} />
      ) : null}
      <div className="text-center flex-1 min-w-0">
        <div style={{ height: data.signatureUrl ? fs(compact, 28) : fs(compact, 16) }} />
        <div className="mx-auto mb-0.5" style={{ borderTop: `1.5px solid ${lineColor}`, width: '88%' }} />
        <p className="uppercase tracking-wide text-slate-500" style={{ fontSize: fs(compact, 8) }}>
          {data.rightTitle}
        </p>
      </div>
    </div>
  )
}

function MetaLine({ data, compact }: { data: CertificateRenderData; compact: boolean }) {
  return (
    <div className="text-center space-y-0.5">
      <p className="font-mono text-slate-700" style={{ fontSize: fs(compact, 10) }}>
        Cert no. {data.certificateNumber}
      </p>
      {data.verifyCode ? (
        <p className="text-slate-500" style={{ fontSize: fs(compact, 8) }}>
          Code: {data.verifyCode}
        </p>
      ) : null}
      {data.dateIssued ? (
        <p className="text-slate-500" style={{ fontSize: fs(compact, 8) }}>
          Issued: {String(data.dateIssued).slice(0, 10)}
        </p>
      ) : null}
      {data.footerText ? (
        <p className="text-slate-500" style={{ fontSize: fs(compact, 8) }}>
          {data.footerText}
        </p>
      ) : null}
    </div>
  )
}

function AwardBody({ data, compact, ink }: { data: CertificateRenderData; compact: boolean; ink: string }) {
  return (
    <div className="flex flex-col items-center text-center px-[6%] w-full">
      <p className="uppercase tracking-[0.22em] text-slate-400" style={{ fontSize: fs(compact, 9) }}>
        This is to certify that
      </p>
      <p
        className="truncate max-w-full"
        style={{
          fontFamily: '"Great Vibes", "Segoe Script", cursive',
          fontSize: fs(compact, 36),
          lineHeight: 1.1,
          color: ink,
        }}
        title={data.studentName}
      >
        {data.studentName}
      </p>
      <p className="text-slate-500" style={{ fontSize: fs(compact, 10), marginTop: 4 }}>
        has successfully completed
      </p>
      <p className="font-semibold max-w-full truncate" style={{ fontSize: fs(compact, 14), color: ink }}>
        {data.programName}
      </p>
      <CertFacts data={data} compact={compact} className="mt-1" />
      {data.motto ? (
        <p className="italic text-slate-500 max-w-[90%] line-clamp-2" style={{ fontSize: fs(compact, 9), marginTop: 4 }}>
          {data.motto}
        </p>
      ) : null}
    </div>
  )
}

function landscapeShell(
  content: React.ReactNode,
  compact: boolean,
  forPdf: boolean,
  layout: string,
  extraStyle: React.CSSProperties = {},
) {
  return (
    <div
      className={`w-full relative overflow-hidden text-slate-900 ${
        compact ? 'rounded border border-slate-200' : forPdf ? '' : 'rounded-lg shadow-xl border border-slate-200'
      }`}
      style={{
        aspectRatio: forPdf ? undefined : '297 / 210',
        width: forPdf ? '100%' : undefined,
        height: forPdf ? '100%' : undefined,
        ...extraStyle,
      }}
      data-cert-layout={layout}
      data-cert-pdf={forPdf ? '1' : undefined}
    >
      {content}
    </div>
  )
}

function FiligreeFrame({ primary, accent }: { primary: string; accent: string }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden>
      <rect x="5" y="5" width="287" height="200" fill="none" stroke={primary} strokeWidth="2.4" />
      <rect x="9" y="9" width="279" height="192" fill="none" stroke={accent} strokeWidth="1.6" />
      <rect x="12.5" y="12.5" width="272" height="185" fill="none" stroke={primary} strokeWidth="0.55" />
      <path d="M18 18 h22 v2 h-20 v20 h-2 z M279 18 h-22 v2 h20 v20 h2 z M18 192 h22 v-2 h-20 v-20 h-2 z M279 192 h-22 v-2 h20 v-20 h2 z" fill={accent} />
      <circle cx="18" cy="18" r="3.2" fill={accent} />
      <circle cx="279" cy="18" r="3.2" fill={accent} />
      <circle cx="18" cy="192" r="3.2" fill={accent} />
      <circle cx="279" cy="192" r="3.2" fill={accent} />
    </svg>
  )
}

function Patch({
  patchKey,
  primary,
  accent,
  size,
  className,
  style,
}: {
  patchKey: string
  primary: string
  accent: string
  size: number
  className?: string
  style?: React.CSSProperties
}) {
  const meta = getCertificatePatchMeta(patchKey)
  const height = meta ? Math.round((size * meta.h) / meta.w) : size
  return (
    <img
      src={getCertificatePatchPreviewSrc(patchKey, primary, accent, '#ffffff')}
      alt=""
      className={`object-contain pointer-events-none select-none ${className || ''}`}
      style={{ width: size, height, ...style }}
      draggable={false}
    />
  )
}

export function OrnateCertificateLayout({ data, compact = false, forPdf = false }: LayoutProps) {
  const primary = data.primary || '#002147'
  const accent = data.accent || '#c9a227'
  return landscapeShell(
    <>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #fffdf6 0%, #f7f0dc 100%)' }} />
      <FiligreeFrame primary={primary} accent={accent} />
      <div className="absolute inset-0 flex flex-col items-center" style={{ padding: '5% 6% 3%' }}>
        <div className="flex w-full items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {data.logoUrl ? <img src={data.logoUrl} alt="" className="object-contain" style={{ height: fs(compact, 40) }} /> : null}
            <p className="font-serif font-bold truncate" style={{ color: primary, fontSize: fs(compact, 13) }}>
              {brandLabel(data)}
            </p>
          </div>
          <QrMini url={data.verificationUrl} size={compact ? 36 : 52} color={primary} />
        </div>
        <p className="uppercase tracking-[0.35em] mt-1" style={{ color: accent, fontSize: fs(compact, 9) }}>
          Certificate of Completion
        </p>
        <div className="flex-1 flex flex-col justify-center w-full">
          <AwardBody data={data} compact={compact} ink={primary} />
        </div>
        <div className="flex justify-center shrink-0" style={{ height: compact ? 48 : 72 }}>
          <Patch patchKey="star_ribbon" primary={primary} accent={accent} size={compact ? 36 : 54} />
        </div>
        <SignBlock data={data} compact={compact} lineColor={accent} hideSeal />
        <div className="mt-1">
          <MetaLine data={data} compact={compact} />
        </div>
      </div>
    </>,
    compact,
    forPdf,
    'ornate',
  )
}

export function MedallionCertificateLayout({ data, compact = false, forPdf = false }: LayoutProps) {
  const primary = data.primary || '#7f1d1d'
  const accent = data.accent || '#eab308'
  return landscapeShell(
    <>
      <div className="absolute inset-0 bg-[#fffaf3]" />
      <div className="absolute inset-[3.2%] border-[3px]" style={{ borderColor: accent }} />
      <div className="absolute inset-[4.6%] border" style={{ borderColor: primary }} />
      <Patch
        patchKey="award_rosette"
        primary={primary}
        accent={accent}
        size={compact ? 56 : 100}
        className="absolute"
        style={{ top: '8%', right: '5%' }}
      />
      <div className="absolute inset-0 flex flex-col items-center" style={{ padding: '7% 8% 6%' }}>
        <div className="flex items-center gap-2">
          {data.logoUrl ? <img src={data.logoUrl} alt="" className="object-contain" style={{ height: fs(compact, 36) }} /> : null}
          <p className="uppercase tracking-[0.2em] font-semibold" style={{ color: primary, fontSize: fs(compact, 11) }}>
            {brandLabel(data) || data.institutionName}
          </p>
        </div>
        <p className="uppercase tracking-[0.28em] mt-1" style={{ color: accent, fontSize: fs(compact, 9) }}>
          Medal of Distinction
        </p>
        <div className="flex-1 flex flex-col justify-center w-full">
          <AwardBody data={data} compact={compact} ink={primary} />
        </div>
        <div className="flex items-end justify-center gap-3 w-full">
          <div className="flex-1">
            <SignBlock data={data} compact={compact} lineColor={primary} />
          </div>
          <QrMini url={data.verificationUrl} size={compact ? 34 : 48} color={primary} />
        </div>
        <div className="mt-1">
          <MetaLine data={data} compact={compact} />
        </div>
      </div>
    </>,
    compact,
    forPdf,
    'medallion',
  )
}

export function HorizonCertificateLayout({ data, compact = false, forPdf = false }: LayoutProps) {
  const primary = data.primary || '#0f766e'
  const accent = data.accent || '#c9a227'
  return landscapeShell(
    <div className="absolute inset-0 flex bg-white">
      <div className="h-full shrink-0 flex flex-col items-center justify-between text-white py-5 px-2" style={{ width: '18%', background: primary }}>
        {data.logoUrl ? (
          <img src={data.logoUrl} alt="" className="object-contain bg-white/10 rounded p-1" style={{ maxWidth: '82%', maxHeight: fs(compact, 56) }} />
        ) : (
          <p className="text-center uppercase tracking-wider font-semibold" style={{ fontSize: fs(compact, 9), writingMode: compact ? undefined : 'horizontal-tb' }}>
            {data.institutionName}
          </p>
        )}
        <Patch patchKey="star_ribbon" primary={primary} accent={accent} size={compact ? 48 : 82} />
        <QrMini url={data.verificationUrl} size={compact ? 32 : 48} color="#0f172a" />
      </div>
      <div className="flex-1 relative flex flex-col" style={{ padding: '4% 5% 3%' }}>
        <div className="absolute top-0 left-0 right-0 h-[6px]" style={{ background: `linear-gradient(90deg, ${accent}, ${primary})` }} />
        <p className="uppercase tracking-[0.3em] text-slate-400" style={{ fontSize: fs(compact, 9) }}>
          Certificate of Completion
        </p>
        <p className="font-serif font-bold" style={{ color: primary, fontSize: fs(compact, 13) }}>
          {brandLabel(data)}
        </p>
        <div className="flex-1 flex flex-col justify-center">
          <AwardBody data={data} compact={compact} ink={primary} />
        </div>
        <SignBlock data={data} compact={compact} lineColor={primary} />
        <div className="mt-1">
          <MetaLine data={data} compact={compact} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[6px]" style={{ background: primary }} />
      </div>
    </div>,
    compact,
    forPdf,
    'horizon',
  )
}

export function LaurelCertificateLayout({ data, compact = false, forPdf = false }: LayoutProps) {
  const primary = data.primary || '#14532d'
  const accent = data.accent || '#c9a227'
  return landscapeShell(
    <>
      <div className="absolute inset-0" style={{ background: '#f8faf4' }} />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden>
        <rect x="8" y="8" width="281" height="194" fill="none" stroke={primary} strokeWidth="1.8" />
        <rect x="12" y="12" width="273" height="186" fill="none" stroke={accent} strokeWidth="0.8" />
      </svg>
      <Patch
        patchKey="award_rosette"
        primary={primary}
        accent={accent}
        size={compact ? 54 : 96}
        className="absolute"
        style={{ right: '3%', top: '34%' }}
      />
      <div className="absolute inset-0 flex flex-col items-center" style={{ padding: '5% 14% 3%' }}>
        <div className="flex items-center gap-2">
          {data.logoUrl ? <img src={data.logoUrl} alt="" className="object-contain" style={{ height: fs(compact, 38) }} /> : null}
          <p className="uppercase tracking-[0.18em]" style={{ color: primary, fontSize: fs(compact, 11) }}>
            {brandLabel(data) || data.institutionName}
          </p>
        </div>
        <div
          className="mt-2 px-6 py-1 text-white text-center"
          style={{
            background: primary,
            clipPath: 'polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)',
            fontSize: fs(compact, 10),
            letterSpacing: '0.18em',
          }}
        >
          CERTIFICATE OF HONOR
        </div>
        <div className="flex-1 flex flex-col justify-center w-full">
          <AwardBody data={data} compact={compact} ink={primary} />
        </div>
        <div className="flex items-end w-full gap-3">
          <div className="flex-1">
            <SignBlock data={data} compact={compact} lineColor={accent} />
          </div>
          <QrMini url={data.verificationUrl} size={compact ? 34 : 48} color={primary} />
        </div>
        <div className="mt-1">
          <MetaLine data={data} compact={compact} />
        </div>
      </div>
    </>,
    compact,
    forPdf,
    'laurel',
  )
}

export function RegalCertificateLayout({ data, compact = false, forPdf = false }: LayoutProps) {
  const primary = data.primary || '#78350f'
  const accent = data.accent || '#c9a227'
  return (
    <div
      className={`w-full relative overflow-hidden text-slate-900 ${
        compact ? 'rounded border border-slate-200' : forPdf ? '' : 'rounded-lg shadow-xl border border-slate-200'
      }`}
      style={{
        aspectRatio: forPdf ? undefined : '210 / 297',
        width: forPdf ? '100%' : undefined,
        height: forPdf ? '100%' : undefined,
        background: '#fbf6ea',
      }}
      data-cert-layout="regal"
      data-cert-pdf={forPdf ? '1' : undefined}
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 210 297" preserveAspectRatio="none" aria-hidden>
        <rect x="7" y="7" width="196" height="283" fill="none" stroke={primary} strokeWidth="3.2" />
        <rect x="12" y="12" width="186" height="273" fill="none" stroke={accent} strokeWidth="2" />
        <rect x="16" y="16" width="178" height="265" fill="none" stroke={primary} strokeWidth="0.7" />
        <path d="M20 20 h28 v3 H23 v25 h-3 z M190 20 h-28 v3 h25 v25 h3 z M20 277 h28 v-3 H23 v-25 h-3 z M190 277 h-28 v-3 h25 v-25 h3 z" fill={accent} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center" style={{ padding: '7% 10% 5%' }}>
        {data.logoUrl ? <img src={data.logoUrl} alt="" className="object-contain mb-1" style={{ height: fs(compact, 44) }} /> : null}
        <p className="font-serif font-bold text-center" style={{ color: primary, fontSize: fs(compact, 13) }}>
          {brandLabel(data)}
        </p>
        <p className="uppercase tracking-[0.32em] mt-2" style={{ color: accent, fontSize: fs(compact, 9) }}>
          Certificate of Completion
        </p>
        <div className="flex-1 flex flex-col justify-center w-full">
          <AwardBody data={data} compact={compact} ink={primary} />
        </div>
        <div className="flex justify-center shrink-0" style={{ height: compact ? 56 : 88 }}>
          <Patch patchKey="star_ribbon" primary={primary} accent={accent} size={compact ? 40 : 62} />
        </div>
        <SignBlock data={data} compact={compact} lineColor={primary} hideSeal />
        <div className="mt-3 flex justify-center">
          <QrMini url={data.verificationUrl} size={compact ? 36 : 52} color={primary} />
        </div>
        <div className="mt-2">
          <MetaLine data={data} compact={compact} />
        </div>
      </div>
    </div>
  )
}
