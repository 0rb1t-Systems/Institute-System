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
import { DsPrimaryAction, DS_ICON_STROKE } from '@/components/ui/ds-actions';
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
  Cell,
  LabelList,
  PieChart,
  Pie,
} from 'recharts';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

/** Chart palette aligned with design-system.pen Admin Dashboard */
const CHART_PALETTE = ['#2563EB', '#1F8A5B', '#F59E0B', '#8B5CF6', '#06B6D4'] as const;

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
 * Admin: Institution KPIs + student distribution (pie) + class registration (column).
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
    courses,
    diplomas,
    generalRegistrations,
    loading,
    error,
  } = useData();
  const showFinance = user?.role === 'admin' || user?.role === 'staff';
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const registrationFee = getRegistrationFeeAmount(institution);

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

    const priorityColors = {
      High: 'var(--ds-warning, #C2410C)',
      Med: 'var(--ds-info, #2563EB)',
      Low: 'var(--ds-border-strong, #C5D0C8)',
    } as const;
    const priorityOrder = ['High', 'Med', 'Low'] as const;
    const priorityMix = priorityOrder
      .map((level) => {
        const items = queue.filter((q) => q.priority === level);
        const samples = [...new Set(items.map((q) => q.title.replace(/^New /, '').replace(/ verify$/, '').replace(/ reminder$/, '')))]
          .slice(0, 2)
          .join(' · ');
        return {
          name: level,
          value: items.length,
          fill: priorityColors[level],
          samples: samples || (level === 'High' ? 'Registration · Payment' : level === 'Med' ? 'Balance · Attendance' : 'Document request'),
        };
      })
      .filter((row) => row.value > 0);
    const priorityTotal = priorityMix.reduce((sum, row) => sum + row.value, 0);

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
      priorityMix,
      priorityTotal,
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

  const classById = useMemo(
    () => Object.fromEntries((classes || []).map((c) => [c.id, c])),
    [classes],
  );

  /** Student Distribution — donut by program (design-system.pen Admin lower section) */
  const studentDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    const activeStudentIds = new Set<string>();

    for (const enrollment of enrollments || []) {
      if (enrollment.status !== 'active') continue;
      const cls = classById[enrollment.class_id];
      let label = 'Unassigned';
      if (cls?.course_id && courseById[cls.course_id]?.name) {
        label = courseById[cls.course_id].name;
      } else if (cls?.diploma_id && diplomaById[cls.diploma_id]?.name) {
        label = diplomaById[cls.diploma_id].name;
      } else if (cls?.name) {
        label = cls.name;
      }
      counts.set(label, (counts.get(label) || 0) + 1);
      if (enrollment.student_id) activeStudentIds.add(enrollment.student_id);
    }

    // Students without an active enrollment still count toward the total slice
    for (const student of students || []) {
      if (activeStudentIds.has(student.id)) continue;
      const label = 'Not enrolled';
      counts.set(label, (counts.get(label) || 0) + 1);
    }

    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4);
    const restTotal = rest.reduce((sum, [, n]) => sum + n, 0);
    const rows =
      restTotal > 0
        ? [...top, ['Other', restTotal] as [string, number]]
        : top;

    const total = rows.reduce((sum, [, n]) => sum + n, 0) || stats.students || 0;
    return {
      total: stats.students || total,
      slices: rows.map(([name, value], index) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
        fill: CHART_PALETTE[index % CHART_PALETTE.length],
      })),
    };
  }, [enrollments, classById, courseById, diplomaById, students, stats.students]);

  /** Class Registration — monthly new students (last 5 months) */
  const monthlyRegistrations = useMemo(() => {
    const now = new Date();
    const months: { key: string; name: string; amount: number; fill: string }[] = [];
    for (let i = 4; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months.push({
        key,
        name: d.toLocaleDateString('en-US', { month: 'short' }),
        amount: 0,
        fill: CHART_PALETTE[(4 - i) % CHART_PALETTE.length],
      });
    }
    const indexByKey = Object.fromEntries(months.map((m, i) => [m.key, i]));
    for (const student of students || []) {
      const d = new Date(student.registration_date || student.created_at || 0);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const idx = indexByKey[key];
      if (idx != null) months[idx].amount += 1;
    }
    const rangeLabel =
      months.length >= 2
        ? `${months[0].name} – ${months[months.length - 1].name}`
        : 'Last 5 months';
    return { months, rangeLabel };
  }, [students]);

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
  const axisColor = 'var(--ds-text-secondary, #5B6B61)';
  const gridColor = 'var(--ds-border, #DDE5DF)';
  const chartTooltipStyle = {
    contentStyle: {
      background: 'var(--ds-surface, #fff)',
      border: '1px solid var(--ds-border, #DDE5DF)',
      borderRadius: 8,
      color: 'var(--ds-text-primary, #122018)',
      fontSize: 13,
    },
    itemStyle: {
      color: 'var(--ds-text-primary, #122018)',
    },
    labelStyle: {
      color: 'var(--ds-text-primary, #122018)',
      fontWeight: 600,
    },
  } as const;
  const activityEmpty = !loading && staffOps.activity.every((d) => d.amount === 0);
  const distributionEmpty = !loading && studentDistribution.slices.length === 0;
  const registrationsEmpty =
    !loading && monthlyRegistrations.months.every((d) => d.amount === 0);

  /* ── Staff workspace (design-system.pen · Staff Dashboard) ── */
  if (isStaff) {
    return (
      <AnimatedPage>
        <Helmet>
          <title>Staff workspace</title>
        </Helmet>

        <PageHeader
          eyebrow="OPERATIONS > STAFF"
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
            tone="primary"
            descriptionTone="secondary"
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
            description="This morning"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg text-white [.tenant-shell_&]:text-[16px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                  Daily activity
                </CardTitle>
                <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                  Tasks completed this week
                </CardDescription>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--ds-surface-muted,#F7FAF8)] px-3 py-1.5 font-data text-[11px] font-semibold text-[var(--ds-text-tertiary,#8A978E)]">
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
                      {...chartTooltipStyle}
                      formatter={(value) => [Number(value), 'Tasks']}
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
                          fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg text-white [.tenant-shell_&]:text-[16px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                  Priority queue
                </CardTitle>
                <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                  By priority level
                </CardDescription>
              </div>
              <Link
                to={staffOps.seeAllHref}
                className="shrink-0 rounded-sm text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40"
              >
                See all
              </Link>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  Loading queue…
                </p>
              ) : staffOps.priorityMix.length > 0 ? (
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-7">
                  <div className="h-[168px] w-[168px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={staffOps.priorityMix}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {staffOps.priorityMix.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          {...chartTooltipStyle}
                          formatter={(value, name) => [`${Number(value)} tasks`, String(name)]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex w-full min-w-0 flex-1 flex-col gap-3.5">
                    {staffOps.priorityMix.map((row) => {
                      const pct =
                        staffOps.priorityTotal > 0
                          ? Math.round((row.value / staffOps.priorityTotal) * 100)
                          : 0;
                      return (
                        <div key={row.name} className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: row.fill }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                              {row.name}
                            </p>
                            <p className="truncate text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                              {row.samples}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-data text-[14px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                              {pct}%
                            </p>
                            <p className="text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                              {row.value} task{row.value === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
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

      {/* Lower section — 2 columns: pie + column (design-system.pen) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white [.tenant-shell_&]:text-[16px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                Student Distribution
              </CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                By program enrollment
              </CardDescription>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--ds-surface-muted,#F7FAF8)] px-3 py-1.5 font-data text-[11px] font-semibold text-[var(--ds-text-tertiary,#8A978E)]">
              {periodLabel}
            </span>
          </CardHeader>
          <CardContent className="flex min-h-[300px] items-center px-6 pb-6 pt-2">
            {loading ? (
              <p className="w-full py-16 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                Loading distribution…
              </p>
            ) : distributionEmpty ? (
              <p className="w-full py-16 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                No students to chart yet.
              </p>
            ) : (
              <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
                <div className="relative h-[200px] w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={studentDistribution.slices}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {studentDistribution.slices.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...chartTooltipStyle}
                        formatter={(value, name) => [`${Number(value)} students`, String(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-data text-[22px] font-bold leading-none text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                      {studentDistribution.total}
                    </span>
                    <span className="mt-1 text-[11px] font-medium text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                      Total Students
                    </span>
                  </div>
                </div>
                <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
                  {studentDistribution.slices.map((row) => (
                    <div key={row.name} className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: row.fill }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                          {row.name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-data text-[14px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                          {row.pct}%
                        </p>
                        <p className="text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                          {row.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white [.tenant-shell_&]:text-[16px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                Class Registration
              </CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                Monthly new registrations
              </CardDescription>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--ds-surface-muted,#F7FAF8)] px-3 py-1.5 font-data text-[11px] font-semibold text-[var(--ds-text-tertiary,#8A978E)]">
              {monthlyRegistrations.rangeLabel}
            </span>
          </CardHeader>
          <CardContent className="h-[300px] px-6 pb-6 pt-2">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                Loading registrations…
              </div>
            ) : registrationsEmpty ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                No new registrations in the last five months.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyRegistrations.months}
                  margin={{ top: 28, right: 12, left: 0, bottom: 4 }}
                >
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
                    {...chartTooltipStyle}
                    formatter={(value) => [Number(value), 'Registrations']}
                  />
                  <Bar dataKey="amount" radius={[10, 10, 0, 0]} maxBarSize={56}>
                    {monthlyRegistrations.months.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="amount"
                      position="top"
                      style={{
                        fill: 'var(--ds-text-primary, #122018)',
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
};

export default DashboardPage;
