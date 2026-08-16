import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, ArrowRight, ShieldCheck, FileText, Loader2 } from 'lucide-react';
import { getPublicInstitutionBySubdomain } from '@/lib/api';
import {
  resolvePublicTenantSubdomain,
  getInstitutionPrimary,
  getInstitutionAccent,
} from '@/lib/institution';

/**
 * Tenant branded public front-door (UI only — no custom DNS required).
 * Resolve tenant from ?tenant= / hostname / VITE_DEFAULT_TENANT_SUBDOMAIN.
 */
const TenantHomePage = ({ subdomain: subdomainProp }) => {
  const [searchParams] = useSearchParams();
  const subdomain =
    subdomainProp ||
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain();

  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(!!subdomain);
  const [error, setError] = useState(null);

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
  const registerHref = `/register?tenant=${encodeURIComponent(subdomain || '')}`;
  const loginHref = `/login?tenant=${encodeURIComponent(subdomain || '')}`;
  const verifyHref = `/verify-credential?tenant=${encodeURIComponent(subdomain || '')}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <Helmet><title>Institution not found</title></Helmet>
        <p className="text-slate-400 mb-4">
          {error === 'missing'
            ? 'Open this page with a valid institution link (?tenant=subdomain).'
            : 'Institution not found or inactive.'}
        </p>
        <Button asChild variant="outline" className="border-slate-700">
          <Link to="/">Back to platform</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col"
      style={{
        background: `linear-gradient(160deg, #0b1220 0%, ${primary}22 45%, #020617 100%)`,
      }}
    >
      <Helmet>
        <title>{institution.name} — Training Center</title>
      </Helmet>

      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 font-semibold min-w-0">
            {institution.logo_url ? (
              <img
                src={institution.logo_url}
                alt=""
                className="h-10 w-10 rounded-lg object-contain bg-white/5 p-1 shrink-0"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: primary }}
              >
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            )}
            <span className="text-base sm:text-lg truncate max-w-[min(70vw,20rem)] sm:max-w-md">{institution.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button asChild variant="ghost" className="text-slate-300 text-sm sm:text-base">
              <Link to={verifyHref}>Verify certificate</Link>
            </Button>
            <Button asChild style={{ backgroundColor: primary }} className="hover:opacity-90 text-white text-sm sm:text-base">
              <Link to={loginHref}>Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 py-16 grid gap-10 lg:grid-cols-2 items-center w-full">
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              {institution.name}
            </h1>
            <p className="text-slate-300 text-lg max-w-xl">
              {institution.description ||
                'Register for classes, access the student portal, and verify credentials.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" style={{ backgroundColor: accent || primary }} className="text-white hover:opacity-90">
                <Link to={registerHref}>
                  Apply to register <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-600">
                <Link to={loginHref}>Portal login</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-600">
                <Link to={verifyHref}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Verify certificate
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-8 min-h-[260px] flex flex-col justify-center gap-4">
            {(institution.email || institution.phone || institution.address) && (
              <div className="space-y-2 text-sm text-slate-300">
                {institution.address ? <p>{institution.address}</p> : null}
                {institution.phone ? <p>{institution.phone}</p> : null}
                {institution.email ? <p>{institution.email}</p> : null}
              </div>
            )}
            <div className="flex items-start gap-3 text-slate-400 text-sm">
              <FileText className="h-5 w-5 shrink-0 mt-0.5" style={{ color: primary }} />
              <p>
                Registration applications are reviewed by institution staff before student accounts are created.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} {institution.name} ·{' '}
        <Link to="/privacy" className="hover:text-slate-300">Privacy</Link>
        {' · '}
        <Link to="/terms" className="hover:text-slate-300">Terms</Link>
      </footer>
    </div>
  );
};

export default TenantHomePage;
