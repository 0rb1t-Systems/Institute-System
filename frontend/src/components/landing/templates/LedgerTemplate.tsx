import React from 'react'
import {
  BrandMark,
  LandingCtas,
  LandingHeaderActions,
  SharedLandingFooter,
} from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import type { LandingTemplateProps } from '@/components/landing/types'

/** Sharp corporate light — accent bar, structured two-column. */
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }}
      />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark institution={institution} primary={primary} size="sm" rounded="xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                {institution.name}
              </p>
              <p className="hidden text-[11px] text-slate-500 sm:block">Official institution portal</p>
            </div>
          </div>
          <LandingPageNav primary={accent} preview={preview} tone="light" className="hidden md:flex" />
          <LandingHeaderActions
            primary={primary}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            solidClassName="rounded-md px-4 text-white"
            outlineClassName="rounded-md border-slate-300 bg-white"
          />
        </div>
      </header>

      <section id="home" className="scroll-mt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-16">
          <div className="space-y-6">
            <div className="border-l-4 pl-5" style={{ borderColor: accent }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Training · {year}
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-4xl">
                {headline}
              </h1>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-slate-600">{tagline}</p>
            <LandingCtas
              primary={primary}
              verifyHref={verifyHref}
              sameTenant={sameTenant}
              userRole={userRole}
              onOpenLogin={onOpenLogin}
              preview={preview}
              size="default"
              solidClassName="rounded-md px-5 text-white"
              outlineClassName="rounded-md border-slate-300 bg-white px-5"
            />
          </div>

          <div className="overflow-hidden rounded-lg shadow-xl ring-1 ring-slate-200">
            <img src={heroImage} alt="" className="aspect-[16/10] w-full object-cover" />
          </div>
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
