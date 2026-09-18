import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Users,
  School,
  DollarSign,
  Activity,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Timer,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';
import { getRegistrationFeeAmount } from '@/lib/institution';
import { computeStudentBalance } from '@/lib/finance';
import { getInstitutionGradeScale } from '@/lib/gradingScale';
import { getExamScorePercent, getExamTotalMarks, getLetterGrade } from '@/lib/examPass';
import { usePlatformTheme } from '@/contexts/PlatformThemeContext';
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

const LATEST_RESULT_AVATAR_COLORS = [
  { bg: '#0F6B4C', text: '#FFFFFF' },
  { bg: '#2563EB', text: '#FFFFFF' },
  { bg: '#7C3AED', text: '#FFFFFF' },
  { bg: '#C2410C', text: '#FFFFFF' },
  { bg: '#0F766E', text: '#FFFFFF' },
] as const;

/**
 * Administrator / Staff overview — visual layout from design-system.pen Admin Dashboard.
 * Data fetching and business logic unchanged.
 */
const DashboardPage = () => {
  const { user, institution } = useAuth();
  const { mode } = usePlatformTheme();
  const isLight = mode === 'light';
  const {
    students,
    classes,
    payments,
    enrollments,
    results,
    exams,
    courses,
    gradebookEntries,
    loading,
    error,
  } = useData();
  const showFinance = user?.role === 'admin' || user?.role === 'staff';
  const isAdmin = user?.role === 'admin';
  const registrationFee = getRegistrationFeeAmount(institution);
  const gradeScale = useMemo(() => getInstitutionGradeScale(institution), [institution]);

  const periodLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date()),
    [],
  );

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
    let growthTone: 'secondary' | 'accent' | 'muted' = 'secondary';
    let growthTrend: 'up' | 'down' | 'none' = 'none';

    if (addedLast > 0) {
      const pct = Math.round(((addedThis - addedLast) / addedLast) * 100);
      growthLabel = `${pct >= 0 ? '+' : ''}${pct}% from last month`;
      growthTone = 'secondary';
      growthTrend = pct >= 0 ? 'up' : 'down';
    } else if (addedThis > 0) {
      growthLabel = `+${addedThis} new this month`;
      growthTone = 'accent';
      growthTrend = 'up';
    }

    return {
      students: students.length,
      classes: activeClasses,
      revenue,
      tuition,
      registration,
      growthLabel,
      growthTone,
      growthTrend,
      outstandingBalance,
      outstandingStudents,
    };
  }, [students, classes, payments, enrollments, registrationFee, institution]);

  const chartData = useMemo(
    () => [
      { name: 'Tuition', amount: stats.tuition, fill: 'var(--ds-primary, #1F8A5B)' },
      { name: 'Registration', amount: stats.registration, fill: 'var(--ds-accent, #1F8A5B)' },
    ],
    [stats.tuition, stats.registration],
  );

  const latestResults = useMemo(() => {
    const studentById = Object.fromEntries((students || []).map((s) => [s.id, s]));
    const courseById = Object.fromEntries((courses || []).map((c) => [c.id, c]));
    const examById = Object.fromEntries((exams || []).map((e) => [e.id, e]));

    const fromGradebook = [...(gradebookEntries || [])]
      .filter((g) => g && g.final_mark != null)
      .sort(
        (a, b) =>
          Number(new Date(b.synced_at || 0)) - Number(new Date(a.synced_at || 0)),
      )
      .slice(0, 5)
      .map((g) => {
        const student = studentById[g.student_id];
        const course = courseById[g.course_id];
        const percentage = Number(g.final_mark);
        const letter =
          g.letter_grade && g.letter_grade !== '-'
            ? g.letter_grade
            : getLetterGrade(percentage, gradeScale);
        const name = student?.name || 'Unknown Student';
        const parts = name.trim().split(/\s+/);
        const initial =
          parts.length >= 2
            ? `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
            : (name.trim()[0] || '?').toUpperCase();
        return {
          id: `gb-${g.id}`,
          name,
          initial,
          subtitle: course?.name || 'Gradebook final',
          scoreLabel: `${Math.round(percentage)}/100`,
          letter,
        };
      });

    if (fromGradebook.length > 0) return fromGradebook;

    return [...(results || [])]
      .sort(
        (a, b) =>
          Number(new Date(b.graded_at || b.created_at || 0)) -
          Number(new Date(a.graded_at || a.created_at || 0)),
      )
      .slice(0, 5)
      .map((r) => {
        const student = studentById[r.student_id];
        const exam = examById[r.exam_id];
        const total = getExamTotalMarks(exam);
        const percentage = getExamScorePercent(r.final_score ?? r.score, exam);
        const letter = getLetterGrade(percentage, gradeScale);
        const name = student?.name || 'Unknown Student';
        const parts = name.trim().split(/\s+/);
        const initial =
          parts.length >= 2
            ? `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
            : (name.trim()[0] || '?').toUpperCase();
        return {
          id: `ex-${r.id}`,
          name,
          initial,
          subtitle: exam?.title || 'Submitted exam',
          scoreLabel: `${Math.round(Number(r.final_score ?? r.score ?? 0))}/${Math.round(total)}`,
          letter,
        };
      });
  }, [gradebookEntries, results, exams, students, courses, gradeScale]);

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
  const chartEmpty = !loading && stats.tuition === 0 && stats.registration === 0;
  const axisColor = isLight ? 'var(--ds-text-secondary, #5B6B61)' : '#94a3b8';
  const gridColor = isLight ? 'var(--ds-border, #DDE5DF)' : '#1e293b';

  return (
    <AnimatedPage>
      <Helmet>
        <title>Administrator Dashboard</title>
      </Helmet>

      <PageHeader
        eyebrow="Institution · Today"
        title={isAdmin ? 'Administrator Dashboard' : 'Staff Dashboard'}
        subtitle="Enrollment, cash flow, and academic pulse in one scan."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Total Students"
          value={v(stats.students)}
          tone="info"
          descriptionTone={stats.growthTone}
          trendIcon={
            stats.growthTrend === 'up' ? (
              <TrendingUp className="h-3 w-3 shrink-0" />
            ) : stats.growthTrend === 'down' ? (
              <TrendingDown className="h-3 w-3 shrink-0 text-[var(--ds-text-tertiary,#8A978E)]" />
            ) : null
          }
          icon={<Users className="h-[18px] w-[18px]" />}
          description={loading ? '…' : stats.growthLabel}
        />
        <StatCard
          title="Active Classes"
          value={v(stats.classes)}
          tone="corporate"
          descriptionTone="secondary"
          icon={<School className="h-[18px] w-[18px]" />}
          description="Currently running"
        />
        {showFinance ? (
          <StatCard
            title="Total Revenue"
            value={loading ? '…' : formatCurrency(stats.revenue)}
            tone="primary"
            descriptionTone="accent"
            trendIcon={<TrendingUp className="h-3 w-3 shrink-0" />}
            icon={<DollarSign className="h-[18px] w-[18px]" />}
            description="Gross volume"
          />
        ) : (
          <StatCard
            title="Total Revenue"
            value="—"
            tone="primary"
            descriptionTone="secondary"
            icon={<DollarSign className="h-[18px] w-[18px]" />}
            description="Admin / staff only"
          />
        )}
        {showFinance ? (
          <StatCard
            title="Outstanding Balance"
            value={loading ? '…' : formatCurrency(stats.outstandingBalance)}
            tone="warning"
            descriptionTone="warning"
            trendIcon={<Timer className="h-3 w-3 shrink-0" />}
            icon={<AlertCircle className="h-[18px] w-[18px]" />}
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
            tone="primary"
            descriptionTone="accent"
            icon={<Activity className="h-[18px] w-[18px]" />}
            description="All services operational"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-3 [.tenant-shell_&]:rounded-[var(--ds-radius-xl,16px)] [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)]">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white [.tenant-shell_&]:text-[17px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:tracking-[-0.01em] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                Revenue mix
              </CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px] [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                Tuition vs registration this term
              </CardDescription>
            </div>
            <span className="shrink-0 font-data text-[11px] font-semibold text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
              {periodLabel}
            </span>
          </CardHeader>
          <CardContent className="h-[300px] px-6 pb-6 pt-2">
            {showFinance ? (
              loading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading revenue…
                </div>
              ) : chartEmpty ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  No completed payments yet this term.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 28, right: 12, left: 0, bottom: 4 }}>
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
                        fill: isLight
                          ? 'color-mix(in srgb, var(--ds-primary, #1F8A5B) 6%, transparent)'
                          : 'rgba(148, 163, 184, 0.08)',
                      }}
                      contentStyle={{
                        background: isLight ? 'var(--ds-surface, #fff)' : '#0f172a',
                        border: isLight
                          ? '1px solid var(--ds-border, #DDE5DF)'
                          : '1px solid #1e293b',
                        borderRadius: 8,
                        color: isLight ? 'var(--ds-text-primary, #122018)' : '#f8fafc',
                        fontSize: 13,
                      }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Amount']}
                    />
                    <Bar dataKey="amount" radius={[10, 10, 10, 10]} maxBarSize={96}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                      <LabelList
                        dataKey="amount"
                        position="top"
                        formatter={(value: number) => formatCurrency(Number(value))}
                        style={{
                          fill: isLight ? 'var(--ds-text-primary, #122018)' : '#e2e8f0',
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: 'Arial, Helvetica, sans-serif',
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Finance metrics are available to admin and staff.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2 [.tenant-shell_&]:rounded-[var(--ds-radius-xl,16px)] [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)]">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white [.tenant-shell_&]:text-[17px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:tracking-[-0.01em] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                Latest results
              </CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px] [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                Gradebook updates
              </CardDescription>
            </div>
            <Link
              to="/gradebook"
              className="shrink-0 text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40 rounded-sm"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-0 px-6 pb-4 pt-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading results…</p>
            ) : latestResults.length > 0 ? (
              latestResults.map((item, index) => {
                const avatarColor =
                  LATEST_RESULT_AVATAR_COLORS[index % LATEST_RESULT_AVATAR_COLORS.length];
                return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-transparent py-2.5 last:border-0 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]/0"
                >
                  <Avatar className="h-9 w-9 border-0">
                    <AvatarFallback
                      className="text-[12px] font-bold"
                      style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                    >
                      {item.initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white [.tenant-shell_&]:text-[13px] [.tenant-shell_&]:font-semibold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-slate-500 [.tenant-shell_&]:text-[11px] [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                      {item.subtitle}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-data text-[13px] font-bold tabular-nums text-emerald-400 [.tenant-shell_&]:text-[var(--ds-primary,#1F8A5B)]">
                      {item.scoreLabel}
                    </span>
                    <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] font-bold text-sky-300 [.tenant-shell_&]:bg-[var(--ds-primary-soft,#ECFDF5)] [.tenant-shell_&]:text-[var(--ds-accent,#0F766E)]">
                      {item.letter}
                    </span>
                  </div>
                </div>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                No gradebook results yet. Marks appear here after exams and assignments are graded.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
};

export default DashboardPage;
