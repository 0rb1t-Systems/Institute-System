import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandMark, LandingCtas, SharedLandingFooter } from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import { dashboardPathForRole, type LandingTemplateProps } from '@/components/landing/types'

export default function LedgerTemplate(p: LandingTemplateProps) {
  const {
    institution, primary, accent, heroImage, headline, tagline, verifyHref, year,
    sameTenant, userRole, onOpenLogin, preview, onChangeTemplate,
  } = p

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }} />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark institution={institution} primary={primary} size="sm" rounded="xl" />
            <p className="text-sm font-bold">{institution.name}</p>
          </div>
          <LandingPageNav primary={accent} preview={preview} tone="light" />
          {sameTenant ? (
            <Button asChild size="sm" className="rounded-md text-white" style={{ backgroundColor: primary }}>
              <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="rounded-md text-white" style={{ backgroundColor: primary }} onClick={() => !preview && onOpenLogin()}>
              Portal Login
            </Button>
          )}
        </div>
      </header>

      <section id="home" className="scroll-mt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-12">
          <div className="space-y-5">
            <div className="border-l-4 pl-4" style={{ borderColor: accent }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Training · {year}</p>
              <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{headline}</h1>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">{tagline}</p>
            <LandingCtas primary={primary} verifyHref={verifyHref} sameTenant={sameTenant} userRole={userRole} onOpenLogin={onOpenLogin} preview={preview} size="default" solidClassName="rounded-md px-5 text-white" outlineClassName="rounded-md border-slate-300 bg-white px-5" />
          </div>
          <div className="overflow-hidden rounded-xl shadow-xl ring-1 ring-slate-200">
            <img src={heroImage} alt="" className="aspect-[16/10] w-full object-cover" />
          </div>
        </div>
      </section>

      <LandingContentSections institution={institution} primary={primary} accent={accent} tagline={tagline} tone="light" />
      <SharedLandingFooter institution={institution} primary={primary} year={year} verifyHref={verifyHref} onOpenLogin={onOpenLogin} onChangeTemplate={onChangeTemplate} preview={preview} tone="light" />
    </div>
  )
}
