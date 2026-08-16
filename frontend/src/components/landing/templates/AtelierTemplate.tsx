import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandMark, LandingCtas, SharedLandingFooter } from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import { dashboardPathForRole, type LandingTemplateProps } from '@/components/landing/types'

export default function AtelierTemplate(p: LandingTemplateProps) {
  const {
    institution, primary, accent, heroImage, headline, tagline, verifyHref, year,
    sameTenant, userRole, onOpenLogin, preview, onChangeTemplate,
  } = p

  return (
    <div className="min-h-screen bg-[#FAFAF9] font-sans text-stone-900">
      <header className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4">
          <div className="flex items-center gap-2.5">
            <BrandMark institution={institution} primary={primary} size="sm" rounded="2xl" />
            <p className="font-display text-base font-semibold">{institution.name}</p>
          </div>
          <LandingPageNav primary={accent} preview={preview} tone="light" />
          {sameTenant ? (
            <Button asChild size="sm" className="rounded-full text-white" style={{ backgroundColor: primary }}>
              <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="rounded-full text-white" style={{ backgroundColor: primary }} onClick={() => !preview && onOpenLogin()}>
              Portal Login
            </Button>
          )}
        </div>
      </header>

      <section id="home" className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-12">
        <div className="space-y-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-stone-500">Community · {year}</p>
          <h1 className="max-w-lg font-display text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl">{headline}</h1>
          <p className="max-w-md border-l-2 pl-4 text-sm leading-relaxed text-stone-600 sm:text-base" style={{ borderColor: accent }}>{tagline}</p>
          <LandingCtas primary={primary} verifyHref={verifyHref} sameTenant={sameTenant} userRole={userRole} onOpenLogin={onOpenLogin} preview={preview} size="default" solidClassName="rounded-full px-6 text-white" outlineClassName="rounded-full border-stone-300 bg-white px-6" />
        </div>
        <div className="relative max-w-md justify-self-center lg:max-w-none lg:justify-self-end">
          <img src={heroImage} alt="" className="aspect-[4/4] w-full rounded-2xl object-cover shadow-xl" />
        </div>
      </section>

      <LandingContentSections institution={institution} primary={primary} accent={accent} tagline={tagline} tone="light" />
      <SharedLandingFooter institution={institution} primary={primary} year={year} verifyHref={verifyHref} onOpenLogin={onOpenLogin} onChangeTemplate={onChangeTemplate} preview={preview} tone="light" />
    </div>
  )
}
