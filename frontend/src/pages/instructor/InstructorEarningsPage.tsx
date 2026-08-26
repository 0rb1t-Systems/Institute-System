import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RefreshCw, Search, Wallet, Banknote, AlertCircle } from 'lucide-react';
import MonthYearSelector from '@/components/instructor/MonthYearSelector';
import EarningsHistoryTable from '@/components/instructor/EarningsHistoryTable';

const InstructorEarningsPage = () => {
  const { user, institution } = useAuth();
  const {
    instructorEarnings,
    withdrawalRequests,
    createWithdrawal,
    refreshData,
    loading,
    students,
    classes,
    payments,
  } = useData();
  const { toast } = useToast();
  const settingsRate = Number(institution?.default_instructor_commission_rate || 0);

  const [activeTab, setActiveTab] = useState('earnings');
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthFilter, setMonthFilter] = useState('month');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [method, setMethod] = useState('EVC Plus');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myEarnings = useMemo(() => {
    return instructorEarnings
      .filter((e) => e.instructor_id === user.id)
      .map((earning) => {
        const isFixed = earning.settlement_type === 'fixed_fee';
        const student =
          earning.student || students.find((s) => s.id === earning.student_id) || null;
        const cls = earning.class || classes.find((c) => c.id === earning.class_id) || null;
        const payment =
          earning.payment ||
          payments.find((p) => p.id === earning.payment_id) ||
          null;
        const rate = Number(earning.rate || settingsRate || cls?.commission_rate || 0);
        const paymentAmount = isFixed
          ? Number(earning.amount)
          : payment?.amount != null
            ? Number(payment.amount)
            : rate > 0
              ? Number(earning.amount) / rate
              : Number(earning.amount);
        return {
          ...earning,
          isFixed,
          student_id: earning.student_id || student?.id || null,
          studentName: isFixed
            ? 'Class fixed fee'
            : student?.name || student?.full_name || 'Unknown Student',
          studentCode: isFixed
            ? 'FIXED'
            : student?.student_code || student?.email?.split?.('@')?.[0]?.toUpperCase?.() || 'N/A',
          className: cls?.name || 'Unknown Class',
          rate,
          paymentAmount,
        };
      })
      .sort((a, b) => Number(new Date(b.created_at)) - Number(new Date(a.created_at)));
  }, [instructorEarnings, user.id, students, classes, payments, settingsRate]);

  const myWithdrawals = useMemo(
    () =>
      withdrawalRequests
        .filter((w) => w.instructor_id === user.id)
        .sort((a, b) => Number(new Date(b.requested_at)) - Number(new Date(a.requested_at))),
    [withdrawalRequests, user.id]
  );

  const totalLifetimeEarnings = useMemo(
    () => myEarnings.reduce((sum: any, e: any) => sum + Number(e.amount), 0),
    [myEarnings]
  );

  const totalPending = useMemo(
    () =>
      myWithdrawals
        .filter((w) => w.status === 'pending')
        .reduce((sum: any, w: any) => sum + Number(w.amount), 0),
    [myWithdrawals]
  );

  const totalApproved = useMemo(
    () =>
      myWithdrawals
        .filter((w) => w.status === 'approved')
        .reduce((sum: any, w: any) => sum + Number(w.amount), 0),
    [myWithdrawals]
  );

  const availableBalance = Math.max(0, totalLifetimeEarnings - totalApproved - totalPending);

  const filteredEarnings = useMemo(() => {
    return myEarnings.filter((item) => {
      const matchesSearch =
        item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.studentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.isFixed && 'fixed'.includes(searchTerm.toLowerCase()));
      const matchesClass = classFilter === 'all' || item.class_id === classFilter;
      if (!matchesSearch || !matchesClass) return false;
      if (monthFilter !== 'month') return true;
      const d = new Date(item.created_at);
      if (Number.isNaN(d.getTime())) return false;
      return (
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [myEarnings, searchTerm, classFilter, monthFilter, selectedDate]);

  const myClassOptions = useMemo(() => {
    const ids = new Set(myEarnings.map((e) => e.class_id));
    return classes.filter((c) => ids.has(c.id));
  }, [myEarnings, classes]);

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
        instructor_id: user.id,
        amount,
        status: 'pending',
        method,
        payment_details: details,
        requested_at: new Date().toISOString(),
      });

      toast({
        title: 'Success',
        description: MESSAGES.SUCCESS.WITHDRAWAL_SUBMITTED,
      });

      setWithdrawAmount('');
      setDetails('');
      refreshData();
    } catch (error) {
      notify.error(error, { context: 'InstructorEarningsPage - withdraw', fallback: MESSAGES.SAVE_FAILED });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedPage>
      <Helmet>
        <title>My Earnings - Portal</title>
      </Helmet>

      <PageHeader
        title="My Earnings"
        subtitle="See which students paid this month, your share of each payment, and request withdrawals."
      >
        <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Sync Data
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Available Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-400">{formatCurrency(availableBalance)}</div>
            <p className="text-xs text-slate-500 mt-1">Ready for withdrawal</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Lifetime Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-400">{formatCurrency(totalLifetimeEarnings)}</div>
            <p className="text-xs text-slate-500 mt-1">Commissions + fixed fees</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Withdrawn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold text-slate-200">{formatCurrency(totalApproved)}</div>
              {totalPending > 0 && (
                <span className="text-yellow-500 text-sm font-bold">
                  (+ {formatCurrency(totalPending)} pending)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Processed payouts</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="earnings">Earnings History</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
        </TabsList>

        <TabsContent value="earnings" className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 bg-slate-900/30 p-4 rounded-lg border border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search student, ID, or class..."
                className="pl-9 bg-slate-950 border-slate-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-[220px] bg-slate-950 border-slate-800">
                <SelectValue placeholder="Filter by Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {myClassOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-slate-950 border-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Selected month</SelectItem>
                <SelectItem value="all">All months</SelectItem>
              </SelectContent>
            </Select>
            {monthFilter === 'month' && (
              <MonthYearSelector selectedDate={selectedDate} onChange={setSelectedDate} />
            )}
            <Button
              variant="outline"
              className="border-green-800 text-green-400 hover:bg-green-900/20"
              onClick={() => setActiveTab('withdraw')}
            >
              <Wallet className="h-4 w-4 mr-2" />
              Go to Withdraw
            </Button>
          </div>

          <EarningsHistoryTable
            earnings={filteredEarnings}
            students={students}
            classes={classes}
            payments={payments}
            defaultRate={settingsRate}
            selectedDate={monthFilter === 'month' ? selectedDate : null}
          />
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card className="bg-slate-900 border-slate-800 sticky top-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" /> Request Withdrawal
                  </CardTitle>
                  <CardDescription>Withdraw your available earnings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded bg-slate-950 border border-slate-800 flex justify-between items-center">
                    <div className="text-xs text-slate-400">Available Limit</div>
                    <div className="text-xl font-bold text-green-400">
                      {formatCurrency(availableBalance)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-slate-950 border-slate-800 font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Withdrawal Method</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger className="bg-slate-950 border-slate-800">
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
                    <Label>Account Details</Label>
                    <Input
                      placeholder={method === 'EVC Plus' ? 'Phone Number' : 'Account Number'}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className="bg-slate-950 border-slate-800"
                    />
                  </div>

                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 mt-4"
                    onClick={handleWithdraw}
                    disabled={isSubmitting || availableBalance <= 0}
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm Withdrawal'}
                  </Button>

                  {availableBalance <= 0 && (
                    <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 p-3 rounded border border-yellow-500/20 mt-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>No funds available. Earn commission from class payments to withdraw.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle>Withdrawal History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800 hover:bg-transparent">
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myWithdrawals.length > 0 ? (
                        myWithdrawals.map((w) => (
                          <TableRow key={w.id} className="border-slate-800 hover:bg-slate-800/50">
                            <TableCell className="text-slate-300">{formatDate(w.requested_at)}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-slate-200">{w.method}</div>
                              <div className="text-xs text-slate-500">{w.payment_details}</div>
                            </TableCell>
                            <TableCell className="font-bold text-white">
                              {formatCurrency(w.amount)}
                            </TableCell>
                            <TableCell>
                              {w.status === 'approved' && (
                                <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                                  Approved
                                </Badge>
                              )}
                              {w.status === 'pending' && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">
                                  Pending
                                </Badge>
                              )}
                              {w.status === 'rejected' && (
                                <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                                  Rejected
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                            No withdrawal history found.
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

export default InstructorEarningsPage;
