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
  ClipboardList,
  ListChecks,
  ClipboardCheck,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DsPrimaryAction, DS_ICON_STROKE } from '@/components/ui/ds-actions';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';
import { getRegistrationFeeAmount } from '@/lib/institution';
import { computeStudentBalance } from '@/lib/finance';
import { getInstitutionGradeScale } from '@/lib/gradingScale';
import { getExamScorePercent, getExamTotalMarks, getLetterGrade } from '@/lib/examPass';
import { getPersonInitials, getStudentAvatarColor } from '@/lib/studentAvatar';
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

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

const isCompletedPayment = (p: { status?: string | null }) =>
  (p.status || 'completed') === 'completed';

const toDateKey = (value: unknown) => {
  if (!value) return null;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const mondayOfWeek = (now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Administrator / Staff overview — visual layout from design-system.pen.
 * Admin: Institution KPIs + revenue mix + latest results.
 * Staff: Operations KPIs + daily activity + priority queue (real data only).
 * Data fetching and business logic unchanged.
 */
const DashboardPage = () => {
  const { user, institution } = useAuth();
  const {
    students,
    classes,
    payments,
    enrollments,
    results,
    exams,
    courses,
    diplomas,
    gradebookEntries,
    generalRegistrations,
    loading,
    error,
  } = useData();
  const showFinance = user?.role === 'admin' || user?.role === 'staff';
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const registrationFee = getRegistrationFeeAmount(institution);
  const gradeScale = useMemo(() => getInstitutionGradeScale(institution), [institution]);

  const periodLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(new Date()),
    [],
  );

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const weekStart = useMemo(() => mondayOfWeek(), []);

  const courseById = useMemo(
    () => Object.fromEntries((courses || []).map((c) => [c.id, c])),
    [courses],
  );
  const diplomaById = useMemo(
    () => Object.fromEntries((diplomas || []).map((d) => [d.id, d])),
    [diplomas],
  );
  const studentById = useMemo(
    () => Object.fromEntries((students || []).map((s) => [s.id, s])),
    [students],
  );

  const resolveProgramLabel = (reg: any) =>
    reg?.program_name ||
    reg?.preferred_course?.name ||
    (reg?.preferred_course_id ? courseById[reg.preferred_course_id]?.name : null) ||
    reg?.preferred_diploma?.name ||
    (reg?.preferred_diploma_id ? diplomaById[reg.preferred_diploma_id]?.name : null) ||
    'Registration';

  const stats = useMemo(() => {
    const activeClasses = classes.filter((c) => c.is_active).length;
    const completed = payments.filter((p) => isCompletedPayment(p));
    const revenue = completed.reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
    const tuition = completed
      .filter((p) => !p.is_registration_fee)
      .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
    const registration = completed
      .filter((p) => p.is_registration_fee)
      .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);

    let outstandingBalance = 0;
    let outstandingStudents = 0;
    const outstandingList: { id: string; name: string; balance: number }[] = [];
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
        outstandingList.push({
          id: student.id,
          name: student.name || 'Student',
          balance,
        });
      }
    }
    outstandingList.sort((a, b) => b.balance - a.balance);

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
      outstandingList,
    };
  }, [students, classes, payments, enrollments, registrationFee, institution]);

  const staffOps = useMemo(() => {
    const pendingRegs = (generalRegistrations || []).filter((r) => r.status === 'pending');
    const pendingPays = (payments || []).filter((p) => p.status === 'pending');

    const paymentsToday = (payments || []).filter((p) => {
      if (!isCompletedPayment(p)) return false;
      return toDateKey(p.payment_date || p.created_at) === todayKey;
    });
    const paymentsTodayAmount = paymentsToday.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );

    const touchedIds = new Set<string>();
    for (const s of students || []) {
      if (toDateKey(s.registration_date || s.created_at) === todayKey) {
        touchedIds.add(s.id);
      }
    }
    for (const p of payments || []) {
      if (toDateKey(p.payment_date || p.created_at) !== todayKey) continue;
      if (p.student_id) touchedIds.add(p.student_id);
    }
    for (const r of generalRegistrations || []) {
      if (toDateKey(r.created_at || r.submitted_at) !== todayKey) continue;
      if (r.student_id) touchedIds.add(r.student_id);
    }

    const openTasks = pendingRegs.length + pendingPays.length;

    const activity = WEEKDAY_LABELS.map((label, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      const key = toDateKey(day);
      let amount = 0;
      for (const p of payments || []) {
        if (!isCompletedPayment(p)) continue;
        if (toDateKey(p.payment_date || p.created_at) === key) amount += 1;
      }
      for (const r of generalRegistrations || []) {
        if (toDateKey(r.created_at || r.submitted_at) === key) amount += 1;
      }
      for (const s of students || []) {
        if (toDateKey(s.registration_date || s.created_at) === key) amount += 1;
      }
      const intensity = Math.min(1, 0.35 + amount * 0.08);
      return {
        name: label,
        amount,
        fill:
          amount === 0
            ? 'var(--ds-primary-muted, #D1FAE5)'
            : `color-mix(in srgb, var(--ds-primary, #1F8A5B) ${Math.round(intensity * 100)}%, var(--ds-primary-soft, #ECFDF5))`,
      };
    });

    const queue: {
      id: string;
      title: string;
      detail: string;
      priority: 'High' | 'Med' | 'Low';
      href: string;
    }[] = [];

    for (const reg of pendingRegs.slice(0, 4)) {
      const program = resolveProgramLabel(reg);
      queue.push({
        id: `reg-${reg.id}`,
        title: 'New registration',
        detail: `${reg.student_name || 'Applicant'} · ${program}`,
        priority: 'High',
        href: '/students/forms',
      });
    }

    for (const pay of pendingPays.slice(0, 3)) {
      const student = studentById[pay.student_id];
      queue.push({
        id: `pay-${pay.id}`,
        title: 'Payment verify',
        detail: `${student?.name || 'Student'} · ${formatCurrency(Number(pay.amount || 0))}`,
        priority: 'High',
        href: '/finance',
      });
    }

    for (const row of stats.outstandingList.slice(0, 4)) {
      if (queue.length >= 5) break;
      queue.push({
        id: `bal-${row.id}`,
        title: 'Balance reminder',
        detail: `${row.name} · ${formatCurrency(row.balance)} due`,
        priority: 'Med',
        href: '/finance',
      });
    }

    const priorityRank = { High: 0, Med: 1, Low: 2 };
    queue.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

    return {
      openTasks,
      pendingRegs: pendingRegs.length,
      pendingPays: pendingPays.length,
      studentsTouched: touchedIds.size,
      paymentsLogged: paymentsToday.length,
      paymentsTodayAmount,
      classesCovered: stats.classes,
      activity,
      queue: queue.slice(0, 5),
      seeAllHref:
        pendingRegs.length > 0
          ? '/students/forms'
          : pendingPays.length > 0 || stats.outstandingStudents > 0
            ? '/finance'
            : '/students',
    };
  }, [
    generalRegistrations,
    payments,
    students,
    todayKey,
    weekStart,
    stats.classes,
    stats.outstandingList,
    stats.outstandingStudents,
    studentById,
    courseById,
    diplomaById,
  ]);

  const chartData = useMemo(
    () => [
      { name: 'Tuition', amount: stats.tuition, fill: 'var(--ds-primary, #1F8A5B)' },
      { name: 'Registration', amount: stats.registration, fill: 'var(--ds-accent, #1F8A5B)' },
    ],
    [stats.tuition, stats.registration],
  );

  const latestResults = useMemo(() => {
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
  }, [gradebookEntries, results, exams, studentById, courseById, gradeScale]);

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
  const axisColor = 'var(--ds-text-secondary, #5B6B61)';
  const gridColor = 'var(--ds-border, #DDE5DF)';
  const activityEmpty = !loading && staffOps.activity.every((d) => d.amount === 0);

  const priorityBadgeClass = (priority: 'High' | 'Med' | 'Low') => {
    if (priority === 'High') {
      return 'border-transparent bg-[var(--ds-warning-bg,#FFF7ED)] text-[var(--ds-warning,#C2410C)]';
    }
    if (priority === 'Med') {
      return 'border-transparent bg-[var(--ds-info-bg,#EFF6FF)] text-[var(--ds-info,#2563EB)]';
    }
    return 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-secondary,#5B6B61)]';
  };

  /* ── Staff workspace (design-system.pen · Staff Dashboard) ── */
  if (isStaff) {
    return (
      <AnimatedPage>
        <Helmet>
          <title>Staff workspace</title>
        </Helmet>

        <PageHeader
          eyebrow="Operations · Staff"
          title="Staff workspace"
          subtitle="Registrations, balances, and attendance queues ready for action."
        >
          <DsPrimaryAction asChild>
            <Link to="/attendance">
              <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} />
              Mark attendance
            </Link>
          </DsPrimaryAction>
        </PageHeader>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            title="Open tasks"
            value={v(staffOps.openTasks)}
            tone="warning"
            descriptionTone={staffOps.openTasks > 0 ? 'warning' : 'secondary'}
            icon={<ClipboardList className="h-[18px] w-[18px]" />}
            description={
              loading
                ? '…'
                : staffOps.openTasks > 0
                  ? 'Needs review today'
                  : 'Nothing pending'
            }
          />
          <StatCard
            title="Students touched"
            value={v(staffOps.studentsTouched)}
            tone="info"
            descriptionTone="secondary"
            icon={<Users className="h-[18px] w-[18px]" />}
            description="Today"
          />
          <StatCard
            title="Payments logged"
            value={v(staffOps.paymentsLogged)}
            tone="primary"
            descriptionTone={staffOps.paymentsLogged > 0 ? 'accent' : 'secondary'}
            trendIcon={
              staffOps.paymentsLogged > 0 ? (
                <TrendingUp className="h-3 w-3 shrink-0" />
              ) : null
            }
            icon={<DollarSign className="h-[18px] w-[18px]" />}
            description={
              loading
                ? '…'
                : staffOps.paymentsLogged > 0
                  ? `${formatCurrency(staffOps.paymentsTodayAmount)} today`
                  : 'No payments today'
            }
          />
          <StatCard
            title="Classes covered"
            value={v(staffOps.classesCovered)}
            tone="corporate"
            descriptionTone="secondary"
            icon={<School className="h-[18px] w-[18px]" />}
            description="Currently running"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="border-slate-800 bg-slate-900/50 lg:col-span-3">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg text-white">Daily activity</CardTitle>
                <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                  Registrations, enrollments, and payments this week
                </CardDescription>
              </div>
              <span className="shrink-0 font-data text-[11px] font-semibold text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                This week
              </span>
            </CardHeader>
            <CardContent className="h-[300px] px-6 pb-6 pt-2">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  Loading activity…
                </div>
              ) : activityEmpty ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  No operational activity recorded this week yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staffOps.activity} margin={{ top: 28, right: 12, left: 0, bottom: 4 }}>
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
                      formatter={(value) => [Number(value), 'Events']}
                    />
                    <Bar dataKey="amount" radius={[10, 10, 10, 10]} maxBarSize={72}>
                      {staffOps.activity.map((entry) => (
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

          <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg text-white">Priority queue</CardTitle>
                <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                  Items needing staff action
                </CardDescription>
              </div>
              <Link
                to={staffOps.seeAllHref}
                className="shrink-0 text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40 rounded-sm"
              >
                See all
              </Link>
            </CardHeader>
            <CardContent className="space-y-0 px-6 pb-4 pt-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  Loading queue…
                </p>
              ) : staffOps.queue.length > 0 ? (
                staffOps.queue.map((item) => (
                  <Link
                    key={item.id}
                    to={item.href}
                    className="flex items-center gap-3 border-b border-slate-800 py-2.5 last:border-0 transition-colors hover:bg-[var(--ds-surface-muted,#F7FAF8)]/60 -mx-2 px-2 rounded-md [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white [.tenant-shell_&]:text-[13px] [.tenant-shell_&]:font-semibold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-slate-500 [.tenant-shell_&]:text-[11px] [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        {item.detail}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide ${priorityBadgeClass(item.priority)}`}
                    >
                      {item.priority}
                    </Badge>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <ListChecks className="h-8 w-8 text-[var(--ds-primary-muted,#D1FAE5)]" />
                  <p className="text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                    Queue is clear. New registrations and pending payments will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  /* ── Administrator Dashboard (design-system.pen · Admin Dashboard) ── */
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
        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white">
                Revenue mix
              </CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
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
                <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
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
                        fill: 'color-mix(in srgb, var(--ds-primary, #1F8A5B) 10%, transparent)',
                      }}
                      contentStyle={{
                        background: 'var(--ds-surface, #fff)',
                        border: '1px solid var(--ds-border, #DDE5DF)',
                        borderRadius: 8,
                        color: 'var(--ds-text-primary, #122018)',
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
                          fill: 'var(--ds-text-primary, #122018)',
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
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                Finance metrics are available to admin and staff.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white">
                Latest results
              </CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
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
              <p className="py-8 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">Loading results…</p>
            ) : latestResults.length > 0 ? (
              latestResults.map((item, index) => {
                const avatarColor = getStudentAvatarColor(item.id || item.name || String(index))
                return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-slate-800 py-2.5 last:border-0 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]"
                >
                  <Avatar className="h-9 w-9 border-0">
                    <AvatarFallback
                      className="text-[12px] font-semibold"
                      style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                    >
                      {item.initial || getPersonInitials(item.name)}
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
