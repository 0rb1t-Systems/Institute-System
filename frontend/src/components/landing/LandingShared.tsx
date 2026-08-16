import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, LogIn, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { brandInitial, dashboardPathForRole, type LandingInstitution } from '@/components/landing/types'
import { scrollToLandingSection } from '@/components/landing/LandingSections'

/** Shared brand mark — logo or initial. */
export function BrandMark({
  institution,
  primary,
  size = 'md',
  rounded = 'full',
}: {
  institution: LandingInstitution
  primary: string
  size?: 'sm' | 'md' | 'lg'
  rounded?: 'full' | 'xl' | '2xl'
}) {
  const dim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
  const radius = rounded === '2xl' ? 'rounded-2xl' : rounded === 'xl' ? 'rounded-xl' : 'rounded-full'
  if (institution.logo_url) {
    return (
      <img
        src={institution.logo_url}
        alt=""
        className={`${dim} ${radius} shrink-0 bg-white/10 object-contain p-0.5 ring-1 ring-black/5`}
      />
    )
  }
  return (
    <div
      className={`flex ${dim} ${radius} shrink-0 items-center justify-center text-sm font-bold text-white`}
      style={{ backgroundColor: primary }}
    >
      {brandInitial(institution.name)}
    </div>
  )
}

/** Portal Login + Verify CTAs used by every template. */
export function LandingCtas({
  primary,
  verifyHref,
  sameTenant,
  userRole,
  onOpenLogin,
  preview,
  solidClassName = 'rounded-xl text-white',
  outlineClassName = 'rounded-xl',
  size = 'lg',
}: {
  primary: string
  verifyHref: string
  sameTenant: boolean
  userRole?: string | null
  onOpenLogin: () => void
  preview?: boolean
  solidClassName?: string
  outlineClassName?: string
  size?: 'sm' | 'default' | 'lg'
}) {
  const click = () => {
    if (!preview) onOpenLogin()
  }

  return (
    <div className="flex flex-wrap gap-3">
      {sameTenant ? (
        <Button asChild size={size} className={solidClassName} style={{ backgroundColor: primary }}>
          <Link to={preview ? '#' : dashboardPathForRole(userRole)}>
            Go to dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          size={size}
          className={solidClassName}
          style={{ backgroundColor: primary }}
          onClick={click}
        >
          <LogIn className="mr-2 h-4 w-4" />
          Portal Login
        </Button>
      )}
      {preview ? (
        <Button type="button" size={size} variant="outline" className={outlineClassName}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          Verify Credential
        </Button>
      ) : (
        <Button asChild size={size} variant="outline" className={outlineClassName}>
          <Link to={verifyHref}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Verify Credential
          </Link>
        </Button>
      )}
    </div>
  )
}

type FooterTone = 'dark' | 'light'

/** One footer for all templates — contact + quick links + change template. */
export function SharedLandingFooter({
  institution,
  primary,
  year,
  verifyHref,
  onOpenLogin,
  onChangeTemplate,
  preview,
  tone = 'dark',
}: {
  institution: LandingInstitution
  primary: string
  year: number
  verifyHref: string
  onOpenLogin: () => void
  onChangeTemplate?: () => void
  preview?: boolean
  tone?: FooterTone
}) {
  const dark = tone === 'dark'
  const footerNote =
    String(institution.footer_text || '').trim() ||
    'Official public portal for verification and secure institution access.'

  const wrap = dark
    ? 'border-t border-white/10 bg-[#060c1c]/95 text-slate-300'
    : 'border-t border-slate-200 bg-white text-slate-600'
  const muted = dark ? 'text-slate-500' : 'text-slate-400'
  const title = dark ? 'text-white' : 'text-slate-900'
  const linkHover = dark ? 'hover:text-white' : 'hover:text-slate-900'
  const bar = dark ? 'border-white/5 text-slate-500' : 'border-slate-100 text-slate-400'

  return (
    <footer id="contact" className={`relative z-10 scroll-mt-24 ${wrap}`}>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark institution={institution} primary={primary} size="sm" />
            <p className={`font-display text-sm font-semibold ${title}`}>{institution.name}</p>
          </div>
          <p className={`mt-3 max-w-xs text-sm leading-relaxed ${muted}`}>{footerNote}</p>
        </div>

        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>Quick links</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <button type="button" onClick={() => scrollToLandingSection('home', preview)} className={linkHover}>
                Home
              </button>
            </li>
            <li>
              <button type="button" onClick={() => scrollToLandingSection('about', preview)} className={linkHover}>
                About
              </button>
            </li>
            <li>
              <button type="button" onClick={() => !preview && onOpenLogin()} className={linkHover}>
                Portal Login
              </button>
            </li>
            <li>
              {preview ? (
                <span>Verify Credential</span>
              ) : (
                <Link to={verifyHref} className={linkHover}>
                  Verify Credential
                </Link>
              )}
            </li>
            {!preview && onChangeTemplate && (
              <li>
                <button
                  type="button"
                  onClick={onChangeTemplate}
                  className={`text-xs underline-offset-2 hover:underline ${muted} ${linkHover}`}
                >
                  Change template
                </button>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>Contact</p>
          <ul className="mt-3 space-y-2.5 text-sm">
            {institution.address && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: primary }} />
                <span>{institution.address}</span>
              </li>
            )}
            {institution.phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" style={{ color: primary }} />
                {preview ? (
                  institution.phone
                ) : (
                  <a href={`tel:${institution.phone}`} className={linkHover}>
                    {institution.phone}
                  </a>
                )}
              </li>
            )}
            {institution.email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" style={{ color: primary }} />
                {preview ? (
                  institution.email
                ) : (
                  <a href={`mailto:${institution.email}`} className={linkHover}>
                    {institution.email}
                  </a>
                )}
              </li>
            )}
            {!institution.address && !institution.phone && !institution.email && (
              <li className={muted}>Contact details coming soon.</li>
            )}
          </ul>
        </div>
      </div>

      <div className={`border-t py-4 text-center text-xs ${bar}`}>
        © {year} {institution.name}
        <span className="mx-2 opacity-30">·</span>
        Powered by{' '}
        {preview ? (
          <span>TvetFlow</span>
        ) : (
          <Link to="/" className={linkHover}>
            TvetFlow
          </Link>
        )}
        {!preview && onChangeTemplate && (
          <>
            <span className="mx-2 opacity-30">·</span>
            <button type="button" onClick={onChangeTemplate} className={`${muted} ${linkHover}`}>
              Change template
            </button>
          </>
        )}
      </div>
    </footer>
  )
}
