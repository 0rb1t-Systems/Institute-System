import React from 'react'
import {
  BrandMark,
  LandingCtas,
  LandingHeaderActions,
  SharedLandingFooter,
} from '@/components/landing/LandingShared'
import { LandingContentSections, LandingPageNav } from '@/components/landing/LandingSections'
import type { LandingTemplateProps } from '@/components/landing/types'

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

  return (
    <div
      className="relative min-h-screen overflow-hidden font-sans text-slate-100"
      style={{ backgroundColor: primary || '#0B1F33' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(165deg, ${primary || '#0B1F33'}f5 8%, ${primary || '#0B1F33'}d8 48%, ${primary || '#0B1F33'}b8 100%), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden
      />

      <header className="relative z-20 border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark institution={institution} primary={accent} size="sm" />
            <p className="truncate text-sm font-bold uppercase tracking-[0.14em] text-white">
              {institution.name}
            </p>
          </div>
          <LandingPageNav primary={accent} preview={preview} tone="dark" className="hidden md:flex" />
          <LandingHeaderActions
            primary={accent}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            solidClassName="rounded-sm px-4 font-semibold text-slate-900"
            outlineClassName="rounded-sm border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          />
        </div>
      </header>

      <section
        id="home"
        className="relative z-10 mx-auto flex min-h-[min(62vh,520px)] max-w-3xl scroll-mt-24 flex-col items-center justify-center px-4 py-16 text-center sm:py-20"
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
        <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
          {headline}
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/70">{tagline}</p>
        <div className="mt-9">
          <LandingCtas
            primary={accent}
            verifyHref={verifyHref}
            sameTenant={sameTenant}
            userRole={userRole}
            onOpenLogin={onOpenLogin}
            preview={preview}
            size="default"
            solidClassName="rounded-sm px-7 font-semibold text-slate-900"
            outlineClassName="rounded-sm border-white/35 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
          />
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
          tone="dark"
        />
        <SharedLandingFooter
          institution={institution}
          primary={accent}
          year={year}
          verifyHref={verifyHref}
          onOpenLogin={onOpenLogin}
          onChangeTemplate={onChangeTemplate}
          preview={preview}
          tone="dark"
        />
      </div>
    </div>
  )
}
