import React, { useRef, useState } from 'react'
import { User, Globe, Mail, Download, BadgeCheck } from 'lucide-react'
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
  splitInstitutionName,
} from '@/lib/institution'

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
  const cardRef = useRef(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const { institution } = useAuth()

  const institutionName = getInstitutionDisplayName(institution)
  const { title, subtitle } = splitInstitutionName(institutionName)
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

  // Identity verify (student/staff code) — not certificate /verify/:code
  const identityCode = String(code || user?.student_code || user?.staff_code || '').trim()
  const qrValue = getVerificationUrl(identityCode || 'unknown', institution, 'credential')

  const handleDownload = async () => {
    const node = cardRef.current
    if (!node || isGenerating) return
    setIsGenerating(true)
    const host = document.createElement('div')
    host.style.cssText =
      'position:fixed;left:-12000px;top:0;z-index:-1;background:#ffffff;margin:0;padding:0;overflow:visible;'
    const clone = node.cloneNode(true) as HTMLElement
    clone.id = `${cardDomId}-export`
    clone.style.transform = 'none'
    clone.style.margin = '0'
    clone.style.maxWidth = 'none'
    clone.style.width = `${node.offsetWidth}px`
    clone.style.height = `${node.offsetHeight}px`
    clone.style.overflow = 'hidden'
    host.appendChild(clone)
    document.body.appendChild(host)
    try {
      if (document.fonts?.ready) await document.fonts.ready
      await new Promise((resolve) => setTimeout(resolve, 250))
      const canvas = await html2canvas(clone, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 20000,
        width: clone.offsetWidth,
        height: clone.offsetHeight,
        windowWidth: clone.offsetWidth,
        windowHeight: clone.offsetHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (doc) => {
          const card = doc.getElementById(`${cardDomId}-export`) as HTMLElement | null
          if (card) {
            card.style.overflow = 'hidden'
            card.style.boxShadow = 'none'
          }
        },
      })
      const link = document.createElement('a')
      const safeInst = institutionName.replace(/\s+/g, '_')
      const fallback = `${safeInst}_${String(roleLabel).replace(/\s+/g, '_')}_${String(displayName).replace(/\s+/g, '_')}.png`
      link.download = downloadName || fallback
      link.href = canvas.toDataURL('image/png', 1.0)
      link.click()
    } catch (error) {
      console.error('ID Card Generation Error:', error)
    } finally {
      host.remove()
      setIsGenerating(false)
    }
  }

  return (
    <div className={`flex flex-col items-center gap-6 w-full min-w-0 ${className}`}>
      <div className="relative group w-full max-w-full">
        <div className="mx-auto w-[480px] max-w-full relative">
        <div
          className={`absolute -inset-2 rounded-xl opacity-30 blur-xl transition duration-500 group-hover:opacity-40 pointer-events-none ${isExpired ? 'bg-red-500' : ''}`}
          style={!isExpired ? { backgroundColor: primary } : undefined}
        />

        <div
          id={cardDomId}
          ref={cardRef}
          className="relative w-[480px] max-w-full min-h-[320px] bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans select-none"
          style={{
            backgroundImage:
              'url("https://www.transparenttextures.com/patterns/clean-gray-paper.png"), linear-gradient(to bottom right, #ffffff, #f8fafc)',
            backgroundBlendMode: 'multiply',
          }}
        >
          <div
            className="h-[68px] relative overflow-hidden flex items-center justify-between px-6 shrink-0 z-10"
            style={{ backgroundColor: primary }}
          >
            <div className="absolute top-0 right-0 w-32 h-full bg-white/5 transform skew-x-[-20deg] translate-x-8 pointer-events-none" />

            <div className="flex items-center gap-3 z-10 min-w-0 flex-1">
              {institution?.logo_url ? (
                <img
                  src={institution.logo_url}
                  alt=""
                  className="h-10 w-auto object-contain bg-white/10 rounded p-0.5"
                  crossOrigin="anonymous"
                />
              ) : null}
              <div className="text-white flex flex-col justify-center leading-none min-w-0">
                <h1 className="text-[15px] font-black uppercase tracking-wide leading-tight mb-[3px] truncate">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider leading-tight truncate">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="relative z-10 shrink-0 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded text-[10px] font-bold text-white uppercase tracking-wider border border-white/20 shadow-sm">
              {roleLabel}
            </div>
          </div>

          <div className="flex-1 px-5 py-4 grid grid-cols-[104px_1fr] gap-4 relative z-10 content-start min-h-0">
            <div className="flex flex-col items-center gap-2.5 pt-1">
              <div className="w-[104px] h-[104px] rounded-lg border-[3px] border-white shadow-md overflow-hidden relative bg-slate-100 shrink-0">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="Profile"
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
                <div className="px-3 py-1 bg-red-100 text-red-600 text-[9px] font-bold uppercase tracking-widest rounded-full border border-red-200 shadow-sm w-full text-center">
                  Expired
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-emerald-700/90 uppercase tracking-widest w-full bg-emerald-50 py-0.5 rounded-full border border-emerald-100 shadow-sm">
                  <BadgeCheck className="h-3 w-3 text-emerald-600" />
                  <span>Verified</span>
                </div>
              )}
            </div>

            <div className="flex flex-col h-full min-w-0 pt-0.5">
              <div className="mb-4">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  {nameLabel}
                </label>
                <h2
                  className="text-[14px] font-black text-slate-900 uppercase leading-snug break-words tracking-tight"
                  title={displayName}
                >
                  {displayName}
                </h2>
              </div>

              <div className="flex-1 min-h-[50px] mb-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  {secondaryLabel}
                </label>
                <div className="relative">
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full opacity-20"
                    style={{ backgroundColor: primary }}
                  />
                  <p className="text-[11px] font-bold text-slate-800 leading-normal pl-3 pr-1" title={secondaryValue}>
                    {secondaryValue}
                  </p>
                </div>
              </div>

              <div className="flex items-end gap-6 mt-auto pt-2 border-t border-slate-100 min-w-0">
                <div className="min-w-0">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    {idLabel}
                  </label>
                  <p className="text-[15px] font-mono font-bold truncate" style={{ color: primary }}>
                    {displayCode}
                  </p>
                </div>
                <div className="min-w-0">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Valid Until
                  </label>
                  <p className={`text-[13px] font-bold ${isExpired ? 'text-red-500' : 'text-slate-700'}`}>
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

          <div className="min-h-[76px] bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 px-4 py-2.5 shrink-0">
            <div className="flex flex-col gap-1.5 min-w-0 flex-1 text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-wide">
              <div className="flex items-center gap-1.5 min-w-0">
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate">{hostLabel}</span>
              </div>
              {contactEmail ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{contactEmail}</span>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 bg-white p-1 rounded-md shadow-sm border border-slate-200">
              <div className="w-[56px] h-[56px]">
                <QRCode
                  size={256}
                  style={{ height: '100%', width: '100%' }}
                  value={qrValue}
                  viewBox={`0 0 256 256`}
                  fgColor={primary}
                />
              </div>
            </div>
          </div>

          <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: accent }} />
        </div>
        </div>
      </div>

      <div className="flex gap-4 w-full justify-center flex-wrap">
        <Button
          onClick={handleDownload}
          disabled={isGenerating}
          variant="outline"
          className="gap-2 bg-slate-900 text-white border-slate-700 hover:bg-slate-800"
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
