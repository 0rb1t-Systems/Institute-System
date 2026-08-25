import React from 'react'
import {
  LandingCtas,
  LandingHeaderBar,
  SharedLandingFooter,
} from '@/components/landing/LandingShared'
import { LandingContentSections } from '@/components/landing/LandingSections'
import type { LandingTemplateProps } from '@/components/landing/types'

/** Cinematic dark — full-bleed photo hero with left-aligned copy. */
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
  } = p

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans text-white">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, rgba(4,8,20,0.94) 0%, rgba(6,12,28,0.82) 42%, rgba(8,14,32,0.55) 100%), linear-gradient(0deg, #040814 0%, transparent 42%)',
          }}
        />
      </div>

      <header className="relative z-20 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-7 px-4 py-2.5 sm:px-8 sm:py-3">
          <LandingHeaderBar
            institution={institution}
            primary={primary}
            navPrimary={accent}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            tone="dark"
            brandNameClassName="text-[13px] font-semibold leading-snug tracking-tight text-white sm:text-[15px]"
            solidClassName="rounded-lg px-4 text-white"
            outlineClassName="rounded-lg border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          />
        </div>
      </header>

      <section
        id="home"
        className="relative z-10 mx-auto flex min-h-[min(56vh,480px)] max-w-6xl scroll-mt-24 flex-col justify-center px-4 py-12 sm:min-h-[min(68vh,580px)] sm:px-8 sm:py-20"
      >
        <div className="max-w-xl space-y-5 sm:space-y-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {institution.name}
          </p>
          <h1 className="break-words font-display text-2xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
            {headline}
          </h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-white/75">{tagline}</p>
          <LandingCtas
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            size="default"
            solidClassName="rounded-lg px-6 text-white"
            outlineClassName="rounded-lg border-white/30 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
          />
        </div>
      </section>

      <LandingContentSections
        institution={institution}
        primary={primary}
        accent={accent}
        tagline={tagline}
        tone="dark"
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
        tone="dark"
      />
    </div>
  )
}
