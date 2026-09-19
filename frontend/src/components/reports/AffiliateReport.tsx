import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileDown, Share2, Users, DollarSign, Wallet, Copy, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getAffiliateCommissionRate, getTenantBaseUrl, rateToPercent } from '@/lib/institution';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import ManageRegistrationProgramsDialog from '@/components/admin/ManageRegistrationProgramsDialog';

/**
 * Affiliate attribution + earnings (tenant-scoped via RLS).
 * Affiliates are created from Users → Staff & Affiliates.
 * Admin sees institution-wide directory; staff/affiliates see only their own referrals.
 */
const AffiliateReport = () => {
  const {
    users,
    students,
    payments,
    enrollments,
    classes,
    affiliateSettlements = [],
    generalRegistrations = [],
  } = useData();
  const { user, institution } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin';
  const canManagePrograms = user?.role === 'admin' || user?.role === 'staff';
  const [manageAffiliateId, setManageAffiliateId] = useState(null);
  const ratePct = rateToPercent(getAffiliateCommissionRate(institution), 1);
  const referralLink = `${getTenantBaseUrl(institution)}/register${user?.id ? `?ref=${user.id}` : ''}`;

  const eligibleAffiliates = useMemo(() => {
    return (users || []).filter(
      (u) =>
        u.role === 'affiliate' &&
        (u.status === 'approved' || u.status === 'active' || !u.status),
    );
  }, [users]);

  const affiliateById = useMemo(() => {
    const map = new Map();
    for (const u of users || []) map.set(u.id, u);
    return map;
  }, [users]);

  /** Pending public registrations that arrived via a referral link (not yet approved students). */
  const pendingReferredInquiries = useMemo(() => {
    return (generalRegistrations || [])
      .filter((r) => r.status === 'pending' && r.affiliate_id)
      .map((r) => {
        const aff = affiliateById.get(r.affiliate_id);
        return {
          ...r,
          affiliateName: aff?.name || aff?.full_name || 'Unknown affiliate',
        };
      })
      .sort((a, b) => Number(new Date(b.submitted_at || b.created_at)) - Number(new Date(a.submitted_at || a.created_at)));
  }, [generalRegistrations, affiliateById]);

  const affiliateDirectory = useMemo(() => {
    return eligibleAffiliates
      .map((aff) => {
        const referred = students.filter((s) => s.affiliate_id === aff.id);
        const studentIds = new Set(referred.map((s) => s.id));
        const enrollmentIds = enrollments
          .filter((e) => studentIds.has(e.student_id))
          .map((e) => e.id);
        const paymentTotal = payments
          .filter(
            (p) =>
              enrollmentIds.includes(p.enrollment_id) &&
              p.status === 'completed' &&
              !p.is_registration_fee,
          )
          .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
        const earnings = (affiliateSettlements || [])
          .filter((s) => s.affiliate_id === aff.id)
          .reduce((sum: any, s: any) => sum + Number(s.amount || 0), 0);
        const pendingCount = (generalRegistrations || []).filter(
          (r) => r.status === 'pending' && r.affiliate_id === aff.id,
        ).length;
        const link = `${getTenantBaseUrl(institution)}/register?ref=${aff.id}`;

        return {
          id: aff.id,
          name: aff.name || aff.full_name || '—',
          email: aff.email || '',
          studentsCount: referred.length,
          pendingCount,
          paymentTotal,
          earnings,
          link,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [eligibleAffiliates, students, payments, enrollments, affiliateSettlements, institution, generalRegistrations]);

  const affiliateStats = useMemo(
    () =>
      affiliateDirectory
        .filter((a) => a.studentsCount > 0 || a.earnings > 0)
        .sort((a, b) => b.earnings - a.earnings || b.paymentTotal - a.paymentTotal),
    [affiliateDirectory],
  );

  // Personal referral stats (preserves former Affiliate / My Referrals page)
  const myStudents = useMemo(() => {
    if (!user) return [];
    return students
      .filter((s) => s.affiliate_id === user.id)
      .sort((a, b) => Number(new Date(b.registration_date)) - Number(new Date(a.registration_date)));
  }, [students, user]);

  const myReferredPaymentTotal = useMemo(() => {
    if (!user || myStudents.length === 0) return 0;
    const studentIds = new Set(myStudents.map((s) => s.id));
    const enrollmentIds = enrollments
      .filter((e) => studentIds.has(e.student_id))
      .map((e) => e.id);
    return payments
      .filter(
        (p) =>
          enrollmentIds.includes(p.enrollment_id) &&
          p.status === 'completed' &&
          !p.is_registration_fee,
      )
      .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
  }, [myStudents, enrollments, payments, user]);

  const myEarnings = useMemo(() => {
    if (!user) return 0;
    return (affiliateSettlements || [])
      .filter((s) => s.affiliate_id === user.id)
      .reduce((sum: any, s: any) => sum + Number(s.amount || 0), 0);
  }, [affiliateSettlements, user]);

  const myStudentRows = useMemo(() => {
    return myStudents.map((s) => {
      const studentEnrollments = enrollments.filter((e) => e.student_id === s.id);
      const enrollmentIds = studentEnrollments.map((e) => e.id);
      const paid = payments
        .filter((p) => enrollmentIds.includes(p.enrollment_id) && p.status === 'completed')
        .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
      const classNames = studentEnrollments
        .map((e) => classes.find((c) => c.id === e.class_id)?.name)
        .filter(Boolean)
        .join(', ');
      return { ...s, paid, classNames };
    });
  }, [myStudents, enrollments, payments, classes]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text('Affiliate Attribution Report', 14, 20);

    const tableRows = affiliateDirectory.map((a) => [
      a.name,
      a.email,
      a.studentsCount,
      formatCurrency(a.paymentTotal),
      formatCurrency(a.earnings),
    ]);

    doc.autoTable({
      startY: 30,
      head: [['Affiliate', 'Email', 'Referred Students', 'Referred Payments', 'Commission Earned']],
      body: tableRows,
    });
    doc.save('Affiliate_Report.pdf');
  };

  const totalReferred = affiliateDirectory.reduce((sum: any, a: any) => sum + a.studentsCount, 0);
  const totalPayments = affiliateDirectory.reduce((sum: any, a: any) => sum + a.paymentTotal, 0);
  const totalEarnings = affiliateDirectory.reduce((sum: any, a: any) => sum + a.earnings, 0);

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast({ title: 'Copied', description: 'Referral link copied.' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
          Institution affiliate rate: <span className="text-[var(--ds-text-primary,#122018)] font-mono">{ratePct.toFixed(1)}%</span>
          {ratePct <= 0 ? ' (set in Institution Settings to enable commission)' : null}
          {isAdmin ? (
            <>
              {' · '}
              Create affiliates in{' '}
              <Link to="/admin/users" className="text-[var(--ds-info,#2563EB)] hover:underline">
                Users → Staff & Affiliates
              </Link>
            </>
          ) : null}
        </p>
        {isAdmin ? (
          <Button onClick={generatePDF} variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        ) : null}
      </div>

      {!isAdmin ? (
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">My Referred Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--ds-text-primary,#122018)] flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--ds-info,#2563EB)]" /> {myStudents.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">My Referred Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--ds-text-primary,#122018)] flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-[var(--ds-accent,#1F8A5B)]" /> {formatCurrency(myReferredPaymentTotal)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">My Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--ds-warning,#C2410C)] flex items-center gap-2">
              <Wallet className="h-5 w-5" /> {formatCurrency(myEarnings)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">My Referral Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono text-violet-700 break-all flex items-start gap-2">
              <Share2 className="h-4 w-4 shrink-0 mt-0.5" /> {referralLink}
            </div>
          </CardContent>
        </Card>
      </div>
      ) : null}

      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">All Referred Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-500">{totalReferred}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">Referred Payment Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(totalPayments)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">Commission Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{formatCurrency(totalEarnings)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">Active Affiliates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{eligibleAffiliates.length}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!isAdmin ? (
      <Card>
        <CardHeader>
          <CardTitle>My Referred Students</CardTitle>
          <CardDescription>Students linked to your profile via affiliate attribution.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Student</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Registered</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Classes</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Payments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myStudentRows.length > 0 ? (
                myStudentRows.map((s) => (
                  <TableRow key={s.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                    <TableCell>
                      <div className="font-medium text-[var(--ds-text-primary,#122018)]">{s.name}</div>
                      <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">{s.email}</div>
                    </TableCell>
                    <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{formatDate(s.registration_date)}</TableCell>
                    <TableCell className="text-[var(--ds-text-secondary,#5B6B61)] text-sm">{s.classNames || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-[var(--ds-accent,#1F8A5B)]">
                      {formatCurrency(s.paid)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-[var(--ds-text-tertiary,#8A978E)]">
                    No referred students yet. Share your referral link or attribute referrals when registering students.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      ) : null}

      {isAdmin && pendingReferredInquiries.length > 0 ? (
        <Card className="border-l-4 border-l-[var(--ds-warning,#C2410C)]">
          <CardHeader>
            <CardTitle className="text-[var(--ds-warning,#C2410C)]">Pending Referral Applications</CardTitle>
            <CardDescription>
              Older referral applications waiting for approval in Online Forms.
              New Referral Link registrations create the student account immediately
              (with affiliate attribution). Commission is earned on completed tuition payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Applicant</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Affiliate</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Submitted</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReferredInquiries.map((r) => (
                  <TableRow key={r.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                    <TableCell>
                      <div className="font-medium text-[var(--ds-text-primary,#122018)]">{r.student_name || r.full_name}</div>
                      <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">{r.student_email || r.email}</div>
                    </TableCell>
                    <TableCell className="text-violet-700">{r.affiliateName}</TableCell>
                    <TableCell className="text-[var(--ds-text-secondary,#5B6B61)] text-sm">
                      {formatDate(r.submitted_at || r.created_at)}
                    </TableCell>
                    <TableCell className="text-right text-[var(--ds-warning,#C2410C)] text-sm">Pending approval</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {canManagePrograms ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Affiliates</CardTitle>
              <CardDescription>
                Create affiliates with the button above. They do not appear in System Users.
                Share each referral link so students register under that affiliate.
                Use Manage to choose which programs appear on that affiliate’s registration form.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Email</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Students</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Pending</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Commission</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Referral Link</TableHead>
                  {canManagePrograms ? <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Programs</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliateDirectory.length > 0 ? (
                  affiliateDirectory.map((a) => (
                    <TableRow key={a.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                      <TableCell className="font-medium text-[var(--ds-text-primary,#122018)]">{a.name}</TableCell>
                      <TableCell className="text-[var(--ds-text-secondary,#5B6B61)] text-sm">{a.email || '—'}</TableCell>
                      <TableCell className="text-right">{a.studentsCount}</TableCell>
                      <TableCell className="text-right text-[var(--ds-warning,#C2410C)]">{a.pendingCount || 0}</TableCell>
                      <TableCell className="text-right text-[var(--ds-warning,#C2410C)]">{formatCurrency(a.earnings)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[280px]">
                          <span className="text-xs font-mono text-violet-700 truncate">{a.link}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => copyLink(a.link)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      {canManagePrograms ? (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="hover:bg-[var(--ds-surface-muted,#F7FAF8)]"
                            onClick={() => setManageAffiliateId(a.id)}
                          >
                            <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                            Manage
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={canManagePrograms ? 7 : 6} className="text-center py-8 text-[var(--ds-text-tertiary,#8A978E)]">
                      No affiliates yet. Create them from Users → Staff & Affiliates.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {isAdmin && affiliateStats.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Affiliate Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Affiliate</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Students</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Payments</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliateStats.map((a) => (
                  <TableRow key={a.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-right">{a.studentsCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(a.paymentTotal)}</TableCell>
                    <TableCell className="text-right text-amber-500">{formatCurrency(a.earnings)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <ManageRegistrationProgramsDialog
        open={Boolean(manageAffiliateId)}
        onOpenChange={(open) => {
          if (!open) setManageAffiliateId(null);
        }}
        affiliateId={manageAffiliateId}
        title="Manage Affiliate Programs"
        description="Choose which courses and diplomas students can pick on this affiliate’s referral registration form."
      />
    </div>
  );
};

export default AffiliateReport;
