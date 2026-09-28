import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Menu,
  X,
  Home,
  LayoutGrid,
  Info,
  Mail,
  ShieldCheck,
  LogIn,
  GraduationCap,
  Package,
  LifeBuoy,
  ArrowRight,
} from 'lucide-react'
import ThemeToggle from '@/components/platform/ThemeToggle'
import LanguageSwitcher from '@/components/platform/LanguageSwitcher'
import PlatformSocialLinks, {
  PLATFORM_SOCIAL,
  PLATFORM_CONTACT_EMAIL,
} from '@/components/platform/PlatformSocialLinks'
import { usePlatformLang } from '@/contexts/PlatformLangContext'

export { PLATFORM_SOCIAL, PLATFORM_CONTACT_EMAIL }

const LINKS = [
  { to: '/', labelKey: 'home' as const, icon: Home, end: true },
  { to: '/features', labelKey: 'features' as const, icon: LayoutGrid },
  { to: '/plans', labelKey: 'plans' as const, icon: Package },
  { to: '/support', labelKey: 'support' as const, icon: LifeBuoy },
  { to: '/about', labelKey: 'about' as const, icon: Info },
  { to: '/contact', labelKey: 'contact' as const, icon: Mail },
]

/** Public platform chrome — Ops Desk branding (gold actions). */
const PlatformLayout = ({
  children,
  onVerify,
}: {
  children: React.ReactNode
  onVerify?: () => void
}) => {
  const location = useLocation()
  const { t } = usePlatformLang()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === '/'
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  return (
    <div className="platform-public platform-landing relative min-h-screen overflow-x-hidden">
      <motion.header
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className={`sticky top-0 z-30 border-b border-[var(--landing-line)] transition-[background,box-shadow] duration-300 ${
          scrolled
            ? 'bg-[var(--landing-limewash)]/95 shadow-[0_8px_24px_rgba(23,26,28,0.08)] backdrop-blur-sm'
            : 'bg-[var(--landing-limewash)]'
        }`}
      >
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-2 px-4 sm:px-8 lg:px-16">
          <Link to="/" className="platform-brand flex min-w-0 shrink-0 items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 items-center justify-center bg-[var(--landing-sun)] text-[var(--landing-on-sun)]"
              style={{ borderRadius: 'var(--landing-radius)' }}
            >
              <GraduationCap className="h-4 w-4" aria-hidden />
            </span>
            <span className="platform-brand-text text-lg font-bold tracking-tight text-[var(--landing-ink)] sm:text-xl">
              TvetFlow
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {LINKS.map((item) => {
              const active = isActive(item.to, item.end)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative py-2 text-sm transition-colors ${
                    active
                      ? 'font-semibold text-[var(--landing-ink)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--landing-sun)]'
                      : 'font-medium text-[var(--landing-muted)] hover:text-[var(--landing-sun)]'
                  }`}
                >
                  {item.to === '/plans' ? t('plans') : t(item.labelKey)}
                </Link>
              )
            })}
            {onVerify ? (
              <button
                type="button"
                onClick={onVerify}
                className="py-2 text-sm font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-sun)]"
              >
                {t('verifyId')}
              </button>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle className="hidden sm:inline-flex !rounded-[2px]" />
            <Link
              to="/login"
              className="landing-btn-outline hidden h-9 items-center px-4 text-sm sm:inline-flex"
            >
              {t('logIn')}
            </Link>
            <Link
              to="/create-institution"
              className="landing-btn-primary hidden h-9 items-center px-4 text-sm sm:inline-flex"
            >
              {t('getStarted')}
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center border border-[var(--landing-line)] text-[var(--landing-muted)] lg:hidden"
              style={{ borderRadius: 'var(--landing-radius)' }}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-[var(--landing-line)] bg-[var(--landing-limewash)] px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-0.5">
              {LINKS.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex items-center gap-2 px-2 py-2.5 text-sm text-[var(--landing-muted)]"
                  >
                    <Icon className="h-4 w-4" />
                    {item.to === '/plans' ? t('plansFull') : t(item.labelKey)}
                  </Link>
                )
              })}
              {onVerify ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-2 py-2.5 text-left text-sm text-[var(--landing-muted)]"
                  onClick={() => {
                    setMenuOpen(false)
                    onVerify()
                  }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t('verifyId')}
                </button>
              ) : null}
              <div className="mt-2 flex items-center gap-2 px-1 sm:hidden">
                <ThemeToggle className="!rounded-[2px]" />
              </div>
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="landing-btn-outline mt-2 inline-flex h-11 items-center justify-center text-sm"
              >
                {t('logIn')}
              </Link>
              <Link
                to="/create-institution"
                onClick={() => setMenuOpen(false)}
                className="landing-btn-primary mt-2 inline-flex h-11 items-center justify-center text-sm"
              >
                {t('getStarted')}
              </Link>
            </div>
          </div>
        ) : null}
      </motion.header>

      <main>{children}</main>

      <footer className="border-t border-[var(--landing-line)] bg-[var(--landing-limewash)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-2 lg:grid-cols-4 lg:px-16">
          <div className="lg:col-span-1">
            <p className="platform-brand flex items-center gap-2.5 text-base font-bold text-[var(--landing-ink)]">
              <span
                className="inline-flex h-8 w-8 items-center justify-center bg-[var(--landing-sun)] text-[var(--landing-on-sun)]"
                style={{ borderRadius: 'var(--landing-radius)' }}
              >
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <span className="platform-brand-text text-xl">TvetFlow</span>
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--landing-muted)]">
              Operations software for training centers — one portal per institution, one console for the platform.
            </p>
            <PlatformSocialLinks variant="footer" className="mt-5" />
            <a
              href={`mailto:${PLATFORM_CONTACT_EMAIL}`}
              className="mt-3 inline-block text-sm font-semibold text-[var(--landing-sun)] hover:underline"
            >
              {PLATFORM_CONTACT_EMAIL}
            </a>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--landing-shadow)]">
              {t('product')}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--landing-muted)]">
              <li>
                <Link to="/features" className="inline-flex items-center gap-2 hover:text-[var(--landing-sun)]">
                  <LayoutGrid className="h-3.5 w-3.5" /> {t('features')}
                </Link>
              </li>
              <li>
                <Link to="/plans" className="inline-flex items-center gap-2 hover:text-[var(--landing-sun)]">
                  <Package className="h-3.5 w-3.5" /> {t('plansFull')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="inline-flex items-center gap-2 hover:text-[var(--landing-sun)]">
                  <Info className="h-3.5 w-3.5" /> {t('about')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--landing-shadow)]">
              {t('help')}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--landing-muted)]">
              <li>
                <Link to="/support" className="inline-flex items-center gap-2 hover:text-[var(--landing-sun)]">
                  <LifeBuoy className="h-3.5 w-3.5" /> {t('support')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="inline-flex items-center gap-2 hover:text-[var(--landing-sun)]">
                  <Mail className="h-3.5 w-3.5" /> {t('contact')}
                </Link>
              </li>
              <li>
                <Link to="/login" className="inline-flex items-center gap-2 hover:text-[var(--landing-sun)]">
                  <LogIn className="h-3.5 w-3.5" /> {t('logIn')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--landing-shadow)]">
              {t('getStarted')}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--landing-muted)]">
              Open an admin account, then your institution portal.
            </p>
            <Link
              to="/create-institution"
              className="landing-btn-primary mt-4 inline-flex h-9 items-center gap-1.5 px-4 text-sm"
            >
              {t('createInstitution')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <div className="mt-5 flex gap-4 text-xs text-[var(--landing-shadow)]">
              <Link to="/privacy" className="hover:text-[var(--landing-sun)]">
                {t('privacy')}
              </Link>
              <Link to="/terms" className="hover:text-[var(--landing-sun)]">
                {t('terms')}
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--landing-line)] px-5 py-4 sm:px-8 lg:px-16">
          <p className="mx-auto max-w-6xl text-xs text-[var(--landing-shadow)]">
            © {new Date().getFullYear()} TvetFlow — Multi-tenant ops for training centers.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default PlatformLayout
