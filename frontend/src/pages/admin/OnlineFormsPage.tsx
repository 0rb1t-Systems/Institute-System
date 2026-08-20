import React from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Link as LinkIcon, Copy, ExternalLink, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GeneralRegistrationsList from '@/components/admin/GeneralRegistrationsList';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantBaseUrl } from '@/lib/institution';

const OnlineFormsPage = () => {
    const { toast } = useToast();
    const { institution } = useAuth();
    const subdomain = institution?.subdomain || '';
    const generalLink = subdomain
        ? `${getTenantBaseUrl(institution)}/register`
        : `${window.location.origin}/register`;

    const copyLink = () => {
        navigator.clipboard.writeText(generalLink);
        toast({
            title: "Link Copied",
            description: "General registration link copied to clipboard."
        });
    };

    return (
        <div className="space-y-8 p-6">
            <Helmet><title>Online Forms | Portal</title></Helmet>
            
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Online Registration</h1>
                <p className="text-slate-400">Manage public registration links and approve student submissions.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-slate-900 border-slate-800 md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Globe className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <CardTitle>General Registration Portal</CardTitle>
                                <CardDescription>
                                    Share this link so students can register <span className="text-white">without an affiliate</span>.
                                    Affiliate Referral Links add <code className="text-purple-400">?ref=…</code> only when you want commission attribution.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Shareable Link (no affiliate)</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                                    <Input 
                                        readOnly 
                                        value={generalLink} 
                                        className="pl-9 bg-slate-950 border-slate-700 text-slate-300 font-mono text-sm"
                                    />
                                </div>
                                <Button onClick={copyLink} className="shrink-0">
                                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                                </Button>
                                <Button variant="outline" onClick={() => window.open(generalLink, '_blank')} className="shrink-0">
                                    <ExternalLink className="h-4 w-4" /> Open
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Submissions create a pending registration request. Admin or Staff must approve before a student account is created and enrolled.
                                Use an Affiliate Referral Link (<code className="text-purple-400">?ref=…</code>) only when the student should be attributed for commission.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* List of Registrations */}
            <GeneralRegistrationsList />
            
        </div>
    );
};

export default OnlineFormsPage;
