import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { notify, getUserMessage, MESSAGES } from '@/lib/notify';
import { Loader2, CheckCircle, School, AlertOctagon, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  getPublicClassesBySubdomain,
  getPublicInstitutionBySubdomain,
  submitGeneralRegistration,
} from '@/lib/api';
import { resolvePublicTenantSubdomain } from '@/lib/institution';

const DEFAULT_FIELDS = [
  { id: 'name', label: 'Full Name', type: 'text', required: true },
  { id: 'email', label: 'Email Address', type: 'email', required: true },
  { id: 'phone', label: 'Phone Number', type: 'tel', required: true },
  { id: 'university_name', label: 'University', type: 'text', required: false },
  { id: 'faculty', label: 'Faculty', type: 'text', required: false },
  { id: 'year', label: 'Year', type: 'text', required: false },
];

const PublicRegistrationPage = () => {
    const { classId } = useParams();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const subdomain =
      searchParams.get('tenant') ||
      searchParams.get('subdomain') ||
      resolvePublicTenantSubdomain();
    const affiliateFromLink = searchParams.get('ref') || searchParams.get('affiliate') || '';
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formConfig, setFormConfig] = useState({ fields: DEFAULT_FIELDS });
    const [classInfo, setClassInfo] = useState(null);
    const [institutionName, setInstitutionName] = useState('');
    const [error, setError] = useState(null);
    
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        if (!classId) return;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);

                if (!subdomain) {
                  setClassInfo(null);
                  setError('Institution not found. Open this page from your institution link (?tenant=subdomain).');
                  return;
                }

                // Public RPCs only — do not call authenticated getClasses()
                const [classes, inst] = await Promise.all([
                  getPublicClassesBySubdomain(subdomain),
                  getPublicInstitutionBySubdomain(subdomain),
                ]);
                const cls = (classes || []).find((c) => c.id === classId);
                if (!cls) throw new Error('Class not found');

                setClassInfo({
                  ...cls,
                  is_active: cls.is_active !== false && cls.status !== 'inactive',
                  name: cls.name,
                  course: cls.course || { name: cls.name },
                });
                setInstitutionName(inst?.name || '');
                setFormConfig({ fields: DEFAULT_FIELDS });

                const prefillData: any = {};
                if (searchParams.get('name')) prefillData.name = searchParams.get('name');
                if (searchParams.get('email')) prefillData.email = searchParams.get('email');
                if (searchParams.get('phone')) prefillData.phone = searchParams.get('phone');
                if (searchParams.get('university_name')) prefillData.university_name = searchParams.get('university_name');
                if (searchParams.get('faculty')) prefillData.faculty = searchParams.get('faculty');
                if (searchParams.get('year')) prefillData.year = searchParams.get('year');
                setFormData(prefillData);
            } catch (err) {
                setClassInfo(null);
                notify.error(err, { context: 'PublicRegistrationPage - load', fallback: MESSAGES.LOAD_FAILED });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [classId, searchParams, subdomain]);

    const handleChange = (fieldId, value) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            if (!classInfo.is_active) {
                throw new Error("Registration cannot be submitted because the class is inactive.");
            }

            // Validate Required
            const missing = formConfig.fields
                .filter(f => f.required && !formData[f.id])
                .map(f => f.label);
            
            if (missing.length > 0) {
                throw new Error(`Please fill in required fields: ${missing.join(', ')}`);
            }

            // Option B: pending inquiry only. Duplicate email/inquiry enforced by RPC.
            if (!subdomain) throw new Error('INSTITUTION_NOT_FOUND');

            await submitGeneralRegistration({
                subdomain,
                class_id: classId,
                student_name: formData.name,
                student_email: formData.email,
                student_phone: formData.phone || null,
                university: formData.university_name || null,
                faculty: formData.faculty || null,
                year: formData.year || null,
                affiliate_id: affiliateFromLink || null,
            });

            toast({
              title: 'Application submitted',
              description: 'Your request is pending institution approval.',
            });
            setSuccess(true);
        } catch (err) {
            const msg = getUserMessage(err, { context: 'PublicRegistrationPage - submit', fallback: MESSAGES.UNEXPECTED });
            setError(msg);
            notify.error(err, { context: 'PublicRegistrationPage - submit', fallback: MESSAGES.UNEXPECTED });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-white h-8 w-8" /></div>;
    }

    if (!classInfo) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <h1 className="text-2xl font-bold text-red-500 mb-2">Class Not Found</h1>
                <p className="text-slate-400">The registration link is invalid or expired.</p>
            </div>
        );
    }

    if (classInfo.is_active === false) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <div className="h-16 w-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                    <AlertOctagon className="h-8 w-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Registration Closed</h1>
                <p className="text-slate-400 text-center max-w-md">
                    This class (<span className="text-white font-medium">{classInfo.name}</span>) is currently inactive and not accepting new registrations.
                </p>
            </div>
        );
    }

    if (success) {
        return (
             <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-slate-900 border-slate-800">
                    <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
                        <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle className="h-10 w-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Application received</h2>
                        <p className="text-slate-400 mb-6">
                            Thank you for applying to <strong>{classInfo.name}</strong>.
                            If approved, a welcome email with login details will be sent.
                            If not approved, you may submit again later.
                        </p>
                        <Button onClick={() => window.location.reload()}>Submit Another Response</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            <Helmet><title>Register for {classInfo.name}</title></Helmet>
            
            <div className="mb-8 text-center">
                 <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
                    <School className="h-8 w-8 text-white" />
                 </div>
                 <h1 className="text-3xl font-bold text-white">{classInfo.course?.name || 'Course Registration'}</h1>
                 <p className="text-slate-400 mt-2">Class: <span className="text-indigo-400 font-semibold">{classInfo.name}</span></p>
            </div>

            <Card className="w-full max-w-lg bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle>Student Registration</CardTitle>
                    <CardDescription>Please complete the form below to register.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-5">
                         {error && (
                            <Alert variant="destructive" className="bg-red-950/30 border-red-900/50 text-red-200">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Registration Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {formConfig.fields.map(field => (
                            <div key={field.id} className="space-y-2">
                                <Label htmlFor={field.id}>
                                    {field.label} 
                                    {field.required && <span className="text-red-500 ml-1">*</span>}
                                </Label>
                                {field.type === 'textarea' ? (
                                    <Textarea 
                                        id={field.id}
                                        required={field.required}
                                        value={formData[field.id] || ''}
                                        onChange={e => handleChange(field.id, e.target.value)}
                                        className="bg-slate-950 border-slate-700"
                                        placeholder={`Enter your ${field.label.toLowerCase()}...`}
                                    />
                                ) : (
                                    <Input 
                                        id={field.id}
                                        type={field.type}
                                        required={field.required}
                                        value={formData[field.id] || ''}
                                        onChange={e => handleChange(field.id, e.target.value)}
                                        className="bg-slate-950 border-slate-700"
                                        placeholder={`Enter your ${field.label.toLowerCase()}...`}
                                    />
                                )}
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter className="border-t border-slate-800 pt-6">
                        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                            {submitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                            ) : (
                                'Submit Registration'
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
            
            <div className="mt-8 text-center text-sm text-slate-500">
                &copy; {new Date().getFullYear()} {institutionName || 'Training Center'}
            </div>
        </div>
    );
};

export default PublicRegistrationPage;