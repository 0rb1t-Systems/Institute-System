import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import {
  Users,
  School,
  DollarSign,
  ClipboardList,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DsPrimaryAction, DS_ICON_STROKE } from '@/components/ui/ds-actions';
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

import MonthYearSelector from '@/components/instructor/MonthYearSelector';
import ClassesOverviewSection from '@/components/instructor/ClassesOverviewSection';
import EarningsHistoryTable from '@/components/instructor/EarningsHistoryTable';

function isSameMonth(dateValue, selectedDate) {
  if (!dateValue || !selectedDate) return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getMonth() === selectedDate.getMonth() &&
    d.getFullYear() === selectedDate.getFullYear()
  );
}

/**
 * Instructor teaching + earnings overview — visual layout from design-system.pen
 * (Instructor Dashboard), matching Admin/Staff DashboardPage shell patterns.
 * Data fetching and permissions unchanged.
 */
const InstructorDashboard = () => {
  const { user } = useAuth();
  const {
    classes = [],
    instructorEarnings = [],
    enrollments = [],
    students = [],
    payments = [],
    assignments = [],
    assignmentSubmissions = [],
    loading,
  } = useData();
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const { filteredEarnings, myClasses, totalStudents, pendingGrading } = useMemo(() => {
    if (!user?.id) {
      return { filteredEarnings: [], myClasses: [], totalStudents: 0, pendingGrading: 0 };
    }

    const myClassesList = (classes || []).filter(
      (c) =>
        c.instructor_id === user.id &&
        (!user.institution_id || c.institution_id === user.institution_id),
    );
    const myClassIds = new Set(myClassesList.map((c) => c.id));

    const filtered = (instructorEarnings || []).filter(
      (e) => e.instructor_id === user.id && isSameMonth(e.created_at, selectedDate),
    );

    const myEnrollments = (enrollments || []).filter(
      (e) => myClassIds.has(e.class_id) && e.status === 'active',
    );
    const uniqueStudentIds = new Set(myEnrollments.map((e) => e.student_id));

    const myAssignmentIds = new Set(
      (assignments || []).filter((a) => myClassIds.has(a.class_id)).map((a) => a.id),
    );
    const pending = (assignmentSubmissions || []).filter(
      (s) =>
        myAssignmentIds.has(s.assignment_id) &&
        s.score == null &&
        s.grade == null,
    ).length;

    return {
      filteredEarnings: filtered,
      myClasses: myClassesList,
      totalStudents: uniqueStudentIds.size,
      pendingGrading: pending,
    };
  }, [
    classes,
    instructorEarnings,
    enrollments,
    assignments,
    assignmentSubmissions,
    user?.id,
    user?.institution_id,
    selectedDate,
  ]);

  const activeClassCount = useMemo(
    () => myClasses.filter((c) => c.is_active).length,
    [myClasses],
  );

  const monthlyTotal = useMemo(
    () => filteredEarnings.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filteredEarnings],
  );

  const weekChartData = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    for (const e of filteredEarnings) {
      if (!e?.created_at) continue;
      const d = new Date(e.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const day = d.getDate();
      const weekIndex = Math.min(4, Math.floor((day - 1) / 7));
      buckets[weekIndex] += Number(e.amount) || 0;
    }
    const fills = [
      'var(--ds-primary, #0B3D2E)',
      'color-mix(in srgb, var(--ds-primary, #0B3D2E) 82%, white)',
      'color-mix(in srgb, var(--ds-primary, #0B3D2E) 64%, white)',
      'color-mix(in srgb, var(--ds-accent, #1F8A5B) 88%, white)',
      'color-mix(in srgb, var(--ds-accent, #1F8A5B) 70%, white)',
    ];
    return buckets.map((amount, i) => ({
      name: `W${i + 1}`,
      amount,
      fill: fills[i],
    }));
  }, [filteredEarnings]);

  const displayName = user?.name || user?.user_metadata?.name || 'Instructor';
  const monthLabel = format(selectedDate, 'MMM yyyy');
  const v = (n) => (loading ? '…' : n);
  const chartEmpty = !loading && weekChartData.every((d) => d.amount === 0);
  const axisColor = 'var(--ds-text-secondary, #5B6B61)';
  const gridColor = 'var(--ds-border, #DDE5DF)';

  return (
    <AnimatedPage>
      <Helmet>
        <title>Instructor Dashboard | Portal</title>
      </Helmet>

      <PageHeader
        eyebrow="Teaching · Instructor"
        title={`Hello, ${displayName}`}
        subtitle="Class performance and monthly earnings at a glance."
      >
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <MonthYearSelector selectedDate={selectedDate} onChange={setSelectedDate} />
          <DsPrimaryAction asChild>
            <Link to="/attendance">
              <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} />
              Mark attendance
            </Link>
          </DsPrimaryAction>
        </div>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Students enrolled"
          value={v(totalStudents)}
          tone="info"
          descriptionTone="secondary"
          icon={<Users className="h-[18px] w-[18px]" />}
          description={loading ? '…' : 'Across your classes'}
        />
        <StatCard
          title="Active classes"
          value={v(activeClassCount)}
          tone="corporate"
          descriptionTone="secondary"
          icon={<School className="h-[18px] w-[18px]" />}
          description="Currently running"
        />
        <StatCard
          title={`Earnings (${format(selectedDate, 'MMM')})`}
          value={loading ? '…' : formatCurrency(monthlyTotal)}
          tone="primary"
          descriptionTone={monthlyTotal > 0 ? 'accent' : 'secondary'}
          trendIcon={
            monthlyTotal > 0 ? <TrendingUp className="h-3 w-3 shrink-0" /> : null
          }
          icon={<DollarSign className="h-[18px] w-[18px]" />}
          description={loading ? '…' : monthLabel}
        />
        <StatCard
          title="To grade"
          value={v(pendingGrading)}
          tone={pendingGrading > 0 ? 'warning' : 'primary'}
          descriptionTone={pendingGrading > 0 ? 'warning' : 'secondary'}
          icon={<ClipboardList className="h-[18px] w-[18px]" />}
          description={
            loading
              ? '…'
              : pendingGrading > 0
                ? 'Assignment submissions waiting'
                : 'Nothing pending'
          }
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <ClassesOverviewSection
            classes={myClasses}
            enrollments={enrollments || []}
            periodEarnings={filteredEarnings}
            selectedDate={selectedDate}
            loading={loading}
          />
        </div>

        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg text-white">Earnings trend</CardTitle>
              <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
                Weekly share for {monthLabel}
              </CardDescription>
            </div>
            <Link
              to="/instructor/earnings"
              className="shrink-0 rounded-sm text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="h-[300px] px-6 pb-6 pt-2">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                Loading earnings…
              </div>
            ) : chartEmpty ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                No earnings recorded for this month yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekChartData} margin={{ top: 28, right: 12, left: 0, bottom: 4 }}>
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
                    formatter={(value) => [formatCurrency(Number(value)), 'Earned']}
                  />
                  <Bar dataKey="amount" radius={[10, 10, 10, 10]} maxBarSize={56}>
                    {weekChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
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
      </div>

      <EarningsHistoryTable
        earnings={filteredEarnings}
        students={students}
        classes={myClasses}
        payments={payments}
        selectedDate={selectedDate}
      />
    </AnimatedPage>
  );
};

export default InstructorDashboard;
