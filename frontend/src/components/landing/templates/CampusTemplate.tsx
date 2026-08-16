import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandMark, LandingCtas, SharedLandingFooter } from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import { dashboardPathForRole, type LandingTemplateProps } from '@/components/landing/types'

export default function CampusTemplate(p: LandingTemplateProps) {
  const {
    institution, primary, accent, heroImage, headline, tagline, verifyHref, year,
    sameTenant, userRole, onOpenLogin, preview, onChangeTemplate,
  } = p
  const match = String(headline || '').match(/^(.*?)(\S+)\.?$/)
  const lead = match?.[1]?.trim() || headline
  const emphasis = match?.[2] || ''

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark institution={institution} primary={primary} size="sm" />
            <p className="text-sm font-bold text-slate-900">{institution.name}</p>
          </div>
          <LandingPageNav primary={primary} preview={preview} tone="light" />
          {sameTenant ? (
            <Button asChild size="sm" className="rounded-lg text-white" style={{ backgroundColor: primary }}>
              <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="rounded-lg text-white" style={{ backgroundColor: primary }} onClick={() => !preview && onOpenLogin()}>
              Portal Login
            </Button>
          )}
        </div>
      </header>

      <section id="home" className="relative grid scroll-mt-24 lg:grid-cols-2">
        <div className="flex flex-col justify-center px-4 py-10 sm:px-10 lg:px-12 lg:py-14">
          <div className="mx-auto w-full max-w-xl space-y-5">
            <h1 className="font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl">
              {lead} {emphasis && <span style={{ color: accent }}>{emphasis}</span>}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{tagline}</p>
            <LandingCtas primary={primary} verifyHref={verifyHref} sameTenant={sameTenant} userRole={userRole} onOpenLogin={onOpenLogin} preview={preview} size="default" solidClassName="rounded-xl px-5 text-white" outlineClassName="rounded-xl border-slate-200 bg-white px-5" />
          </div>
        </div>
        <div className="relative min-h-[240px] lg:min-h-[420px]">
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent lg:w-20" aria-hidden />
        </div>
      </section>

      <LandingContentSections institution={institution} primary={primary} accent={accent} tagline={tagline} tone="light" />
      <SharedLandingFooter institution={institution} primary={primary} year={year} verifyHref={verifyHref} onOpenLogin={onOpenLogin} onChangeTemplate={onChangeTemplate} preview={preview} tone="light" />
    </div>
  )
}
