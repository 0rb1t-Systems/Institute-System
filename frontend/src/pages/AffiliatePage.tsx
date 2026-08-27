import React, { useMemo, useState } from 'react';
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
import {
  buildAffiliateStudentMonthRows,
  filterSettlementsForMonth,
  monthKeyFromDate,
} from '@/lib/affiliateMonthTracking';

const statusBadge = (status: string) => {
  if (status === 'paid') {
    return <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">Paid</Badge>;
  }
  if (status === 'partial') {
    return <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">Partial</Badge>;
  }
  return <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">Unpaid</Badge>;
};

/**
 * Affiliate dashboard — referred students paid vs unpaid for a selected month,
 * plus commission earned on those payments.
 */
const AffiliatePage = () => {
  const { user, institution } = useAuth();
  const { students, payments, enrollments, classes, affiliateSettlements = [] } = useData();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [statusTab, setStatusTab] = useState('all');

  const ratePct = rateToPercent(getAffiliateCommissionRate(institution), 1);
  const referralLink = `${getTenantBaseUrl(institution)}/register${user?.id ? `?ref=${user.id}` : ''}`;
  const monthKey = monthKeyFromDate(selectedDate);
  const monthLabel = format(selectedDate, 'MMMM yyyy');

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

  const billedRows = useMemo(
    () => monthRows.filter((r) => r.billedThisMonth),
    [monthRows],
  );

  const listSource = billedRows.length > 0 ? billedRows : monthRows;

  const visibleRows = useMemo(() => {
    if (statusTab === 'paid') return listSource.filter((r) => r.status === 'paid');
    if (statusTab === 'unpaid') return listSource.filter((r) => r.status === 'unpaid' || r.status === 'partial');
    return listSource;
  }, [listSource, statusTab]);

  const paidCount = listSource.filter((r) => r.status === 'paid').length;
  const unpaidCount = listSource.filter((r) => r.status !== 'paid').length;

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
          subtitle="Track referred students who paid this month, who still owe, and your commission."
        />
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            Billing month
          </span>
          <MonthYearSelector selectedDate={selectedDate} onChange={setSelectedDate} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 mb-8">
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
            <CardTitle className="text-sm font-medium text-slate-400">Paid in {format(selectedDate, 'MMM')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> {paidCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">Fully paid for {monthLabel}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Unpaid in {format(selectedDate, 'MMM')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> {unpaidCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">Unpaid or partial for {monthLabel}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Commission ({format(selectedDate, 'MMM')})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400 flex items-center gap-2">
              <Wallet className="h-5 w-5" /> {formatCurrency(monthCommission)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Lifetime {formatCurrency(lifetimeCommission)} · Rate {ratePct.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800 mb-8">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-purple-400" /> Referral Link
            </CardTitle>
            <CardDescription>Students who register with this link are attributed to you.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            <Copy className="h-4 w-4 mr-2" /> Copy
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs font-mono text-purple-400 break-all">{referralLink}</p>
        </CardContent>
      </Card>

      <Tabs value={statusTab} onValueChange={setStatusTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="all">All ({listSource.length})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({paidCount})</TabsTrigger>
            <TabsTrigger value="unpaid">Unpaid ({unpaidCount})</TabsTrigger>
          </TabsList>
          <Button asChild variant="outline" size="sm">
            <Link to="/affiliate/earnings">
              <DollarSign className="h-4 w-4 mr-2" /> View earnings
            </Link>
          </Button>
        </div>

        <TabsContent value={statusTab} className="mt-0">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle>Students — {monthLabel}</CardTitle>
              <CardDescription>
                Tuition status for the selected month. Commission is earned when a referred student completes a tuition payment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead>Student</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Classes</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Your share</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.length > 0 ? (
                    visibleRows.map((s) => (
                      <TableRow key={s.id} className="border-slate-800 hover:bg-slate-800/50">
                        <TableCell>
                          <div className="font-medium text-slate-200">{s.name}</div>
                          <div className="text-xs text-slate-500">{s.email}</div>
                        </TableCell>
                        <TableCell className="text-slate-400">{formatDate(s.registration_date)}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{s.classNames}</TableCell>
                        <TableCell className="text-right font-mono text-slate-300">
                          {formatCurrency(s.dueAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-400">
                          {formatCurrency(s.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-400">
                          {formatCurrency(s.commission)}
                        </TableCell>
                        <TableCell className="text-right">{statusBadge(s.status)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
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
