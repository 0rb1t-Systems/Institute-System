import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingTemplateMain } from '@/components/landing/LandingSitePages'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Formal navy ceremony with gold accents — split hero. */
export default function CrestTemplate(p: LandingTemplateProps) {
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
  const navy = primary || '#0B1F33'

  return (
    <div
      className={`tenant-landing-crest min-h-screen overflow-x-hidden font-sans ${
        light ? 'bg-slate-50 text-slate-900' : 'text-slate-100'
      }`}
      style={!light ? { backgroundColor: navy } : undefined}
    >
      <header
        className={`relative z-20 border-b ${
          light ? 'border-slate-200 bg-white/95 backdrop-blur-md' : 'border-white/10'
        }`}
        style={!light ? { borderColor: `${accent}55`, backgroundColor: navy } : undefined}
      >
        <div className="mx-auto w-full min-w-0 max-w-6xl px-3 py-2.5 sm:px-6 sm:py-3.5">
          <LandingHeaderBar
            institution={institution}
            primary={accent}
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
            solidClassName="rounded-sm px-4 font-semibold"
            outlineClassName={
              light
                ? 'rounded-sm border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                : 'rounded-sm border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white'
            }
          />
        </div>
      </header>

      <div className="relative z-10">
        <LandingTemplateMain
          page={page}
          institution={institution}
          primary={accent}
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
            <section className="relative grid scroll-mt-24 md:min-h-[min(58vh,520px)] lg:min-h-[min(68vh,620px)] md:grid-cols-2">
              <div
                className="flex flex-col justify-center px-4 py-10 sm:px-10 sm:py-14 md:px-10 lg:px-14"
                style={!light ? { backgroundColor: navy } : { backgroundColor: '#fff' }}
              >
                <div className="mx-auto w-full max-w-xl space-y-5 sm:space-y-6">
                  <div className="h-0.5 w-12" style={{ backgroundColor: accent }} aria-hidden />
                  <h1
                    className={`break-words font-display text-[1.75rem] font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.65rem] ${
                      light ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {headline}
                  </h1>
                  <p className={`max-w-md text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-white/70'}`}>
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
                    solidClassName="rounded-sm px-5 font-semibold"
                    outlineClassName={
                      light
                        ? 'rounded-sm border-slate-200 bg-white px-5 text-slate-800 hover:bg-slate-50'
                        : 'rounded-sm border-white/35 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white'
                    }
                  />
                  <LandingHeroSocials
                    institution={institution}
                    primary={accent}
                    tone={tone}
                    preview={preview}
                  />
                </div>
              </div>
              <div className="relative min-h-[240px] sm:min-h-[280px] md:min-h-full">
                <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            </section>
          }
        />
        <SharedLandingFooter
          institution={institution}
          primary={accent}
          year={year}
          verifyHref={verifyHref}
          onOpenLogin={onOpenLogin}
          onChangeTemplate={onChangeTemplate}
          preview={preview}
          tone={tone}
        />
      </div>
    </div>
  )
}
