import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingContentSections } from '@/components/landing/LandingSections'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Airy centered — brand first, wide campus band below. */
export default function HorizonTemplate(p: LandingTemplateProps) {
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
    <div
      className={`relative min-h-screen overflow-x-hidden font-sans ${
        light ? 'bg-[#F4FAF8] text-slate-900' : 'bg-[#061816] text-white'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${primary}16, transparent 68%)` }}
        aria-hidden
      />

      <header className="relative z-20 mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="w-full min-w-0">
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
            solidClassName="rounded-xl px-4 text-white"
            outlineClassName={
              light
                ? 'rounded-xl border-slate-200 bg-white text-slate-800'
                : 'rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10'
            }
          />
        </div>
      </header>

      <section
        id="home"
        className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-4 py-8 text-center sm:px-6 sm:py-14"
      >
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: accent }}
        >
          Welcome · {year}
        </p>
        <h1
          className={`mx-auto max-w-2xl break-words font-display text-2xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.75rem] ${
            light ? 'text-slate-900' : 'text-white'
          }`}
        >
          {headline}
        </h1>
        <p className={`mx-auto mt-4 max-w-xl text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-slate-300'}`}>
          {tagline}
        </p>
        <div className="mx-auto mt-7 w-full max-w-sm sm:mt-8 sm:max-w-md">
          <LandingCtas
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            size="default"
            align="center"
            solidClassName="rounded-xl px-6 text-white"
            outlineClassName={
              light
                ? 'rounded-xl border-slate-200 bg-white px-6 text-slate-800'
                : 'rounded-xl border-white/20 bg-white/5 px-6 text-white hover:bg-white/10'
            }
          />
        </div>
        <div className="mt-6">
          <LandingHeroSocials
            institution={institution}
            primary={primary}
            tone={tone}
            align="center"
            preview={preview}
          />
        </div>
        <div className="mx-auto mt-8 overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.12)] ring-1 ring-black/5 sm:mt-10">
          <img src={heroImage} alt="" className="aspect-[16/10] w-full object-cover sm:aspect-[21/9]" />
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
