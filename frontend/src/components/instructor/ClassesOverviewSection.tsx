import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, CheckCircle2, XCircle, ArrowRight, School } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DsIconButton, DS_ICON_STROKE } from '@/components/ui/ds-actions';

function formatSafeDate(value) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return format(d, 'MMM d, yyyy');
}

const ClassesOverviewSection = ({
  classes = [],
  enrollments = [],
  periodEarnings = [],
  selectedDate,
  loading = false,
}) => {
  const navigate = useNavigate();
  const monthName = selectedDate ? format(selectedDate, 'MMMM') : '';

  const sortedClasses = useMemo(() => {
    const classStats = (classes || []).map((cls) => {
      const classEnrollments = (enrollments || []).filter(
        (e) => e.class_id === cls.id && e.status === 'active',
      );
      const enrollmentCount = classEnrollments.length;
      const capacity = cls.capacity || 30;
      const fillRate = capacity > 0 ? (enrollmentCount / capacity) * 100 : 0;
      const periodClassEarnings = (periodEarnings || [])
        .filter((e) => e.class_id === cls.id)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return {
        ...cls,
        enrollmentCount,
        capacity,
        fillRate,
        periodEarnings: periodClassEarnings,
      };
    });

    return [...classStats].sort((a, b) => {
      if (a.is_active !== b.is_active) return b.is_active ? 1 : -1;
      return b.periodEarnings - a.periodEarnings;
    });
  }, [classes, enrollments, periodEarnings]);

  return (
    <Card className="border-slate-800 bg-slate-900/50 h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-6 pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg text-white">Classes overview</CardTitle>
          <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
            Enrollment and earnings for {monthName || 'this period'}
          </CardDescription>
        </div>
        <Link
          to="/instructor/classes"
          className="shrink-0 rounded-sm text-[12px] font-semibold text-[var(--ds-accent,#1F8A5B)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/40"
        >
          Manage all
        </Link>
      </CardHeader>
      <CardContent className="px-0 pb-2 pt-2">
        {loading ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
            Loading classes…
          </p>
        ) : sortedClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <School className="h-8 w-8 text-[var(--ds-primary-muted,#D1FAE5)]" />
            <p className="text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
              No classes assigned yet. Assigned classes will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left border-collapse">
              <thead className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                <tr>
                  <th className="px-6 py-2.5 font-semibold">Class</th>
                  <th className="px-4 py-2.5 font-semibold">Schedule</th>
                  <th className="px-4 py-2.5 font-semibold">Enrollment</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">
                    Earnings ({monthName})
                  </th>
                  <th className="px-6 py-2.5 text-right font-semibold">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedClasses.map((cls) => (
                  <tr
                    key={cls.id}
                    className="border-b border-slate-800 last:border-0 transition-colors hover:bg-[var(--ds-surface-muted,#F7FAF8)]/60 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]"
                  >
                    <td className="px-6 py-3">
                      <p className="truncate text-sm font-medium text-white [.tenant-shell_&]:text-[13px] [.tenant-shell_&]:font-semibold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                        {cls.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 [.tenant-shell_&]:text-[11px] [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        {cls.course?.name || 'General Course'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-slate-400 [.tenant-shell_&]:text-[12px] [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatSafeDate(cls.start_date)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        {cls.duration_months || 1} month(s)
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-[120px]">
                        <div className="mb-1.5 flex justify-between text-[11px]">
                          <span className="font-medium text-white [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                            {cls.enrollmentCount}
                          </span>
                          <span className="text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                            {Math.round(cls.fillRate)}%
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, Math.max(0, cls.fillRate))}
                          className="h-1.5 bg-[var(--ds-border,#DDE5DF)]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          cls.is_active
                            ? 'border-transparent bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-accent,#0F766E)]'
                            : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-secondary,#5B6B61)]'
                        }
                      >
                        {cls.is_active ? (
                          <>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-1 h-3 w-3" /> Ended
                          </>
                        )}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-data text-[13px] font-bold tabular-nums text-emerald-400 [.tenant-shell_&]:text-[var(--ds-primary,#1F8A5B)]">
                        {formatCurrency(cls.periodEarnings)}
                      </p>
                      <p className="text-[10px] text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        {Math.round(Number(cls.commission_rate || 0) * 100)}% share
                      </p>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <DsIconButton
                        chrome="outline"
                        tone="secondary"
                        aria-label={`Open ${cls.name}`}
                        onClick={() => navigate('/instructor/classes')}
                      >
                        <ArrowRight className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
                      </DsIconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClassesOverviewSection;
