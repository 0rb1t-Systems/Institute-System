import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DsOutlineAction, DsPrimaryAction, DS_ICON_STROKE } from '@/components/ui/ds-actions';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  DollarSign,
  Share2,
  Copy,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Timer,
  UserPlus,
} from 'lucide-react';
import { getAffiliateCommissionRate, getTenantBaseUrl, rateToPercent } from '@/lib/institution';
import { useToast } from '@/components/ui/use-toast';
import MonthYearSelector from '@/components/instructor/MonthYearSelector';
import {
  buildAffiliateStudentMonthRows,
  filterSettlementsForMonth,
  formatMonthKey,
  latestBillingMonthDate,
  monthKeyFromDate,
  paymentMonthKey,
} from '@/lib/affiliateMonthTracking';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

const statusBadge = (status: string) => {
  if (status === 'paid') {
    return (
      <Badge className="border-transparent bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-accent,#0F766E)]">
        Paid
      </Badge>
    );
  }
  if (status === 'partial') {
    return (
      <Badge className="border-transparent bg-[var(--ds-warning-bg,#FFF7ED)] text-[var(--ds-warning,#C2410C)]">
        Partial
      </Badge>
    );
  }
  if (status === 'not_due') {
    return (
      <Badge
        variant="outline"
        className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-secondary,#5B6B61)]"
      >
        Not billed
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-[var(--ds-danger-bg,#FEF2F2)] text-[var(--ds-danger,#DC2626)]">
      Unpaid
    </Badge>
  );
};

/**
 * Affiliate referral + commission overview — visual layout from design-system.pen
 * (Affiliate Dashboard), matching Admin/Staff/Instructor shell patterns.
 * Commission calculation, withdrawals, and permissions unchanged.
 */
const AffiliatePage = () => {
  const { user, institution } = useAuth();
  const { students, payments, enrollments, classes, affiliateSettlements = [], loading } = useData();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [statusTab, setStatusTab] = useState('all');
  const monthInitialized = useRef(false);

  const ratePct = rateToPercent(getAffiliateCommissionRate(institution), 1);
  const referralLink = `${getTenantBaseUrl(institution)}/register${user?.id ? `?ref=${user.id}` : ''}`;
  const monthKey = monthKeyFromDate(selectedDate);
  const monthLabel = format(selectedDate, 'MMMM yyyy');
  const monthShort = format(selectedDate, 'MMM');

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

  const referredThisMonth = useMemo(() => {
    return myStudents.filter((s) => {
      const d = new Date(s.registration_date || s.created_at || 0);
      if (Number.isNaN(d.getTime())) return false;
      return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
    }).length;
  }, [myStudents, selectedDate]);

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

  const commissionTrend = useMemo(() => {
    if (!user?.id) return [];
    const buckets = new Map<string, number>();
    for (const s of affiliateSettlements || []) {
      if (s.affiliate_id !== user.id) continue;
      const payment = (payments || []).find((p) => p.id === s.payment_id);
      const key =
        (payment ? paymentMonthKey(payment) : null) ||
        (s.created_at ? String(s.created_at).slice(0, 7) : null);
      if (!key) continue;
      buckets.set(key, (buckets.get(key) || 0) + Number(s.amount || 0));
    }

    // Show up to 4 months ending at selected month (or latest available).
    const keys = Array.from(buckets.keys()).sort();
    if (keys.length === 0) {
      // Empty shell months around selection for empty-state chart labels
      const base = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 2, 1);
      return [0, 1, 2, 3].map((i) => {
        const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
        const key = monthKeyFromDate(d);
        return {
          name: format(d, 'MMM'),
          amount: 0,
          key,
          fill:
            key === monthKey
              ? 'var(--ds-primary, #0B3D2E)'
              : 'color-mix(in srgb, var(--ds-accent, #1F8A5B) 55%, white)',
        };
      });
    }

    let endIdx = keys.indexOf(monthKey);
    if (endIdx < 0) endIdx = keys.length - 1;
    const startIdx = Math.max(0, endIdx - 3);
    const windowKeys = keys.slice(startIdx, endIdx + 1);

    const fills = [
      'color-mix(in srgb, var(--ds-primary, #0B3D2E) 55%, white)',
      'color-mix(in srgb, var(--ds-primary, #0B3D2E) 72%, white)',
      'color-mix(in srgb, var(--ds-accent, #1F8A5B) 88%, white)',
      'var(--ds-primary, #0B3D2E)',
    ];

    return windowKeys.map((key, i) => {
      const [y, m] = key.split('-');
      const d = new Date(Number(y), Number(m) - 1, 1);
      return {
        name: format(d, 'MMM'),
        amount: buckets.get(key) || 0,
        key,
        fill: key === monthKey ? fills[3] : fills[Math.min(i, 2)],
      };
    });
  }, [affiliateSettlements, payments, user?.id, monthKey, selectedDate]);

  const referralStatusChart = useMemo(
    () => [
      {
        name: 'Paid',
        amount: paidCount,
        fill: 'var(--ds-primary, #0B3D2E)',
      },
      {
        name: 'Unpaid',
        amount: unpaidCount,
        fill: 'var(--ds-warning, #C2410C)',
      },
    ],
    [paidCount, unpaidCount],
  );

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: 'Copied', description: 'Referral link copied.' });
  };

  const v = (n: React.ReactNode) => (loading ? '…' : n);
  const axisColor = 'var(--ds-text-secondary, #5B6B61)';
  const gridColor = 'var(--ds-border, #DDE5DF)';
  const trendEmpty = !loading && commissionTrend.every((d) => d.amount === 0);
  const statusEmpty = !loading && paidCount === 0 && unpaidCount === 0;

  return (
    <AnimatedPage>
      <Helmet>
        <title>Affiliate Dashboard | Portal</title>
      </Helmet>

      <PageHeader
        eyebrow="Referrals · Affiliate"
        title="Affiliate Dashboard"
        subtitle="See which months each referred student paid, and the commission you can withdraw."
      >
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span className="font-data text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-tertiary,#8A978E)]">
              Billing month
            </span>
            <MonthYearSelector selectedDate={selectedDate} onChange={setSelectedDate} />
          </div>
          <DsPrimaryAction asChild>
            <Link to="/affiliate/earnings">
              <DollarSign className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} />
              Withdraw earnings
            </Link>
          </DsPrimaryAction>
        </div>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Referred students"
          value={v(myStudents.length)}
          tone="info"
          descriptionTone={referredThisMonth > 0 ? 'accent' : 'secondary'}
          trendIcon={referredThisMonth > 0 ? <TrendingUp className="h-3 w-3 shrink-0" /> : null}
          icon={<UserPlus className="h-[18px] w-[18px]" />}
          description={
            loading
              ? '…'
              : referredThisMonth > 0
                ? `+${referredThisMonth} this month`
                : 'Total attributed to you'
          }
        />
        <StatCard
          title={`Paid in ${monthShort}`}
          value={v(paidCount)}
          tone="primary"
          descriptionTone="secondary"
          icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
          description={loading ? '…' : 'Settled for selected month'}
        />
        <StatCard
          title={`Unpaid in ${monthShort}`}
          value={v(unpaidCount)}
          tone={unpaidCount > 0 ? 'warning' : 'corporate'}
          descriptionTone={unpaidCount > 0 ? 'warning' : 'secondary'}
          trendIcon={unpaidCount > 0 ? <Timer className="h-3 w-3 shrink-0" /> : null}
          icon={<AlertCircle className="h-[18px] w-[18px]" />}
          description={
            loading ? '…' : unpaidCount > 0 ? 'Needs follow-up' : 'Nothing outstanding'
          }
        />
        <StatCard
          title={`Commission (${monthShort})`}
          value={loading ? '…' : formatCurrency(monthCommission)}
          tone="primary"
          descriptionTone={monthCommission > 0 ? 'accent' : 'secondary'}
          trendIcon={monthCommission > 0 ? <TrendingUp className="h-3 w-3 shrink-0" /> : null}
          icon={<DollarSign className="h-[18px] w-[18px]" />}
          description={
            loading
              ? '…'
              : `Lifetime ${formatCurrency(lifetimeCommission)} · ${ratePct.toFixed(1)}%`
          }
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white">Commission trend</CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                Monthly earnings from referrals
              </CardDescription>
            </div>
            <Link
              to="/affiliate/earnings"
              className="shrink-0 rounded-sm text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="h-[280px] px-6 pb-6 pt-2">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                Loading commissions…
              </div>
            ) : trendEmpty ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                No commission recorded yet. Share your referral link to get started.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commissionTrend} margin={{ top: 28, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="0" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{
                      fill: 'color-mix(in srgb, var(--ds-primary, #1F8A5B) 10%, transparent)',
                    }}
                    contentStyle={{
                      background: 'var(--ds-surface, #fff)',
                      border: '1px solid var(--ds-border, #DDE5DF)',
                      borderRadius: 8,
                      color: 'var(--ds-text-primary, #122018)',
                      fontSize: 13,
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), 'Commission']}
                  />
                  <Bar dataKey="amount" radius={[10, 10, 10, 10]} maxBarSize={56}>
                    {commissionTrend.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="amount"
                      position="top"
                      formatter={(value: number) =>
                        Number(value) > 0 ? formatCurrency(Number(value)) : ''
                      }
                      style={{
                        fill: 'var(--ds-text-primary, #122018)',
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: 'Arial, Helvetica, sans-serif',
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
          <CardHeader className="space-y-1 p-6 pb-2">
            <CardTitle className="text-lg text-white">Referral status</CardTitle>
            <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
              Paid vs unpaid for {monthLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] px-6 pb-6 pt-2">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                Loading status…
              </div>
            ) : statusEmpty ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                No referred students billed for this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={referralStatusChart} margin={{ top: 28, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="0" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    cursor={{
                      fill: 'color-mix(in srgb, var(--ds-primary, #1F8A5B) 10%, transparent)',
                    }}
                    contentStyle={{
                      background: 'var(--ds-surface, #fff)',
                      border: '1px solid var(--ds-border, #DDE5DF)',
                      borderRadius: 8,
                      color: 'var(--ds-text-primary, #122018)',
                      fontSize: 13,
                    }}
                    formatter={(value) => [Number(value), 'Students']}
                  />
                  <Bar dataKey="amount" radius={[10, 10, 10, 10]} maxBarSize={72}>
                    {referralStatusChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="amount"
                      position="top"
                      style={{
                        fill: 'var(--ds-text-primary, #122018)',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: 'Arial, Helvetica, sans-serif',
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-5 border-slate-800 bg-slate-900/50">
        <CardHeader className="flex flex-col gap-3 space-y-0 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Share2 className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" />
              Your referral link
            </CardTitle>
            <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
              Students who register with this link are attributed to you.
            </CardDescription>
          </div>
          <DsOutlineAction type="button" onClick={copyLink}>
            <Copy className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} />
            Copy
          </DsOutlineAction>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          <p className="break-all font-data text-[12px] text-[var(--ds-accent,#1F8A5B)]">{referralLink}</p>
        </CardContent>
      </Card>

      <Tabs value={statusTab} onValueChange={setStatusTab} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="all">All ({monthRows.length})</TabsTrigger>
            <TabsTrigger value="paid">Paid ({paidCount})</TabsTrigger>
            <TabsTrigger value="unpaid">Unpaid ({unpaidCount})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={statusTab} className="mt-0">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-lg text-white">Students — {monthLabel}</CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                Status is for the selected billing month. Paid months lists every month this student
                has already paid.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 pb-2 sm:px-2">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 font-data text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                      Student
                    </TableHead>
                    <TableHead className="font-data text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                      Class
                    </TableHead>
                    <TableHead className="hidden font-data text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:table-cell [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                      Paid months
                    </TableHead>
                    <TableHead className="text-right font-data text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                      Paid
                    </TableHead>
                    <TableHead className="text-right font-data text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                      Commission
                    </TableHead>
                    <TableHead className="pr-6 text-right font-data text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]"
                      >
                        Loading referrals…
                      </TableCell>
                    </TableRow>
                  ) : visibleRows.length > 0 ? (
                    visibleRows.map((s) => (
                      <TableRow
                        key={s.id}
                        className="transition-colors hover:bg-[var(--ds-surface-muted,#F7FAF8)]/60"
                      >
                        <TableCell className="pl-6">
                          <div className="font-medium text-white [.tenant-shell_&]:text-[13px] [.tenant-shell_&]:font-semibold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                            {s.name}
                          </div>
                          <div className="text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                            {s.email}
                          </div>
                          <div className="text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                            {formatDate(s.registration_date)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-300 [.tenant-shell_&]:text-[12px] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                          {s.classNames}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {s.paidMonths?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {s.paidMonths.map((m) => (
                                <Badge
                                  key={m}
                                  variant="outline"
                                  className="border-[var(--ds-border,#DDE5DF)] text-[10px] font-normal text-[var(--ds-text-secondary,#5B6B61)]"
                                >
                                  {formatMonthKey(m)}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                              None yet
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-data text-sm tabular-nums text-emerald-400 [.tenant-shell_&]:text-[var(--ds-primary,#1F8A5B)]">
                          {formatCurrency(s.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right font-data text-sm font-semibold tabular-nums text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                          {formatCurrency(s.commission)}
                        </TableCell>
                        <TableCell className="pr-6 text-right">{statusBadge(s.status)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-10 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]"
                      >
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
