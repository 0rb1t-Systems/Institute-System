import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingTemplateMain } from '@/components/landing/LandingSitePages'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Cinematic full-bleed photo hero. */
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
    page = 'home',
  } = p
  const light = landingIsLight(p.themeMode)
  const tone = light ? 'light' : 'dark'

  return (
    <div
      className={`tenant-landing-classic relative min-h-screen overflow-x-hidden ${
        light ? 'bg-slate-50 text-slate-900' : 'bg-[#0B1220] text-white'
      }`}
    >
      {page === 'home' ? (
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImage})` }} />
          <div
            className="absolute inset-0"
            style={{
              background: light
                ? `linear-gradient(105deg, color-mix(in srgb, ${primary} 28%, #f8fafc) 0%, color-mix(in srgb, ${primary} 10%, #ffffff) 48%, rgba(248,250,252,0.78) 100%)`
                : 'linear-gradient(270deg, rgba(11,18,32,0.95) 0%, rgba(11,18,32,0.72) 48%, rgba(11,18,32,0.35) 100%)',
            }}
          />
        </div>
      ) : null}

      <header
        className={`relative z-20 border-b backdrop-blur-xl ${
          light ? 'border-slate-200/80 bg-white/85' : 'border-white/10 bg-[#0B1220]/80'
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
                ? 'font-display text-[13px] font-semibold leading-snug tracking-tight text-slate-900 sm:text-[15px]'
                : 'font-display text-[13px] font-semibold leading-snug tracking-tight text-white sm:text-[15px]'
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

      <LandingTemplateMain
        page={page}
        institution={institution}
        primary={primary}
        accent={accent}
        tagline={tagline}
        tone={tone}
        preview={preview}
        verifyHref={verifyHref}
        sameTenant={sameTenant}
        userRole={userRole}
        onOpenLogin={onOpenLogin}
        heroImage={heroImage}
        hero={
          <section className="relative z-10 mx-auto flex min-h-[min(58vh,520px)] max-w-6xl scroll-mt-24 flex-col justify-center px-4 py-12 sm:min-h-[min(70vh,640px)] sm:px-8 sm:py-20">
            <div className="max-w-xl space-y-5 sm:space-y-6">
              <h1
                className={`break-words font-display text-[1.75rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl ${
                  light ? 'text-slate-900' : 'text-white'
                }`}
              >
                {headline}
              </h1>
              <p className={`max-w-lg text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-white/80'}`}>
                {tagline}
              </p>
              <LandingCtas
                primary={accent}
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
              <LandingHeroSocials institution={institution} primary={primary} tone={tone} preview={preview} />
            </div>
          </section>
        }
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
