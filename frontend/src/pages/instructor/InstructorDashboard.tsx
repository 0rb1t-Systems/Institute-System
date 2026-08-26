import React, { useMemo, useState, Suspense, lazy } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { dashboardStyles } from '@/components/instructor/InstructorDashboardStyles';
import { Users, BookOpen, Star, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

import MonthYearSelector from '@/components/instructor/MonthYearSelector';
import ClassesOverviewSection from '@/components/instructor/ClassesOverviewSection';
import EarningsHistoryTable from '@/components/instructor/EarningsHistoryTable';

const EarningsVisualization = lazy(() => import('@/components/instructor/EarningsVisualization'));

function isSameMonth(dateValue, selectedDate) {
  if (!dateValue || !selectedDate) return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getMonth() === selectedDate.getMonth() &&
    d.getFullYear() === selectedDate.getFullYear()
  );
}

const InstructorDashboard = () => {
  const { user } = useAuth();
  const { classes = [], instructorEarnings = [], enrollments = [], students = [], payments = [] } = useData();
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const { filteredEarnings, myClasses, totalStudents } = useMemo(() => {
    if (!user?.id) {
      return { filteredEarnings: [], myClasses: [], totalStudents: 0 };
    }

    const myClassesList = (classes || []).filter(
      (c) =>
        c.instructor_id === user.id &&
        (!user.institution_id || c.institution_id === user.institution_id)
    );
    const myClassIds = new Set(myClassesList.map((c) => c.id));

    const filtered = (instructorEarnings || []).filter(
      (e) => e.instructor_id === user.id && isSameMonth(e.created_at, selectedDate),
    );

    const myEnrollments = (enrollments || []).filter(
      (e) => myClassIds.has(e.class_id) && e.status === 'active',
    );
    const uniqueStudentIds = new Set(myEnrollments.map((e) => e.student_id));

    return {
      filteredEarnings: filtered,
      myClasses: myClassesList,
      totalStudents: uniqueStudentIds.size,
    };
  }, [classes, instructorEarnings, enrollments, user?.id, selectedDate]);

  const kpis = useMemo(() => {
    const monthlyTotal = filteredEarnings.reduce((sum: any, e: any) => sum + (Number(e.amount) || 0), 0);

    return [
      {
        label: 'Students Enrolled',
        value: totalStudents,
        icon: Users,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/20',
      },
      {
        label: 'Active Classes',
        value: myClasses.filter((c) => c.is_active).length,
        icon: BookOpen,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10 border-purple-500/20',
      },
      {
        label: `Earnings (${format(selectedDate, 'MMM')})`,
        value: formatCurrency(monthlyTotal),
        icon: Star,
        color: 'text-green-400',
        bg: 'bg-green-500/10 border-green-500/20',
      },
      {
        label: 'Overall Rating',
        value: '4.9',
        icon: GraduationCap,
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10 border-yellow-500/20',
      },
    ];
  }, [filteredEarnings, myClasses, totalStudents, selectedDate]);

  const displayName = user?.name || user?.user_metadata?.name || 'Instructor';

  return (
    <AnimatedPage className={dashboardStyles.container}>
      <Helmet>
        <title>Instructor Dashboard | Portal</title>
      </Helmet>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-2">
        <PageHeader
          title={`Hello, ${displayName}`}
          subtitle="Track your class performance and monthly revenue."
        />
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-[var(--tenant-muted)] font-medium uppercase tracking-wider">
            Reporting Period
          </span>
          <MonthYearSelector selectedDate={selectedDate} onChange={setSelectedDate} />
        </div>
      </div>

      <div className={dashboardStyles.grid}>
        {kpis.map((kpi, index) => (
          <div
            key={index}
            className={`${dashboardStyles.card} border flex items-center gap-4 hover:scale-[1.02] transition-transform`}
          >
            <div className={`p-4 rounded-xl ${kpi.bg} border`}>
              <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
            </div>
            <div>
              <p className={dashboardStyles.metricLabel}>{kpi.label}</p>
              <h3 className={dashboardStyles.metricValue}>{kpi.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <ClassesOverviewSection
        classes={myClasses}
        enrollments={enrollments || []}
        periodEarnings={filteredEarnings}
        selectedDate={selectedDate}
      />

      <Suspense fallback={<div className={`${dashboardStyles.card} h-64 animate-pulse`} />}>
        <EarningsVisualization
          earnings={filteredEarnings}
          selectedDate={selectedDate}
          classes={myClasses}
        />
      </Suspense>

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
