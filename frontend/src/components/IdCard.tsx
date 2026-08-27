import React, { useEffect, useRef, useState } from 'react'
import { User, Download, BadgeCheck } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import QRCode from 'react-qr-code'
import html2canvas from 'html2canvas'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import {
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getInstitutionAccent,
  getTenantBaseUrl,
  getVerificationUrl,
} from '@/lib/institution'

/** Fixed width so columns never collapse. Height follows content so nothing is clipped. */
const CARD_WIDTH = 560

const INK = '#334155'
const CHIP_H = 16
const CHIP_ICON = 12
const CHIP_GAP = 5
const CHIP_FONT = 11

function strokeGlobe(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.arc(12, 12, 10, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(2, 12)
  ctx.lineTo(22, 12)
  ctx.stroke()
  ctx.stroke(new Path2D('M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'))
}

function strokeMail(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(3, 5, 18, 14, 2)
  } else {
    ctx.rect(3, 5, 18, 14)
  }
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(3, 7)
  ctx.lineTo(12, 13)
  ctx.lineTo(21, 7)
  ctx.stroke()
}

/** Paint icon + label as one bitmap so html2canvas cannot split their baselines. */
function paintContactChip(kind: 'globe' | 'mail', label: string): string {
  const scale = 3
  const font = `700 ${CHIP_FONT}px Inter, ui-sans-serif, system-ui, sans-serif`
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) return ''
  probe.font = font
  const textW = Math.ceil(probe.measureText(label).width)
  const w = CHIP_ICON + CHIP_GAP + textW + 2

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w * scale)
  canvas.height = Math.ceil(CHIP_H * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.scale(scale, scale)
  ctx.font = font
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.save()
  ctx.translate(0, (CHIP_H - CHIP_ICON) / 2)
  ctx.scale(CHIP_ICON / 24, CHIP_ICON / 24)
  if (kind === 'globe') strokeGlobe(ctx)
  else strokeMail(ctx)
  ctx.restore()

  ctx.fillText(label, CHIP_ICON + CHIP_GAP, CHIP_H / 2)
  return canvas.toDataURL('image/png')
}

function IconLabel({ kind, label }: { kind: 'globe' | 'mail'; label: string }) {
  const [src, setSrc] = useState(() => paintContactChip(kind, label))

  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        await (document as any).fonts?.ready
      } catch {
        /* ignore */
      }
      if (!alive) return
      setSrc(paintContactChip(kind, label))
    }
    void run()
    return () => {
      alive = false
    }
  }, [kind, label])

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{ display: 'block', height: CHIP_H, width: 'auto' }}
    />
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function srcToDataUrl(src: string): Promise<string | null> {
  if (!src || src.startsWith('data:')) return src || null
  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(blob)
    })
  } catch {
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          try {
            const c = document.createElement('canvas')
            c.width = img.naturalWidth || 1
            c.height = img.naturalHeight || 1
            const ctx = c.getContext('2d')
            if (!ctx) {
              reject(new Error('no ctx'))
              return
            }
            ctx.drawImage(img, 0, 0)
            resolve(c.toDataURL('image/png'))
          } catch (err) {
            reject(err)
          }
        }
        img.onerror = () => reject(new Error('img error'))
        img.src = src
      })
    } catch {
      return null
    }
  }
}

async function inlineDomImages(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  const originals: Array<{ img: HTMLImageElement; src: string }> = []

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) return
      originals.push({ img, src })
      const dataUrl = await srcToDataUrl(src)
      if (dataUrl) img.setAttribute('src', dataUrl)
    }),
  )

  return () => {
    originals.forEach(({ img, src }) => img.setAttribute('src', src))
  }
}

async function captureCardPng(node: HTMLElement): Promise<string> {
  const restore = await inlineDomImages(node)
  try {
    await (document as any).fonts?.ready
  } catch {
    /* ignore */
  }
  await wait(80)

  const measuredH = Math.ceil(Math.max(node.scrollHeight, node.offsetHeight, 360))

  const host = document.createElement('div')
  host.style.cssText = [
    'position:fixed',
    `left:-${CARD_WIDTH + 80}px`,
    'top:0',
    `width:${CARD_WIDTH}px`,
    `height:${measuredH}px`,
    'opacity:1',
    'pointer-events:none',
    'z-index:-1',
    'overflow:visible',
    'background:#ffffff',
  ].join(';')

  const clone = node.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.style.cssText = [
    `width:${CARD_WIDTH}px`,
    `min-width:${CARD_WIDTH}px`,
    `max-width:${CARD_WIDTH}px`,
    'height:auto',
    'min-height:0',
    'max-height:none',
    'transform:none',
    'margin:0',
    'position:relative',
    'left:auto',
    'top:auto',
    'box-shadow:none',
    'overflow:visible',
  ].join(';')

  host.appendChild(clone)
  document.body.appendChild(host)
  void clone.offsetHeight
  const captureH = Math.ceil(Math.max(clone.scrollHeight, clone.offsetHeight, measuredH)) + 8
  host.style.height = `${captureH}px`

  try {
    const canvas = await html2canvas(clone, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 20000,
      foreignObjectRendering: false,
      width: CARD_WIDTH,
      height: captureH,
      windowWidth: CARD_WIDTH,
      windowHeight: captureH,
      scrollX: 0,
      scrollY: 0,
      onclone: (_doc, el) => {
        el.style.width = `${CARD_WIDTH}px`
        el.style.height = 'auto'
        el.style.maxHeight = 'none'
        el.style.transform = 'none'
        el.style.overflow = 'visible'
      },
    })
    return canvas.toDataURL('image/png', 1.0)
  } finally {
    host.remove()
    restore()
  }
}

/** Shared visual ID card used by student / instructor / staff wrappers. */
const IdCard = ({
  user,
  roleLabel = 'ID',
  nameLabel = 'Full Name',
  secondaryLabel = 'Department / Position',
  secondaryValue = 'General',
  idLabel = 'ID',
  code,
  expirationDate,
  indefiniteIfMissing = false,
  onRenew,
  className = '',
  cardDomId = 'tenant-id-card',
  downloadName,
}: any) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const { institution } = useAuth()

  const institutionName = getInstitutionDisplayName(institution)
  const nameParts = String(institutionName).trim().split(/\s+/).filter(Boolean)
  const brandName = nameParts[0] || 'INSTITUTION'
  const brandRest = nameParts.slice(1).join(' ')
  const primary = getInstitutionPrimary(institution)
  const accent = getInstitutionAccent(institution)
  const hostLabel = getTenantBaseUrl(institution).replace(/^https?:\/\//, '')
  const contactEmail = institution?.email || ''

  const displayName = user?.name || 'NAME'
  const displayCode = code || '---'

  let isExpired = false
  if (expirationDate) {
    const exp = expirationDate instanceof Date ? expirationDate : new Date(expirationDate)
    if (!Number.isNaN(exp.getTime())) {
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const expStart = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate())
      isExpired = todayStart > expStart
    }
  }

  const identityCode = String(code || user?.student_code || user?.staff_code || '').trim()
  const qrValue = getVerificationUrl(identityCode || 'unknown', institution, 'credential')

  const handleDownload = async () => {
    const node = cardRef.current
    if (!node || isGenerating) return
    setIsGenerating(true)
    try {
      const dataUrl = await captureCardPng(node)
      const link = document.createElement('a')
      const safeInst = institutionName.replace(/\s+/g, '_')
      const fallback = `${safeInst}_${String(roleLabel).replace(/\s+/g, '_')}_${String(displayName).replace(/\s+/g, '_')}.png`
      link.download = downloadName || fallback
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('ID Card Generation Error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const cardShell: React.CSSProperties = {
    width: CARD_WIDTH,
    minWidth: CARD_WIDTH,
    maxWidth: CARD_WIDTH,
    height: 'auto',
    flexShrink: 0,
    backgroundImage: 'linear-gradient(160deg, #ffffff 0%, #f8fafc 55%, #f1f5f9 100%)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  }

  return (
    <div className={`flex flex-col items-center gap-6 w-full min-w-0 ${className}`}>
      <div className="w-full overflow-x-auto">
        <div className="relative mx-auto" style={{ width: CARD_WIDTH, minWidth: CARD_WIDTH }}>
          <div
            className={`absolute -inset-2 rounded-2xl opacity-25 blur-xl pointer-events-none ${isExpired ? 'bg-red-500' : ''}`}
            style={!isExpired ? { backgroundColor: primary } : undefined}
          />

          <div
            id={cardDomId}
            ref={cardRef}
            className="relative flex flex-col rounded-[14px] overflow-hidden shadow-2xl select-none text-left"
            style={cardShell}
          >
            {/* Header */}
            <div
              className="shrink-0"
              style={{ height: 80, backgroundColor: primary, padding: '0 20px 0 18px' }}
            >
              <table cellPadding={0} cellSpacing={0} style={{ width: '100%', height: 80, borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td valign="middle" style={{ verticalAlign: 'middle', width: 46, padding: 0 }}>
                      {institution?.logo_url ? (
                        <div
                          className="rounded-full bg-white overflow-hidden shadow-sm ring-2 ring-white/40"
                          style={{ width: 46, height: 46 }}
                        >
                          <img
                            src={institution.logo_url}
                            alt=""
                            className="w-full h-full object-contain"
                            crossOrigin="anonymous"
                          />
                        </div>
                      ) : (
                        <div
                          className="rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white text-base font-black"
                          style={{ width: 46, height: 46 }}
                        >
                          {brandName.slice(0, 1)}
                        </div>
                      )}
                    </td>
                    <td valign="middle" style={{ verticalAlign: 'middle', padding: '0 12px', minWidth: 0 }}>
                      <div
                        className="font-black uppercase"
                        style={{
                          color: '#ffffff',
                          fontSize: 20,
                          lineHeight: '22px',
                          letterSpacing: '0.12em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {brandName}
                      </div>
                      {brandRest ? (
                        <div
                          className="font-bold uppercase"
                          style={{
                            color: 'rgba(255,255,255,0.86)',
                            fontSize: 10,
                            lineHeight: '12px',
                            letterSpacing: '0.22em',
                            marginTop: 3,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {brandRest}
                        </div>
                      ) : null}
                    </td>
                    <td valign="middle" style={{ verticalAlign: 'middle', width: 1, whiteSpace: 'nowrap', padding: 0, textAlign: 'right' }}>
                      <span
                        className="inline-block px-3 py-1.5 rounded-md border font-bold uppercase"
                        style={{
                          borderColor: 'rgba(255,255,255,0.35)',
                          backgroundColor: 'rgba(255,255,255,0.18)',
                          color: '#ffffff',
                          fontSize: 10,
                          lineHeight: '14px',
                          letterSpacing: '0.14em',
                        }}
                      >
                        {roleLabel}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Body — auto height; photo + fields never share space with the QR */}
            <div
              className="grid items-start"
              style={{
                gridTemplateColumns: '128px 1fr',
                columnGap: 22,
                padding: '20px 24px 16px 24px',
              }}
            >
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-[118px] h-[118px] rounded-[10px] overflow-hidden bg-slate-100 shadow-md ring-[3px] ring-white shrink-0">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt=""
                      className={`w-full h-full object-cover ${isExpired ? 'grayscale' : ''}`}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <User className="h-14 w-14" />
                    </div>
                  )}
                </div>
                {isExpired ? (
                  <div className="w-full text-center px-2 py-1 rounded-full bg-red-50 text-red-600 text-[9px] font-bold uppercase tracking-[0.16em] border border-red-100">
                    Expired
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase tracking-[0.16em] border border-emerald-100">
                    <BadgeCheck className="h-3 w-3 text-emerald-600 shrink-0" />
                    Verified
                  </div>
                )}
              </div>

              <div className="min-w-0 flex flex-col gap-3">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.16em] mb-0.5 leading-none">
                    {nameLabel}
                  </p>
                  <h2
                    className="text-[22px] font-black text-slate-900 uppercase leading-snug tracking-tight break-words"
                    title={displayName}
                  >
                    {displayName}
                  </h2>
                </div>

                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.16em] mb-1 leading-none">
                    {secondaryLabel}
                  </p>
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className="mt-0.5 w-[3px] h-[16px] rounded-full shrink-0"
                      style={{ backgroundColor: primary }}
                    />
                    <p className="text-[13px] font-bold text-slate-800 leading-snug break-words" title={secondaryValue}>
                      {secondaryValue}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.16em] mb-1 leading-none">
                      {idLabel}
                    </p>
                    <p className="text-[15px] font-mono font-bold leading-normal break-all" style={{ color: primary }}>
                      {displayCode}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.16em] mb-1 leading-none">
                      Valid Until
                    </p>
                    <p className={`text-[13px] font-bold leading-normal ${isExpired ? 'text-red-500' : 'text-slate-800'}`}>
                      {expirationDate
                        ? formatDate(expirationDate)
                        : indefiniteIfMissing
                          ? 'Indefinite'
                          : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer — icon + label share one table row so PNG export stays optically centered */}
            <div
              className="border-t border-slate-200 bg-slate-50"
              style={{ padding: '14px 16px 14px 20px', overflow: 'visible' }}
            >
              <table cellPadding={0} cellSpacing={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td valign="middle" style={{ verticalAlign: 'middle', padding: 0 }}>
                      <table cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td valign="middle" style={{ verticalAlign: 'middle', padding: 0 }}>
                              <IconLabel kind="globe" label={hostLabel} />
                            </td>
                            {contactEmail ? (
                              <td valign="middle" style={{ verticalAlign: 'middle', padding: '0 0 0 28px' }}>
                                <IconLabel kind="mail" label={contactEmail} />
                              </td>
                            ) : null}
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td valign="middle" style={{ verticalAlign: 'middle', width: 68, padding: '0 0 0 12px' }}>
                      <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-100 w-[68px] h-[68px]">
                        <QRCode
                          size={256}
                          style={{ height: '100%', width: '100%' }}
                          value={qrValue}
                          viewBox="0 0 256 256"
                          fgColor={primary}
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="h-[5px] w-full shrink-0" style={{ backgroundColor: accent }} />
          </div>
        </div>
      </div>

      <div className="flex gap-4 w-full justify-center flex-wrap">
        <Button
          onClick={handleDownload}
          disabled={isGenerating}
          variant="outline"
          className="gap-2 bg-white text-slate-900 border-slate-300 hover:bg-slate-50"
        >
          {isGenerating ? (
            <>Generating...</>
          ) : (
            <>
              <Download className="h-4 w-4" /> Download ID Card
            </>
          )}
        </Button>
        {onRenew ? (
          <Button onClick={onRenew} variant="outline">
            Renew Validity
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default IdCard
