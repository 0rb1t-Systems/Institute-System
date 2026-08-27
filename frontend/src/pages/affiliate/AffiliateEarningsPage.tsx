import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { format } from 'date-fns';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RefreshCw, Wallet } from 'lucide-react';
import { getAffiliateCommissionRate, rateToPercent } from '@/lib/institution';
import MonthYearSelector from '@/components/instructor/MonthYearSelector';
import {
  filterSettlementsForMonth,
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
    refreshData,
    loading,
  } = useData();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthFilter, setMonthFilter] = useState('month');

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

  const rows = useMemo(() => {
    return visibleSettlements.map((s) => {
      const student = students.find((st) => st.id === s.student_id);
      const cls = classes.find((c) => c.id === s.class_id);
      const payment = payments.find((p) => p.id === s.payment_id);
      return {
        id: s.id,
        date: s.created_at,
        studentName: student?.name || student?.full_name || 'Unknown student',
        studentEmail: student?.email || '',
        className: cls?.name || '—',
        billingMonth: payment ? paymentMonthKey(payment) : null,
        paymentAmount: payment ? Number(payment.amount || 0) : null,
        earned: Number(s.amount || 0),
        rate: Number(s.rate || 0),
      };
    });
  }, [visibleSettlements, students, classes, payments]);

  return (
    <AnimatedPage>
      <Helmet>
        <title>Affiliate Earnings - Portal</title>
      </Helmet>
      <PageHeader
        title="My Earnings"
        subtitle="Commission from referred students' completed tuition payments, by month."
      >
        <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Sync Data
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              {monthFilter === 'month' ? `Earned in ${format(selectedDate, 'MMM yyyy')}` : 'Shown total'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400 flex items-center gap-2">
              <Wallet className="h-6 w-6" /> {formatCurrency(shownTotal)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Rate {ratePct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Lifetime Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{formatCurrency(lifetime)}</div>
            <p className="text-xs text-slate-500 mt-1">All completed referred tuition</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/30 p-4 rounded-lg border border-slate-800 mb-6">
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
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle>Commission history</CardTitle>
          <CardDescription>
            {monthFilter === 'month'
              ? `Payments billed in ${monthLabel}.`
              : 'Every commission record from referred tuition.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
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
                  <TableRow key={row.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-slate-400">{formatDate(row.date)}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-200">{row.studentName}</div>
                      <div className="text-xs text-slate-500">{row.studentEmail}</div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">{row.className}</TableCell>
                    <TableCell className="text-slate-400">{row.billingMonth || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-slate-300">
                      {row.paymentAmount != null ? formatCurrency(row.paymentAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-400">
                      + {formatCurrency(row.earned)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    {monthFilter === 'month'
                      ? `No commission in ${monthLabel}.`
                      : 'No commission records yet. Earnings appear when referred students complete tuition payments.'}
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

export default AffiliateEarningsPage;
