import React, { useMemo, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DsPrimaryAction, DS_ICON_STROKE } from '@/components/ui/ds-actions';
import {
  Calendar,
  CreditCard,
  ClipboardList,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { getAttendanceEnriched } from '@/lib/api';
import { formatCurrency, getMonthsBetween } from '@/lib/utils';
import { goToTenantLanding } from '@/lib/institution';
import { computeStudentBalance, computeMonthlyFee } from '@/lib/finance';
import { getLetterGrade } from '@/lib/examPass';
import { getInstitutionGradeScale } from '@/lib/gradingScale';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';

const CLASS_PIE_COLORS = ['#0B3D2E', '#1F8A5B', '#34B87A', '#059669', '#C5D0C8'];

const formatMonthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  if (!y || !m) return ym;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

const formatMonthShort = (ym: string) => {
  const [y, m] = ym.split('-');
  if (!y || !m) return ym;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
};

const timeGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Student academic + finance overview — visual layout from design-system.pen
 * (Student Dashboard). Data fetching, finance math, and permissions unchanged.
 */
const StudentDashboard = () => {
  const { user, institution, loading: authLoading } = useAuth();
  const {
    enrollments,
    classes,
    results,
    payments,
    gradebookEntries,
    assignments = [],
    assignmentSubmissions = [],
    courses = [],
    diplomas = [],
    students = [],
    loading: dataLoading,
  } = useData();
  const navigate = useNavigate();
  const gradeScale = useMemo(() => getInstitutionGradeScale(institution), [institution]);

  const [attendance, setAttendance] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  const studentId = user?.studentId || user?.id;

  const studentRecord = useMemo(() => {
    if (!studentId && !user?.id) return null;
    return (
      students.find((s) => s.id === studentId) ||
      students.find((s) => s.profile_id === user?.id) ||
      null
    );
  }, [students, studentId, user?.id]);

  useEffect(() => {
    if (!authLoading && !user) {
      goToTenantLanding(institution, null, navigate);
    }
  }, [user, authLoading, navigate, institution]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      setLoadingAttendance(true);
      try {
        const rows = await getAttendanceEnriched({ student_id: studentId });
        if (!cancelled) setAttendance(rows || []);
      } catch {
        if (!cancelled) setAttendance([]);
      } finally {
        if (!cancelled) setLoadingAttendance(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const myEnrollments = useMemo(() => {
    if (!studentId) return [];
    return enrollments.filter((e) => e.student_id === studentId);
  }, [studentId, enrollments]);

  const activeClasses = useMemo(() => {
    return myEnrollments
      .filter((e) => e.status === 'active')
      .map((e) => classes.find((c) => c.id === e.class_id))
      .filter(Boolean);
  }, [myEnrollments, classes]);

  const myClassIds = useMemo(
    () => new Set(activeClasses.map((c: any) => c.id)),
    [activeClasses],
  );

  const myAttendance = useMemo(() => {
    if (!studentId) return [];
    return attendance.filter((a) => a.student_id === studentId);
  }, [studentId, attendance]);

  const myResults = useMemo(() => {
    if (!studentId) return [];
    return results.filter((r) => r.student_id === studentId);
  }, [studentId, results]);

  const overallAttendanceStats = useMemo(() => {
    const total = myAttendance.length;
    if (total === 0) return { present: 0, absent: 0, rate: 0, total: 0 };
    const present = myAttendance.filter(
      (a) => a.status === 'present' || a.status === 'late',
    ).length;
    const absent = myAttendance.filter((a) => a.status === 'absent').length;
    return {
      present,
      absent,
      total,
      rate: (present / total) * 100,
    };
  }, [myAttendance]);

  const averageGrade = useMemo(() => {
    if (!studentId) return { pct: 0, letter: '—', count: 0 };
    const gbRows = (gradebookEntries || []).filter(
      (g) => g.student_id === studentId && g.final_mark != null,
    );
    if (gbRows.length > 0) {
      const sum = gbRows.reduce((acc, g) => acc + Number(g.final_mark), 0);
      const pct = sum / gbRows.length;
      const letterFromGb = gbRows.find((g) => g.letter_grade && g.letter_grade !== '-')?.letter_grade;
      return {
        pct,
        letter: letterFromGb || getLetterGrade(pct, gradeScale),
        count: gbRows.length,
      };
    }
    if (myResults.length === 0) return { pct: 0, letter: '—', count: 0 };
    const sum = myResults.reduce((acc: number, r: any) => {
      const total = Number(r.total_marks) || 100;
      return acc + (Number(r.score) / total) * 100;
    }, 0);
    const pct = sum / myResults.length;
    return { pct, letter: getLetterGrade(pct, gradeScale), count: myResults.length };
  }, [studentId, myResults, gradebookEntries, gradeScale]);

  const myPayments = useMemo(() => {
    if (!studentId) return [];
    return payments.filter((p) => p.student_id === studentId);
  }, [payments, studentId]);

  const activeEnrollment = useMemo(() => {
    if (!studentId) return null;
    return enrollments.find((e) => e.student_id === studentId && e.status === 'active') || null;
  }, [enrollments, studentId]);

  const activeClass = useMemo(() => {
    if (!activeEnrollment) return null;
    return classes.find((c) => c.id === activeEnrollment.class_id) || null;
  }, [activeEnrollment, classes]);

  const programLabel = useMemo(() => {
    if (!activeClass) return null;
    if (activeClass.course_id) {
      const course = courses.find((c) => c.id === activeClass.course_id);
      if (course?.name) return { kind: 'Course', name: course.name };
    }
    if (activeClass.diploma_id) {
      const diploma = diplomas.find((d) => d.id === activeClass.diploma_id);
      if (diploma?.name) return { kind: 'Diploma', name: diploma.name };
    }
    return activeClass.name ? { kind: 'Class', name: activeClass.name } : null;
  }, [activeClass, courses, diplomas]);

  const financialSummary = useMemo(() => {
    return computeStudentBalance({
      payments: myPayments,
      activeClass,
      enrollment: activeEnrollment,
      institution,
    });
  }, [myPayments, activeClass, activeEnrollment, institution]);

  const monthlyBreakdown = useMemo(() => {
    if (!activeClass?.start_date || !activeClass?.end_date) return [];
    const months = getMonthsBetween(activeClass.start_date, activeClass.end_date);
    const monthlyFee = computeMonthlyFee(activeClass, activeEnrollment);
    const paidByMonth = new Map<string, number>();
    const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    myPayments.forEach((p) => {
      if (p.is_registration_fee) return;
      if (p.status && p.status !== 'completed') return;
      const key = p.month_paid ? String(p.month_paid).slice(0, 7) : null;
      if (!key) return;
      paidByMonth.set(key, (paidByMonth.get(key) || 0) + Number(p.amount || 0));
    });

    return months.map((month) => {
      const paidAmount = paidByMonth.get(month) || 0;
      const remaining = Math.max(0, monthlyFee - paidAmount);
      let status: 'paid' | 'partial' | 'unpaid' | 'upcoming' =
        paidAmount <= 0 ? 'unpaid' : remaining > 0 ? 'partial' : 'paid';
      if (status === 'unpaid' && month > nowKey) status = 'upcoming';
      return {
        month,
        label: formatMonthLabel(month),
        shortLabel: formatMonthShort(month),
        monthlyFee,
        paidAmount,
        remaining,
        status,
        displayAmount: status === 'upcoming' ? 0 : status === 'paid' ? paidAmount : remaining || monthlyFee,
      };
    });
  }, [activeClass, activeEnrollment, myPayments]);

  const monthlyBars = useMemo(() => {
    const rows = monthlyBreakdown.slice(-5);
    const maxFee = Math.max(...rows.map((r) => r.monthlyFee || 0), 1);
    return rows.map((row) => {
      let fill = 'var(--ds-border-strong, #C5D0C8)';
      let amountLabel = '—';
      let barValue = Math.max(maxFee * 0.12, 1);
      if (row.status === 'paid') {
        fill = 'var(--ds-success, #059669)';
        amountLabel = formatCurrency(row.paidAmount || row.monthlyFee);
        barValue = row.monthlyFee || maxFee;
      } else if (row.status === 'partial' || row.status === 'unpaid') {
        fill = 'var(--ds-danger, #DC2626)';
        amountLabel = formatCurrency(row.remaining || row.monthlyFee);
        barValue = Math.max((row.remaining || row.monthlyFee) * 0.45, maxFee * 0.28);
      }
      return {
        name: row.shortLabel,
        amount: barValue,
        fill,
        amountLabel,
        status: row.status,
      };
    });
  }, [monthlyBreakdown]);

  const paidYtd = useMemo(() => {
    const year = new Date().getFullYear();
    return myPayments
      .filter((p) => {
        if (p.status && p.status !== 'completed') return false;
        const when = p.payment_date || p.created_at;
        if (!when) return false;
        return new Date(when).getFullYear() === year;
      })
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [myPayments]);

  const assignmentsDueThisWeek = useMemo(() => {
    if (!studentId || myClassIds.size === 0) return 0;
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    return (assignments || []).filter((a) => {
      if (!myClassIds.has(a.class_id)) return false;
      if (!a.due_date) return false;
      const due = new Date(a.due_date);
      if (Number.isNaN(due.getTime())) return false;
      if (due < now || due > weekEnd) return false;
      const submitted = (assignmentSubmissions || []).some(
        (s) => s.assignment_id === a.id && s.student_id === studentId,
      );
      return !submitted;
    }).length;
  }, [assignments, assignmentSubmissions, myClassIds, studentId]);

  const classShare = useMemo(() => {
    if (activeClasses.length === 0) return [];
    const weights = activeClasses.map((cls: any) => {
      const sessions = myAttendance.filter((a) => a.class_id === cls.id).length;
      return { cls, weight: Math.max(sessions, 1) };
    });
    const total = weights.reduce((sum, w) => sum + w.weight, 0) || 1;
    return weights.map((w, index) => ({
      name: w.cls.name || 'Class',
      value: w.weight,
      pct: Math.round((w.weight / total) * 100),
      status: 'Active',
      fill: CLASS_PIE_COLORS[index % CLASS_PIE_COLORS.length],
    }));
  }, [activeClasses, myAttendance]);

  const displayName = user?.name || studentRecord?.name || 'Student';
  const studentCode = user?.studentCode || studentRecord?.student_code || studentRecord?.code || '—';
  const loading = authLoading || dataLoading || loadingAttendance;
  const v = (n: React.ReactNode) => (loading ? '…' : n);
  const greeting = useMemo(() => timeGreeting(), []);
  const axisColor = 'var(--ds-text-tertiary, #8A978E)';
  const gridColor = 'var(--ds-border, #DDE5DF)';
  const balanceEmpty = !loading && monthlyBars.length === 0;
  const classesEmpty = !loading && classShare.length === 0;

  if (!authLoading && !user) return null;

  return (
    <AnimatedPage>
      <Helmet>
        <title>Dashboard | Student Portal</title>
      </Helmet>

      {/* Greeting header — design-system.pen Student Dashboard */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[14px] font-medium text-slate-400 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
            {greeting}
          </p>
          <h1 className="truncate text-[24px] font-bold tracking-[-0.025em] text-white sm:text-[28px] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
            {displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-[6px] border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] px-2 py-1 font-data text-[12px] font-semibold text-[var(--ds-text-secondary,#5B6B61)]"
            >
              {studentCode}
            </Badge>
            {programLabel ? (
              <>
                <Badge className="rounded-[6px] border-transparent bg-[var(--ds-primary-soft,#ECFDF5)] px-2 py-1 text-[12px] font-semibold text-[var(--ds-accent,#0F766E)]">
                  {programLabel.kind}
                </Badge>
                <span className="truncate text-[13px] font-medium text-slate-400 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                  {programLabel.name}
                </span>
              </>
            ) : null}
            {activeEnrollment ? (
              <>
                <span className="hidden h-1 w-1 rounded-full bg-[var(--ds-border-strong,#C5D0C8)] sm:inline-block" />
                <Badge className="gap-1.5 rounded-[6px] border-transparent bg-[var(--ds-primary-soft,#ECFDF5)] px-2 py-1 text-[12px] font-semibold text-[var(--ds-accent,#0F766E)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-success,#059669)]" />
                  Active
                </Badge>
              </>
            ) : null}
          </div>
        </div>
        <DsPrimaryAction asChild>
          <Link to="/portal/id-card">
            <CreditCard className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
            Student ID
          </Link>
        </DsPrimaryAction>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-[12px]">
        <StatCard
          title="Attendance"
          value={
            overallAttendanceStats.total === 0 ? (
              v('—')
            ) : (
              <span className="text-[var(--ds-success,#059669)]">
                {v(`${Math.round(overallAttendanceStats.rate)}%`)}
              </span>
            )
          }
          tone="primary"
          descriptionTone="secondary"
          icon={<Calendar className="h-[18px] w-[18px]" />}
          description={
            loading
              ? '…'
              : overallAttendanceStats.total === 0
                ? 'No sessions yet'
                : `${overallAttendanceStats.present} of ${overallAttendanceStats.total} sessions`
          }
        />
        <StatCard
          title="Avg grade"
          value={v(averageGrade.count === 0 ? '—' : averageGrade.letter)}
          tone="info"
          descriptionTone="secondary"
          icon={<GraduationCap className="h-[18px] w-[18px]" />}
          description={
            loading
              ? '…'
              : averageGrade.count === 0
                ? 'No grades yet'
                : averageGrade.count === 1
                  ? '1 course graded'
                  : `Across ${averageGrade.count} courses`
          }
        />
        <StatCard
          title="Due soon"
          value={
            <span
              className={
                assignmentsDueThisWeek > 0
                  ? 'text-[var(--ds-warning,#C2410C)]'
                  : undefined
              }
            >
              {v(assignmentsDueThisWeek)}
            </span>
          }
          tone="warning"
          descriptionTone="secondary"
          icon={<ClipboardList className="h-[18px] w-[18px]" />}
          description="Assignments this week"
        />
        <StatCard
          title="Paid"
          value={v(formatCurrency(paidYtd))}
          tone="primary"
          descriptionTone="secondary"
          icon={<CreditCard className="h-[18px] w-[18px]" />}
          description="Year to date"
        />
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
        <Card className="border-slate-800 bg-slate-900/50 min-h-[368px]">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-[22px] pb-0">
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="text-lg text-white [.tenant-shell_&]:text-[16px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                My classes
              </CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                Share of study time
              </CardDescription>
            </div>
            <Link
              to="/student/classes"
              className="shrink-0 rounded-sm text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center px-[22px] pb-[22px] pt-[18px]">
            {loading ? (
              <p className="py-16 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                Loading classes…
              </p>
            ) : classesEmpty ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <BookOpen className="h-8 w-8 text-[var(--ds-primary-muted,#D1FAE5)]" />
                <p className="text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  No active classes. Contact your institution if this looks wrong.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center">
                <div className="h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={classShare}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {classShare.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--ds-surface, #fff)',
                          border: '1px solid var(--ds-border, #DDE5DF)',
                          borderRadius: 8,
                          color: 'var(--ds-text-primary, #122018)',
                          fontSize: 13,
                        }}
                        formatter={(value, name) => [`${Number(value)} sessions`, String(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex w-full min-w-0 flex-1 flex-col gap-3.5">
                  {classShare.map((row) => (
                    <div key={row.name} className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: row.fill }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                          {row.name}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                          {row.status}
                        </p>
                      </div>
                      <span className="shrink-0 font-data text-[14px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                        {row.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50 min-h-[368px]">
          <CardHeader className="space-y-0.5 p-[22px] pb-0">
            <CardTitle className="text-lg text-white [.tenant-shell_&]:text-[16px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
              Monthly balance
            </CardTitle>
            <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
              {financialSummary.monthlyFee > 0
                ? `${formatCurrency(financialSummary.monthlyFee)} / month · last ${Math.min(5, monthlyBars.length || 5)} months`
                : 'Tuition months for your active class'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-[18px] px-[22px] pb-[22px] pt-[18px]">
            <div className="flex items-end gap-2.5">
              <span
                className={`font-data text-[28px] font-semibold leading-none tracking-[-0.02em] ${
                  financialSummary.balance > 0
                    ? 'text-[var(--ds-danger,#DC2626)]'
                    : 'text-[var(--ds-success,#059669)]'
                }`}
              >
                {loading ? '…' : formatCurrency(financialSummary.balance)}
              </span>
              <span className="pb-0.5 text-[12px] font-medium text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                {financialSummary.balance > 0 ? 'outstanding' : 'cleared'}
              </span>
            </div>

            {loading ? (
              <p className="py-12 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                Loading balance…
              </p>
            ) : balanceEmpty ? (
              <p className="py-12 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                No tuition schedule for an active class yet.
              </p>
            ) : (
              <>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyBars} margin={{ top: 22, right: 4, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="0" stroke={gridColor} vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 11, fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{
                          fill: 'color-mix(in srgb, var(--ds-primary, #1F8A5B) 8%, transparent)',
                        }}
                        contentStyle={{
                          background: 'var(--ds-surface, #fff)',
                          border: '1px solid var(--ds-border, #DDE5DF)',
                          borderRadius: 8,
                          color: 'var(--ds-text-primary, #122018)',
                          fontSize: 13,
                        }}
                        formatter={(_value, _name, item) => [
                          item?.payload?.amountLabel || '—',
                          item?.payload?.status || 'Status',
                        ]}
                      />
                      <Bar dataKey="amount" radius={[6, 6, 6, 6]} maxBarSize={42}>
                        {monthlyBars.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                        <LabelList
                          dataKey="amountLabel"
                          position="top"
                          style={{
                            fill: 'var(--ds-text-tertiary, #8A978E)',
                            fontSize: 10,
                            fontWeight: 600,
                            fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap items-center gap-3.5">
                  {[
                    { label: 'Paid', color: 'var(--ds-success, #059669)' },
                    { label: 'Due', color: 'var(--ds-danger, #DC2626)' },
                    { label: 'Upcoming', color: 'var(--ds-border-strong, #C5D0C8)' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="text-[11px] font-medium text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!loading && financialSummary.regBalance > 0 ? (
              <p className="text-sm text-[var(--ds-warning,#C2410C)]">
                Registration fee still due: {formatCurrency(financialSummary.regBalance)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
};

export default StudentDashboard;
