import React from 'react'
import { LandingCtas, LandingHeaderBar, SharedLandingFooter } from '@/components/landing/LandingShared'
import LandingHeroSocials from '@/components/landing/LandingHeroSocials'
import { LandingContentSections } from '@/components/landing/LandingSections'
import { landingIsLight, type LandingTemplateProps } from '@/components/landing/types'

/** Formal dark — navy ceremony with gold accents, centered composition. */
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
  } = p
  const light = landingIsLight(p.themeMode)
  const tone = light ? 'light' : 'dark'

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden font-sans ${light ? 'text-slate-900' : 'text-slate-100'}`}
      style={{ backgroundColor: light ? '#F8FAFC' : primary || '#0B1F33' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: light
            ? `linear-gradient(165deg, color-mix(in srgb, ${primary} 16%, #ffffff) 0%, #f8fafc 55%, #ffffff 100%), url(${heroImage})`
            : `linear-gradient(165deg, ${primary || '#0B1F33'}f5 8%, ${primary || '#0B1F33'}d8 48%, ${primary || '#0B1F33'}b8 100%), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden
      />

      <header className={`relative z-20 border-b ${light ? 'border-slate-200 bg-white/90 backdrop-blur-md' : 'border-white/10'}`}>
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
                ? 'text-[13px] font-semibold leading-snug tracking-tight text-slate-900 sm:text-[15px]'
                : 'text-[13px] font-semibold leading-snug tracking-tight text-white sm:text-[15px]'
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

      <section
        id="home"
        className="relative z-10 mx-auto flex min-h-[min(56vh,480px)] max-w-3xl scroll-mt-24 flex-col items-center justify-center px-4 py-12 text-center sm:min-h-[min(62vh,520px)] sm:py-20"
      >
        <div
          className="mb-6 h-px w-28"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: accent }}
        >
          Academic Excellence
        </p>
        <h1 className={`break-words px-1 font-display text-2xl font-bold leading-tight sm:text-4xl lg:text-5xl ${light ? 'text-slate-900' : 'text-white'}`}>
          {headline}
        </h1>
        <p className={`mt-5 max-w-xl text-[15px] leading-relaxed ${light ? 'text-slate-600' : 'text-white/70'}`}>{tagline}</p>
        <div className="mt-8 w-full max-w-sm sm:mt-9 sm:max-w-md">
          <LandingCtas
            primary={accent}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            size="default"
            align="center"
            solidClassName="rounded-sm px-5 font-semibold sm:px-7"
            outlineClassName={
              light
                ? 'rounded-sm border-slate-200 bg-white px-5 text-slate-800 hover:bg-slate-50 sm:px-7'
                : 'rounded-sm border-white/35 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white sm:px-7'
            }
          />
          <div className="mt-6">
            <LandingHeroSocials
              institution={institution}
              primary={accent}
              tone={tone}
              align="center"
              preview={preview}
            />
          </div>
        </div>
        <div
          className="mt-10 h-px w-28"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      </section>

      <div className="relative z-10">
        <LandingContentSections
          institution={institution}
          primary={accent}
          accent={accent}
          tagline={tagline}
          tone={tone}
          preview={preview}
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
