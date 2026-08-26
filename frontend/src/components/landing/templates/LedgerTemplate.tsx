import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingContentSections } from '@/components/landing/LandingSections'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Sharp corporate — accent bar, structured two-column. */
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
  } = p
  const light = landingIsLight(p.themeMode)
  const tone = light ? 'light' : 'dark'

  return (
    <div
      className={`min-h-screen overflow-x-hidden font-sans ${
        light ? 'bg-[#F8FAFC] text-slate-900' : 'bg-[#0b1220] text-white'
      }`}
    >
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }}
      />

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
            brandTagline="Official institution portal"
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

      <section id="home" className="scroll-mt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-14 lg:py-16">
          <div className="space-y-5 sm:space-y-6">
            <div className="border-l-4 pl-3 sm:pl-5" style={{ borderColor: accent }}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${light ? 'text-slate-500' : 'text-slate-400'}`}>
                Training · {year}
              </p>
              <h1
                className={`mt-2 break-words font-display text-2xl font-bold leading-[1.12] tracking-tight sm:text-4xl ${
                  light ? 'text-slate-900' : 'text-white'
                }`}
              >
                {headline}
              </h1>
            </div>
            <p className={`max-w-md text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-slate-300'}`}>{tagline}</p>
            <LandingCtas
              primary={primary}
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
            <LandingHeroSocials
              institution={institution}
              primary={primary}
              tone={tone}
              preview={preview}
            />
          </div>

          <div className={`overflow-hidden rounded-lg shadow-xl ring-1 ${light ? 'ring-slate-200' : 'ring-white/10'}`}>
            <img src={heroImage} alt="" className="aspect-[16/10] w-full object-cover" />
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
