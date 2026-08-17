import React from 'react'
import {
  BrandMark,
  LandingCtas,
  LandingHeaderActions,
  SharedLandingFooter,
} from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark institution={institution} primary={primary} size="sm" />
            <p className="truncate text-sm font-bold uppercase tracking-[0.08em] text-white">
              {institution.name}
            </p>
          </div>
          <LandingPageNav primary={accent} preview={preview} tone="dark" className="hidden md:flex" />
          <LandingHeaderActions
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            solidClassName="rounded-lg px-4 text-white"
            outlineClassName="rounded-lg border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          />
        </div>
      </header>

      <section
        id="home"
        className="relative z-10 mx-auto flex min-h-[min(68vh,580px)] max-w-6xl scroll-mt-24 flex-col justify-center px-4 py-16 sm:px-8 sm:py-20"
      >
        <div className="max-w-xl space-y-6">
          <p className="font-display text-xl font-semibold tracking-tight text-white/90 sm:text-2xl">
            {institution.name}
          </p>
          <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
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
