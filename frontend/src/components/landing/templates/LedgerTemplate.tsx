import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingTemplateMain } from '@/components/landing/LandingSitePages'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Sharp corporate — structured two-column. */
export default function LedgerTemplate(p: LandingTemplateProps) {
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
      className={`tenant-landing-ledger min-h-screen overflow-x-hidden ${
        light ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#0b1220] text-white'
      }`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

      <header className={`border-b ${light ? 'border-slate-200 bg-white' : 'border-white/10 bg-[#0b1220]'}`}>
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-2.5 sm:px-6 sm:py-3">
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
            solidClassName="rounded-md px-4 text-white"
            outlineClassName={
              light
                ? 'rounded-md border-slate-300 bg-white text-slate-800'
                : 'rounded-md border-white/20 bg-white/5 text-white hover:bg-white/10'
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
          <section className={`scroll-mt-24 ${light ? 'bg-slate-50' : 'bg-[#0f172a]'}`}>
            <div className="mx-auto grid max-w-6xl md:min-h-[min(56vh,500px)] lg:min-h-[min(62vh,600px)] md:grid-cols-2">
              <div className="flex flex-col justify-center px-4 py-10 sm:px-8 sm:py-14 md:px-8 lg:px-12">
                <div className="max-w-xl space-y-5 sm:space-y-6">
                  <div className="h-1 w-10" style={{ backgroundColor: accent }} aria-hidden />
                  <h1
                    className={`break-words font-display text-[1.75rem] font-bold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.75rem] ${
                      light ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {headline}
                  </h1>
                  <p className={`max-w-md text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-slate-300'}`}>
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
                    solidClassName="rounded-md px-5 text-white"
                    outlineClassName={
                      light
                        ? 'rounded-md border-slate-300 bg-white px-5 text-slate-800'
                        : 'rounded-md border-white/20 bg-white/5 px-5 text-white hover:bg-white/10'
                    }
                  />
                  <LandingHeroSocials institution={institution} primary={primary} tone={tone} preview={preview} />
                </div>
              </div>
              <div className="relative min-h-[220px] sm:min-h-[260px] md:min-h-full">
                <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
