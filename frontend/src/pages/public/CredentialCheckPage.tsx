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
        <div
            className={
                isPlatform
                    ? 'platform-public flex min-h-screen flex-col font-sans text-[var(--pf-text)]'
                    : 'flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100'
            }
        >
            <Helmet>
                <title>
                    {tenant
                        ? `Credential Verification — ${getInstitutionDisplayName(tenant)}`
                        : 'Verify Identity — TvetFlow'}
                </title>
            </Helmet>

            <div
                className={
                    isPlatform
                        ? 'sticky top-0 z-10 border-b border-[var(--pf-line)] bg-[var(--pf-bg)]/90 backdrop-blur-md'
                        : 'sticky top-0 z-10 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md'
                }
            >
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className={
                                isPlatform
                                    ? 'text-[var(--pf-muted)] transition-colors hover:text-teal-600'
                                    : 'text-slate-400 transition-colors hover:text-teal-400'
                            }
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className={isPlatform ? 'hidden h-8 w-px bg-[var(--pf-line)] sm:block' : 'hidden h-8 w-px bg-slate-800 sm:block'} />
                        {logoUrl ? (
                            <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
                        ) : (
                            <Logo className={isPlatform ? 'h-8 w-auto' : 'h-8 w-auto brightness-0 invert'} />
                        )}
                        {tenant?.name ? (
                            <span className="hidden max-w-[240px] truncate text-sm font-medium text-slate-300 sm:inline">
                                {tenant.name}
                            </span>
                        ) : (
                            <span
                                className={
                                    isPlatform
                                        ? 'hidden font-display text-sm font-semibold text-[var(--pf-text)] sm:inline'
                                        : 'hidden font-display text-sm font-semibold text-white sm:inline'
                                }
                            >
                                Tvet<span className="text-teal-500">Flow</span>
                            </span>
                        )}
                    </div>
                    <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className={
                            isPlatform
                                ? 'hidden text-[var(--pf-muted)] hover:bg-[var(--pf-hover)] hover:text-[var(--pf-text)] sm:flex'
                                : 'hidden text-slate-300 hover:bg-slate-800 hover:text-white sm:flex'
                        }
                    >
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
