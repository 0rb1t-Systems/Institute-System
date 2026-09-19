import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';
import { format, getDate, getDaysInMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const BAR_FILLS = [
  'var(--ds-primary, #0B3D2E)',
  'color-mix(in srgb, var(--ds-primary, #0B3D2E) 82%, white)',
  'color-mix(in srgb, var(--ds-accent, #1F8A5B) 90%, white)',
  'color-mix(in srgb, var(--ds-accent, #1F8A5B) 72%, white)',
  'color-mix(in srgb, var(--ds-primary, #0B3D2E) 55%, white)',
];

/**
 * Daily earnings + top classes — shared chart styling with Admin/Staff DashboardPage.
 * Kept for reuse; Instructor dashboard uses the compact weekly panel inline.
 */
const EarningsVisualization = ({ earnings = [], selectedDate, classes = [] }) => {
  const safeDate =
    selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime())
      ? selectedDate
      : new Date();
  const monthName = format(safeDate, 'MMMM yyyy');
  const rows = Array.isArray(earnings) ? earnings : [];

  const totalPeriodEarnings = rows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const dailyData = React.useMemo(() => {
    const daysInMonth = getDaysInMonth(safeDate);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const earningsByDay = rows.reduce((acc, curr) => {
      if (!curr?.created_at) return acc;
      const d = new Date(curr.created_at);
      if (Number.isNaN(d.getTime())) return acc;
      const day = getDate(d);
      acc[day] = (acc[day] || 0) + (Number(curr.amount) || 0);
      return acc;
    }, {});

    return days.map((day) => ({
      name: String(day),
      amount: earningsByDay[day] || 0,
    }));
  }, [rows, safeDate]);

  const classBreakdown = React.useMemo(() => {
    const grouped = rows.reduce((acc, curr) => {
      let className = curr.class?.name;
      if (!className && curr.class_id) {
        const cls = (classes || []).find((c) => c.id === curr.class_id);
        className = cls ? cls.name : 'Unknown Class';
      }
      className = className || 'Unknown Class';
      if (!acc[className]) acc[className] = 0;
      acc[className] += Number(curr.amount) || 0;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, val]) => ({ name, value: Number(val) || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [rows, classes]);

  const avgPerDay = dailyData.length > 0 ? totalPeriodEarnings / dailyData.length : 0;
  const axisColor = 'var(--ds-text-secondary, #5B6B61)';
  const gridColor = 'var(--ds-border, #DDE5DF)';
  const dailyEmpty = dailyData.every((d) => d.amount === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
            Financial overview
          </h3>
          <p className="text-sm text-slate-400 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
            Earnings breakdown for {monthName}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-data text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
            Total share
          </p>
          <p className="font-data text-[28px] font-bold tabular-nums text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
            {formatCurrency(totalPeriodEarnings)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white">Daily earnings</CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                Trend across days in {monthName}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="border-transparent bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-accent,#0F766E)]"
            >
              <DollarSign className="mr-1 h-3 w-3" />
              Avg: {formatCurrency(avgPerDay)} / day
            </Badge>
          </CardHeader>
          <CardContent className="h-[300px] px-6 pb-6 pt-2">
            {dailyEmpty ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                No earnings recorded for this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorDailyDs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--ds-accent, #1F8A5B)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--ds-accent, #1F8A5B)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12, fontWeight: 500 }}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    stroke={axisColor}
                    tick={{ fill: axisColor, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
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
                    formatter={(value) => [formatCurrency(Number(value)), 'Earned']}
                    labelFormatter={(label) => `${format(safeDate, 'MMM')} ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--ds-accent, #1F8A5B)"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorDailyDs)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="space-y-1 p-6 pb-2">
            <CardTitle className="text-lg text-white">Top classes</CardTitle>
            <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
              Revenue contribution by class
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-2">
            <div className="mb-3 h-[160px] w-full">
              {classBreakdown.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  No class earnings yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classBreakdown} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" hide />
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
                      formatter={(value) => [formatCurrency(Number(value)), 'Share']}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                      {classBreakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={BAR_FILLS[index % BAR_FILLS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-2.5">
              {classBreakdown.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: BAR_FILLS[idx % BAR_FILLS.length] }}
                    />
                    <span
                      className="truncate text-slate-300 [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </div>
                  <span className="shrink-0 font-data tabular-nums text-slate-400 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                    {formatCurrency(Number(item.value))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EarningsVisualization;
