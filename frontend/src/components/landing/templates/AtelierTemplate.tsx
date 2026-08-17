import React from 'react'
import {
  BrandMark,
  LandingCtas,
  LandingHeaderActions,
  SharedLandingFooter,
} from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import type { LandingTemplateProps } from '@/components/landing/types'

/** Editorial warm — image left, refined typography right. */
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

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-sans text-stone-900">
      <header className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark institution={institution} primary={primary} size="sm" rounded="2xl" />
            <p className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">
              {institution.name}
            </p>
          </div>
          <LandingPageNav primary={accent} preview={preview} tone="light" className="hidden md:flex" />
          <LandingHeaderActions
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            solidClassName="rounded-full px-4 text-white"
            outlineClassName="rounded-full border-stone-300 bg-white"
          />
        </div>
      </header>

      <section
        id="home"
        className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-16"
      >
        <div className="relative order-2 lg:order-1">
          <img
            src={heroImage}
            alt=""
            className="aspect-[5/5] w-full rounded-2xl object-cover shadow-[0_24px_60px_rgba(28,25,23,0.12)] sm:aspect-[4/5]"
          />
          <div
            className="pointer-events-none absolute -bottom-3 -right-3 -z-10 hidden h-full w-full rounded-2xl sm:block"
            style={{ backgroundColor: `${accent}22` }}
            aria-hidden
          />
        </div>

        <div className="order-1 space-y-6 lg:order-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-stone-500">
            Community · {year}
          </p>
          <h1 className="max-w-lg font-display text-3xl font-semibold leading-[1.14] tracking-tight text-stone-900 sm:text-4xl lg:text-[2.6rem]">
            {headline}
          </h1>
          <p
            className="max-w-md border-l-2 pl-4 text-[15px] leading-relaxed text-stone-600"
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
            outlineClassName="rounded-full border-stone-300 bg-white px-6"
          />
        </div>
      </section>

      <LandingContentSections
        institution={institution}
        primary={primary}
        accent={accent}
        tagline={tagline}
        tone="light"
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
