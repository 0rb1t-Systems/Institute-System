import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Users, DollarSign, Share2, Wallet } from 'lucide-react';
import { getAffiliateCommissionRate, getTenantBaseUrl, rateToPercent } from '@/lib/institution';

/**
 * Personal affiliate portal — own referrals + commission only (tenant-scoped).
 */
const AffiliatePage = () => {
  const { user, institution } = useAuth();
  const { students, payments, enrollments, classes, affiliateSettlements = [] } = useData();
  const ratePct = rateToPercent(getAffiliateCommissionRate(institution), 1);
  const referralLink = `${getTenantBaseUrl(institution)}/register?tenant=${encodeURIComponent(institution?.subdomain || '')}&ref=${user?.id || ''}`;

  const myStudents = useMemo(() => {
    if (!user) return [];
    return students
      .filter((s) => s.affiliate_id === user.id)
      .sort((a, b) => Number(new Date(b.registration_date)) - Number(new Date(a.registration_date)));
  }, [students, user]);

  const referredPaymentTotal = useMemo(() => {
    if (!user || myStudents.length === 0) return 0;
    const studentIds = new Set(myStudents.map((s) => s.id));
    const enrollmentIds = enrollments
      .filter((e) => studentIds.has(e.student_id))
      .map((e) => e.id);
    return payments
      .filter((p) => enrollmentIds.includes(p.enrollment_id) && p.status === 'completed')
      .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
  }, [myStudents, enrollments, payments, user]);

  const myEarnings = useMemo(() => {
    if (!user) return 0;
    return (affiliateSettlements || [])
      .filter((s) => s.affiliate_id === user.id)
      .reduce((sum: any, s: any) => sum + Number(s.amount || 0), 0);
  }, [affiliateSettlements, user]);

  const studentRows = useMemo(() => {
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

  return (
    <AnimatedPage>
      <Helmet><title>Affiliate Referrals - Portal</title></Helmet>
      <PageHeader
        title="My Referrals"
        subtitle="Students attributed to you at registration, payment activity, and commission earnings."
      />

      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Referred Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" /> {myStudents.length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Referred Payment Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500 flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> {formatCurrency(referredPaymentTotal)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Commission Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              <Wallet className="h-5 w-5" /> {formatCurrency(myEarnings)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Rate: {ratePct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Referral Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono text-purple-400 break-all flex items-start gap-2">
              <Share2 className="h-4 w-4 shrink-0 mt-0.5" /> {referralLink}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle>Referred Students</CardTitle>
          <CardDescription>Students linked to your profile via affiliate attribution.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead>Student</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead className="text-right">Payments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studentRows.length > 0 ? (
                studentRows.map((s) => (
                  <TableRow key={s.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="font-medium text-slate-200">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.email}</div>
                    </TableCell>
                    <TableCell className="text-slate-400">{formatDate(s.registration_date)}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{s.classNames || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-green-400">
                      {formatCurrency(s.paid)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    No referred students yet. Share your referral link or attribute referrals when registering students.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AnimatedPage>
  );
};

export default AffiliatePage;
