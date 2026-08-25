import React from 'react'
import {
  BrandMark,
  LandingCtas,
  LandingHeaderActions,
  SharedLandingFooter,
} from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import type { LandingTemplateProps } from '@/components/landing/types'

/** Modern dark teal — bold type left, large media right on mesh background. */
export default function NovaTemplate(p: LandingTemplateProps) {
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
    <div className="relative min-h-screen overflow-x-hidden bg-[#061816] font-sans text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -left-24 top-20 h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: `${primary}33` }}
        />
        <div
          className="absolute -right-16 top-40 h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: `${accent}22` }}
        />
      </div>

      <header className="relative z-30 border-b border-white/10 bg-[#061816]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <BrandMark institution={institution} primary={primary} size="sm" rounded="xl" />
            <p className="truncate font-display text-sm font-bold tracking-tight sm:text-base">
              {institution.name}
            </p>
          </div>
          <LandingPageNav institution={institution} primary={primary} preview={preview} tone="dark" className="hidden lg:flex" />
          <LandingHeaderActions
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            solidClassName="rounded-xl px-4 font-semibold text-[#04201c]"
            outlineClassName="rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 lg:hidden">
          <LandingPageNav institution={institution} primary={primary} preview={preview} tone="dark" className="justify-center" />
        </div>
      </header>

      <section
        id="home"
        className="relative z-10 mx-auto grid max-w-6xl scroll-mt-24 items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 lg:grid-cols-12 lg:gap-12 lg:py-16"
      >
        <div className="space-y-5 sm:space-y-6 lg:col-span-5">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: primary }}
          >
            Portal · {year}
          </p>
          <h1 className="break-words font-display text-2xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.65rem]">
            {headline}
          </h1>
          <p className="max-w-md text-[15px] leading-relaxed text-[#9bc4b8]">{tagline}</p>
          <LandingCtas
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            size="default"
            solidClassName="rounded-xl px-5 font-semibold text-[#04201c]"
            outlineClassName="rounded-xl border-white/25 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
          />
        </div>

        <div className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
            <img
              src={heroImage}
              alt=""
              className="aspect-[16/11] w-full object-cover sm:aspect-[16/10]"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${primary}22, transparent 50%)` }}
              aria-hidden
            />
          </div>
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
