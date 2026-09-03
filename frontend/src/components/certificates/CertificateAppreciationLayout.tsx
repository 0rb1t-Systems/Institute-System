import React from 'react'
import QRCode from 'react-qr-code'
import type { CertificateRenderData } from '@/lib/certificateTemplates'

type Props = {
  data: CertificateRenderData
  compact?: boolean
  forPdf?: boolean
}

/**
 * Clean landscape Certificate of Appreciation.
 * Matches the uploaded design style (navy / gold / seal / signatures)
 * without compositing on top of a sample scan — no double text, no cover boxes.
 */
const CertificateAppreciationLayout = ({ data, compact = false, forPdf = false }: Props) => {
  const primary = data.primary || '#001f3f'
  const accent = data.accent || '#c9a227'
  const dateLabel = data.dateIssued ? String(data.dateIssued).slice(0, 10) : ''
  const hasLogo = Boolean(String(data.logoUrl || '').trim())
  const brandName = hasLogo ? '' : data.institutionName || ''
  const bodyText =
    data.footerText ||
    data.motto ||
    'in recognition of outstanding dedication, professional growth, and valuable contribution to the programme.'

  const fs = (n: number) => (compact ? Math.max(7, Math.round(n * 0.5)) : n)
  const qrSize = compact ? 42 : 54

  return (
    <div
      className={`w-full relative overflow-hidden bg-white text-slate-900 ${
        compact ? 'rounded border border-slate-200' : forPdf ? '' : 'rounded-lg shadow-xl border border-slate-200'
      }`}
      style={
        forPdf
          ? { width: '100%', height: '100%' }
          : { aspectRatio: '297 / 210' }
      }
      data-cert-layout="appreciation"
      data-cert-pdf={forPdf ? '1' : undefined}
    >
      {/* Navy header */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col items-center justify-center text-white px-8"
        style={{
          height: '29%',
          background: `radial-gradient(ellipse 80% 120% at 50% 40%, ${primary}cc 0%, ${primary} 70%)`,
        }}
      >
        {hasLogo ? (
          <img
            src={data.logoUrl!}
            alt=""
            className="object-contain mb-1"
            style={{ maxHeight: fs(48), maxWidth: '72%' }}
          />
        ) : brandName ? (
          <p
            className="uppercase truncate max-w-full"
            style={{
              fontSize: fs(11),
              letterSpacing: '0.28em',
              fontFamily: 'Montserrat, Arial, sans-serif',
              fontWeight: 500,
            }}
          >
            {brandName}
          </p>
        ) : null}
        <h1
          style={{
            marginTop: 4,
            fontSize: fs(34),
            lineHeight: 1,
            fontFamily: '"Playfair Display", Georgia, Times New Roman, serif',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          CERTIFICATE
        </h1>
        <div className="flex items-center gap-3" style={{ marginTop: 6 }}>
          <span style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.75)' }} />
          <p
            className="uppercase"
            style={{
              fontSize: fs(11),
              letterSpacing: '0.22em',
              fontFamily: 'Montserrat, Arial, sans-serif',
            }}
          >
            OF APPRECIATION
          </p>
          <span style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.75)' }} />
        </div>
      </div>

      {/* Gold divider */}
      <div
        className="absolute inset-x-0"
        style={{
          top: '27%',
          height: '3.5%',
          background: `linear-gradient(90deg, ${accent}66 0%, ${accent} 35%, ${accent} 65%, ${accent}66 100%)`,
          borderRadius: '0 0 50% 50% / 0 0 120% 120%',
        }}
      />

      {/* White body */}
      <div
        className="absolute inset-x-0 flex flex-col items-center px-[7%]"
        style={{ top: '34%', bottom: '3.2%' }}
      >
        <p
          className="uppercase text-slate-400"
          style={{
            fontSize: fs(10),
            letterSpacing: '0.2em',
            fontFamily: 'Montserrat, Arial, sans-serif',
          }}
        >
          The certificate is presented to:
        </p>

        <p
          className="truncate max-w-full px-2"
          style={{
            marginTop: 2,
            fontFamily: '"Great Vibes", "Segoe Script", cursive',
            fontSize: fs(42),
            lineHeight: 1.1,
            color: '#111827',
          }}
          title={data.studentName}
        >
          {data.studentName}
        </p>

        <p
          className="uppercase text-slate-400"
          style={{
            marginTop: 8,
            fontSize: fs(9),
            letterSpacing: '0.18em',
            fontFamily: 'Montserrat, Arial, sans-serif',
          }}
        >
          {data.programName || ''}
        </p>
        {[
          data.studentId ? `ID ${data.studentId}` : null,
          data.className || null,
          data.startMonth && data.completionMonth
            ? `${data.startMonth} – ${data.completionMonth}`
            : data.completionMonth || data.startMonth || null,
        ]
          .filter(Boolean)
          .length ? (
          <p className="text-slate-500" style={{ marginTop: 4, fontSize: fs(9) }}>
            {[
              data.studentId ? `ID ${data.studentId}` : null,
              data.className || null,
              data.startMonth && data.completionMonth
                ? `${data.startMonth} – ${data.completionMonth}`
                : data.completionMonth || data.startMonth || null,
            ]
              .filter(Boolean)
              .join('  ·  ')}
          </p>
        ) : null}

        <p
          className="text-center text-slate-500 line-clamp-3 max-w-[88%]"
          style={{
            marginTop: 8,
            fontSize: fs(11),
            lineHeight: 1.4,
            fontFamily: 'Georgia, serif',
          }}
        >
          {bodyText}
        </p>

        <p
          className="font-mono text-slate-500"
          style={{ marginTop: 8, fontSize: fs(10) }}
        >
          {[data.certificateNumber ? `No. ${data.certificateNumber}` : null, dateLabel]
            .filter(Boolean)
            .join('  ·  ')}
        </p>

        {/* Signatures + seal + QR */}
        <div
          className="mt-auto w-full grid items-end"
          style={{
            gridTemplateColumns: '1fr auto 1fr',
            gap: 12,
            paddingBottom: 4,
          }}
        >
          <div className="text-center min-w-0">
            <p className="text-slate-400" style={{ fontSize: fs(9) }}>
              Regard
            </p>
            {data.signatureUrl ? (
              <img
                src={data.signatureUrl}
                alt=""
                className="mx-auto object-contain"
                style={{ height: fs(28), marginTop: 2, marginBottom: 2 }}
              />
            ) : (
              <div style={{ height: fs(20) }} />
            )}
            <div className="mx-auto mb-0.5" style={{ borderTop: '1.5px solid #334155', width: '80%' }} />
            <p
              className="uppercase text-slate-500"
              style={{ fontSize: fs(9), letterSpacing: '0.06em' }}
            >
              {data.leftTitle || 'Registrar'}
            </p>
          </div>

          <div className="flex items-end justify-center pb-1">
            {data.sealUrl ? (
              <img
                src={data.sealUrl}
                alt=""
                className="object-contain"
                style={{ width: fs(70), height: fs(70) }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-center font-semibold leading-tight"
                style={{
                  width: fs(70),
                  height: fs(70),
                  border: `2px solid ${accent}`,
                  color: accent,
                  fontSize: fs(9),
                }}
              >
                OFFICIAL
                <br />
                SEAL
              </div>
            )}
          </div>

          <div className="text-center min-w-0 relative">
            <p className="text-slate-400" style={{ fontSize: fs(9) }}>
              Regard
            </p>
            <div style={{ height: data.signatureUrl ? fs(32) : fs(20) }} />
            <div className="mx-auto mb-0.5" style={{ borderTop: '1.5px solid #334155', width: '80%' }} />
            <p
              className="uppercase text-slate-500"
              style={{ fontSize: fs(9), letterSpacing: '0.06em' }}
            >
              {data.rightTitle || 'Principal'}
            </p>

            {data.verificationUrl ? (
              <div
                className="absolute right-0 bottom-0 bg-white"
                style={{ width: qrSize, height: qrSize, padding: 2 }}
              >
                <QRCode
                  value={data.verificationUrl}
                  size={qrSize * 2}
                  level="H"
                  fgColor="#0f172a"
                  bgColor="#FFFFFF"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Navy footer bar */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: '2.8%', background: primary }} />
    </div>
  )
}

export default CertificateAppreciationLayout
