import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingTemplateMain } from '@/components/landing/LandingSitePages'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Editorial — image left, refined typography right. */
export default function AtelierTemplate(p: LandingTemplateProps) {
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
      className={`tenant-landing-atelier min-h-screen overflow-x-hidden ${
        light ? 'bg-[#FAF7F2] text-stone-900' : 'bg-[#161412] text-stone-100'
      }`}
    >
      <header className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-6">
        <div className={`w-full min-w-0 border-b pb-4 sm:pb-5 ${light ? 'border-stone-200/80' : 'border-white/10'}`}>
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
                ? 'font-display text-[15px] font-normal leading-snug tracking-tight text-stone-900 sm:text-[18px]'
                : 'font-display text-[15px] font-normal leading-snug tracking-tight text-white sm:text-[18px]'
            }
            solidClassName="rounded-lg px-4 text-white"
            outlineClassName={
              light
                ? 'rounded-lg border-stone-300 bg-white text-stone-800'
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
          <section className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 md:grid-cols-2 md:gap-10 lg:gap-14 md:py-12 lg:py-16">
            <div className="relative order-2 md:order-1">
              <img
                src={heroImage}
                alt=""
                className="aspect-[4/3] w-full rounded-lg object-cover shadow-[0_20px_50px_rgba(28,25,23,0.14)] sm:aspect-[4/5]"
              />
            </div>

            <div className="order-1 space-y-5 sm:space-y-6 md:order-2">
              <h1
                className={`max-w-lg break-words font-display text-[1.85rem] font-normal leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.75rem] ${
                  light ? 'text-stone-900' : 'text-white'
                }`}
              >
                {headline}
              </h1>
              <p className={`max-w-md text-[15px] leading-relaxed ${light ? 'text-stone-600' : 'text-stone-300'}`}>
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
                solidClassName="rounded-lg px-6 text-white"
                outlineClassName={
                  light
                    ? 'rounded-lg border-stone-300 bg-white px-6 text-stone-800'
                    : 'rounded-lg border-white/20 bg-white/5 px-6 text-white hover:bg-white/10'
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
