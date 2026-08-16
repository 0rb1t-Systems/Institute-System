import React from 'react'
import QRCode from 'react-qr-code'
import type { CertificateRenderData } from '@/lib/certificateTemplates'
import CertificateDesignRenderer from '@/components/certificates/CertificateDesignRenderer'

type Props = {
  data: CertificateRenderData
  /** Compact mode for library thumbnails */
  compact?: boolean
  /** PDF capture mode — fill host exactly, no decorative chrome */
  forPdf?: boolean
}

const QrBlock = ({
  url,
  primary,
  sizeMm = 28,
  forPdf = false,
}: {
  url?: string
  primary: string
  sizeMm?: number
  forPdf?: boolean
}) => {
  if (!url) return null
  // In PDF host (~794px ≈ 210mm) mm units map correctly; use % fallback for safety
  const size = forPdf ? `${Math.max(18, sizeMm)}mm` : `${sizeMm}mm`
  return (
    <div style={{ width: size, height: size }} className="shrink-0 bg-white p-0.5">
      <QRCode
        value={url}
        size={140}
        level="H"
        fgColor={primary}
        bgColor="#FFFFFF"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

const Signatures = ({
  data,
  lineClass = 'border-t-2 border-slate-800',
  tone = 'light',
}: {
  data: CertificateRenderData
  lineClass?: string
  tone?: 'light' | 'dark'
}) => (
  <div className="flex justify-center items-end gap-8 w-full px-6">
    <div className="text-center flex-1 max-w-[40%]">
      {data.signatureUrl ? (
        <img src={data.signatureUrl} alt="" className="h-9 w-auto object-contain mx-auto mb-1" />
      ) : null}
      <div className={`${lineClass} mx-auto mb-1`} />
      {data.leftName ? (
        <p className={`text-[11px] font-semibold ${tone === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
          {data.leftName}
        </p>
      ) : null}
      <p className={`text-[10px] uppercase tracking-wide ${tone === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
        {data.leftTitle}
      </p>
    </div>
    {data.sealUrl ? (
      <img src={data.sealUrl} alt="" className="h-14 w-14 object-contain opacity-90" />
    ) : null}
    <div className="text-center flex-1 max-w-[40%]">
      <div className={`${lineClass} mx-auto mb-1`} />
      {data.rightName ? (
        <p className={`text-[11px] font-semibold ${tone === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
          {data.rightName}
        </p>
      ) : null}
      <p className={`text-[10px] uppercase tracking-wide ${tone === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
        {data.rightTitle}
      </p>
    </div>
  </div>
)

const MetaFooter = ({ data, tone = 'light' }: { data: CertificateRenderData; tone?: 'light' | 'dark' }) => (
  <div className="w-full px-8 text-center space-y-1">
    <p className={`text-[11px] font-mono ${tone === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
      Cert no. {data.certificateNumber}
    </p>
    {data.verifyCode ? (
      <p className={`text-[9px] ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Code: {data.verifyCode}</p>
    ) : null}
    {data.dateIssued ? (
      <p className={`text-[9px] ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
        Issued: {String(data.dateIssued).slice(0, 10)}
      </p>
    ) : null}
    {data.footerText ? (
      <p className={`text-[9px] pt-1 ${tone === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{data.footerText}</p>
    ) : null}
  </div>
)

/**
 * Print-ready A4 portrait certificate canvas.
 * Layout changes only — data/branding supplied by caller.
 */
const CertificateCanvas = ({ data: rawData, compact = false, forPdf = false }: Props) => {
  // Guard empty/invalid brand color so text never renders transparent
  const primary =
    String(rawData.primary || '').trim() &&
    String(rawData.primary).toLowerCase() !== 'transparent'
      ? String(rawData.primary)
      : '#002147'
  const data = rawData.primary === primary ? rawData : { ...rawData, primary }
  const tagline = data.motto || data.description || ''
  const layout = data.layoutKey

  if (layout === 'logo_builder' || layout === 'custom_upload') {
    return (
      <CertificateDesignRenderer
        data={data}
        compact={compact}
        forPdf={forPdf}
        design={layout === 'logo_builder' ? data.logoBuilderDesign : null}
        backgroundUrl={layout === 'custom_upload' ? data.customBackgroundUrl : null}
        composeUpload={layout === 'custom_upload'}
      />
    )
  }

  // Aspect-ratio alone does not give percentage-height children a definite containing
  // block in many browsers (and html2canvas). Wrap content in absolute inset-0 so every
  // library layout (modern/premium/… using h-full flex) fills the page like classic.
  const shell = (
    content: React.ReactNode,
    extraClass = '',
    style: React.CSSProperties = {},
  ) => (
    <div
      className={`w-full h-full bg-white relative overflow-hidden text-slate-900 ${
        compact
          ? 'rounded border border-slate-200'
          : forPdf
            ? ''
            : 'rounded-lg shadow-xl border border-slate-200'
      } ${extraClass}`}
      style={{
        aspectRatio: forPdf ? undefined : '210/297',
        width: forPdf ? '100%' : undefined,
        height: forPdf ? '100%' : undefined,
        ['--cert-primary' as string]: primary,
        ...style,
      }}
      data-cert-layout={layout}
      data-cert-pdf={forPdf ? '1' : undefined}
    >
      <div className="absolute inset-0 overflow-hidden">{content}</div>
    </div>
  )

  if (layout === 'modern') {
    return shell(
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 flex justify-between items-start text-white" style={{ backgroundColor: data.primary }}>
          <div className="flex gap-3 items-start">
            {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-11 w-auto object-contain bg-white/10 rounded p-1" /> : null}
            <div>
              <p className="text-sm font-bold uppercase tracking-wide">{data.institutionName}</p>
              {tagline ? <p className="text-[10px] opacity-90 mt-0.5 line-clamp-2">{tagline}</p> : null}
            </div>
          </div>
          <QrBlock url={data.verificationUrl} primary="#0f172a" sizeMm={compact ? 18 : 26} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Certificate of Completion</p>
          <h1 className="text-xl font-semibold" style={{ color: data.primary }}>{data.programName}</h1>
          <p className="text-xs text-slate-500">This is to certify that</p>
          <p className="text-2xl font-bold" style={{ color: data.primary }}>{data.studentName}</p>
          <p className="text-[11px] text-slate-600 max-w-sm leading-relaxed">
            has successfully completed the approved programme of study and met all academic requirements.
          </p>
        </div>
        <div className="pb-4 space-y-4">
          <Signatures data={data} />
          <MetaFooter data={data} />
          <div className="h-2" style={{ backgroundColor: data.primary }} />
        </div>
      </div>,
    )
  }

  if (layout === 'premium') {
    return shell(
      <div className="h-full p-3 box-border">
        <div className="h-full border-[3px] relative" style={{ borderColor: data.primary }}>
          <div className="absolute inset-1.5 border border-amber-700/40 pointer-events-none" />
          <div className="h-full flex flex-col px-5 py-5">
            <div className="flex justify-between items-start">
              <div className="flex gap-2 items-center">
                {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-10 w-auto object-contain" /> : null}
                <div>
                  <p className="text-sm font-serif font-bold" style={{ color: data.primary }}>{data.institutionName}</p>
                  {tagline ? <p className="text-[9px] italic text-slate-500">{tagline}</p> : null}
                </div>
              </div>
              <QrBlock url={data.verificationUrl} primary={data.primary} sizeMm={compact ? 16 : 24} />
            </div>
            <div className="my-3 h-px bg-gradient-to-r from-transparent via-amber-700 to-transparent" />
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
              <p className="text-[10px] tracking-[0.3em] uppercase text-amber-800">Premium Award</p>
              <h1 className="text-xl font-serif" style={{ color: data.primary }}>{data.programName}</h1>
              <p className="text-xs text-slate-500">Presented to</p>
              <p className="text-2xl font-serif font-semibold" style={{ color: data.primary }}>{data.studentName}</p>
              <p className="text-[11px] text-slate-600 max-w-xs">in recognition of distinguished academic achievement.</p>
            </div>
            <Signatures data={data} lineClass="border-t border-amber-800" />
            <div className="mt-3"><MetaFooter data={data} /></div>
          </div>
        </div>
      </div>,
    )
  }

  if (layout === 'elegant') {
    return shell(
      <div className="h-full flex flex-col items-center px-8 py-8 text-center">
        {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-12 w-auto object-contain mb-2" /> : null}
        <p className="font-serif text-base tracking-wide" style={{ color: data.primary }}>{data.institutionName}</p>
        <div className="w-24 h-px my-3" style={{ backgroundColor: data.primary }} />
        {tagline ? <p className="text-[10px] italic text-slate-500 mb-4">{tagline}</p> : null}
        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Certificate</p>
        <h1 className="mt-2 text-xl font-serif italic" style={{ color: data.primary }}>{data.programName}</h1>
        <p className="mt-6 text-xs text-slate-500">This certifies that</p>
        <p className="mt-2 text-2xl font-serif" style={{ color: data.primary }}>{data.studentName}</p>
        <p className="mt-4 text-[11px] text-slate-600 max-w-sm leading-relaxed">
          has fulfilled the requirements of the programme with distinction and honour.
        </p>
        <div className="mt-auto w-full space-y-4 pb-2">
          <div className="flex justify-center">{data.sealUrl ? <img src={data.sealUrl} alt="" className="h-14 w-14 object-contain" /> : null}</div>
          <Signatures data={data} lineClass="border-t border-slate-400" />
          <div className="flex justify-center"><QrBlock url={data.verificationUrl} primary={data.primary} sizeMm={compact ? 16 : 22} /></div>
          <MetaFooter data={data} />
        </div>
      </div>,
    )
  }

  if (layout === 'minimal') {
    return shell(
      <div className="h-full flex flex-col px-10 py-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-8 w-auto object-contain" /> : null}
            <p className="text-xs font-medium tracking-wide text-slate-700">{data.institutionName}</p>
          </div>
          <QrBlock url={data.verificationUrl} primary="#334155" sizeMm={compact ? 14 : 20} />
        </div>
        <div className="flex-1 flex flex-col justify-center text-center gap-3">
          <h1 className="text-lg font-light tracking-wide text-slate-800">{data.programName}</h1>
          <div className="w-10 h-px bg-slate-300 mx-auto" />
          <p className="text-xs text-slate-400">Awarded to</p>
          <p className="text-2xl font-light text-slate-900">{data.studentName}</p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">for successful completion of the programme of study.</p>
        </div>
        <Signatures data={data} lineClass="border-t border-slate-300" />
        <div className="mt-6"><MetaFooter data={data} /></div>
      </div>,
    )
  }

  if (layout === 'luxury') {
    return shell(
      <div className="h-full flex flex-col bg-slate-950 text-slate-100">
        <div className="px-6 py-5 border-b" style={{ borderColor: '#C9A227' }}>
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-start">
              {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-10 w-auto object-contain" /> : null}
              <div>
                <p className="text-sm font-semibold tracking-wide" style={{ color: '#C9A227' }}>{data.institutionName}</p>
                {tagline ? <p className="text-[9px] text-slate-400 mt-1">{tagline}</p> : null}
              </div>
            </div>
            <QrBlock url={data.verificationUrl} primary="#C9A227" sizeMm={compact ? 16 : 24} />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
          <p className="text-[10px] uppercase tracking-[0.35em]" style={{ color: '#C9A227' }}>Luxury Distinction</p>
          <h1 className="text-xl font-serif text-white">{data.programName}</h1>
          <p className="text-xs text-slate-400">Conferred upon</p>
          <p className="text-2xl font-serif" style={{ color: '#C9A227' }}>{data.studentName}</p>
          <p className="text-[11px] text-slate-400 max-w-sm">for excellence in professional training and academic merit.</p>
        </div>
        <div className="pb-2 space-y-3">
          <Signatures data={data} lineClass="border-t border-amber-600/60" tone="dark" />
          <MetaFooter data={data} tone="dark" />
          <div className="h-3" style={{ background: `linear-gradient(90deg, ${data.primary}, #C9A227, ${data.primary})` }} />
        </div>
      </div>,
    )
  }

  if (layout === 'academic') {
    return shell(
      <div className="h-full flex flex-col px-7 py-6">
        <div className="text-center">
          {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-12 w-auto object-contain mx-auto mb-2" /> : null}
          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: data.primary }}>{data.institutionName}</p>
          {tagline ? <p className="text-[9px] text-slate-500 mt-1">{tagline}</p> : null}
        </div>
        <div className="my-3 border-y-2 py-1" style={{ borderColor: data.primary }}>
          <div className="border-y py-2 text-center" style={{ borderColor: data.primary }}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Official Academic Record</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
          <h1 className="text-lg font-serif font-semibold" style={{ color: data.primary }}>{data.programName}</h1>
          <p className="text-xs text-slate-500">Be it known that</p>
          <p className="text-2xl font-serif font-bold text-slate-900">{data.studentName}</p>
          <p className="text-[11px] text-slate-600 max-w-sm">
            having completed the prescribed course of study and examinations, is hereby awarded this certificate.
          </p>
          {data.sealUrl ? <img src={data.sealUrl} alt="" className="h-16 w-16 object-contain my-2" /> : null}
        </div>
        <div className="flex justify-between items-end px-2">
          <div className="text-center w-[38%]">
            {data.signatureUrl ? <img src={data.signatureUrl} alt="" className="h-8 mx-auto object-contain" /> : null}
            <div className="border-t border-slate-800 mt-1" />
            {data.leftName ? <p className="text-[11px] font-semibold mt-1">{data.leftName}</p> : null}
            <p className="text-[10px] mt-0.5 uppercase tracking-wide text-slate-600">{data.leftTitle}</p>
          </div>
          <QrBlock url={data.verificationUrl} primary={data.primary} sizeMm={compact ? 16 : 22} />
          <div className="text-center w-[38%]">
            <div className="border-t border-slate-800 mt-8" />
            {data.rightName ? <p className="text-[11px] font-semibold mt-1">{data.rightName}</p> : null}
            <p className="text-[10px] mt-0.5 uppercase tracking-wide text-slate-600">{data.rightTitle}</p>
          </div>
        </div>
        <div className="mt-4"><MetaFooter data={data} /></div>
      </div>,
    )
  }

  if (layout === 'formal') {
    return shell(
      <div className="h-full relative p-4 box-border">
        <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2" style={{ borderColor: data.primary }} />
        <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2" style={{ borderColor: data.primary }} />
        <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2" style={{ borderColor: data.primary }} />
        <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2" style={{ borderColor: data.primary }} />
        <div className="h-full flex flex-col px-6 py-6">
          <div className="flex justify-between items-start">
            <div className="flex gap-2">
              {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-10 w-auto object-contain" /> : null}
              <div>
                <p className="text-sm font-bold uppercase" style={{ color: data.primary }}>{data.institutionName}</p>
                {tagline ? <p className="text-[9px] text-slate-500">{tagline}</p> : null}
              </div>
            </div>
            <QrBlock url={data.verificationUrl} primary={data.primary} sizeMm={compact ? 16 : 22} />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Formal Certificate</p>
            <h1 className="text-xl font-semibold" style={{ color: data.primary }}>{data.programName}</h1>
            <p className="text-xs text-slate-500 mt-2">This is to certify that</p>
            <p className="text-2xl font-bold text-slate-900">{data.studentName}</p>
            <p className="text-[11px] text-slate-600 max-w-sm">has satisfied all formal requirements of the training programme.</p>
          </div>
          <Signatures data={data} />
          <div className="mt-3"><MetaFooter data={data} /></div>
        </div>
      </div>,
    )
  }

  if (layout === 'contemporary') {
    return shell(
      <div className="h-full flex">
        <div className="w-3 shrink-0" style={{ backgroundColor: data.primary }} />
        <div className="flex-1 flex flex-col px-6 py-6">
          <div className="flex justify-between items-start">
            <div>
              {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-10 w-auto object-contain mb-2" /> : null}
              <p className="text-sm font-bold" style={{ color: data.primary }}>{data.institutionName}</p>
              {tagline ? <p className="text-[9px] text-slate-500">{tagline}</p> : null}
            </div>
            <QrBlock url={data.verificationUrl} primary={data.primary} sizeMm={compact ? 16 : 22} />
          </div>
          <div className="mt-6 inline-block self-start px-3 py-1 text-[10px] uppercase tracking-wider text-white" style={{ backgroundColor: data.primary }}>
            Certificate
          </div>
          <div className="flex-1 flex flex-col justify-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{data.programName}</h1>
            <p className="text-xs text-slate-500">Awarded to</p>
            <p className="text-2xl font-bold" style={{ color: data.primary }}>{data.studentName}</p>
            <p className="text-[11px] text-slate-600 max-w-sm">for completing all modules and assessments of the programme.</p>
          </div>
          <Signatures data={data} />
          <div className="mt-3"><MetaFooter data={data} /></div>
        </div>
      </div>,
    )
  }

  if (layout === 'heritage') {
    return shell(
      <div className="h-full flex flex-col px-6 py-6">
        <div className="flex justify-between items-start">
          {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-11 w-auto object-contain" /> : <div />}
          <QrBlock url={data.verificationUrl} primary={data.primary} sizeMm={compact ? 16 : 22} />
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm font-serif font-bold" style={{ color: data.primary }}>{data.institutionName}</p>
          {tagline ? <p className="text-[9px] italic text-slate-500 mt-1">{tagline}</p> : null}
        </div>
        <div
          className="mt-5 mx-auto px-8 py-2 text-white text-center shadow"
          style={{
            backgroundColor: data.primary,
            clipPath: 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)',
          }}
        >
          <p className="text-[10px] uppercase tracking-widest">Certificate of Achievement</p>
          <p className="text-sm font-semibold mt-0.5">{data.programName}</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
          <p className="text-xs text-slate-500">Proudly presented to</p>
          <p className="text-2xl font-serif font-bold" style={{ color: data.primary }}>{data.studentName}</p>
          <p className="text-[11px] text-slate-600 max-w-sm">
            in recognition of dedication and successful programme completion.
          </p>
          {data.sealUrl ? <img src={data.sealUrl} alt="" className="h-14 w-14 object-contain mt-2" /> : null}
        </div>
        <Signatures data={data} />
        <div className="mt-3"><MetaFooter data={data} /></div>
      </div>,
    )
  }

  // classic (default) — clean Certificate of Completion matching institution branding
  return shell(
    <div className="h-full relative box-border">
      {/* Header: logo + name | QR */}
      <div className="absolute top-[12mm] left-[16mm] right-[16mm] flex justify-between items-start gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt="" className="h-14 w-14 rounded-full object-contain shrink-0" />
          ) : null}
          <h2
            className="text-lg font-serif italic font-semibold truncate"
            style={{ color: data.primary }}
          >
            {data.institutionName}
          </h2>
        </div>
        <QrBlock url={data.verificationUrl} primary={data.primary} sizeMm={compact ? 18 : 28} />
      </div>

      {/* Navy rule */}
      <div className="absolute left-0 right-0 top-[42mm] h-[2.5mm]" style={{ backgroundColor: data.primary }} />

      {/* Title + body */}
      <div className="absolute left-0 right-0 top-[52mm] text-center px-10">
        <h1 className="text-2xl font-serif italic" style={{ color: data.primary }}>
          Certificate of Completion
        </h1>
        {data.programName ? (
          <p className="mt-2 text-xs font-medium" style={{ color: data.primary }}>
            {data.programName}
          </p>
        ) : null}
        <p className="mt-6 text-sm italic" style={{ color: data.primary }}>
          This is to certify that
        </p>
        <p className="mt-3 text-2xl font-serif italic" style={{ color: data.primary }}>
          {data.studentName}
        </p>
        <p className="mt-5 text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
          having completed an approved course of study and passed the prescribed examinations,
          under the authority of the academic board.
        </p>
      </div>

      {/* Signatures: seal left, lines + names */}
      <div className="absolute left-[16mm] right-[16mm] top-[165mm] flex justify-between items-end gap-6">
        <div className="flex-1 text-center">
          {data.sealUrl ? (
            <img src={data.sealUrl} alt="" className="h-12 w-12 object-contain mx-auto mb-2" />
          ) : data.logoUrl ? (
            <img src={data.logoUrl} alt="" className="h-10 w-10 object-contain mx-auto mb-2 opacity-80" />
          ) : (
            <div className="h-10" />
          )}
          {data.signatureUrl ? (
            <img src={data.signatureUrl} alt="" className="h-8 w-auto object-contain mx-auto mb-1" />
          ) : null}
          <div className="border-t border-slate-900 mx-auto mb-1" />
          <p className="text-[11px] font-bold text-slate-900">{data.leftName || 'Authorized Signatory'}</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">{data.leftTitle}</p>
        </div>
        <div className="flex-1 text-center">
          <div className="h-12" />
          <div className="border-t border-slate-900 mx-auto mb-1 mt-8" />
          <p className="text-[11px] font-bold text-slate-900">{data.rightName || 'Authorized Signatory'}</p>
          <p className="text-[9px] uppercase tracking-wide text-slate-500">{data.rightTitle}</p>
        </div>
      </div>

      <div className="absolute left-0 right-0 top-[215mm]">
        <MetaFooter data={data} />
      </div>
      <div className="absolute left-0 right-0 bottom-0 h-[7mm]" style={{ backgroundColor: data.primary }} />
    </div>,
  )
}

export default CertificateCanvas
