import React from 'react'
import {
  BrandMark,
  LandingCtas,
  LandingHeaderActions,
  SharedLandingFooter,
} from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import type { LandingTemplateProps } from '@/components/landing/types'

/** Airy centered light — brand first, wide campus band below. */
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
  } = p

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F4FAF8] font-sans text-slate-900">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${primary}16, transparent 68%)` }}
        aria-hidden
      />

      <header className="relative z-20 mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            <BrandMark institution={institution} primary={primary} size="sm" rounded="xl" />
            <p className="truncate font-display text-sm font-bold tracking-tight sm:text-lg">
              {institution.name}
            </p>
          </div>
          <LandingHeaderActions
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            solidClassName="rounded-xl px-4 text-white"
            outlineClassName="rounded-xl border-slate-200 bg-white"
          />
        </div>
        <div className="mt-4 flex justify-center sm:mt-5">
          <LandingPageNav institution={institution} primary={primary} preview={preview} tone="light" className="justify-center" />
        </div>
      </header>

      <section
        id="home"
        className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-4 py-8 text-center sm:px-6 sm:py-14"
      >
        <p
          className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: accent }}
        >
          Welcome · {year}
        </p>
        <h1 className="mx-auto max-w-2xl break-words font-display text-2xl font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
          {headline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600">
          {tagline}
        </p>
        <div className="mx-auto mt-7 w-full max-w-sm sm:mt-8 sm:max-w-md">
          <LandingCtas
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            size="default"
            align="center"
            solidClassName="rounded-xl px-6 text-white"
            outlineClassName="rounded-xl border-slate-200 bg-white px-6"
          />
        </div>
        <div className="mx-auto mt-8 overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.12)] ring-1 ring-black/5 sm:mt-10">
          <img src={heroImage} alt="" className="aspect-[16/10] w-full object-cover sm:aspect-[21/9]" />
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
