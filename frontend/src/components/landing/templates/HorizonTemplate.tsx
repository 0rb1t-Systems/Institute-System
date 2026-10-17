import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingTemplateMain } from '@/components/landing/LandingSitePages'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Centered brand with wide campus band. */
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
    page = 'home',
  } = p
  const light = landingIsLight(p.themeMode)
  const tone = light ? 'light' : 'dark'

  return (
    <div
      className={`tenant-landing-horizon relative min-h-screen overflow-x-hidden ${
        light ? 'bg-[#FAFBFA] text-slate-900' : 'bg-[#061816] text-white'
      }`}
    >
      <header
        className={`relative z-20 border-b ${
          light ? 'border-transparent bg-[#FAFBFA]' : 'border-white/10 bg-[#061816]'
        }`}
      >
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-3 sm:px-6 sm:py-4">
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
          <section className="relative z-10 scroll-mt-24">
            <div className="mx-auto max-w-5xl px-4 py-8 text-center sm:px-6 sm:py-12">
              <h1
                className={`mx-auto max-w-2xl break-words font-display text-[1.75rem] font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[3.25rem] ${
                  light ? 'text-teal-950' : 'text-white'
                }`}
              >
                {headline}
              </h1>
              <p
                className={`mx-auto mt-4 max-w-xl text-[15px] leading-relaxed ${
                  light ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {tagline}
              </p>
              <div className="mx-auto mt-7 w-full max-w-sm sm:mt-8 sm:max-w-md">
                <LandingCtas
                  primary={accent}
                  verifyHref={verifyHref}
                  sameTenant={sameTenant}
                  userRole={userRole}
                  onOpenLogin={onOpenLogin}
                  preview={preview}
                  size="default"
                  align="center"
                  solidClassName="rounded-lg px-6 text-white"
                  outlineClassName={
                    light
                      ? 'rounded-lg border-teal-200 bg-white px-6 text-teal-900'
                      : 'rounded-lg border-white/20 bg-white/5 px-6 text-white hover:bg-white/10'
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
            </div>
            <div className="relative mt-2 h-[200px] w-full overflow-hidden sm:h-[280px] lg:h-[320px]">
              <img src={heroImage} alt="" className="h-full w-full object-cover" />
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
