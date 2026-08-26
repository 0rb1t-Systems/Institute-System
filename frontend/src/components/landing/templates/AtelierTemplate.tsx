import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingContentSections } from '@/components/landing/LandingSections'
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
  } = p
  const light = landingIsLight(p.themeMode)
  const tone = light ? 'light' : 'dark'

  return (
    <div
      className={`min-h-screen overflow-x-hidden font-sans ${
        light ? 'bg-[#F7F6F4] text-stone-900' : 'bg-[#161412] text-stone-100'
      }`}
    >
      <header className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-6">
        <div
          className={`w-full min-w-0 border-b pb-4 sm:pb-5 ${
            light ? 'border-stone-200/80' : 'border-white/10'
          }`}
        >
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
                ? 'font-display text-[13px] font-semibold leading-snug tracking-tight text-stone-900 sm:text-[15px]'
                : 'font-display text-[13px] font-semibold leading-snug tracking-tight text-white sm:text-[15px]'
            }
            solidClassName="rounded-full px-4 text-white"
            outlineClassName={
              light
                ? 'rounded-full border-stone-300 bg-white text-stone-800'
                : 'rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10'
            }
          />
        </div>
      </header>

      <section
        id="home"
        className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-16 lg:py-16"
      >
        <div className="relative order-2 lg:order-1">
          <img
            src={heroImage}
            alt=""
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-[0_24px_60px_rgba(28,25,23,0.12)] sm:aspect-[4/5]"
          />
          <div
            className="pointer-events-none absolute -bottom-3 -right-3 -z-10 hidden h-full w-full rounded-2xl sm:block"
            style={{ backgroundColor: `${accent}22` }}
            aria-hidden
          />
        </div>

        <div className="order-1 space-y-5 sm:space-y-6 lg:order-2">
          <p className={`text-[11px] font-medium uppercase tracking-[0.24em] ${light ? 'text-stone-500' : 'text-stone-400'}`}>
            Community · {year}
          </p>
          <h1
            className={`max-w-lg break-words font-display text-2xl font-semibold leading-[1.14] tracking-tight sm:text-4xl lg:text-[2.6rem] ${
              light ? 'text-stone-900' : 'text-white'
            }`}
          >
            {headline}
          </h1>
          <p
            className={`max-w-md border-l-2 pl-3 text-[15px] leading-relaxed sm:pl-4 ${
              light ? 'text-stone-600' : 'text-stone-300'
            }`}
            style={{ borderColor: accent }}
          >
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
            solidClassName="rounded-full px-6 text-white"
            outlineClassName={
              light
                ? 'rounded-full border-stone-300 bg-white px-6 text-stone-800'
                : 'rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10'
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
