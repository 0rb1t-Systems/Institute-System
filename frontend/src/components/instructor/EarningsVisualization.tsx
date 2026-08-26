import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { dashboardStyles } from './InstructorDashboardStyles';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, PieChart } from 'lucide-react';
import { format, getDate, getDaysInMonth } from 'date-fns';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

const EarningsVisualization = ({ earnings = [], selectedDate, classes = [] }) => {
  const safeDate = selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime())
    ? selectedDate
    : new Date();
  const monthName = format(safeDate, 'MMMM yyyy');
  const rows = Array.isArray(earnings) ? earnings : [];

  const totalPeriodEarnings = rows.reduce((sum: any, e: any) => sum + (Number(e.amount) || 0), 0);

  const dailyData = React.useMemo(() => {
    const daysInMonth = getDaysInMonth(safeDate);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const earningsByDay = rows.reduce((acc: any, curr: any) => {
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
    const grouped = rows.reduce((acc: any, curr: any) => {
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
      .map(([name, val]) => ({ name, value: val }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5);
  }, [rows, classes]);

  const avgPerDay = dailyData.length > 0 ? totalPeriodEarnings / dailyData.length : 0;

  return (
    <div className={dashboardStyles.section}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xl font-bold text-[var(--tenant-text)] flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Financial Overview
          </h3>
          <p className="text-[var(--tenant-muted)] text-sm mt-1">
            Earnings breakdown for <span className="text-green-400 font-medium">{monthName}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--tenant-muted)] uppercase font-bold tracking-wider">Total Share</p>
          <h2 className="text-3xl font-bold text-[var(--tenant-text)] tracking-tight">{formatCurrency(totalPeriodEarnings)}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${dashboardStyles.card}`}>
          <div className={dashboardStyles.cardHeader}>
            <div>
              <h3 className={dashboardStyles.cardTitle}>Daily Earnings</h3>
              <p className="text-xs text-slate-500">Trend across days in {monthName}</p>
            </div>
            <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
              <DollarSign className="h-3 w-3 mr-1" />
              Avg: {formatCurrency(avgPerDay)} / day
            </Badge>
          </div>

          {/* Fixed height avoids Recharts ResponsiveContainer 0×0 crash */}
          <div className="w-full mt-4" style={{ width: '100%', height: 300, minHeight: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  itemStyle={{ color: '#22c55e' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '0.25rem' }}
                  formatter={(value: any) => [formatCurrency(value), 'Earned']}
                  labelFormatter={(label) => `${format(safeDate, 'MMM')} ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#22c55e"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorDaily)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={dashboardStyles.card}>
          <div className={dashboardStyles.cardHeader}>
            <div>
              <h3 className={dashboardStyles.cardTitle}>Top Classes</h3>
              <p className="text-xs text-slate-500">Revenue contribution by class</p>
            </div>
            <div className="p-2 bg-slate-800 rounded-md">
              <PieChart className="h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div className="w-full mt-2" style={{ width: '100%', height: 200, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={classBreakdown} layout="vertical" margin={{ left: 0, right: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                  }}
                  formatter={(value: any) => [formatCurrency(value), 'Share']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {classBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-3">
            {classBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-slate-300 truncate max-w-[140px]" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <span className="font-mono text-slate-400">{formatCurrency(item.value as any)}</span>
              </div>
            ))}
            {classBreakdown.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">
                No earnings recorded for this month.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EarningsVisualization;
