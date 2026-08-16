import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { notify, getUserMessage, MESSAGES } from '@/lib/notify';
import {
  getPublicClassesBySubdomain,
  getPublicInstitutionBySubdomain,
  submitGeneralRegistration,
} from '@/lib/api';
import { resolvePublicTenantSubdomain } from '@/lib/institution';
import { Loader2, CheckCircle2, GraduationCap, User, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Format class duration window for public dropdown (e.g. "Jan 2026 – Jun 2026"). */
const formatClassDuration = (startMonth, endMonth) => {
  if (!startMonth || !endMonth) return '';
  try {
    const start = new Date(startMonth);
    const end = new Date(endMonth);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  } catch {
    return '';
  }
};

const PublicGeneralRegistrationPage = () => {
    const { toast } = useToast();
    const [searchParams] = useSearchParams();
    const [activeClasses, setActiveClasses] = useState([]);
    const [institutionName, setInstitutionName] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [inquiryResult, setInquiryResult] = useState(null);
    const [institutionLogo, setInstitutionLogo] = useState('');
    const [error, setError] = useState(null);

    const subdomain = searchParams.get('tenant') || searchParams.get('subdomain') || resolvePublicTenantSubdomain();
    const affiliateFromLink = searchParams.get('ref') || searchParams.get('affiliate') || '';

    const [formData, setFormData] = useState({
        student_name: '',
        student_email: '',
        student_phone: '',
        university: '',
        faculty: '',
        year: '',
        class_id: 'none',
        affiliate_id: affiliateFromLink || '',
        subdomain: subdomain || '',
    });

    useEffect(() => {
        fetchPublicData();
    }, [subdomain]);

    useEffect(() => {
        if (affiliateFromLink) {
            setFormData((prev) => ({ ...prev, affiliate_id: affiliateFromLink }));
        }
    }, [affiliateFromLink]);

    const fetchPublicData = async () => {
        setLoading(true);
        try {
            if (!subdomain) {
                setError('Institution not found. Open this page from your institution link (?tenant=subdomain).');
                setActiveClasses([]);
                return;
            }
            const [classes, inst] = await Promise.all([
                getPublicClassesBySubdomain(subdomain),
                getPublicInstitutionBySubdomain(subdomain),
            ]);
            setActiveClasses(classes || []);
            setInstitutionName(inst?.name || '');
            setInstitutionLogo(inst?.logo_url || '');
            setFormData((prev) => ({ ...prev, subdomain }));
            setError(inst ? null : 'Institution not found or inactive.');
        } catch (err) {
            console.error('Failed to fetch public registration data:', err);
            setError('Unable to load available classes. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { id, value } = e.target;
        setFormData((prev) => ({ ...prev, [id]: value }));
    };

    const handleClassChange = (value) => {
        setFormData((prev) => ({ ...prev, class_id: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!subdomain) {
            setError('Institution not found. Use a valid institution registration link.');
            return;
        }

        setSubmitting(true);
        try {
            // class_id "none" = skip enrollment; server validates real class ids per tenant
            const result = await submitGeneralRegistration({
                ...formData,
                class_id: formData.class_id === 'none' ? null : formData.class_id,
                subdomain,
                affiliate_id: formData.affiliate_id || affiliateFromLink || null,
            });
            setInquiryResult(result || null);
            setSuccess(true);
            toast({
                title: 'Application submitted',
                description: 'Your registration request is pending institution approval.',
            });
        } catch (err) {
            const msg = getUserMessage(err, { context: 'PublicGeneralRegistrationPage', fallback: MESSAGES.UNEXPECTED });
            setError(msg);
            notify.error(err, { context: 'PublicGeneralRegistrationPage', fallback: MESSAGES.UNEXPECTED });
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Helmet><title>Application Received | {institutionName || 'Portal'}</title></Helmet>
                <Card className="max-w-md w-full bg-slate-900 border-slate-800 shadow-2xl">
                    <CardContent className="pt-6 text-center space-y-4">
                        <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Application received</h2>
                        <p className="text-slate-400">
                            Thank you, <span className="text-indigo-400 font-medium">{formData.student_name}</span>.
                            Your registration request was submitted to{' '}
                            <span className="text-white font-medium">
                              {inquiryResult?.institution_name || institutionName || 'the institution'}
                            </span>
                            {affiliateFromLink ? ' (referral attributed)' : ''}.
                        </p>
                        <p className="text-sm text-slate-500">
                            Staff will review your application. If approved, a welcome email with login details will be sent to your email. If not approved, you may submit again later.
                        </p>
                        <Button onClick={() => window.location.reload()} className="w-full bg-slate-800 hover:bg-slate-700 mt-4">
                            Submit another application
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:py-10">
             <Helmet><title>Student Registration | {institutionName || 'Portal'}</title></Helmet>
             <div className="mb-8 text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 mb-4 overflow-hidden">
                    {institutionLogo ? (
                      <img src={institutionLogo} alt="" className="h-10 w-10 object-contain" />
                    ) : (
                      <GraduationCap className="h-8 w-8 text-indigo-500" />
                    )}
                </div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  {institutionName ? `${institutionName} Registration` : 'Student Registration'}
                </h1>
                <p className="text-slate-400 max-w-md mx-auto">
                    Submit an application for review. Your account is created after the institution approves it.
                </p>
                {affiliateFromLink ? (
                  <p className="text-sm text-purple-300">
                    Referral link applied — this registration will be attributed to the referring affiliate for commission.
                  </p>
                ) : null}
             </div>

             <Card className="max-w-2xl w-full bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader className="border-b border-slate-800 pb-6">
                    <CardTitle className="text-xl text-white flex items-center gap-2">
                        <User className="h-5 w-5 text-indigo-400" /> Personal Information
                    </CardTitle>
                    <CardDescription>Please provide your accurate details for enrollment.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="pt-6 space-y-6">
                        {loading && (
                          <div className="flex justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                          </div>
                        )}
                        {error && (
                            <Alert variant="destructive" className="bg-red-950/30 border-red-900/50 text-red-200">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Registration Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="student_name" className="text-slate-300">Full Name</Label>
                                <Input id="student_name" value={formData.student_name} onChange={handleChange} required
                                        placeholder="e.g. John Doe" className="bg-slate-950 border-slate-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="student_email" className="text-slate-300">Email</Label>
                                <Input id="student_email" type="email" value={formData.student_email} onChange={handleChange} required
                                        placeholder="student@example.com" className="bg-slate-950 border-slate-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="student_phone" className="text-slate-300">Phone</Label>
                                <Input id="student_phone" value={formData.student_phone} onChange={handleChange}
                                        placeholder="+252..." className="bg-slate-950 border-slate-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year" className="text-slate-300">Year</Label>
                                <Input id="year" value={formData.year} onChange={handleChange}
                                        placeholder="e.g. 2024 or Year 1" className="bg-slate-950 border-slate-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="university" className="text-slate-300">University / School</Label>
                                <Input id="university" value={formData.university} onChange={handleChange}
                                        placeholder="Current University" className="bg-slate-950 border-slate-800 text-white" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="faculty" className="text-slate-300">Faculty / Field</Label>
                                <Input id="faculty" value={formData.faculty} onChange={handleChange}
                                        placeholder="e.g. Computer Science" className="bg-slate-950 border-slate-800 text-white" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-300">Preferred Class (optional)</Label>
                            <Select value={formData.class_id || 'none'} onValueChange={handleClassChange}>
                                <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                    <SelectValue placeholder="Choose a class, or skip..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                    <SelectItem value="none">Skip for now — register without a class</SelectItem>
                                    {activeClasses.length === 0 ? (
                                      <div className="px-2 py-1.5 text-xs text-slate-500">
                                        No active classes open for registration right now.
                                      </div>
                                    ) : (
                                      activeClasses.map((c) => {
                                        const duration = formatClassDuration(c.start_month, c.end_month);
                                        return (
                                          <SelectItem key={c.id} value={c.id}>
                                            {duration ? `${c.name} (${duration})` : c.name}
                                          </SelectItem>
                                        );
                                      })
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                              Active classes for this institution are listed (with their date range). You can skip and be enrolled later by staff.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="border-t border-slate-800 pt-6">
                        <Button type="submit" disabled={submitting || loading || !subdomain} className="w-full bg-indigo-600 hover:bg-indigo-500">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Submit Registration
                        </Button>
                    </CardFooter>
                </form>
             </Card>
        </div>
    );
};

export default PublicGeneralRegistrationPage;
