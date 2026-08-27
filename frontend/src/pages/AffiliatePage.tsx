import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Users, DollarSign, Share2, Wallet, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { getAffiliateCommissionRate, getTenantBaseUrl, rateToPercent } from '@/lib/institution';
import { useToast } from '@/components/ui/use-toast';
import MonthYearSelector from '@/components/instructor/MonthYearSelector';
import { dashboardStyles } from '@/components/instructor/InstructorDashboardStyles';
import {
  buildAffiliateStudentMonthRows,
  filterSettlementsForMonth,
  formatMonthKey,
  latestBillingMonthDate,
  monthKeyFromDate,
} from '@/lib/affiliateMonthTracking';

const statusBadge = (status: string) => {
  if (status === 'paid') {
    return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/20">Paid</Badge>;
  }
  if (status === 'partial') {
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20">Partial</Badge>;
  }
  if (status === 'not_due') {
    return <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-300 hover:bg-slate-500/20">Not billed</Badge>;
  }
  return <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/20">Unpaid</Badge>;
};

const AffiliatePage = () => {
  const { user, institution } = useAuth();
  const { students, payments, enrollments, classes, affiliateSettlements = [] } = useData();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [statusTab, setStatusTab] = useState('all');
  const monthInitialized = useRef(false);

  const ratePct = rateToPercent(getAffiliateCommissionRate(institution), 1);
  const referralLink = `${getTenantBaseUrl(institution)}/register${user?.id ? `?ref=${user.id}` : ''}`;
  const monthKey = monthKeyFromDate(selectedDate);
  const monthLabel = format(selectedDate, 'MMMM yyyy');

  useEffect(() => {
    if (monthInitialized.current || !user?.id) return;
    const latest = latestBillingMonthDate({
      students,
      payments,
      settlements: affiliateSettlements,
      affiliateId: user.id,
    });
    if (latest) {
      setSelectedDate(latest);
      monthInitialized.current = true;
    } else if ((payments || []).length > 0 || (affiliateSettlements || []).length > 0) {
      monthInitialized.current = true;
    }
  }, [students, payments, affiliateSettlements, user?.id]);

  const myStudents = useMemo(() => {
    if (!user) return [];
    return students.filter((s) => s.affiliate_id === user.id);
  }, [students, user]);

  const monthRows = useMemo(
    () =>
      buildAffiliateStudentMonthRows({
        students,
        enrollments,
        classes,
        payments,
        settlements: affiliateSettlements,
        affiliateId: user?.id,
        monthKey,
      }),
    [students, enrollments, classes, payments, affiliateSettlements, user?.id, monthKey],
  );

  const visibleRows = useMemo(() => {
    if (statusTab === 'paid') return monthRows.filter((r) => r.status === 'paid');
    if (statusTab === 'unpaid') return monthRows.filter((r) => r.status === 'unpaid' || r.status === 'partial');
    return monthRows;
  }, [monthRows, statusTab]);

  const paidCount = monthRows.filter((r) => r.status === 'paid').length;
  const unpaidCount = monthRows.filter((r) => r.status === 'unpaid' || r.status === 'partial').length;

  const monthSettlements = useMemo(
    () => filterSettlementsForMonth(affiliateSettlements, user?.id, monthKey, payments),
    [affiliateSettlements, user?.id, monthKey, payments],
  );

  const monthCommission = useMemo(
    () => monthSettlements.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0),
    [monthSettlements],
  );

  const lifetimeCommission = useMemo(() => {
    if (!user) return 0;
    return (affiliateSettlements || [])
      .filter((s) => s.affiliate_id === user.id)
      .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
  }, [affiliateSettlements, user]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: 'Copied', description: 'Referral link copied.' });
  };

  return (
    <AnimatedPage>
      <Helmet><title>Affiliate Dashboard - Portal</title></Helmet>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-2">
        <PageHeader
          title="Affiliate Dashboard"
          subtitle="See which months each referred student paid, and the commission you can withdraw."
        />
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-[var(--tenant-muted)] font-medium uppercase tracking-wider">
            Billing month
          </span>
          <MonthYearSelector selectedDate={selectedDate} onChange={setSelectedDate} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 mb-8">
        <Card className={dashboardStyles.card}>
          <CardHeader className="pb-2 p-0">
            <CardTitle className={dashboardStyles.metricLabel}>Referred Students</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className={`${dashboardStyles.metricValue} flex items-center gap-2`}>
              <Users className="h-5 w-5 text-blue-500" /> {myStudents.length}
            </div>
          </CardContent>
        </Card>
        <Card className={dashboardStyles.card}>
          <CardHeader className="pb-2 p-0">
            <CardTitle className={dashboardStyles.metricLabel}>Paid in {format(selectedDate, 'MMM')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> {paidCount}
            </div>
            <p className="text-xs text-[var(--tenant-muted)] mt-1">Fully paid for {monthLabel}</p>
          </CardContent>
        </Card>
        <Card className={dashboardStyles.card}>
          <CardHeader className="pb-2 p-0">
            <CardTitle className={dashboardStyles.metricLabel}>Unpaid in {format(selectedDate, 'MMM')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {unpaidCount}
            </div>
            <p className="text-xs text-[var(--tenant-muted)] mt-1">Unpaid or partial for {monthLabel}</p>
          </CardContent>
        </Card>
        <Card className={dashboardStyles.card}>
          <CardHeader className="pb-2 p-0">
            <CardTitle className={dashboardStyles.metricLabel}>Commission ({format(selectedDate, 'MMM')})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Wallet className="h-5 w-5" /> {formatCurrency(monthCommission)}
            </div>
            <p className="text-xs text-[var(--tenant-muted)] mt-1">
              Lifetime {formatCurrency(lifetimeCommission)} · Rate {ratePct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className={`${dashboardStyles.card} mb-8`}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 p-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-[var(--tenant-text)]">
              <Share2 className="h-4 w-4 text-purple-500" /> Referral Link
            </CardTitle>
            <CardDescription>Students who register with this link are attributed to you.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <p className="text-xs font-mono text-purple-600 dark:text-purple-400 break-all">{referralLink}</p>
        </CardContent>
      </Card>

      <Tabs value={statusTab} onValueChange={setStatusTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="all">All ({monthRows.length})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({paidCount})</TabsTrigger>
            <TabsTrigger value="unpaid">Unpaid ({unpaidCount})</TabsTrigger>
          </TabsList>
          <Button asChild variant="outline" size="sm">
            <Link to="/affiliate/earnings">
              <DollarSign className="h-4 w-4 mr-2" /> Withdraw earnings
            </Link>
          </Button>
        </div>

        <TabsContent value={statusTab} className="mt-0">
          <Card className={dashboardStyles.card}>
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-[var(--tenant-text)]">Students — {monthLabel}</CardTitle>
              <CardDescription>
                Status is for the selected billing month. Paid months lists every month this student has already paid.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead>Paid months</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Your share</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.length > 0 ? (
                    visibleRows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium text-[var(--tenant-text)]">{s.name}</div>
                          <div className="text-xs text-[var(--tenant-muted)]">{s.email}</div>
                          <div className="text-xs text-[var(--tenant-muted)]">{formatDate(s.registration_date)}</div>
                        </TableCell>
                        <TableCell className="text-sm text-[var(--tenant-text)]">{s.classNames}</TableCell>
                        <TableCell>
                          {s.paidMonths?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {s.paidMonths.map((m) => (
                                <Badge
                                  key={m}
                                  variant="outline"
                                  className="text-[10px] font-normal"
                                >
                                  {formatMonthKey(m)}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--tenant-muted)]">None yet</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[var(--tenant-text)]">
                          {formatCurrency(s.dueAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                          {formatCurrency(s.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600 dark:text-amber-400">
                          {formatCurrency(s.commission)}
                        </TableCell>
                        <TableCell className="text-right">{statusBadge(s.status)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-[var(--tenant-muted)]">
                        {myStudents.length === 0
                          ? 'No referred students yet. Share your referral link.'
                          : `No students in this list for ${monthLabel}.`}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
};

export default AffiliatePage;
