import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandMark, LandingCtas, SharedLandingFooter } from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import { dashboardPathForRole, type LandingTemplateProps } from '@/components/landing/types'

export default function HorizonTemplate(p: LandingTemplateProps) {
  const {
    institution, primary, accent, heroImage, headline, tagline, verifyHref, year,
    sameTenant, userRole, onOpenLogin, preview, onChangeTemplate,
  } = p

  return (
    <div className="relative min-h-screen bg-[#F7FBFA] font-sans text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64" style={{ background: `radial-gradient(ellipse at 50% 0%, ${primary}18, transparent 70%)` }} aria-hidden />

      <header className="relative z-20 mx-auto max-w-5xl px-4 pt-5 sm:px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <BrandMark institution={institution} primary={primary} rounded="xl" />
              <p className="font-display text-base font-bold">{institution.name}</p>
            </div>
            {sameTenant ? (
              <Button asChild size="sm" className="rounded-xl text-white" style={{ backgroundColor: primary }}>
                <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
              </Button>
            ) : (
              <Button type="button" size="sm" className="rounded-xl text-white" style={{ backgroundColor: primary }} onClick={() => !preview && onOpenLogin()}>
                Login
              </Button>
            )}
          </div>
          <LandingPageNav primary={primary} preview={preview} tone="light" className="justify-center" />
        </div>
      </header>

      <section id="home" className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-4 py-8 text-center sm:px-6 sm:py-10">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: accent }}>
          Enrollment · {year}
        </p>
        <h1 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">{headline}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">{tagline}</p>
        <div className="mt-6 flex justify-center">
          <LandingCtas primary={primary} verifyHref={verifyHref} sameTenant={sameTenant} userRole={userRole} onOpenLogin={onOpenLogin} preview={preview} size="default" solidClassName="rounded-xl px-6 text-white" outlineClassName="rounded-xl border-slate-200 bg-white px-6" />
        </div>
        <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
          <img src={heroImage} alt="" className="aspect-[21/9] w-full object-cover" />
        </div>
      </section>

      <LandingContentSections institution={institution} primary={primary} accent={accent} tagline={tagline} tone="light" />
      <SharedLandingFooter institution={institution} primary={primary} year={year} verifyHref={verifyHref} onOpenLogin={onOpenLogin} onChangeTemplate={onChangeTemplate} preview={preview} tone="light" />
    </div>
  )
}
