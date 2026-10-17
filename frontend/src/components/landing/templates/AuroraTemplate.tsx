import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingTemplateMain } from '@/components/landing/LandingSitePages'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Soft glass — floating nav, rounded portrait hero. */
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
    page = 'home',
  } = p
  const light = landingIsLight(p.themeMode)
  const tone = light ? 'light' : 'dark'

  return (
    <div
      className={`tenant-landing-aurora relative min-h-screen overflow-x-hidden ${
        light ? 'bg-[#F4F7FB] text-slate-900' : 'bg-[#0b1220] text-white'
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 55% 45% at 100% 0%, ${primary}14, transparent 55%), radial-gradient(ellipse 40% 30% at 0% 20%, ${accent}10, transparent 50%)`,
        }}
        aria-hidden
      />

      <div className="relative z-30 mx-auto max-w-6xl px-3 pt-4 sm:px-6 sm:pt-5">
        <header
          className={`w-full min-w-0 rounded-2xl border px-3 py-2.5 backdrop-blur-xl sm:px-5 sm:py-3 ${
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
            solidClassName="rounded-xl px-4"
            outlineClassName={
              light
                ? 'rounded-xl border-slate-200 bg-white text-slate-800'
                : 'rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10'
            }
          />
        </header>
      </div>

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
          <section className="relative z-10 mx-auto grid max-w-6xl scroll-mt-24 items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 md:grid-cols-2 md:gap-10 lg:gap-14 md:py-12 lg:py-16">
            <div className="space-y-5 sm:space-y-6">
              <h1
                className={`max-w-lg break-words font-display text-[1.75rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.65rem] ${
                  light ? 'text-slate-800' : 'text-white'
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
                solidClassName="rounded-xl px-6 shadow-md shadow-slate-900/10"
                outlineClassName={
                  light
                    ? 'rounded-xl border-slate-200 bg-white px-6 text-slate-800'
                    : 'rounded-xl border-white/20 bg-white/5 px-6 text-white'
                }
              />
              <LandingHeroSocials institution={institution} primary={primary} tone={tone} preview={preview} />
            </div>

            <div className="relative mx-auto w-full max-w-md md:max-w-none">
              <div
                className="pointer-events-none absolute left-6 top-8 hidden h-[88%] w-[88%] rounded-[1.75rem] sm:block"
                style={{
                  background: `linear-gradient(160deg, ${primary}22, ${accent}33)`,
                }}
                aria-hidden
              />
              <div className="relative overflow-hidden rounded-[1.75rem] shadow-[0_18px_40px_rgba(26,86,219,0.2)]">
                <img
                  src={heroImage}
                  alt=""
                  className="aspect-[4/3] max-h-[55vh] w-full object-cover sm:aspect-[4/5] sm:max-h-none"
                />
              </div>
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
