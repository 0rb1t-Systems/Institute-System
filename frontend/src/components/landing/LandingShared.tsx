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

/** Compact header actions — Portal Login + Verify on every template. */
export function LandingHeaderActions({
  primary,
  verifyHref,
  sameTenant,
  userRole,
  onOpenLogin,
  preview,
  solidClassName = 'rounded-lg text-white',
  outlineClassName = 'rounded-lg',
}: {
  primary: string
  verifyHref: string
  sameTenant: boolean
  userRole?: string | null
  onOpenLogin: () => void
  preview?: boolean
  solidClassName?: string
  outlineClassName?: string
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      {sameTenant ? (
        <Button asChild size="sm" className={`${solidClassName} max-sm:px-2.5`} style={{ backgroundColor: primary }}>
          <Link to={preview ? '#' : dashboardPathForRole(userRole)}>Dashboard</Link>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          className={`${solidClassName} max-sm:px-2.5`}
          style={{ backgroundColor: primary }}
          onClick={() => !preview && onOpenLogin()}
        >
          <LogIn className="mr-1 h-3.5 w-3.5 sm:mr-1.5" />
          <span className="sm:hidden">Login</span>
          <span className="hidden sm:inline">Portal Login</span>
        </Button>
      )}
      {preview ? (
        <Button type="button" size="sm" variant="outline" className={`${outlineClassName} max-sm:px-2.5`}>
          <ShieldCheck className="mr-1 h-3.5 w-3.5 sm:mr-1.5" />
          Verify
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className={`${outlineClassName} max-sm:px-2.5`}>
          <Link to={verifyHref}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5 sm:mr-1.5" />
            Verify
          </Link>
        </Button>
      )}
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
  align = 'start',
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
  align?: 'start' | 'center'
}) {
  const click = () => {
    if (!preview) onOpenLogin()
  }
  const justify = align === 'center' ? 'justify-center' : 'justify-start'

  return (
    <div className={`flex w-full max-w-full flex-col gap-3 sm:flex-row sm:flex-wrap ${justify}`}>
      {sameTenant ? (
        <Button
          asChild
          size={size}
          className={`${solidClassName} w-full sm:w-auto`}
          style={{ backgroundColor: primary }}
        >
          <Link to={preview ? '#' : dashboardPathForRole(userRole)}>
            Go to dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <Button
          type="button"
          size={size}
          className={`${solidClassName} w-full sm:w-auto`}
          style={{ backgroundColor: primary }}
          onClick={click}
        >
          <LogIn className="mr-2 h-4 w-4" />
          Portal Login
        </Button>
      )}
      {preview ? (
        <Button
          type="button"
          size={size}
          variant="outline"
          className={`${outlineClassName} w-full sm:w-auto`}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          <span className="sm:hidden">Verify</span>
          <span className="hidden sm:inline">Verify Credential</span>
        </Button>
      ) : (
        <Button asChild size={size} variant="outline" className={`${outlineClassName} w-full sm:w-auto`}>
          <Link to={verifyHref}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            <span className="sm:hidden">Verify</span>
            <span className="hidden sm:inline">Verify Credential</span>
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
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] md:px-8">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark institution={institution} primary={primary} size="sm" />
            <p className={`truncate font-display text-sm font-semibold ${title}`}>{institution.name}</p>
          </div>
          <p className={`mt-3 max-w-xs break-words text-sm leading-relaxed ${muted}`}>{footerNote}</p>
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

        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>Contact</p>
          <ul className="mt-3 space-y-2.5 text-sm">
            {institution.address && (
              <li className="flex min-w-0 gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: primary }} />
                <span className="min-w-0 break-words">{institution.address}</span>
              </li>
            )}
            {institution.phone && (
              <li className="flex min-w-0 items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" style={{ color: primary }} />
                {preview ? (
                  <span className="break-all">{institution.phone}</span>
                ) : (
                  <a href={`tel:${institution.phone}`} className={`min-w-0 break-all ${linkHover}`}>
                    {institution.phone}
                  </a>
                )}
              </li>
            )}
            {institution.email && (
              <li className="flex min-w-0 items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" style={{ color: primary }} />
                {preview ? (
                  <span className="break-all">{institution.email}</span>
                ) : (
                  <a href={`mailto:${institution.email}`} className={`min-w-0 break-all ${linkHover}`}>
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

      <div className={`border-t px-4 py-4 text-center text-xs break-words ${bar}`}>
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
