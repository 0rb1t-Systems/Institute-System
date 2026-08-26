import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingContentSections } from '@/components/landing/LandingSections'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Cinematic photo hero — light mode uses a bright branded wash; dark stays cinematic. */
export default function ClassicTemplate(p: LandingTemplateProps) {
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
    <div className={`relative min-h-screen overflow-x-hidden font-sans ${light ? 'bg-slate-50 text-slate-900' : 'text-white'}`}>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: light
              ? `linear-gradient(105deg, color-mix(in srgb, ${primary} 22%, #f8fafc) 0%, color-mix(in srgb, ${primary} 8%, #ffffff) 42%, rgba(248,250,252,0.72) 100%)`
              : 'linear-gradient(105deg, rgba(4,8,20,0.94) 0%, rgba(6,12,28,0.82) 42%, rgba(8,14,32,0.55) 100%), linear-gradient(0deg, #040814 0%, transparent 42%)',
          }}
        />
      </div>

      <header
        className={`relative z-20 border-b backdrop-blur-xl ${
          light ? 'border-slate-200/80 bg-white/85' : 'border-white/10 bg-black/20'
        }`}
      >
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-2.5 sm:px-8 sm:py-3">
          <LandingHeaderBar
            institution={institution}
            primary={primary}
            navPrimary={accent}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            tone={tone}
            brandNameClassName={
              light
                ? 'text-[13px] font-semibold leading-snug tracking-tight text-slate-900 sm:text-[15px]'
                : 'text-[13px] font-semibold leading-snug tracking-tight text-white sm:text-[15px]'
            }
            solidClassName="rounded-lg px-4"
            outlineClassName={
              light
                ? 'rounded-lg border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                : 'rounded-lg border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white'
            }
          />
        </div>
      </header>

      <section
        id="home"
        className="relative z-10 mx-auto flex min-h-[min(56vh,480px)] max-w-6xl scroll-mt-24 flex-col justify-center px-4 py-12 sm:min-h-[min(68vh,580px)] sm:px-8 sm:py-20"
      >
        <div className="max-w-xl space-y-5 sm:space-y-6">
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${light ? '' : 'text-white/70'}`}
            style={light ? { color: primary } : undefined}
          >
            {institution.name}
          </p>
          <h1
            className={`break-words font-display text-2xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl ${
              light ? 'text-slate-900' : ''
            }`}
          >
            {headline}
          </h1>
          <p className={`max-w-lg text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-white/75'}`}>
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
            solidClassName="rounded-lg px-6"
            outlineClassName={
              light
                ? 'rounded-lg border-slate-200 bg-white px-6 text-slate-800 hover:bg-slate-50'
                : 'rounded-lg border-white/30 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white'
            }
          />
          <LandingHeroSocials
            institution={institution}
            primary={primary}
            tone={tone}
            preview={preview}
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
