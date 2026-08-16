import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandMark, LandingCtas, SharedLandingFooter } from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import { dashboardPathForRole, type LandingTemplateProps } from '@/components/landing/types'

export default function CrestTemplate(p: LandingTemplateProps) {
  const {
    institution, primary, accent, heroImage, headline, tagline, verifyHref, year,
    sameTenant, userRole, onOpenLogin, preview, onChangeTemplate,
  } = p

  return (
    <div className="relative min-h-screen overflow-hidden font-sans text-slate-100" style={{ backgroundColor: primary }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(165deg, ${primary}f2 10%, ${primary}cc 55%, ${primary}aa 100%), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden
      />

      <header className="relative z-20 border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark institution={institution} primary={accent} size="sm" />
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-white">{institution.name}</p>
          </div>
          <LandingPageNav primary={accent} preview={preview} tone="dark" />
          {sameTenant ? (
            <Button asChild size="sm" className="rounded-sm font-semibold text-slate-900" style={{ backgroundColor: accent }}>
              <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="rounded-sm font-semibold text-slate-900" style={{ backgroundColor: accent }} onClick={() => !preview && onOpenLogin()}>
              Portal Login
            </Button>
          )}
        </div>
      </header>

      <section id="home" className="relative z-10 mx-auto flex max-w-3xl scroll-mt-24 flex-col items-center px-4 py-16 text-center sm:py-20">
        <div className="mb-5 h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">{headline}</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">{tagline}</p>
        <div className="mt-7">
          <LandingCtas primary={accent} verifyHref={verifyHref} sameTenant={sameTenant} userRole={userRole} onOpenLogin={onOpenLogin} preview={preview} size="default" solidClassName="rounded-sm px-7 font-semibold text-slate-900" outlineClassName="rounded-sm border-white/30 bg-transparent px-7 text-white" />
        </div>
      </section>

      <div className="relative z-10">
        <LandingContentSections institution={institution} primary={accent} accent={accent} tagline={tagline} tone="dark" />
        <SharedLandingFooter institution={institution} primary={accent} year={year} verifyHref={verifyHref} onOpenLogin={onOpenLogin} onChangeTemplate={onChangeTemplate} preview={preview} tone="dark" />
      </div>
    </div>
  )
}
