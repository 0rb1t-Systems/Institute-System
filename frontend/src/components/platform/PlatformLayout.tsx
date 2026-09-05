import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Menu,
  X,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
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
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/platform/ThemeToggle'
import LanguageSwitcher from '@/components/platform/LanguageSwitcher'
import { usePlatformLang } from '@/contexts/PlatformLangContext'

export const PLATFORM_SOCIAL = [
  { name: 'Facebook', href: 'https://facebook.com', icon: Facebook },
  { name: 'Instagram', href: 'https://instagram.com', icon: Instagram },
  { name: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
  { name: 'X (Twitter)', href: 'https://x.com', icon: Twitter },
  { name: 'YouTube', href: 'https://youtube.com', icon: Youtube },
]

const LINKS = [
  { to: '/', labelKey: 'home' as const, icon: Home, end: true },
  { to: '/features', labelKey: 'features' as const, icon: LayoutGrid },
  { to: '/plans', labelKey: 'plans' as const, icon: Package },
  { to: '/support', labelKey: 'support' as const, icon: LifeBuoy },
  { to: '/about', labelKey: 'about' as const, icon: Info },
  { to: '/contact', labelKey: 'contact' as const, icon: Mail },
]

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
    <div className="platform-public relative min-h-screen overflow-x-hidden font-sans">
      <header
        className={`sticky top-0 z-30 border-b transition-[background,box-shadow,border-color] duration-300 ${
          scrolled
            ? 'border-[var(--pf-line)] bg-[var(--pf-bg)] shadow-[0_8px_28px_rgba(6,21,18,0.14)]'
            : 'border-[var(--pf-line)] bg-[var(--pf-bg)]'
        }`}
      >
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pf-accent)] text-[var(--pf-accent-fg)]">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-[var(--pf-text)] sm:text-lg">
              Tvet<span className="text-[var(--pf-accent)]">Flow</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {LINKS.map((item) => {
              const active = isActive(item.to, item.end)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative px-2.5 py-2 text-[13px] transition-colors duration-200 ${
                    active
                      ? 'font-semibold text-[var(--pf-text)] after:absolute after:inset-x-2.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-[var(--pf-accent)]'
                      : 'font-medium text-[var(--pf-muted)] hover:text-[var(--pf-text)]'
                  }`}
                >
                  <span className="whitespace-nowrap">
                    {item.to === '/plans' ? t('plans') : t(item.labelKey)}
                  </span>
                </Link>
              )
            })}
            {onVerify ? (
              <button
                type="button"
                onClick={onVerify}
                className="px-2.5 py-2 text-[13px] font-medium text-[var(--pf-muted)] transition-colors hover:text-[var(--pf-text)]"
              >
                {t('verifyId')}
              </button>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle className="hidden sm:inline-flex" />
            <Button
              asChild
              size="sm"
              variant="outline"
              className="hidden h-9 rounded-lg border-[var(--pf-line)] bg-transparent px-3 font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-hover)] sm:inline-flex"
            >
              <Link to="/login">{t('logIn')}</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden h-9 rounded-lg bg-[var(--pf-accent)] px-3.5 font-semibold text-[var(--pf-accent-fg)] hover:opacity-90 sm:inline-flex"
            >
              <Link to="/create-institution">{t('getStarted')}</Link>
            </Button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--pf-line)] text-[var(--pf-muted)] lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-[var(--pf-line)] bg-[var(--pf-bg)] px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-1">
              {LINKS.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--pf-muted)]"
                  >
                    <Icon className="h-4 w-4" />
                    {item.to === '/plans' ? t('plansFull') : t(item.labelKey)}
                  </Link>
                )
              })}
              {onVerify ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--pf-muted)]"
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
                <ThemeToggle />
              </div>
              <Button
                asChild
                variant="outline"
                className="mt-2 border-[var(--pf-line)] bg-transparent font-semibold text-[var(--pf-text)] hover:bg-[var(--pf-hover)]"
              >
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  {t('logIn')}
                </Link>
              </Button>
              <Button asChild className="bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
                <Link to="/create-institution" onClick={() => setMenuOpen(false)}>
                  {t('getStarted')}
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      <main>{children}</main>

      <footer className="border-t border-[var(--pf-line)] bg-[var(--pf-bg-2)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="flex items-center gap-2 font-display text-base font-bold text-[var(--pf-text)]">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--pf-accent)] text-[var(--pf-accent-fg)]">
                <GraduationCap className="h-4 w-4" />
              </span>
              Tvet<span className="text-[var(--pf-accent)]">Flow</span>
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--pf-muted)]">
              Operations software for training centers — one portal per institution, one console for the platform.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {PLATFORM_SOCIAL.map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.name}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] text-[var(--pf-muted)] transition-colors duration-200 hover:border-teal-500/40 hover:text-teal-600"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pf-faint)]">{t('product')}</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--pf-muted)]">
              <li>
                <Link to="/features" className="inline-flex items-center gap-2 hover:text-[var(--pf-text)]">
                  <LayoutGrid className="h-3.5 w-3.5" /> {t('features')}
                </Link>
              </li>
              <li>
                <Link to="/plans" className="inline-flex items-center gap-2 hover:text-[var(--pf-text)]">
                  <Package className="h-3.5 w-3.5" /> {t('plansFull')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="inline-flex items-center gap-2 hover:text-[var(--pf-text)]">
                  <Info className="h-3.5 w-3.5" /> {t('about')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pf-faint)]">{t('help')}</p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--pf-muted)]">
              <li>
                <Link to="/support" className="inline-flex items-center gap-2 hover:text-[var(--pf-text)]">
                  <LifeBuoy className="h-3.5 w-3.5" /> {t('support')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="inline-flex items-center gap-2 hover:text-[var(--pf-text)]">
                  <Mail className="h-3.5 w-3.5" /> {t('contact')}
                </Link>
              </li>
              <li>
                <Link to="/login" className="inline-flex items-center gap-2 hover:text-[var(--pf-text)]">
                  <LogIn className="h-3.5 w-3.5" /> {t('logIn')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--pf-faint)]">{t('getStarted')}</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--pf-muted)]">
              Open an admin account, then your institution portal.
            </p>
            <Button asChild size="sm" className="mt-4 bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
              <Link to="/create-institution">
                {t('createInstitution')}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
            <div className="mt-5 flex gap-4 text-xs text-[var(--pf-faint)]">
              <Link to="/privacy" className="hover:text-[var(--pf-text)]">
                {t('privacy')}
              </Link>
              <Link to="/terms" className="hover:text-[var(--pf-text)]">
                {t('terms')}
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--pf-line)] px-5 py-4 sm:px-8">
          <p className="mx-auto max-w-7xl text-xs text-[var(--pf-faint)]">
            © {new Date().getFullYear()} TvetFlow
          </p>
        </div>
      </footer>
    </div>
  )
}

export default PlatformLayout
