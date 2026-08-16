import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Logo from '@/components/Logo';
import { resolvePublicTenantSubdomain } from '@/lib/institution';

/**
 * Public instant signup is closed (Option B only).
 * Applicants must use the institution registration form → pending approval.
 */
const SignupPage = () => {
  const [searchParams] = useSearchParams();
  const tenant =
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain() ||
    '';

  const registerHref = tenant
    ? `/register?tenant=${encodeURIComponent(tenant)}`
    : '/register';

  return (
    <>
      <Helmet>
        <title>Registration — Apply for review</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <Card className="w-full max-w-md bg-slate-900/50 border-slate-800 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 w-fit">
              <Logo />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Open signup is closed</CardTitle>
            <CardDescription className="text-slate-400">
              Student accounts are created only after your institution reviews and approves your
              registration application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link to={registerHref}>Go to registration form</Link>
            </Button>
            <Button asChild variant="outline" className="w-full border-slate-700">
              <Link to={tenant ? `/login?tenant=${encodeURIComponent(tenant)}` : '/login'}>
                Already approved? Sign in
              </Link>
            </Button>
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-800 pt-4">
            <p className="text-xs text-slate-500 text-center">
              Use your institution link with <code className="text-slate-400">?tenant=subdomain</code>{' '}
              if the form does not load classes.
            </p>
          </CardFooter>
        </Card>
      </div>
    </>
  );
};

export default SignupPage;
