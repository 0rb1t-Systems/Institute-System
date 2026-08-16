import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Users, School, DollarSign, Activity, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';
import { getRegistrationFeeAmount } from '@/lib/institution';
import { computeStudentBalance } from '@/lib/finance';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * Administrator / Staff overview — matches product dashboard reference.
 */
const DashboardPage = () => {
  const { user, institution } = useAuth();
  const { students, classes, payments, enrollments, results, exams, loading, error } = useData();
  const showFinance = user?.role === 'admin' || user?.role === 'staff';
  const isAdmin = user?.role === 'admin';
  const registrationFee = getRegistrationFeeAmount(institution);

  const stats = useMemo(() => {
    const activeClasses = classes.filter((c) => c.is_active).length;
    const completed = payments.filter((p) => (p.status || 'completed') === 'completed');
    const revenue = completed.reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
    const tuition = completed
      .filter((p) => !p.is_registration_fee)
      .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
    const registration = completed
      .filter((p) => p.is_registration_fee)
      .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);

    // Outstanding balance — shared SSOT with Finance page
    let outstandingBalance = 0;
    let outstandingStudents = 0;
    for (const student of students) {
      const enrollment = enrollments.find((e) => e.student_id === student.id && e.status === 'active');
      const activeClass = enrollment ? classes.find((c) => c.id === enrollment.class_id) : null;
      const studentPayments = payments.filter((p) => p.student_id === student.id);
      const { balance } = computeStudentBalance({
        payments: studentPayments,
        activeClass,
        enrollment,
        institution,
        registrationFeeAmount: registrationFee,
      });

      if (balance > 0) {
        outstandingBalance += balance;
        outstandingStudents += 1;
      }
    }

    // Rough month-over-month student growth from registration_date / created_at
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastYear = lastMonthDate.getFullYear();

    const countInMonth = (y, m) =>
      students.filter((s) => {
        const d = new Date(s.registration_date || s.created_at || 0);
        return d.getFullYear() === y && d.getMonth() === m;
      }).length;

    const addedThis = countInMonth(thisYear, thisMonth);
    const addedLast = countInMonth(lastYear, lastMonth);
    let growthLabel = 'Enrolled in your institution';
    if (addedLast > 0) {
      const pct = Math.round(((addedThis - addedLast) / addedLast) * 100);
      growthLabel = `${pct >= 0 ? '+' : ''}${pct}% from last month`;
    } else if (addedThis > 0) {
      growthLabel = `+${addedThis} new this month`;
    }

    return {
      students: students.length,
      classes: activeClasses,
      revenue,
      tuition,
      registration,
      growthLabel,
      outstandingBalance,
      outstandingStudents,
    };
  }, [students, classes, payments, enrollments, registrationFee, institution]);

  const chartData = useMemo(
    () => [
      { name: 'Tuition', amount: stats.tuition },
      { name: 'Registration', amount: stats.registration },
    ],
    [stats.tuition, stats.registration]
  );

  const latestResults = useMemo(() => {
    const examById = Object.fromEntries((exams || []).map((e) => [e.id, e]));
    const studentById = Object.fromEntries((students || []).map((s) => [s.id, s]));

    return [...(results || [])]
      .sort(
        (a, b) =>
          Number(new Date(b.graded_at || b.created_at || 0)) - Number(new Date(a.graded_at || a.created_at || 0))
      )
      .slice(0, 5)
      .map((r) => {
        const student = studentById[r.student_id];
        const exam = examById[r.exam_id];
        const score = Number(r.final_score ?? r.score ?? r.raw_score ?? 0);
        const total = Number(exam?.total_marks ?? exam?.final_marks ?? 100);
        const name = student?.name || 'Unknown Student';
        return {
          id: r.id,
          name,
          initial: (name.trim()[0] || '?').toUpperCase(),
          scoreLabel: `${Math.round(score)}/${Math.round(total)}`,
        };
      });
  }, [results, exams, students]);

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Dashboard</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { context: 'DashboardPage', fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const v = (n) => (loading ? '…' : n);

  return (
    <AnimatedPage>
      <Helmet>
        <title>Administrator Dashboard</title>
      </Helmet>

      <PageHeader
        title={isAdmin ? 'Administrator Dashboard' : 'Staff Dashboard'}
        subtitle="System overview and performance metrics."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Total Students"
          value={v(stats.students)}
          icon={<Users className="h-4 w-4 text-blue-400" />}
          description={loading ? '…' : stats.growthLabel}
        />
        <StatCard
          title="Active Classes"
          value={v(stats.classes)}
          icon={<School className="h-4 w-4 text-violet-400" />}
          description="Currently running"
        />
        {showFinance ? (
          <StatCard
            title="Total Revenue"
            value={loading ? '…' : formatCurrency(stats.revenue)}
            icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
            description="Gross volume"
          />
        ) : (
          <StatCard
            title="Total Revenue"
            value="—"
            icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
            description="Admin / staff only"
          />
        )}
        {showFinance ? (
          <StatCard
            title="Outstanding Balance"
            value={loading ? '…' : formatCurrency(stats.outstandingBalance)}
            icon={<AlertCircle className="h-4 w-4 text-orange-400" />}
            description={
              loading
                ? '…'
                : `${stats.outstandingStudents} student${stats.outstandingStudents === 1 ? '' : 's'} with balance`
            }
          />
        ) : (
          <StatCard
            title="System Status"
            value="Healthy"
            icon={<Activity className="h-4 w-4 text-emerald-400" />}
            description="All services operational"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="bg-slate-900/50 border-slate-800 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-white text-lg">Financial Overview</CardTitle>
            <CardDescription className="text-slate-400">
              Distribution of revenue sources.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] pt-2">
            {showFinance ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) =>
                      val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${val}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      color: '#f8fafc',
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), 'Amount']}
                  />
                  <Bar dataKey="amount" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={72} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Finance metrics are available to admin and staff.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-lg">Latest Results</CardTitle>
            <CardDescription className="text-slate-400">
              Real-time exam submissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500 py-8 text-center">Loading results…</p>
            ) : latestResults.length > 0 ? (
              latestResults.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border border-slate-700">
                    <AvatarFallback className="bg-slate-800 text-slate-300 text-sm">
                      {item.initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">Submitted exam</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 tabular-nums shrink-0">
                    {item.scoreLabel}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 py-8 text-center">
                No exam results yet. Grades will appear here after marking.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
};

export default DashboardPage;
