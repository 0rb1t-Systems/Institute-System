import React from 'react'
import {
  LandingCtas,
  LandingHeaderBar,
  SharedLandingFooter,
} from '@/components/landing/LandingShared'
import { LandingContentSections } from '@/components/landing/LandingSections'
import type { LandingTemplateProps } from '@/components/landing/types'

/** Architectural split — copy left, full-bleed campus photo right. */
export default function CampusTemplate(p: LandingTemplateProps) {
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
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-7 px-4 py-2.5 sm:px-6 sm:py-3">
          <LandingHeaderBar
            institution={institution}
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            solidClassName="rounded-lg px-4 text-white"
            outlineClassName="rounded-lg border-slate-200 bg-white"
          />
        </div>
      </header>

      <section id="home" className="relative grid scroll-mt-24 lg:min-h-[min(72vh,640px)] lg:grid-cols-2">
        <div className="flex flex-col justify-center px-4 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
          <div className="mx-auto w-full max-w-xl space-y-5 sm:space-y-6">
            <div className="h-1 w-12 rounded-full" style={{ backgroundColor: accent }} />
            <h1 className="break-words font-display text-2xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
              {headline}
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-slate-600">{tagline}</p>
            <LandingCtas
              primary={primary}
              verifyHref={verifyHref}
              sameTenant={sameTenant}
              userRole={userRole}
              onOpenLogin={onOpenLogin}
              preview={preview}
              size="default"
              solidClassName="rounded-lg px-5 text-white"
              outlineClassName="rounded-lg border-slate-200 bg-white px-5"
            />
          </div>
        </div>

        <div className="relative min-h-[220px] sm:min-h-[320px] lg:min-h-full">
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r from-white to-transparent lg:block"
            aria-hidden
          />
        </div>
      </section>

      <LandingContentSections
        institution={institution}
        primary={primary}
        accent={accent}
        tagline={tagline}
        tone="light"
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
        tone="light"
      />
    </div>
  )
}
