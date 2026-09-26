import React, { useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatCard from '@/components/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileDown, Share2, Users, DollarSign, Wallet, Copy, ListChecks, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getAffiliateCommissionRate, getTenantBaseUrl, rateToPercent } from '@/lib/institution';
import { useToast } from '@/components/ui/use-toast';
import ManageRegistrationProgramsDialog from '@/components/admin/ManageRegistrationProgramsDialog';

const thClass =
  'text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]';

const kpiIcon = (Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>) => (
  <Icon className="h-5 w-5" strokeWidth={1.75} />
);

/**
 * Affiliate attribution + earnings (tenant-scoped via RLS).
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
      .sort(
        (a, b) =>
          Number(new Date(b.submitted_at || b.created_at)) -
          Number(new Date(a.submitted_at || a.created_at)),
      );
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
  }, [
    eligibleAffiliates,
    students,
    payments,
    enrollments,
    affiliateSettlements,
    institution,
    generalRegistrations,
  ]);

  const myStudents = useMemo(() => {
    if (!user) return [];
    return students
      .filter((s) => s.affiliate_id === user.id)
      .sort(
        (a, b) =>
          Number(new Date(b.registration_date)) - Number(new Date(a.registration_date)),
      );
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
      head: [['Affiliate', 'Email', 'Students', 'Payments', 'Commission']],
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
          Rate:{' '}
          <span className="font-mono font-semibold text-[var(--ds-text-primary,#122018)]">
            {ratePct.toFixed(1)}%
          </span>
        </p>
        {isAdmin ? (
          <Button onClick={generatePDF} variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        ) : null}
      </div>

      {!isAdmin ? (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Students"
            value={myStudents.length}
            icon={kpiIcon(Users)}
            tone="info"
          />
          <StatCard
            title="Payments"
            value={formatCurrency(myReferredPaymentTotal)}
            icon={kpiIcon(DollarSign)}
            tone="primary"
          />
          <StatCard
            title="Commission"
            value={formatCurrency(myEarnings)}
            icon={kpiIcon(Wallet)}
            tone="warning"
          />
          <Card className="overflow-hidden rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
              <CardTitle className="text-[12px] font-semibold leading-none text-[var(--ds-text-secondary,#5B6B61)]">
                Referral Link
              </CardTitle>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ds-radius-lg,12px)] bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)]">
                <Share2 className="h-5 w-5" strokeWidth={1.75} />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                  {referralLink}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copyLink(referralLink)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            title="Students"
            value={totalReferred}
            icon={kpiIcon(Users)}
            tone="info"
            description="Referred students"
          />
          <StatCard
            title="Payments"
            value={formatCurrency(totalPayments)}
            icon={kpiIcon(DollarSign)}
            tone="primary"
            description="Payment volume"
            descriptionTone="accent"
          />
          <StatCard
            title="Commission"
            value={formatCurrency(totalEarnings)}
            icon={kpiIcon(Wallet)}
            tone="warning"
            description="Earned commission"
            descriptionTone="warning"
          />
          <StatCard
            title="Affiliates"
            value={eligibleAffiliates.length}
            icon={kpiIcon(UserPlus)}
            tone="info"
            description="Active affiliates"
          />
        </div>
      )}

      {!isAdmin ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>My Referred Students</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                  <TableHead className={thClass}>Student</TableHead>
                  <TableHead className={thClass}>Registered</TableHead>
                  <TableHead className={thClass}>Classes</TableHead>
                  <TableHead className={`text-right ${thClass}`}>Payments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myStudentRows.length > 0 ? (
                  myStudentRows.map((s) => (
                    <TableRow
                      key={s.id}
                      className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]"
                    >
                      <TableCell>
                        <div className="font-medium text-[var(--ds-text-primary,#122018)]">
                          {s.name}
                        </div>
                        <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                          {s.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">
                        {formatDate(s.registration_date)}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                        {s.classNames || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[var(--ds-accent,#1F8A5B)]">
                        {formatCurrency(s.paid)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-[var(--ds-text-tertiary,#8A978E)]"
                    >
                      No referred students yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {isAdmin && pendingReferredInquiries.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Pending Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                  <TableHead className={thClass}>Applicant</TableHead>
                  <TableHead className={thClass}>Affiliate</TableHead>
                  <TableHead className={thClass}>Submitted</TableHead>
                  <TableHead className={`text-right ${thClass}`}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingReferredInquiries.map((r) => (
                  <TableRow
                    key={r.id}
                    className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]"
                  >
                    <TableCell>
                      <div className="font-medium text-[var(--ds-text-primary,#122018)]">
                        {r.student_name || r.full_name}
                      </div>
                      <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                        {r.student_email || r.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-violet-700">{r.affiliateName}</TableCell>
                    <TableCell className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                      {formatDate(r.submitted_at || r.created_at)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-[var(--ds-warning,#C2410C)]">
                      Pending
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {canManagePrograms ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Affiliates</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                  <TableHead className={thClass}>Name</TableHead>
                  <TableHead className={thClass}>Email</TableHead>
                  <TableHead className={`text-right ${thClass}`}>Students</TableHead>
                  <TableHead className={`text-right ${thClass}`}>Pending</TableHead>
                  <TableHead className={`text-right ${thClass}`}>Payments</TableHead>
                  <TableHead className={`text-right ${thClass}`}>Commission</TableHead>
                  <TableHead className={thClass}>Referral Link</TableHead>
                  {canManagePrograms ? (
                    <TableHead className={`text-right ${thClass}`}>Programs</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliateDirectory.length > 0 ? (
                  affiliateDirectory.map((a) => (
                    <TableRow
                      key={a.id}
                      className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]"
                    >
                      <TableCell className="font-medium text-[var(--ds-text-primary,#122018)]">
                        {a.name}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                        {a.email || '—'}
                      </TableCell>
                      <TableCell className="text-right">{a.studentsCount}</TableCell>
                      <TableCell className="text-right text-[var(--ds-warning,#C2410C)]">
                        {a.pendingCount || 0}
                      </TableCell>
                      <TableCell className="text-right text-[var(--ds-accent,#1F8A5B)]">
                        {formatCurrency(a.paymentTotal)}
                      </TableCell>
                      <TableCell className="text-right text-[var(--ds-warning,#C2410C)]">
                        {formatCurrency(a.earnings)}
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[240px] items-center gap-2">
                          <span className="truncate font-mono text-xs text-violet-700">
                            {a.link}
                          </span>
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
                            onClick={() => setManageAffiliateId(a.id)}
                          >
                            <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                            Manage
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={canManagePrograms ? 8 : 7}
                      className="py-8 text-center text-[var(--ds-text-tertiary,#8A978E)]"
                    >
                      No affiliates yet.
                    </TableCell>
                  </TableRow>
                )}
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
        description="Programs on this affiliate’s registration form."
      />
    </div>
  );
};

export default AffiliateReport;
