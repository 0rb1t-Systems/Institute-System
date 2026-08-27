import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { format } from 'date-fns';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RefreshCw, Wallet, Banknote, AlertCircle } from 'lucide-react';
import { getAffiliateCommissionRate, rateToPercent } from '@/lib/institution';
import MonthYearSelector from '@/components/instructor/MonthYearSelector';
import { dashboardStyles } from '@/components/instructor/InstructorDashboardStyles';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import {
  filterSettlementsForMonth,
  formatMonthKey,
  monthKeyFromDate,
  paymentMonthKey,
} from '@/lib/affiliateMonthTracking';

const AffiliateEarningsPage = () => {
  const { user, institution } = useAuth();
  const {
    students,
    payments,
    classes,
    affiliateSettlements = [],
    withdrawalRequests = [],
    createWithdrawal,
    refreshData,
    loading,
  } = useData();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthFilter, setMonthFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('earnings');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [method, setMethod] = useState('EVC Plus');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ratePct = rateToPercent(getAffiliateCommissionRate(institution), 1);
  const monthKey = monthKeyFromDate(selectedDate);
  const monthLabel = format(selectedDate, 'MMMM yyyy');

  const mySettlements = useMemo(() => {
    if (!user) return [];
    return (affiliateSettlements || [])
      .filter((s) => s.affiliate_id === user.id)
      .sort((a, b) => Number(new Date(b.created_at)) - Number(new Date(a.created_at)));
  }, [affiliateSettlements, user]);

  const visibleSettlements = useMemo(() => {
    if (monthFilter !== 'month') return mySettlements;
    return filterSettlementsForMonth(mySettlements, user?.id, monthKey, payments);
  }, [mySettlements, monthFilter, user?.id, monthKey, payments]);

  const lifetime = useMemo(
    () => mySettlements.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0),
    [mySettlements],
  );

  const shownTotal = useMemo(
    () => visibleSettlements.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0),
    [visibleSettlements],
  );

  const myWithdrawals = useMemo(
    () =>
      (withdrawalRequests || [])
        .filter((w) => w.affiliate_id === user?.id)
        .sort((a, b) => Number(new Date(b.requested_at)) - Number(new Date(a.requested_at))),
    [withdrawalRequests, user?.id],
  );

  const totalPending = useMemo(
    () =>
      myWithdrawals
        .filter((w) => w.status === 'pending')
        .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0),
    [myWithdrawals],
  );

  const totalApproved = useMemo(
    () =>
      myWithdrawals
        .filter((w) => w.status === 'approved' || w.status === 'paid')
        .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0),
    [myWithdrawals],
  );

  const availableBalance = Math.max(0, lifetime - totalApproved - totalPending);

  const rows = useMemo(() => {
    return visibleSettlements.map((s) => {
      const student = students.find((st) => st.id === s.student_id);
      const cls = classes.find((c) => c.id === s.class_id);
      const payment = payments.find((p) => p.id === s.payment_id);
      const billingMonth = payment ? paymentMonthKey(payment) : null;
      return {
        id: s.id,
        date: s.created_at,
        studentName: student?.name || student?.full_name || 'Unknown student',
        studentEmail: student?.email || '',
        className: cls?.name || '—',
        billingMonth,
        paymentAmount: payment ? Number(payment.amount || 0) : null,
        earned: Number(s.amount || 0),
      };
    });
  }, [visibleSettlements, students, classes, payments]);

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      notify.validation(MESSAGES.VALIDATION.AMOUNT);
      return;
    }
    if (amount > availableBalance) {
      notify.validation(`You can only withdraw up to ${formatCurrency(availableBalance)}.`);
      return;
    }
    if (!details.trim()) {
      notify.validation(MESSAGES.VALIDATION.REQUIRED);
      return;
    }

    setIsSubmitting(true);
    try {
      await createWithdrawal({
        affiliate_id: user.id,
        amount,
        status: 'pending',
        method,
        payment_details: details,
      });
      toast({
        title: 'Success',
        description: MESSAGES.SUCCESS.WITHDRAWAL_SUBMITTED,
      });
      setWithdrawAmount('');
      setDetails('');
      refreshData();
    } catch (error) {
      notify.error(error, { context: 'AffiliateEarningsPage - withdraw', fallback: MESSAGES.SAVE_FAILED });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedPage>
      <Helmet>
        <title>Affiliate Earnings - Portal</title>
      </Helmet>
      <PageHeader
        title="My Earnings"
        subtitle="Accumulated commission, withdrawable balance, and every referred tuition payment."
      >
        <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Sync Data
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className={dashboardStyles.card}>
          <CardHeader className="pb-2 p-0">
            <CardTitle className={dashboardStyles.metricLabel}>Available to withdraw</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(availableBalance)}
            </div>
            <p className="text-xs text-[var(--tenant-muted)] mt-1">
              {totalPending > 0 ? `${formatCurrency(totalPending)} pending approval` : 'Ready to request'}
            </p>
          </CardContent>
        </Card>
        <Card className={dashboardStyles.card}>
          <CardHeader className="pb-2 p-0">
            <CardTitle className={dashboardStyles.metricLabel}>
              {monthFilter === 'month' ? `Earned in ${format(selectedDate, 'MMM yyyy')}` : 'Shown total'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Wallet className="h-6 w-6" /> {formatCurrency(shownTotal)}
            </div>
            <p className="text-xs text-[var(--tenant-muted)] mt-1">Rate {ratePct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className={dashboardStyles.card}>
          <CardHeader className="pb-2 p-0">
            <CardTitle className={dashboardStyles.metricLabel}>Lifetime commission</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-bold text-[var(--tenant-text)]">{formatCurrency(lifetime)}</div>
            <p className="text-xs text-[var(--tenant-muted)] mt-1">
              Withdrawn {formatCurrency(totalApproved)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="earnings">Commission history</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>

        <TabsContent value="earnings" className="space-y-6">
          <div className={`${dashboardStyles.card} flex flex-col md:flex-row gap-4 items-start md:items-center`}>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                <SelectItem value="month">Selected month</SelectItem>
              </SelectContent>
            </Select>
            {monthFilter === 'month' && (
              <MonthYearSelector selectedDate={selectedDate} onChange={setSelectedDate} />
            )}
            <Button variant="outline" className="ml-auto" onClick={() => setActiveTab('withdraw')}>
              <Wallet className="h-4 w-4 mr-2" /> Request withdrawal
            </Button>
          </div>

          <Card className={dashboardStyles.card}>
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-[var(--tenant-text)]">Commission history</CardTitle>
              <CardDescription>
                {monthFilter === 'month'
                  ? `Payments billed in ${monthLabel}.`
                  : 'Every commission from referred tuition payments.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Billing month</TableHead>
                    <TableHead className="text-right">Tuition</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-[var(--tenant-muted)]">{formatDate(row.date)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-[var(--tenant-text)]">{row.studentName}</div>
                          <div className="text-xs text-[var(--tenant-muted)]">{row.studentEmail}</div>
                        </TableCell>
                        <TableCell className="text-sm text-[var(--tenant-text)]">{row.className}</TableCell>
                        <TableCell className="text-[var(--tenant-text)]">
                          {row.billingMonth ? formatMonthKey(row.billingMonth) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.paymentAmount != null ? formatCurrency(row.paymentAmount) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600 dark:text-amber-400">
                          + {formatCurrency(row.earned)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-[var(--tenant-muted)]">
                        {monthFilter === 'month'
                          ? `No commission in ${monthLabel}. Try All months if the student paid a different billing month.`
                          : 'No commission records yet. Earnings appear when referred students complete tuition payments.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card className={`${dashboardStyles.card} sticky top-6`}>
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="flex items-center gap-2 text-[var(--tenant-text)]">
                    <Banknote className="h-5 w-5" /> Request withdrawal
                  </CardTitle>
                  <CardDescription>Admin will approve and pay out your available commission.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                  <div className="p-4 rounded-lg border border-[var(--tenant-line)] flex justify-between items-center">
                    <div className="text-xs text-[var(--tenant-muted)]">Available</div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(availableBalance)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EVC Plus">EVC Plus</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="Cash">Cash Pickup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Account details</Label>
                    <Input
                      placeholder={method === 'EVC Plus' ? 'Phone number' : 'Account number'}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full mt-2"
                    onClick={handleWithdraw}
                    disabled={isSubmitting || availableBalance <= 0}
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm withdrawal'}
                  </Button>

                  {availableBalance <= 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-yellow-500 bg-amber-500/10 p-3 rounded border border-amber-500/20">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>No withdrawable balance yet. Commission appears after referred students pay tuition.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className={dashboardStyles.card}>
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-[var(--tenant-text)]">Withdrawal history</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myWithdrawals.length > 0 ? (
                        myWithdrawals.map((w) => (
                          <TableRow key={w.id}>
                            <TableCell className="text-[var(--tenant-text)]">{formatDate(w.requested_at)}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-[var(--tenant-text)]">{w.method}</div>
                              <div className="text-xs text-[var(--tenant-muted)]">{w.payment_details}</div>
                            </TableCell>
                            <TableCell className="font-bold">{formatCurrency(w.amount)}</TableCell>
                            <TableCell>
                              {(w.status === 'approved' || w.status === 'paid') && (
                                <Badge className="bg-green-500/15 text-green-700 dark:text-green-400">Approved</Badge>
                              )}
                              {w.status === 'pending' && (
                                <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">Pending</Badge>
                              )}
                              {w.status === 'rejected' && (
                                <Badge className="bg-red-500/15 text-red-700 dark:text-red-400">Rejected</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-[var(--tenant-muted)]">
                            No withdrawal requests yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
};

export default AffiliateEarningsPage;
