import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, ArrowRight, ShieldCheck } from 'lucide-react';
import { resolvePublicTenantSubdomain } from '@/lib/institution';
import TenantHomePage from '@/pages/public/TenantHomePage';

/**
 * Platform landing, or tenant branded front-door when a tenant subdomain is resolved.
 */
const WelcomePage = () => {
  const [searchParams] = useSearchParams();
  const tenant =
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain();

  if (tenant) {
    return <TenantHomePage subdomain={tenant} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Helmet>
        <title>Training Center Platform</title>
      </Helmet>

      <header className="border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold shrink-0">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span>Training Platform</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="text-slate-300 text-sm sm:text-base">
              <Link to="/verify-credential">Verify credential</Link>
            </Button>
            <Button asChild variant="outline" className="border-slate-700 text-slate-200 text-sm sm:text-base">
              <Link to="/create-institution">Create institution</Link>
            </Button>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-sm sm:text-base">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 py-16 grid gap-10 lg:grid-cols-2 items-center w-full">
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              Manage your training institution in one place
            </h1>
            <p className="text-slate-400 text-lg max-w-xl">
              Students, classes, attendance, payments, and credentials — securely isolated for each institution.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-indigo-600 hover:bg-indigo-500">
                <Link to="/create-institution">
                  Create institution <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-700">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-700">
                <Link to="/verify-credential">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Verify ID
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-8 min-h-[280px] flex items-center justify-center">
            <div className="text-center space-y-3">
              <GraduationCap className="h-16 w-16 text-indigo-400 mx-auto" />
              <p className="text-slate-300 font-medium">Multi-tenant training operations</p>
              <p className="text-slate-500 text-sm">
                Institutions open their branded page with <code className="text-slate-400">?tenant=subdomain</code>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Training Platform ·{' '}
        <Link to="/privacy" className="hover:text-slate-300">Privacy</Link>
        {' · '}
        <Link to="/terms" className="hover:text-slate-300">Terms</Link>
      </footer>
    </div>
  );
};

export default WelcomePage;
