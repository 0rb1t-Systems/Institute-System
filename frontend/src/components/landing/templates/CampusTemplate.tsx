import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingContentSections } from '@/components/landing/LandingSections'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Architectural split — copy left, full-bleed campus photo right. */
export default function CampusTemplate(p: LandingTemplateProps) {
  const {
    institution,
    primary,
    accent,
    heroImage,
    headline,
    tagline,
    verifyHref,
    year,
    sameTenant,
    userRole,
    onOpenLogin,
    preview,
    onChangeTemplate,
  } = p
  const light = landingIsLight(p.themeMode)
  const tone = light ? 'light' : 'dark'

  return (
    <div className={`min-h-screen overflow-x-hidden font-sans ${light ? 'bg-white text-slate-900' : 'bg-[#071018] text-white'}`}>
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          light ? 'border-slate-100 bg-white/95' : 'border-white/10 bg-[#071018]/90'
        }`}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-7 px-4 py-2.5 sm:px-6 sm:py-3">
          <LandingHeaderBar
            institution={institution}
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            tone={tone}
            brandNameClassName={
              light
                ? 'font-display text-[13px] font-semibold leading-snug tracking-tight text-slate-900 sm:text-[15px]'
                : 'font-display text-[13px] font-semibold leading-snug tracking-tight text-white sm:text-[15px]'
            }
            solidClassName="rounded-lg px-4 text-white"
            outlineClassName={
              light
                ? 'rounded-lg border-slate-200 bg-white text-slate-800'
                : 'rounded-lg border-white/20 bg-white/5 text-white hover:bg-white/10'
            }
          />
        </div>
      </header>

      <section id="home" className="relative grid scroll-mt-24 lg:min-h-[min(72vh,640px)] lg:grid-cols-2">
        <div className="flex flex-col justify-center px-4 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
          <div className="mx-auto w-full max-w-xl space-y-5 sm:space-y-6">
            <div className="h-1 w-12 rounded-full" style={{ backgroundColor: accent }} />
            <h1
              className={`break-words font-display text-2xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.75rem] ${
                light ? 'text-slate-900' : 'text-white'
              }`}
            >
              {headline}
            </h1>
            <p className={`max-w-md text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-slate-300'}`}>
              {tagline}
            </p>
            <LandingCtas
              primary={primary}
              verifyHref={verifyHref}
              sameTenant={sameTenant}
              userRole={userRole}
              onOpenLogin={onOpenLogin}
              preview={preview}
              size="default"
              solidClassName="rounded-lg px-5 text-white"
              outlineClassName={
                light
                  ? 'rounded-lg border-slate-200 bg-white px-5 text-slate-800'
                  : 'rounded-lg border-white/20 bg-white/5 px-5 text-white hover:bg-white/10'
              }
            />
            <LandingHeroSocials
              institution={institution}
              primary={primary}
              tone={tone}
              preview={preview}
            />
          </div>
        </div>

        <div className="relative min-h-[220px] sm:min-h-[320px] lg:min-h-full">
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className={`absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r to-transparent lg:block ${
              light ? 'from-white' : 'from-[#071018]'
            }`}
            aria-hidden
          />
        </div>
      </section>

      <LandingContentSections
        institution={institution}
        primary={primary}
        accent={accent}
        tagline={tagline}
        tone={tone}
        preview={preview}
      />
      <SharedLandingFooter
        institution={institution}
        primary={primary}
        year={year}
        verifyHref={verifyHref}
        onOpenLogin={onOpenLogin}
        onChangeTemplate={onChangeTemplate}
        preview={preview}
        tone={tone}
      />
    </div>
  )
}
