import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandMark, LandingCtas, SharedLandingFooter } from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import { dashboardPathForRole, type LandingTemplateProps } from '@/components/landing/types'

export default function NovaTemplate(p: LandingTemplateProps) {
  const {
    institution, primary, accent, heroImage, headline, tagline, verifyHref, year,
    sameTenant, userRole, onOpenLogin, preview, onChangeTemplate,
  } = p

  return (
    <div className="min-h-screen bg-[#ECFDF9] font-sans text-slate-900">
      <header className="sticky top-0 z-30 border-b border-teal-900/5 bg-[#ECFDF9]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <BrandMark institution={institution} primary={primary} size="sm" rounded="xl" />
            <p className="text-sm font-bold">{institution.name}</p>
          </div>
          <LandingPageNav primary={primary} preview={preview} tone="light" />
          {sameTenant ? (
            <Button asChild size="sm" className="rounded-xl text-white" style={{ backgroundColor: primary }}>
              <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="rounded-xl text-white" style={{ backgroundColor: primary }} onClick={() => !preview && onOpenLogin()}>
              Portal Login
            </Button>
          )}
        </div>
      </header>

      <section id="home" className="mx-auto grid max-w-6xl scroll-mt-24 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:py-12">
        <div className="flex flex-col justify-center space-y-5 lg:col-span-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>Portal · {year}</p>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{headline}</h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{tagline}</p>
          <LandingCtas primary={primary} verifyHref={verifyHref} sameTenant={sameTenant} userRole={userRole} onOpenLogin={onOpenLogin} preview={preview} size="default" solidClassName="rounded-xl px-5 text-white" outlineClassName="rounded-xl border-teal-200 bg-white px-5" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:col-span-7">
          <div className="col-span-2 overflow-hidden rounded-2xl sm:col-span-1 sm:row-span-2">
            <img src={heroImage} alt="" className="h-full min-h-[200px] w-full object-cover sm:min-h-[280px]" />
          </div>
          <div className="rounded-2xl p-4 text-white" style={{ background: `linear-gradient(145deg, ${primary}, ${accent})` }}>
            <p className="text-xs text-white/80">Credentials</p>
            <p className="mt-1 font-display text-lg font-bold">Verified</p>
          </div>
          <div className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Portal</p>
            <p className="mt-1 font-display text-lg font-bold text-slate-900">Students · Staff</p>
          </div>
        </div>
      </section>

      <LandingContentSections institution={institution} primary={primary} accent={accent} tagline={tagline} tone="light" />
      <SharedLandingFooter institution={institution} primary={primary} year={year} verifyHref={verifyHref} onOpenLogin={onOpenLogin} onChangeTemplate={onChangeTemplate} preview={preview} tone="light" />
    </div>
  )
}
