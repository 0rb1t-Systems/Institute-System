import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  Loader2,
  LogIn,
  UserPlus,
  LayoutDashboard,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
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

function dashboardPathForRole(role) {
  if (role === 'super_admin') return '/super-admin';
  if (role === 'student') return '/student/dashboard';
  if (role === 'instructor') return '/instructor/dashboard';
  if (role === 'affiliate') return '/affiliate';
  return '/dashboard';
}

/**
 * Public tenant landing — visit without login.
 * Optional inline portal sign-in on the same page (no separate institution login required).
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

  const primary = getInstitutionPrimary(institution);
  const accent = getInstitutionAccent(institution);
  const q = encodeURIComponent(subdomain || '');
  const registerHref = `/register?tenant=${q}`;
  const verifyHref = `/verify-credential?tenant=${q}`;
  const sameTenant =
    user &&
    institution &&
    user.institution_id &&
    String(user.institution_id) === String(institution.id);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleInlineLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const id = identifier.trim();
    const pw = password.trim();
    if (!id || !pw) {
      setLoginError(MESSAGES.AUTH.MISSING_CREDENTIALS);
      return;
    }
    setSigningIn(true);
    try {
      const { user: signedIn, error: loginErr } = await login(id, pw, {
        requiredInstitutionId: institution.id,
      });
      if (loginErr || !signedIn) {
        throw loginErr || new Error('AUTH.INVALID_CREDENTIALS');
      }
      setIdentifier('');
      setPassword('');
      navigate(dashboardPathForRole(signedIn.role), { replace: true });
    } catch (err) {
      setLoginError(getUserMessage(err, { context: 'TenantHomeLogin', fallback: MESSAGES.AUTH.INVALID_CREDENTIALS }));
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primary }} />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
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

  return (
    <div
      className="flex min-h-screen flex-col font-sans text-slate-100"
      style={{
        background: `linear-gradient(165deg, #071016 0%, ${primary}22 40%, #020617 100%)`,
      }}
    >
      <Helmet>
        <title>{institution.name}</title>
      </Helmet>

      {/* Public header — browse without login */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/35 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          <button type="button" onClick={() => scrollTo('home')} className="flex min-w-0 items-center gap-2.5 text-left">
            {institution.logo_url ? (
              <img
                src={institution.logo_url}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg bg-white/5 object-contain p-0.5"
              />
            ) : (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: primary }}
              >
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
            )}
            <span className="truncate font-display text-sm font-semibold sm:text-base">{institution.name}</span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { id: 'home', label: 'Home' },
              { id: 'about', label: 'About' },
              { id: 'portal', label: 'Portal' },
              { id: 'contact', label: 'Contact' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="rounded-md px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </button>
            ))}
            <Button asChild size="sm" variant="ghost" className="text-slate-300">
              <Link to={verifyHref}>Verify</Link>
            </Button>
            {sameTenant ? (
              <Button asChild size="sm" className="ml-1 text-white hover:opacity-90" style={{ backgroundColor: primary }}>
                <Link to={dashboardPathForRole(user.role)}>Dashboard</Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="ml-1 text-white hover:opacity-90"
                style={{ backgroundColor: primary }}
                onClick={() => scrollTo('portal')}
              >
                Sign in
              </Button>
            )}
          </nav>

          <Button
            type="button"
            size="sm"
            className="text-white hover:opacity-90 md:hidden"
            style={{ backgroundColor: primary }}
            onClick={() => scrollTo(sameTenant ? 'home' : 'portal')}
          >
            {sameTenant ? 'Dashboard' : 'Sign in'}
          </Button>
        </div>
      </header>

      <main>
        {/* Home — public visit */}
        <section id="home" className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-2">
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Public institution page</p>
            <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
              {institution.name}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              {institution.description ||
                'Welcome. Browse this page freely — apply, verify certificates, or sign in to your portal when you need your dashboard.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link to={registerHref}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Apply to register
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
                <Link to={verifyHref}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify certificate
                </Link>
              </Button>
            </div>
            <p className="text-sm text-slate-500">No login needed to visit, apply, or verify.</p>
          </motion.div>

          <motion.div
            className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-1 shadow-2xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div
              className="flex min-h-[220px] flex-col justify-end rounded-xl p-6 sm:min-h-[280px]"
              style={{
                background: `linear-gradient(145deg, ${primary}55, #020617 70%)`,
              }}
            >
              {institution.logo_url ? (
                <img src={institution.logo_url} alt="" className="mb-4 h-14 w-14 rounded-xl bg-white/10 object-contain p-1" />
              ) : (
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/10">
                  <GraduationCap className="h-7 w-7 text-white" />
                </div>
              )}
              <p className="font-display text-xl font-semibold text-white">{institution.name}</p>
              <p className="mt-1 text-sm text-slate-300">Training institution on TvetFlow</p>
            </div>
          </motion.div>
        </section>

        {/* About — public */}
        <section id="about" className="border-t border-white/5 bg-black/20 px-4 py-12 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold text-white">About</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              {institution.description ||
                `${institution.name} uses TvetFlow to manage training, students, and credentials. Anyone can visit this page without signing in.`}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { title: 'Visit freely', body: 'Read about the institution, apply, and verify certificates with no account.' },
                { title: 'Students apply', body: 'Submit a registration request. Staff review before creating student accounts.' },
                { title: 'Team portal', body: 'Admin, staff, instructors, affiliates, and students sign in below for dashboards.' },
              ].map((card) => (
                <div key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="font-display text-base font-semibold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Portal — inline login (no separate institution login page needed) */}
        <section id="portal" className="border-t border-white/5 px-4 py-12 sm:px-8 sm:py-14">
          <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Portal</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">Sign in here</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                Only {institution.name} users can sign in here — admin, staff, instructor, affiliate, and student of this institution.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-400">
                <li>· Admin & staff → operations dashboard</li>
                <li>· Instructor → teaching dashboard</li>
                <li>· Affiliate → affiliate portal</li>
                <li>· Student → student dashboard</li>
                <li>· Other institutions’ accounts are blocked here</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-xl backdrop-blur sm:p-6">
              {sameTenant ? (
                <div className="space-y-4 text-center">
                  <LayoutDashboard className="mx-auto h-8 w-8" style={{ color: accent || primary }} />
                  <p className="font-display text-lg font-semibold text-white">You are signed in</p>
                  <p className="text-sm text-slate-400">Continue to your dashboard for {institution.name}.</p>
                  <Button
                    asChild
                    className="w-full text-white hover:opacity-90"
                    style={{ backgroundColor: accent || primary }}
                  >
                    <Link to={dashboardPathForRole(user.role)}>
                      Go to dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleInlineLogin} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <LogIn className="h-5 w-5" style={{ color: primary }} />
                    <h3 className="font-display text-lg font-semibold text-white">Portal sign in</h3>
                  </div>
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
                      className="border-white/10 bg-slate-950 text-white"
                      disabled={signingIn}
                      autoComplete="username"
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
                      className="border-white/10 bg-slate-950 text-white"
                      disabled={signingIn}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full text-white hover:opacity-90"
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
              )}
            </div>
          </div>
        </section>

        {/* Contact — public */}
        <section id="contact" className="border-t border-white/5 bg-black/20 px-4 py-12 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-2xl font-semibold text-white">Contact</h2>
            <p className="mt-2 text-sm text-slate-400">Reach {institution.name} — no login required.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {institution.address && (
                <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primary }} />
                  <p className="text-sm text-slate-300">{institution.address}</p>
                </div>
              )}
              {institution.phone && (
                <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primary }} />
                  <a href={`tel:${institution.phone}`} className="text-sm text-slate-300 hover:text-white">
                    {institution.phone}
                  </a>
                </div>
              )}
              {institution.email && (
                <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primary }} />
                  <a href={`mailto:${institution.email}`} className="text-sm text-slate-300 hover:text-white">
                    {institution.email}
                  </a>
                </div>
              )}
              {!institution.address && !institution.phone && !institution.email && (
                <p className="text-sm text-slate-500">Contact details will appear when the institution updates its profile.</p>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} {institution.name}
        <span className="mx-2 text-white/10">·</span>
        <Link to="/privacy" className="hover:text-slate-300">
          Privacy
        </Link>
        <span className="mx-2 text-white/10">·</span>
        <Link to="/terms" className="hover:text-slate-300">
          Terms
        </Link>
        <span className="mx-2 text-white/10">·</span>
        <Link to="/" className="hover:text-slate-300">
          TvetFlow
        </Link>
      </footer>
    </div>
  );
};

export default TenantHomePage;
