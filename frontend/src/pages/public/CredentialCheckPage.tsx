import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicInstitutionBySubdomain } from '@/lib/api';
import {
    getInstitutionDisplayName,
    getInstitutionPrimary,
    resolvePublicTenantSubdomain,
} from '@/lib/institution';
import Logo from '@/components/Logo';
import StudentIdentityVerify from '@/components/public/StudentIdentityVerify';

const CredentialCheckPage = () => {
    const [searchParams] = useSearchParams();
    const [tenant, setTenant] = useState<any>(null);

    const tenantSlug = String(
        searchParams.get('tenant') || searchParams.get('subdomain') || resolvePublicTenantSubdomain() || '',
    ).trim().toLowerCase();

    const prefillId = String(
        searchParams.get('id') || searchParams.get('studentId') || searchParams.get('code') || '',
    ).trim();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!tenantSlug) return;
            try {
                const inst = await getPublicInstitutionBySubdomain(tenantSlug);
                if (!cancelled) setTenant(inst);
            } catch {
                if (!cancelled) setTenant(null);
            }
        })();
        return () => { cancelled = true; };
    }, [tenantSlug]);

    const isPlatform = !tenantSlug;
    const logoUrl = tenant?.logo_url || null;
    const accent = getInstitutionPrimary(tenant);

    return (
        <div className="min-h-screen bg-slate-950 font-sans flex flex-col text-slate-100">
            <Helmet>
                <title>
                    {tenant
                        ? `Credential Verification — ${getInstitutionDisplayName(tenant)}`
                        : 'Verify Identity — TvetFlow'}
                </title>
            </Helmet>

            <div className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-slate-400 hover:text-teal-400 transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="h-8 w-px bg-slate-800 hidden sm:block" />
                        {logoUrl ? (
                            <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
                        ) : (
                            <Logo className="h-8 w-auto brightness-0 invert" />
                        )}
                        {tenant?.name ? (
                            <span className="hidden sm:inline text-sm text-slate-300 font-medium truncate max-w-[240px]">
                                {tenant.name}
                            </span>
                        ) : (
                            <span className="hidden sm:inline font-display text-sm font-semibold text-white">
                                Tvet<span className="text-teal-300">Flow</span>
                            </span>
                        )}
                    </div>
                    <Button asChild variant="ghost" size="sm" className="hidden sm:flex text-slate-300 hover:text-white hover:bg-slate-800">
                        <Link to={isPlatform ? '/login' : `/login?tenant=${encodeURIComponent(tenantSlug)}`}>
                            {isPlatform ? 'Sign in' : 'Portal Login'}
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 py-12">
                <StudentIdentityVerify
                    tenantSlug={tenantSlug}
                    tenantName={tenant?.name || ''}
                    accent={isPlatform ? '#14b8a6' : accent}
                    prefillId={prefillId}
                    variant={isPlatform ? 'platform' : 'portal'}
                />
            </div>
        </div>
    );
};

export default CredentialCheckPage;
