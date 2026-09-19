import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Link as LinkIcon, Copy, ExternalLink, Globe, ListChecks } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GeneralRegistrationsList from '@/components/admin/GeneralRegistrationsList';
import ManageRegistrationProgramsDialog from '@/components/admin/ManageRegistrationProgramsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { getTenantBaseUrl } from '@/lib/institution';

const OnlineFormsPage = () => {
    const { toast } = useToast();
    const { institution } = useAuth();
    const [manageOpen, setManageOpen] = useState(false);
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
        <AnimatedPage>
            <Helmet><title>Online Forms | Portal</title></Helmet>

            <div className="space-y-8">
            <PageHeader
                title="Online Registration"
                subtitle="Manage public registration links and approve student submissions."
            />

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)]">
                                    <Globe className="h-5 w-5 text-[var(--ds-accent,#1F8A5B)]" />
                                </div>
                                <div>
                                    <CardTitle>General Registration Portal</CardTitle>
                                    <CardDescription>
                                        Share this link so students can register{' '}
                                        <span className="font-medium text-[var(--ds-text-primary,#122018)]">without an affiliate</span>.
                                        Affiliate Referral Links add{' '}
                                        <code className="font-mono text-[var(--ds-accent,#1F8A5B)]">?ref=…</code> only when you want commission attribution.
                                    </CardDescription>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="shrink-0"
                                onClick={() => setManageOpen(true)}
                            >
                                <ListChecks className="mr-2 h-4 w-4" />
                                Manage Programs
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Shareable Link (no affiliate)</Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-[var(--ds-text-tertiary,#8A978E)]" />
                                    <Input
                                        readOnly
                                        value={generalLink}
                                        className="pl-9 font-mono text-sm"
                                    />
                                </div>
                                <Button onClick={copyLink} className="shrink-0">
                                    <Copy className="mr-2 h-4 w-4" /> Copy Link
                                </Button>
                                <Button variant="outline" onClick={() => window.open(generalLink, '_blank')} className="shrink-0">
                                    <ExternalLink className="h-4 w-4" /> Open
                                </Button>
                            </div>
                            <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                                Use{' '}
                                <span className="font-medium text-[var(--ds-text-secondary,#5B6B61)]">Manage Programs</span>{' '}
                                to choose which courses and diplomas appear in the student’s Preferred Class dropdown.
                                Submissions create a pending registration request. Admin or Staff must approve before a student account is created and enrolled.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <GeneralRegistrationsList />

            <ManageRegistrationProgramsDialog
                open={manageOpen}
                onOpenChange={setManageOpen}
            />
            </div>
        </AnimatedPage>
    );
};

export default OnlineFormsPage;
