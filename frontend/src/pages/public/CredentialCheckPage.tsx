import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
    ShieldCheck,
    Search,
    Loader2,
    ArrowLeft,
    CheckCircle2,
    User,
    XCircle,
    Award,
    BookOpen,
    BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPublicInstitutionBySubdomain, verifyStudentProfile } from '@/lib/api';
import {
    getInstitutionDisplayName,
    getInstitutionPrimary,
    resolvePublicTenantSubdomain,
} from '@/lib/institution';
import Logo from '@/components/Logo';
import { MESSAGES } from '@/lib/notify';

const academicStatusTone = (status?: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return 'bg-emerald-600/25 text-emerald-300 border-emerald-500/40';
    if (s === 'enrolled' || s === 'verified') return 'bg-sky-600/20 text-sky-300 border-sky-500/40';
    if (s === 'inactive') return 'bg-amber-600/20 text-amber-300 border-amber-500/40';
    return 'bg-slate-700/50 text-slate-300 border-slate-600/50';
};

const CredentialCheckPage = () => {
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [student, setStudent] = useState<any>(null);
    const [tenant, setTenant] = useState<any>(null);

    const tenantSlug = String(
        searchParams.get('tenant') || searchParams.get('subdomain') || resolvePublicTenantSubdomain() || '',
    ).trim().toLowerCase();

    const prefillId = String(
        searchParams.get('id') || searchParams.get('studentId') || searchParams.get('code') || '',
    ).trim();

    const { register, handleSubmit, setValue, formState: { errors } } = useForm({
        defaultValues: { studentId: prefillId },
    });

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

    const runVerify = async (studentId: string) => {
        setIsLoading(true);
        setStatus('idle');
        setStudent(null);

        try {
            if (!tenantSlug) {
                setStatus('error');
                return;
            }
            const result: any = await verifyStudentProfile(studentId, tenantSlug);
            const studentData = result?.data || (result?.name ? result : null);

            if (result?.valid && studentData) {
                setStudent(studentData);
                setStatus('success');
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        } finally {
            setIsLoading(false);
            setIsOpen(true);
        }
    };

    useEffect(() => {
        if (!prefillId) return;
        setValue('studentId', prefillId);
        void runVerify(prefillId);
        // Auto-verify once when QR deep-link provides an id
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefillId]);

    const onSubmit = async (data) => {
        await runVerify(String(data.studentId || '').trim());
    };

    const institutionName =
        student?.institution_name ||
        getInstitutionDisplayName(tenant, 'Training Center');
    const logoUrl = student?.institution_logo_url || tenant?.logo_url || null;
    const accent = student?.theme_primary || getInstitutionPrimary(tenant);
    const programLabel = student?.program_name || student?.class_name || '—';
    const academicStatus = student?.academic_status || 'Verified';
    const initials = String(student?.name || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase() || 'ST';

    return (
        <div className="min-h-screen bg-slate-950 font-sans flex flex-col text-slate-100">
            <Helmet>
                <title>
                    {tenant
                        ? `Credential Verification — ${getInstitutionDisplayName(tenant)}`
                        : 'Credential Verification - Portal'}
                </title>
            </Helmet>

            <div className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-slate-400 hover:text-blue-500 transition-colors">
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
                        ) : null}
                    </div>
                    <Button asChild variant="ghost" size="sm" className="hidden sm:flex text-slate-300 hover:text-white hover:bg-slate-800">
                        <Link to="/login">Portal Login</Link>
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 py-12">
                <div className="w-full max-w-lg space-y-8">
                    <div className="text-center space-y-4">
                        <div className="bg-blue-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-blue-500/20 shadow-lg shadow-blue-500/10">
                            <ShieldCheck className="h-8 w-8 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Verify Identity</h1>
                            <p className="text-slate-400 mt-2 text-sm">
                                Enter a Student ID to confirm the official academic record
                                {tenant?.name ? ` at ${tenant.name}` : ''}.
                            </p>
                            {!tenantSlug ? (
                                <p className="text-amber-400/90 text-xs max-w-md mx-auto">
                                    Open this page from your institution link (?tenant=subdomain) or scan an ID-card QR.
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <Card className="shadow-2xl border-t-4 border-t-blue-600 bg-slate-900 border-x-0 border-b-0 sm:border sm:border-slate-800 overflow-hidden">
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-white">Student Verification</CardTitle>
                            <CardDescription className="text-slate-400">
                                Secure check against the institution registry
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="studentId" className="sr-only">Student ID</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                                        <Input
                                            id="studentId"
                                            placeholder="e.g. BRCE01106"
                                            className="pl-9 h-11 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-600"
                                            {...register('studentId', { required: MESSAGES.VALIDATION.STUDENT_ID })}
                                        />
                                    </div>
                                    {errors.studentId && (
                                        <p className="text-xs text-red-400">{String(errors.studentId.message || '')}</p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-white shadow-lg shadow-blue-900/20 transition-all hover:shadow-blue-900/40"
                                    disabled={isLoading || !tenantSlug}
                                >
                                    {isLoading ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                                    ) : (
                                        <><Search className="mr-2 h-4 w-4" /> Verify Now</>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-[#121826] border-slate-800 text-slate-100 gap-0">
                            {status === 'success' && student ? (
                                <div className="flex flex-col">
                                    <div
                                        className="h-1 w-full"
                                        style={{ backgroundColor: accent || '#22c55e' }}
                                    />

                                    <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                                                {logoUrl ? (
                                                    <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
                                                ) : (
                                                    <Award className="h-5 w-5 text-slate-300" />
                                                )}
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                                                    Official Record
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2">
                                                    {institutionName}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Verified Credential
                                        </div>
                                    </div>

                                    <div className="px-5 pb-5 flex items-center gap-4">
                                        <div className="relative shrink-0">
                                            <Avatar className="h-20 w-20 border-2 border-slate-700 shadow-lg">
                                                <AvatarImage src={student.avatar_url || undefined} alt="" />
                                                <AvatarFallback className="bg-slate-800 text-slate-300 text-xl font-bold">
                                                    {initials}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-amber-400 border-2 border-[#121826] flex items-center justify-center">
                                                <BadgeCheck className="h-3.5 w-3.5 text-slate-900" />
                                            </span>
                                        </div>
                                        <div className="min-w-0 text-left space-y-2">
                                            <h2 className="text-xl font-bold text-white leading-tight truncate">
                                                {student.name}
                                            </h2>
                                            <span className="inline-flex items-center rounded-full bg-slate-800 border border-slate-700 px-3 py-1 font-mono text-sm text-white tracking-wide">
                                                {student.student_code}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 text-left">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                    Program / Course
                                                </p>
                                            </div>
                                            <p className="text-sm font-semibold text-white leading-snug">
                                                {programLabel}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 text-left">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                                                Academic Status
                                            </p>
                                            <span
                                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${academicStatusTone(academicStatus)}`}
                                            >
                                                {academicStatus}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="px-5 pb-5 text-center text-[11px] leading-relaxed text-slate-500">
                                        This verification page confirms the authenticity of the student&apos;s academic
                                        record at {institutionName}. If you require further validation, please contact
                                        the administration office.
                                    </p>

                                    <div className="px-5 pb-5">
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsOpen(false)}
                                            className="w-full border-slate-700 hover:bg-slate-800 text-slate-200"
                                        >
                                            Close
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="px-5 py-8 text-center space-y-4">
                                    <XCircle className="h-12 w-12 text-red-500 mx-auto" />
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Not Verified</h2>
                                        <p className="text-slate-400 mt-2 text-sm">{MESSAGES.DOMAIN.STUDENT_NOT_FOUND}</p>
                                        <p className="text-sm mt-1 text-slate-500">Please check the ID and try again.</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsOpen(false)}
                                        className="w-full border-slate-700 hover:bg-slate-800 text-slate-300"
                                    >
                                        Close
                                    </Button>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default CredentialCheckPage;
