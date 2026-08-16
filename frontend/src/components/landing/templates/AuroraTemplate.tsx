import React from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark, LandingCtas, SharedLandingFooter } from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import { dashboardPathForRole, type LandingTemplateProps } from '@/components/landing/types'

export default function AuroraTemplate(p: LandingTemplateProps) {
  const {
    institution, primary, accent, heroImage, headline, tagline, verifyHref, year,
    sameTenant, userRole, onOpenLogin, preview, onChangeTemplate,
  } = p
  const words = String(headline || '').trim().split(/\s+/)
  const last = words.length > 1 ? words.pop()! : ''
  const lead = words.join(' ')

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white font-sans text-slate-900">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 90% 0%, ${primary}12, transparent 55%), linear-gradient(180deg,#fff,#F5F8FF)`,
        }}
        aria-hidden
      />

      <div className="relative z-30 mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-slate-200/70 bg-white/85 px-3 py-2 shadow-lg backdrop-blur-xl sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark institution={institution} primary={primary} size="sm" />
            <p className="truncate text-sm font-bold text-slate-900">{institution.name}</p>
          </div>
          <LandingPageNav primary={primary} preview={preview} tone="light" />
          {sameTenant ? (
            <Button asChild size="sm" className="rounded-full text-white" style={{ backgroundColor: primary }}>
              <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="rounded-full text-white" style={{ backgroundColor: primary }} onClick={() => !preview && onOpenLogin()}>
              Portal Login
            </Button>
          )}
        </header>
      </div>

      <section id="home" className="relative z-10 mx-auto grid max-w-6xl scroll-mt-24 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-12">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ backgroundColor: `${primary}12`, color: primary }}>
            <GraduationCap className="h-3.5 w-3.5" /> Official portal
          </div>
          <h1 className="font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
            {lead ? <>{lead} <span style={{ color: primary }}>{last}</span></> : headline}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">{tagline}</p>
          <LandingCtas primary={primary} verifyHref={verifyHref} sameTenant={sameTenant} userRole={userRole} onOpenLogin={onOpenLogin} preview={preview} size="default" solidClassName="rounded-full px-5 text-white shadow-md" outlineClassName="rounded-full border-slate-200 bg-white px-5" />
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="relative overflow-hidden shadow-2xl" style={{ borderRadius: '42% 58% 48% 52% / 48% 42% 58% 52%' }}>
            <img src={heroImage} alt="" className="aspect-[5/5] w-full object-cover" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(155deg, ${primary}40, transparent 50%)` }} />
          </div>
          <div className="absolute bottom-6 left-0 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold shadow-lg">
            <Sparkles className="h-3 w-3" style={{ color: primary }} /> Quality Education
          </div>
        </div>
      </section>

      <LandingContentSections institution={institution} primary={primary} accent={accent} tagline={tagline} tone="light" />
      <SharedLandingFooter institution={institution} primary={primary} year={year} verifyHref={verifyHref} onOpenLogin={onOpenLogin} onChangeTemplate={onChangeTemplate} preview={preview} tone="light" />
    </div>
  )
}
