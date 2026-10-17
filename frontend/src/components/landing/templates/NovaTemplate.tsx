import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingTemplateMain } from '@/components/landing/LandingSitePages'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Modern dark teal — bold type left, large media right. */
export default function NovaTemplate(p: LandingTemplateProps) {
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
      className={`tenant-landing-nova relative min-h-screen overflow-x-hidden ${
        light ? 'bg-slate-50 text-slate-900' : 'bg-[#041512] text-white'
      }`}
    >
      <header
        className={`relative z-30 border-b backdrop-blur-xl ${
          light ? 'border-slate-200 bg-white/90' : 'border-white/10 bg-[#041512]/90'
        }`}
      >
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-3 sm:px-6">
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
                : 'font-display text-[13px] font-semibold leading-snug tracking-tight text-emerald-50 sm:text-[15px]'
            }
            solidClassName="rounded-xl px-4 font-semibold"
            outlineClassName={
              light
                ? 'rounded-xl border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                : 'rounded-xl border-teal-400/40 bg-white/5 text-teal-100 hover:bg-white/10'
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
          <section className="relative z-10 grid scroll-mt-24 md:min-h-[min(60vh,520px)] lg:min-h-[min(70vh,640px)] md:grid-cols-2">
            <div className="flex flex-col justify-center px-4 py-10 sm:px-10 sm:py-14 md:px-10 lg:px-14">
              <div className="mx-auto w-full max-w-xl space-y-5 sm:space-y-6">
                <h1 className="break-words font-display text-[1.75rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.75rem]">
                  {headline}
                </h1>
                <p className={`max-w-md text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-teal-200/90'}`}>
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
                  solidClassName="rounded-xl px-5 font-semibold"
                  outlineClassName={
                    light
                      ? 'rounded-xl border-slate-200 bg-white px-5 text-slate-800 hover:bg-slate-50'
                      : 'rounded-xl border-teal-400/50 bg-transparent px-5 text-teal-200 hover:bg-white/5'
                  }
                />
                <LandingHeroSocials institution={institution} primary={primary} tone={tone} preview={preview} />
              </div>
            </div>
            <div className="relative min-h-[240px] sm:min-h-[280px] md:min-h-full">
              <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: light ? 'transparent' : 'linear-gradient(90deg, #04151299, transparent)' }}
                aria-hidden
              />
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
