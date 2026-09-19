import React, { useMemo, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DsPrimaryAction, DsOutlineAction, DS_ICON_STROKE } from '@/components/ui/ds-actions';
import {
  BookOpen,
  Calendar,
  ArrowRight,
  CheckCircle,
  CreditCard,
  ClipboardList,
  GraduationCap,
  Activity,
  FileText,
} from 'lucide-react';
import { getAttendanceEnriched } from '@/lib/api';
import { formatCurrency, formatDate, getMonthsBetween, cn } from '@/lib/utils';
import { goToTenantLanding } from '@/lib/institution';
import { computeStudentBalance, computeMonthlyFee } from '@/lib/finance';
import { getLetterGrade } from '@/lib/examPass';
import { getInstitutionGradeScale } from '@/lib/gradingScale';
import { getPersonInitials } from '@/lib/studentAvatar';

const formatMonthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  if (!y || !m) return ym;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

const formatRelative = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
};

/**
 * Student academic + finance overview — visual layout from design-system.pen
 * (Student Dashboard), matching Admin/Staff/Instructor shell patterns.
 * Data fetching, finance math, and permissions unchanged.
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
      const progress =
        monthlyFee > 0 ? Math.min(100, (paidAmount / monthlyFee) * 100) : status === 'paid' ? 100 : 0;
      return {
        month,
        label: formatMonthLabel(month),
        monthlyFee,
        paidAmount,
        remaining,
        status,
        progress,
      };
    });
  }, [activeClass, activeEnrollment, myPayments]);

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

  const classRows = useMemo(() => {
    return activeClasses.map((cls: any) => {
      const classAttendance = myAttendance.filter((a) => a.class_id === cls.id);
      const present = classAttendance.filter(
        (a) => a.status === 'present' || a.status === 'late',
      ).length;
      const rate =
        classAttendance.length > 0 ? Math.round((present / classAttendance.length) * 100) : null;
      const gb = (gradebookEntries || []).find(
        (g) => g.student_id === studentId && g.class_id === cls.id && g.final_mark != null,
      );
      const letter =
        gb?.letter_grade && gb.letter_grade !== '-'
          ? gb.letter_grade
          : gb?.final_mark != null
            ? getLetterGrade(Number(gb.final_mark), gradeScale)
            : null;
      return {
        id: cls.id,
        name: cls.name,
        start: cls.start_date,
        letter,
        attendanceRate: rate,
        isActive: true,
      };
    });
  }, [activeClasses, myAttendance, gradebookEntries, studentId, gradeScale]);

  const recentActivity = useMemo(() => {
    const items: {
      id: string;
      title: string;
      detail: string;
      at: number;
      icon: 'assignment' | 'grade' | 'attendance' | 'payment';
    }[] = [];

    for (const s of assignmentSubmissions || []) {
      if (s.student_id !== studentId || !s.submitted_at) continue;
      const assignment = (assignments || []).find((a) => a.id === s.assignment_id);
      items.push({
        id: `sub-${s.id}`,
        title: 'Assignment submitted',
        detail: `${assignment?.title || 'Assignment'} · ${formatRelative(s.submitted_at)}`,
        at: Number(new Date(s.submitted_at)),
        icon: 'assignment',
      });
    }

    for (const g of gradebookEntries || []) {
      if (g.student_id !== studentId || g.final_mark == null) continue;
      const when = g.synced_at || g.updated_at || g.created_at;
      if (!when) continue;
      const course = courses.find((c) => c.id === g.course_id);
      const letter =
        g.letter_grade && g.letter_grade !== '-'
          ? g.letter_grade
          : getLetterGrade(Number(g.final_mark), gradeScale);
      items.push({
        id: `gb-${g.id}`,
        title: 'Grade posted',
        detail: `${course?.name || 'Course'} · ${letter}`,
        at: Number(new Date(when)),
        icon: 'grade',
      });
    }

    for (const r of myResults || []) {
      const when = r.graded_at || r.created_at;
      if (!when) continue;
      items.push({
        id: `res-${r.id}`,
        title: 'Exam result',
        detail: `Score ${r.score ?? '—'} · ${formatRelative(when)}`,
        at: Number(new Date(when)),
        icon: 'grade',
      });
    }

    for (const a of myAttendance || []) {
      const when = a.date || a.created_at;
      if (!when) continue;
      const label =
        a.status === 'present' || a.status === 'late'
          ? 'Present'
          : a.status === 'absent'
            ? 'Absent'
            : String(a.status || 'Marked');
      items.push({
        id: `att-${a.id}`,
        title: 'Attendance marked',
        detail: `${label} · ${formatDate(when)}`,
        at: Number(new Date(when)),
        icon: 'attendance',
      });
    }

    for (const p of myPayments || []) {
      if (p.status && p.status !== 'completed') continue;
      const when = p.payment_date || p.created_at;
      if (!when) continue;
      items.push({
        id: `pay-${p.id}`,
        title: p.is_registration_fee ? 'Registration fee paid' : 'Tuition payment',
        detail: `${formatCurrency(Number(p.amount || 0))} · ${formatRelative(when)}`,
        at: Number(new Date(when)),
        icon: 'payment',
      });
    }

    return items
      .filter((i) => Number.isFinite(i.at))
      .sort((a, b) => b.at - a.at)
      .slice(0, 6);
  }, [
    assignmentSubmissions,
    assignments,
    gradebookEntries,
    courses,
    myResults,
    myAttendance,
    myPayments,
    studentId,
    gradeScale,
  ]);

  const nextDueLabel = useMemo(() => {
    const due = monthlyBreakdown.find((r) => r.status === 'unpaid' || r.status === 'partial');
    if (!due) return financialSummary.balance > 0 ? 'Outstanding balance' : 'All clear';
    return `Due ${due.label}`;
  }, [monthlyBreakdown, financialSummary.balance]);

  const displayName = user?.name || studentRecord?.name || 'Student';
  const initials = getPersonInitials(displayName, 'ST');
  const studentCode = user?.studentCode || studentRecord?.student_code || studentRecord?.code || '—';
  const loading = authLoading || dataLoading || loadingAttendance;
  const v = (n: React.ReactNode) => (loading ? '…' : n);

  const activityIcon = (kind: string) => {
    if (kind === 'assignment') return <ClipboardList className="h-3.5 w-3.5" />;
    if (kind === 'grade') return <GraduationCap className="h-3.5 w-3.5" />;
    if (kind === 'attendance') return <CheckCircle className="h-3.5 w-3.5" />;
    return <CreditCard className="h-3.5 w-3.5" />;
  };

  const monthStatusBadge = (status: string) => {
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
    if (status === 'upcoming') {
      return (
        <Badge
          variant="outline"
          className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-secondary,#5B6B61)]"
        >
          Upcoming
        </Badge>
      );
    }
    return (
      <Badge className="border-transparent bg-[var(--ds-danger-bg,#FEF2F2)] text-[var(--ds-danger,#DC2626)]">
        Due
      </Badge>
    );
  };

  if (!authLoading && !user) return null;

  return (
    <AnimatedPage>
      <Helmet>
        <title>Dashboard | Student Portal</title>
      </Helmet>

      {/* Profile header — design-system.pen Student Dashboard */}
      <Card className="mb-5 overflow-hidden border-slate-800 bg-slate-900/50">
        <div className="flex flex-col md:flex-row">
          <div
            className="flex shrink-0 flex-col items-center justify-center gap-3 px-6 py-6 md:w-[200px] md:py-7"
            style={{
              background: 'linear-gradient(200deg, #0B3D2E 0%, #145C45 100%)',
            }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ECFDF5] ring-4 ring-[#34D39955]">
              <span className="font-data text-[22px] font-bold text-[#0B3D2E]">{initials}</span>
            </div>
            <span className="font-data text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A7D7C0]">
              Active
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0 space-y-2">
              <p className="text-[13px] text-slate-400 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                Welcome back
              </p>
              <h1 className="truncate text-[24px] font-bold tracking-[-0.02em] text-white sm:text-[28px] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-data border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] text-[11px] font-semibold text-[var(--ds-text-secondary,#5B6B61)]"
                >
                  {studentCode}
                </Badge>
                {programLabel ? (
                  <>
                    <Badge className="border-transparent bg-[var(--ds-primary-soft,#ECFDF5)] text-[11px] font-semibold text-[var(--ds-accent,#0F766E)]">
                      {programLabel.kind}
                    </Badge>
                    <span className="truncate text-[12px] text-slate-400 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                      {programLabel.name}
                    </span>
                  </>
                ) : null}
                {activeEnrollment ? (
                  <Badge className="border-transparent bg-[var(--ds-primary-soft,#ECFDF5)] text-[11px] font-semibold text-[var(--ds-accent,#0F766E)]">
                    Active enrollment
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <DsPrimaryAction asChild>
                <Link to="/portal/id-card">
                  <CreditCard className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} />
                  Student ID
                </Link>
              </DsPrimaryAction>
              <DsOutlineAction asChild>
                <Link to="/student/classes">
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} />
                  My classes
                </Link>
              </DsOutlineAction>
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Attendance"
          value={
            overallAttendanceStats.total === 0
              ? v('—')
              : v(`${Math.round(overallAttendanceStats.rate)}%`)
          }
          tone="primary"
          descriptionTone="secondary"
          icon={<CheckCircle className="h-[18px] w-[18px]" />}
          description={
            loading
              ? '…'
              : overallAttendanceStats.total === 0
                ? 'No sessions yet'
                : `${overallAttendanceStats.present} / ${overallAttendanceStats.total} sessions`
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
          title="Assignments"
          value={v(assignmentsDueThisWeek)}
          tone={assignmentsDueThisWeek > 0 ? 'warning' : 'corporate'}
          descriptionTone={assignmentsDueThisWeek > 0 ? 'warning' : 'secondary'}
          icon={<ClipboardList className="h-[18px] w-[18px]" />}
          description={
            loading
              ? '…'
              : assignmentsDueThisWeek > 0
                ? 'Due this week'
                : 'Nothing due this week'
          }
        />
        <StatCard
          title="Balance"
          value={loading ? '…' : formatCurrency(financialSummary.balance)}
          tone={financialSummary.balance > 0 ? 'danger' : 'primary'}
          descriptionTone={financialSummary.balance > 0 ? 'danger' : 'secondary'}
          icon={<FileText className="h-[18px] w-[18px]" />}
          description={loading ? '…' : nextDueLabel}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg text-white">Monthly balance</CardTitle>
                <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                  {activeClass?.name
                    ? `Tuition months for ${activeClass.name}`
                    : 'Tuition months for your active class'}
                  {financialSummary.monthlyFee > 0
                    ? ` · ${formatCurrency(financialSummary.monthlyFee)} / month`
                    : ''}
                </CardDescription>
              </div>
              <Link
                to="/portal/finance"
                className="shrink-0 rounded-sm text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40"
              >
                Pay now
              </Link>
            </CardHeader>
            <CardContent className="space-y-3 px-6 pb-6 pt-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  Loading balance…
                </p>
              ) : monthlyBreakdown.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  No tuition schedule for an active class yet.
                </p>
              ) : (
                monthlyBreakdown.map((row) => (
                  <div
                    key={row.month}
                    className="flex flex-col gap-2 rounded-[var(--ds-radius-md,8px)] border border-slate-800 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]"
                  >
                    <div className="flex w-full items-center justify-between gap-3 sm:w-28 sm:shrink-0 sm:flex-col sm:items-start sm:justify-center sm:gap-0.5">
                      <span className="text-[13px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                        {row.label}
                      </span>
                      <span className="text-[11px] text-slate-500 sm:hidden">
                        {row.status === 'paid'
                          ? formatCurrency(row.paidAmount)
                          : row.status === 'partial'
                            ? `${formatCurrency(row.paidAmount)} / ${formatCurrency(row.monthlyFee)}`
                            : formatCurrency(row.monthlyFee)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--ds-border,#DDE5DF)]">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            row.status === 'paid' && 'bg-[var(--ds-primary,#0B3D2E)]',
                            row.status === 'partial' && 'bg-[var(--ds-warning,#C2410C)]',
                            row.status === 'unpaid' && 'bg-[var(--ds-danger,#DC2626)]',
                            row.status === 'upcoming' && 'bg-[var(--ds-border-strong,#C5D0C8)]',
                          )}
                          style={{
                            width: `${row.status === 'upcoming' ? 12 : Math.max(row.progress, row.status === 'unpaid' ? 8 : 0)}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 hidden text-[11px] text-slate-500 sm:block [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        {row.status === 'paid'
                          ? `Paid ${formatCurrency(row.paidAmount)}`
                          : row.status === 'partial'
                            ? `Paid ${formatCurrency(row.paidAmount)} · Due ${formatCurrency(row.remaining)}`
                            : row.status === 'upcoming'
                              ? `Upcoming · ${formatCurrency(row.monthlyFee)}`
                              : `Due ${formatCurrency(row.monthlyFee)}`}
                      </p>
                    </div>
                    <div className="shrink-0 self-end sm:self-center">{monthStatusBadge(row.status)}</div>
                  </div>
                ))
              )}
              {!loading && financialSummary.regBalance > 0 ? (
                <p className="text-sm text-[var(--ds-warning,#C2410C)]">
                  Registration fee still due: {formatCurrency(financialSummary.regBalance)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" />
                  Quick actions
                </CardTitle>
                <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                  Jump to grades, attendance, assignments, and finance
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 px-6 pb-6 pt-2 sm:grid-cols-2">
              {[
                { to: '/portal/gradebook', label: 'My grades', icon: GraduationCap },
                { to: '/portal/attendance', label: 'Attendance log', icon: CheckCircle },
                { to: '/portal/assignments', label: 'Assignments', icon: ClipboardList },
                { to: '/portal/finance', label: 'Financial status', icon: CreditCard },
              ].map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex items-center justify-between rounded-[var(--ds-radius-md,8px)] border border-slate-800 px-3 py-2.5 transition-colors hover:bg-[var(--ds-surface-muted,#F7FAF8)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]"
                >
                  <span className="flex items-center gap-2.5 text-[13px] font-medium text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                    <action.icon className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" strokeWidth={DS_ICON_STROKE} />
                    {action.label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg text-white">My classes</CardTitle>
                <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                  Active enrollments
                </CardDescription>
              </div>
              <Link
                to="/student/classes"
                className="shrink-0 rounded-sm text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 px-6 pb-6 pt-2">
              {loading ? (
                <p className="py-6 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  Loading classes…
                </p>
              ) : classRows.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <BookOpen className="h-8 w-8 text-[var(--ds-primary-muted,#D1FAE5)]" />
                  <p className="text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                    No active classes. Contact your institution if this looks wrong.
                  </p>
                </div>
              ) : (
                classRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => navigate('/student/classes')}
                    className="flex w-full items-start justify-between gap-3 rounded-[var(--ds-radius-md,8px)] border border-slate-800 px-3 py-2.5 text-left transition-colors hover:bg-[var(--ds-surface-muted,#F7FAF8)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                        {row.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {row.start ? formatDate(row.start) : 'In progress'}
                        {row.attendanceRate != null ? ` · ${row.attendanceRate}% attendance` : ''}
                      </p>
                    </div>
                    {row.letter ? (
                      <Badge className="shrink-0 border-transparent bg-[var(--ds-primary-soft,#ECFDF5)] font-data text-[var(--ds-accent,#0F766E)]">
                        {row.letter}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-[var(--ds-border,#DDE5DF)] text-[var(--ds-text-secondary,#5B6B61)]"
                      >
                        Active
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="space-y-1 p-6 pb-2">
              <CardTitle className="text-lg text-white">Recent activity</CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                Grades, attendance, assignments, and payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 px-6 pb-6 pt-2">
              {loading ? (
                <p className="py-6 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  Loading activity…
                </p>
              ) : recentActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                  No recent academic or payment activity yet.
                </p>
              ) : (
                recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 border-b border-slate-800 py-2.5 last:border-0 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ds-radius-md,8px)] bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)]">
                      {activityIcon(item.icon)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default StudentDashboard;
