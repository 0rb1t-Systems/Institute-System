import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, LogIn, GraduationCap, ArrowLeft } from 'lucide-react';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';
import { getPublicInstitutionBySubdomain, requestPasswordReset } from '@/lib/api';
import ThemeToggle from '@/components/platform/ThemeToggle';
import { usePlatformTheme } from '@/contexts/PlatformThemeContext';
import { LandingLogo } from '@/components/landing/LandingShared';
import {
  getInstitutionPrimary,
  getTenantPortalUrl,
  institutionLogoUrl,
  applyBrandPatch,
  mergeInstitutionWithPublishedBrand,
  coalesceLogoUrl,
  resolvePublicTenantSubdomain,
  subscribeInstitutionBrand,
} from '@/lib/institution';

function dashboardPathForRole(role) {
  if (role === 'super_admin') return '/super-admin';
  if (role === 'student') return '/student/dashboard';
  if (role === 'instructor') return '/instructor/dashboard';
  if (role === 'affiliate') return '/affiliate';
  return '/dashboard';
}

const LoginPage = ({ initialError = '' }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError || '');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [info, setInfo] = useState('');
  const [institution, setInstitution] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(false);
  const { login } = useAuth();
  const { mode } = usePlatformTheme();
  const light = mode === 'light';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const tenantFromQuery =
    searchParams.get('tenant') || searchParams.get('subdomain') || '';
  // Subdomain host (dhambaal.tvetflow.online) counts; platform apex stays admin-only when no tenant.
  const tenant = String(tenantFromQuery || resolvePublicTenantSubdomain() || '')
    .trim()
    .toLowerCase();

  useEffect(() => {
    if (location.state?.tenantSuspended) {
      setError(MESSAGES.AUTH.TENANT_SUSPENDED);
    }
    if (location.state?.passwordReset) {
      setInfo(MESSAGES.AUTH.RESET_PASSWORD_OK);
    }
  }, [location.state]);

  useEffect(() => {
    if (!tenant) {
      setInstitution(null);
      return undefined;
    }
    let cancelled = false;
    const load = async (silent = false) => {
      if (!silent) setLoadingTenant(true);
      try {
        const inst = await getPublicInstitutionBySubdomain(tenant);
        if (cancelled) return
        const merged = mergeInstitutionWithPublishedBrand(inst || null)
        setInstitution((prev) => {
          if (!silent || !prev || !merged) return merged
          return {
            ...merged,
            logo_url: coalesceLogoUrl(merged.logo_url, prev.logo_url),
            name: merged.name || prev.name,
          }
        })
      } catch {
        if (!cancelled && !silent) setInstitution(null);
      } finally {
        if (!cancelled && !silent) setLoadingTenant(false);
      }
    };
    void load(false);
    const onFocus = () => void load(true);
    const onVis = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [tenant]);

  useEffect(() => {
    return subscribeInstitutionBrand((patch) => {
      setInstitution((prev) => applyBrandPatch(prev, patch) ?? prev)
    })
  }, []);

  const primary = getInstitutionPrimary(institution);
  const tenantLogo = institutionLogoUrl(institution);
  const isTenantLogin = Boolean(tenant);
  const tenantHomeHref = tenant ? getTenantPortalUrl({ subdomain: tenant }) : '/';

  const handleForgot = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError(MESSAGES.AUTH.MISSING_CREDENTIALS);
      return;
    }
    setIsLoading(true);
    try {
      await requestPasswordReset({
        identifier: trimmedIdentifier,
        subdomain: tenant,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setForgotSent(true);
    } catch (err) {
      setError(
        getUserMessage(err, {
          context: 'LoginPage.forgot',
          fallback: MESSAGES.AUTH.EMAIL_NOT_CONFIGURED,
        }),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdentifier || !trimmedPassword) {
      setError(MESSAGES.AUTH.MISSING_CREDENTIALS);
      return;
    }

    if (isTenantLogin && !institution?.id) {
      setError(
        loadingTenant
          ? 'Loading institution… please wait.'
          : 'Institution not found. Open a valid institution link (?tenant=slug).',
      );
      return;
    }

    setIsLoading(true);

    try {
      const { user, error: loginError } = await login(trimmedIdentifier, trimmedPassword, {
        platformAdminOnly: !isTenantLogin,
        ...(isTenantLogin && institution?.id
          ? { requiredInstitutionId: institution.id }
          : {}),
      });

      if (loginError || !user) {
        throw loginError || new Error('AUTH.INVALID_CREDENTIALS');
      }

      setIdentifier('');
      setPassword('');
      navigate(dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      setError(getUserMessage(err, { context: 'LoginPage', fallback: MESSAGES.AUTH.INVALID_CREDENTIALS }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={
        isTenantLogin
          ? `relative flex min-h-screen items-center justify-center overflow-hidden p-4 ${
              light ? 'bg-slate-50' : 'bg-slate-950'
            }`
          : 'platform-public relative flex min-h-screen items-center justify-center overflow-hidden p-4'
      }
    >
      <Helmet>
        <title>
          {institution?.name ? `Sign in · ${institution.name}` : isTenantLogin ? 'Portal Sign in' : 'TvetFlow Sign in'}
        </title>
      </Helmet>

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle variant={isTenantLogin ? 'brand' : 'platform'} />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -left-[10%] -top-[20%] h-[50%] w-[50%] rounded-full blur-[120px]"
          style={{ backgroundColor: `${primary}18` }}
        />
        <div className="absolute bottom-[10%] right-[10%] h-[30%] w-[30%] rounded-full bg-teal-500/5 blur-[100px]" />
      </div>

      <Card
        className={
          isTenantLogin
            ? light
              ? 'relative z-10 w-full max-w-md border-slate-200 bg-white shadow-xl'
              : 'relative z-10 w-full max-w-md border-slate-800 bg-slate-900/80 shadow-2xl backdrop-blur-sm'
            : 'relative z-10 w-full max-w-md border-[var(--pf-line)] bg-[var(--pf-surface)] shadow-xl'
        }
      >
        <CardHeader className="space-y-3 pb-6 text-center">
          {isTenantLogin ? (
            <div className="flex flex-col items-center gap-3">
              {loadingTenant && !tenantLogo ? (
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              ) : tenantLogo ? (
                <LandingLogo institution={institution} align="center" />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: primary }}
                >
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                {tenantLogo ? null : (
                  <CardTitle className={`text-xl font-bold sm:text-2xl ${light ? 'text-slate-900' : 'text-white'}`}>
                    {institution?.name || 'Institution portal'}
                  </CardTitle>
                )}
                <CardDescription className={`${light && isTenantLogin ? 'text-slate-500' : 'text-slate-400'} ${tenantLogo ? '' : 'mt-1'}`}>
                  Sign in to open your dashboard
                </CardDescription>
              </div>
            </div>
          ) : (
            <>
              <Link to="/" className="font-display text-2xl font-bold tracking-tight text-[var(--pf-text)]">
                Tvet<span className="text-teal-500">Flow</span>
              </Link>
              <CardTitle className="text-2xl font-bold text-[var(--pf-text)]">Sign in</CardTitle>
              <CardDescription className="text-[var(--pf-muted)]">
                Institution admin sign in
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={forgotMode ? handleForgot : handleSubmit} className="space-y-4">
            {info && !error && (
              <Alert className={light ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-teal-900/50 bg-teal-950/50 text-teal-100'}>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive" className={light ? 'border-red-200 bg-red-50 text-red-800' : 'border-red-900/50 bg-red-950/50 text-red-200'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {forgotSent ? (
              <p className={`text-sm ${light && isTenantLogin ? 'text-slate-600' : 'text-slate-400'}`}>
                {MESSAGES.AUTH.FORGOT_PASSWORD}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="identifier" className={isTenantLogin ? (light ? 'text-slate-700' : 'text-slate-200') : 'text-[var(--pf-text)]'}>
                {isTenantLogin ? 'Email or Student ID' : 'Admin email'}
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder={
                  isTenantLogin
                    ? 'e.g. email@example.com or Student ID'
                    : 'admin@example.com'
                }
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setError('');
                }}
                className={
                  isTenantLogin
                    ? light
                      ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
                      : 'border-slate-700 bg-slate-950 text-white placeholder:text-slate-500'
                    : 'border-[var(--pf-line)] bg-[var(--pf-bg)] text-[var(--pf-text)] placeholder:text-[var(--pf-faint)]'
                }
                style={{ ['--tw-ring-color']: primary }}
                disabled={isLoading || forgotSent}
                required
              />
            </div>
            {!forgotMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className={isTenantLogin ? (light ? 'text-slate-700' : 'text-slate-200') : 'text-[var(--pf-text)]'}>
                  Password
                </Label>
                <button
                  type="button"
                  className="text-xs font-semibold underline-offset-2 hover:underline"
                  style={{ color: primary }}
                  onClick={() => {
                    setForgotMode(true);
                    setError('');
                    setForgotSent(false);
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className={
                  isTenantLogin
                    ? light
                      ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
                      : 'border-slate-700 bg-slate-950 text-white placeholder:text-slate-500'
                    : 'border-[var(--pf-line)] bg-[var(--pf-bg)] text-[var(--pf-text)] placeholder:text-[var(--pf-faint)]'
                }
                disabled={isLoading}
                required={!forgotMode}
              />
            </div>
            ) : null}
            {!forgotSent ? (
            <div className="pt-2 space-y-2">
              <Button
                type="submit"
                className={
                  isTenantLogin
                    ? 'w-full text-white transition-all hover:opacity-90'
                    : 'w-full bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90'
                }
                style={isTenantLogin ? { backgroundColor: primary } : undefined}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {forgotMode ? 'Sending...' : 'Verifying...'}
                  </>
                ) : forgotMode ? (
                  'Send reset link'
                ) : (
                  <>
                    Sign In <LogIn className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              {forgotMode ? (
                <button
                  type="button"
                  className="w-full text-center text-xs text-teal-400 hover:text-teal-300"
                  onClick={() => {
                    setForgotMode(false);
                    setForgotSent(false);
                    setError('');
                  }}
                >
                  Back to sign in
                </button>
              ) : null}
            </div>
            ) : (
              <button
                type="button"
                className="w-full text-center text-xs text-teal-400 hover:text-teal-300"
                onClick={() => {
                  setForgotMode(false);
                  setForgotSent(false);
                  setError('');
                }}
              >
                Back to sign in
              </button>
            )}
          </form>
        </CardContent>
        <CardFooter
          className={
            isTenantLogin
              ? `flex flex-col items-center space-y-3 border-t pt-6 ${light ? 'border-slate-200' : 'border-slate-800'}`
              : 'flex flex-col items-center space-y-3 border-t border-[var(--pf-line)] pt-6'
          }
        >
          {isTenantLogin ? (
            <>
              <p className={`text-center text-xs ${light ? 'text-slate-500' : 'text-slate-400'}`}>
                Only this institution’s accounts can sign in here.
              </p>
              {/^https?:\/\//i.test(tenantHomeHref) ? (
                <a
                  href={tenantHomeHref}
                  className="inline-flex items-center text-sm text-teal-400 hover:text-teal-300"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to {institution?.name || 'institution'} page
                </a>
              ) : (
                <Link
                  to={tenantHomeHref}
                  className="inline-flex items-center text-sm text-teal-400 hover:text-teal-300"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to {institution?.name || 'institution'} page
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="text-center text-xs text-[var(--pf-muted)]">
                Institution accounts must sign in from their own landing page.
              </p>
              <p className="text-center text-sm text-[var(--pf-text)]">
                New institution?{' '}
                <Link to="/create-institution" className="font-medium text-teal-600 hover:underline">
                  Create institution admin
                </Link>
              </p>
            </>
          )}
          <p className="space-x-3 text-center text-xs text-slate-500">
            <Link to="/privacy" className="hover:text-slate-300">
              Privacy
            </Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-slate-300">
              Terms
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
