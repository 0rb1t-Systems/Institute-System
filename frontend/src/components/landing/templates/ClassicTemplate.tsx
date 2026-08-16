import React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BrandMark, LandingCtas, SharedLandingFooter } from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import { dashboardPathForRole, type LandingTemplateProps } from '@/components/landing/types'

export default function ClassicTemplate(p: LandingTemplateProps) {
  const {
    institution, primary, accent, heroImage, headline, tagline, verifyHref, year,
    sameTenant, userRole, onOpenLogin, preview, onChangeTemplate,
  } = p

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans text-white">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }} />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(105deg, rgba(5,10,24,0.94) 0%, rgba(8,16,36,0.78) 50%, rgba(10,18,40,0.5) 100%), linear-gradient(0deg,#050a18 0%, transparent 45%)`,
          }}
        />
      </div>

      <header className="relative z-20 border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark institution={institution} primary={primary} size="sm" />
            <p className="truncate text-sm font-bold uppercase tracking-wide text-white">{institution.name}</p>
          </div>
          <LandingPageNav primary={accent} preview={preview} tone="dark" />
          {sameTenant ? (
            <Button asChild size="sm" className="rounded-lg text-white" style={{ backgroundColor: primary }}>
              <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
            </Button>
          ) : (
            <Button type="button" size="sm" className="rounded-lg text-white" style={{ backgroundColor: primary }} onClick={() => !preview && onOpenLogin()}>
              Sign In
            </Button>
          )}
        </div>
      </header>

      <section id="home" className="relative z-10 mx-auto flex max-w-6xl scroll-mt-24 flex-col justify-center px-4 py-14 sm:px-8 sm:py-16">
        <div className="max-w-xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: `${primary}55`, backgroundColor: `${primary}22` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            Enrollment · {year}
          </div>
          <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">{headline}</h1>
          <p className="max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">{tagline}</p>
          <LandingCtas primary={primary} verifyHref={verifyHref} sameTenant={sameTenant} userRole={userRole} onOpenLogin={onOpenLogin} preview={preview} size="default" solidClassName="rounded-xl px-5 text-white" outlineClassName="rounded-xl border-white/25 bg-white/5 px-5 text-white" />
        </div>
      </section>

      <LandingContentSections institution={institution} primary={primary} accent={accent} tagline={tagline} tone="dark" />
      <SharedLandingFooter institution={institution} primary={primary} year={year} verifyHref={verifyHref} onOpenLogin={onOpenLogin} onChangeTemplate={onChangeTemplate} preview={preview} tone="dark" />
    </div>
  )
}
