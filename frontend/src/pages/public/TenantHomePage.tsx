import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  Loader2,
  LogIn,
  LayoutDashboard,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  X,
  Award,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getPublicInstitutionBySubdomain } from '@/lib/api';
import {
  resolvePublicTenantSubdomain,
  getInstitutionPrimary,
  getInstitutionAccent,
} from '@/lib/institution';
import { useAuth } from '@/contexts/AuthContext';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';

const HERO_BG =
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1920&q=80';

function dashboardPathForRole(role) {
  if (role === 'super_admin') return '/super-admin';
  if (role === 'student') return '/student/dashboard';
  if (role === 'instructor') return '/instructor/dashboard';
  if (role === 'affiliate') return '/affiliate';
  return '/dashboard';
}

function brandInitial(name) {
  const n = String(name || '').trim();
  return n ? n.charAt(0).toUpperCase() : 'I';
}

/**
 * Public tenant landing — photo hero, showcase card, login modal on Sign In.
 */
const TenantHomePage = ({ subdomain: subdomainProp }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const subdomain =
    subdomainProp ||
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain();

  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(!!subdomain);
  const [error, setError] = useState(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!subdomain) {
        setLoading(false);
        setError('missing');
        return;
      }
      setLoading(true);
      try {
        const inst = await getPublicInstitutionBySubdomain(subdomain);
        if (cancelled) return;
        if (!inst) {
          setError('not_found');
          setInstitution(null);
        } else {
          setInstitution(inst);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('load_failed');
          setInstitution(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subdomain]);

  useEffect(() => {
    if (!loginOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLoginOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [loginOpen]);

  const primary = getInstitutionPrimary(institution);
  const accent = getInstitutionAccent(institution);
  const q = encodeURIComponent(subdomain || '');
  const verifyHref = `/verify-credential?tenant=${q}`;
  const sameTenant =
    user &&
    institution &&
    user.institution_id &&
    String(user.institution_id) === String(institution.id);

  const openLogin = () => {
    setLoginError('');
    setLoginOpen(true);
  };

  const closeLogin = () => {
    if (signingIn) return;
    setLoginOpen(false);
    setLoginError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const id = identifier.trim();
    const pw = password.trim();
    if (!id || !pw) {
      setLoginError(MESSAGES.AUTH.MISSING_CREDENTIALS);
      return;
    }
    if (!institution?.id) {
      setLoginError('Institution not ready. Refresh the page or open a valid institution link (?tenant=slug).');
      return;
    }
    setSigningIn(true);
    try {
      const { user: signedIn, error: loginErr } = await login(id, pw, {
        requiredInstitutionId: String(institution.id),
      });
      if (loginErr || !signedIn) {
        throw loginErr || new Error('AUTH.INVALID_CREDENTIALS');
      }
      setIdentifier('');
      setPassword('');
      setLoginOpen(false);
      navigate(dashboardPathForRole(signedIn.role), { replace: true });
    } catch (err) {
      setLoginError(
        getUserMessage(err, { context: 'TenantHomeLogin', fallback: MESSAGES.AUTH.INVALID_CREDENTIALS }),
      );
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a1628] text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primary }} />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a1628] p-6 text-slate-100">
        <Helmet>
          <title>Institution not found</title>
        </Helmet>
        <p className="mb-4 text-slate-400">
          {error === 'missing'
            ? 'Open this page with a valid institution link (?tenant=subdomain).'
            : 'Institution not found or inactive.'}
        </p>
        <Button asChild variant="outline" className="border-slate-700">
          <Link to="/">Back to TvetFlow</Link>
        </Button>
      </div>
    );
  }

  const year = new Date().getFullYear();
  const bodyCopy =
    institution.description ||
    'A trusted place for training, credentials, and academic excellence.';
  const shortTagline = bodyCopy.length > 160 ? `${bodyCopy.slice(0, 157)}…` : bodyCopy;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden font-sans text-slate-100">
      <Helmet>
        <title>{institution.name}</title>
      </Helmet>

      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(105deg, rgba(6,12,28,0.94) 0%, rgba(8,18,40,0.88) 42%, rgba(10,22,48,0.72) 100%),
              linear-gradient(180deg, ${primary}55 0%, transparent 45%),
              linear-gradient(0deg, #060c1c 0%, transparent 35%)
            `,
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 70% 40%, ${primary}44, transparent 70%)`,
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-white/10 bg-[#071225]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {institution.logo_url ? (
              <img
                src={institution.logo_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full bg-white/10 object-contain p-0.5 ring-1 ring-white/15"
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ring-1 ring-white/15"
                style={{ backgroundColor: primary }}
              >
                <GraduationCap className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold tracking-[0.08em] uppercase text-white sm:text-base">
                {institution.name}
              </p>
              <p className="hidden text-[11px] text-slate-400 sm:block">Official institution portal</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={sameTenant ? undefined : openLogin}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
            >
              Portal Login
            </button>
            <Link
              to={verifyHref}
              className="rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5 hover:text-white"
            >
              Verify Credential
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {sameTenant ? (
              <Button asChild size="sm" className="rounded-lg text-white hover:opacity-90" style={{ backgroundColor: primary }}>
                <Link to={dashboardPathForRole(user.role)}>
                  Dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openLogin}
                  className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/5 sm:inline"
                >
                  Sign In
                </button>
                <Button
                  asChild
                  size="sm"
                  className="rounded-lg text-white shadow-lg hover:opacity-90"
                  style={{ backgroundColor: primary, boxShadow: `0 8px 24px ${primary}44` }}
                >
                  <Link to={verifyHref}>Check Credential</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        <section className="mx-auto grid min-h-[calc(100vh-4.25rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: `${primary}55`,
                backgroundColor: `${primary}22`,
                color: '#c8d9ff',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent || primary }} />
              Enrollment Open for {year}
            </div>

            <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-[3.35rem]">
              Empowering Future{' '}
              <span style={{ color: '#9eb8f0' }}>Researchers & Leaders</span>
            </h1>

            <p className="max-w-lg text-base leading-relaxed text-slate-200/90 sm:text-lg">
              {shortTagline}
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              {sameTenant ? (
                <Button asChild size="lg" className="rounded-lg text-white hover:opacity-90" style={{ backgroundColor: primary }}>
                  <Link to={dashboardPathForRole(user.role)}>
                    Go to dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="rounded-lg text-white hover:opacity-90"
                  style={{ backgroundColor: primary }}
                  onClick={openLogin}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Portal Login
                </Button>
              )}
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-lg border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                <Link to={verifyHref}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify Credential
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Showcase card (replaces inline login) */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="absolute -inset-1 rounded-3xl opacity-70 blur-xl"
              style={{ background: `linear-gradient(135deg, ${primary}66, transparent 70%)` }}
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0c1a32]/85 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
              <div className="mb-6 flex items-center gap-3">
                {institution.logo_url ? (
                  <img
                    src={institution.logo_url}
                    alt=""
                    className="h-12 w-12 rounded-full bg-white/10 object-contain p-1"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {brandInitial(institution.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-semibold text-white">
                    {institution.name}
                  </p>
                  <p className="text-xs text-slate-400">Academic Excellence</p>
                </div>
              </div>

              <div className="mb-6 space-y-2.5">
                <div className="h-2 w-full rounded bg-white/10" />
                <div className="h-2 w-5/6 rounded bg-white/10" />
                <div className="h-2 w-4/6 rounded bg-white/10" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <Award className="mb-2 h-4 w-4" style={{ color: accent || primary }} />
                  <p className="font-display text-2xl font-bold text-white">Trusted</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-400">Credentials</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <BookOpen className="mb-2 h-4 w-4" style={{ color: accent || primary }} />
                  <p className="font-display text-2xl font-bold text-white">Quality</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-400">Training</p>
                </div>
              </div>

              {sameTenant && (
                <Button asChild className="mt-5 w-full text-white hover:opacity-90" style={{ backgroundColor: primary }}>
                  <Link to={dashboardPathForRole(user.role)}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Open dashboard
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-[#060c1c]/95">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              {institution.logo_url ? (
                <img
                  src={institution.logo_url}
                  alt=""
                  className="h-9 w-9 rounded-full bg-white/10 object-contain p-0.5"
                />
              ) : (
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: primary }}
                >
                  <GraduationCap className="h-4 w-4" />
                </div>
              )}
              <p className="font-display text-sm font-semibold text-white">{institution.name}</p>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              Official public portal for verification and secure institution access.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quick links</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>
                <button type="button" onClick={openLogin} className="hover:text-white">
                  Portal Login
                </button>
              </li>
              <li>
                <Link to={verifyHref} className="hover:text-white">
                  Verify Credential
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-white">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white">
                  Terms
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contact</p>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-300">
              {institution.address && (
                <li className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: primary }} />
                  <span>{institution.address}</span>
                </li>
              )}
              {institution.phone && (
                <li>
                  <a href={`tel:${institution.phone}`} className="flex items-center gap-2 hover:text-white">
                    <Phone className="h-4 w-4 shrink-0" style={{ color: primary }} />
                    {institution.phone}
                  </a>
                </li>
              )}
              {institution.email && (
                <li>
                  <a href={`mailto:${institution.email}`} className="flex items-center gap-2 hover:text-white">
                    <Mail className="h-4 w-4 shrink-0" style={{ color: primary }} />
                    {institution.email}
                  </a>
                </li>
              )}
              {!institution.address && !institution.phone && !institution.email && (
                <li className="text-slate-500">Contact details coming soon.</li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
          © {year} {institution.name}
          <span className="mx-2 text-white/10">·</span>
          Powered by{' '}
          <Link to="/" className="text-slate-400 hover:text-white">
            TvetFlow
          </Link>
        </div>
      </footer>

      {/* Login modal — opens on Sign In / Portal Login */}
      <AnimatePresence>
        {loginOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label="Close sign in"
              onClick={closeLogin}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tenant-login-title"
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#0c1a32] p-6 shadow-2xl"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.25 }}
            >
              <button
                type="button"
                onClick={closeLogin}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-5 flex items-center gap-3 pr-8">
                {institution.logo_url ? (
                  <img
                    src={institution.logo_url}
                    alt=""
                    className="h-11 w-11 rounded-full bg-white/10 object-contain p-1"
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {brandInitial(institution.name)}
                  </div>
                )}
                <div>
                  <p id="tenant-login-title" className="font-display text-lg font-semibold text-white">
                    Sign in
                  </p>
                  <p className="text-xs text-slate-400">Only this institution’s accounts.</p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <Alert variant="destructive" className="border-red-900/50 bg-red-950/50 text-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="tenant-login-id" className="text-slate-200">
                    Email or Student ID
                  </Label>
                  <Input
                    id="tenant-login-id"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setLoginError('');
                    }}
                    className="border-white/10 bg-white/95 text-slate-900"
                    disabled={signingIn}
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-login-pw" className="text-slate-200">
                    Password
                  </Label>
                  <Input
                    id="tenant-login-pw"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLoginError('');
                    }}
                    className="border-white/10 bg-white/95 text-slate-900"
                    disabled={signingIn}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-lg text-white hover:opacity-90"
                  style={{ backgroundColor: primary }}
                  disabled={signingIn}
                >
                  {signingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                    </>
                  ) : (
                    <>
                      Sign in <LogIn className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TenantHomePage;
