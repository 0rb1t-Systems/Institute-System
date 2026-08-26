import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingContentSections } from '@/components/landing/LandingSections'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Soft light glass — floating nav, rounded portrait hero. */
export default function AuroraTemplate(p: LandingTemplateProps) {
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
    <div className={`relative min-h-screen overflow-x-hidden font-sans ${light ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#0b1220] text-white'}`}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 55% 45% at 100% 0%, ${primary}14, transparent 55%), radial-gradient(ellipse 40% 30% at 0% 20%, ${accent}10, transparent 50%)`,
        }}
        aria-hidden
      />

      <div className="relative z-30 mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <header
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-7 rounded-2xl border px-3 py-2.5 backdrop-blur-xl sm:px-5 sm:py-3 ${
            light
              ? 'border-white/80 bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)]'
              : 'border-white/10 bg-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]'
          }`}
        >
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
            solidClassName="rounded-full px-4"
            outlineClassName={
              light
                ? 'rounded-full border-slate-200 bg-white text-slate-800'
                : 'rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10'
            }
          />
        </header>
      </div>

      <section
        id="home"
        className="relative z-10 mx-auto grid max-w-6xl scroll-mt-24 items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-14 lg:py-16"
      >
        <div className="space-y-5 sm:space-y-6">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${light ? 'text-slate-500' : 'text-slate-400'}`}>
            {institution.name}
          </p>
          <h1 className={`max-w-lg break-words font-display text-2xl font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.65rem] ${light ? 'text-slate-800' : 'text-white'}`}>
            {headline}
          </h1>
          <p className={`max-w-md text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-slate-300'}`}>{tagline}</p>
          <LandingCtas
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            size="default"
            solidClassName="rounded-full px-6 shadow-md shadow-slate-900/10"
            outlineClassName={
              light
                ? 'rounded-full border-slate-200 bg-white px-6 text-slate-800'
                : 'rounded-full border-white/20 bg-white/5 px-6 text-white'
            }
          />
          <LandingHeroSocials
            institution={institution}
            primary={primary}
            tone={tone}
            preview={preview}
          />
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            className="relative overflow-hidden shadow-2xl shadow-slate-900/15"
            style={{ borderRadius: '1.75rem' }}
          >
            <img src={heroImage} alt="" className="aspect-[4/3] max-h-[55vh] w-full object-cover sm:aspect-[5/5] sm:max-h-none" />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: `linear-gradient(160deg, ${primary}28, transparent 45%)` }}
              aria-hidden
            />
          </div>
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
