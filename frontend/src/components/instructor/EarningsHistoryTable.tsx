import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function mapEarningHistoryRows(
  earnings = [],
  { students = [], classes = [], payments = [], defaultRate = 0 } = {},
) {
  return (earnings || [])
    .map((earning) => {
      const isFixed = earning.settlement_type === 'fixed_fee';
      const student =
        earning.student || students.find((s) => s.id === earning.student_id) || null;
      const cls = earning.class || classes.find((c) => c.id === earning.class_id) || null;
      const payment =
        earning.payment || payments.find((p) => p.id === earning.payment_id) || null;
      const rate = Number(earning.rate || defaultRate || cls?.commission_rate || 0);
      const paymentAmount = isFixed
        ? Number(earning.amount)
        : payment?.amount != null
          ? Number(payment.amount)
          : rate > 0
            ? Number(earning.amount) / rate
            : Number(earning.amount);
      return {
        id: earning.id,
        date: earning.created_at,
        isFixed,
        studentName: isFixed
          ? 'Class fixed fee'
          : student?.name || student?.full_name || 'Unknown student',
        studentCode: isFixed
          ? 'FIXED FEE'
          : student?.student_code ||
            student?.email?.split?.('@')?.[0]?.toUpperCase?.() ||
            '—',
        className: cls?.name || 'Unknown class',
        paymentAmount,
        earned: Number(earning.amount) || 0,
      };
    })
    .sort((a, b) => Number(new Date(b.date)) - Number(new Date(a.date)));
}

const EarningsHistoryTable = ({
  earnings = [],
  students = [],
  classes = [],
  payments = [],
  defaultRate = 0,
  selectedDate = null,
  title = 'Earnings history',
}) => {
  const rows = useMemo(
    () => mapEarningHistoryRows(earnings, { students, classes, payments, defaultRate }),
    [earnings, students, classes, payments, defaultRate],
  );
  const monthLabel =
    selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime())
      ? format(selectedDate, 'MMMM yyyy')
      : null;
  const totalEarned = rows.reduce((sum, row) => sum + row.earned, 0);

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="flex flex-col gap-3 space-y-0 p-6 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Receipt className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" />
            {title}
          </CardTitle>
          <CardDescription className="text-slate-400 [.tenant-shell_&]:text-[12px]">
            {monthLabel ? (
              <>Student payments that earned you a share in {monthLabel}.</>
            ) : (
              'Each row is a student payment (or class fixed fee) and your share.'
            )}
          </CardDescription>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="font-data text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
            {monthLabel ? 'Month total' : 'Shown total'}
          </p>
          <p className="font-data text-[22px] font-bold tabular-nums text-emerald-400 [.tenant-shell_&]:text-[var(--ds-primary,#1F8A5B)]">
            {formatCurrency(totalEarned)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2 pt-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse">
            <thead className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-500 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
              <tr>
                <th className="px-6 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Student / Type</th>
                <th className="px-4 py-2.5 font-semibold">Class</th>
                <th className="px-4 py-2.5 text-right font-semibold">Base</th>
                <th className="px-4 py-2.5 text-right font-semibold">Earned</th>
                <th className="px-6 py-2.5 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-800 last:border-0 transition-colors hover:bg-[var(--ds-surface-muted,#F7FAF8)]/60 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)]"
                  >
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-slate-400 [.tenant-shell_&]:text-[12px] [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white [.tenant-shell_&]:text-[13px] [.tenant-shell_&]:font-semibold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                        {item.studentName}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]">
                        {item.studentCode}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 [.tenant-shell_&]:text-[12px] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
                      {item.className}
                    </td>
                    <td className="px-4 py-3 text-right font-data text-sm tabular-nums text-slate-400 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
                      {item.isFixed ? '—' : formatCurrency(item.paymentAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-data text-sm font-bold tabular-nums text-emerald-400 [.tenant-shell_&]:text-[var(--ds-primary,#1F8A5B)]">
                      + {formatCurrency(item.earned)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Badge
                        variant="outline"
                        className={
                          item.isFixed
                            ? 'border-transparent bg-[var(--ds-warning-bg,#FFF7ED)] text-[var(--ds-warning,#C2410C)]'
                            : 'border-transparent bg-[var(--ds-info-bg,#EFF6FF)] text-[var(--ds-info,#2563EB)]'
                        }
                      >
                        {item.isFixed ? 'Fixed fee' : 'Commission'}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-500 [.tenant-shell_&]:text-[var(--ds-text-tertiary,#8A978E)]"
                  >
                    {monthLabel
                      ? `No student payments earned a share in ${monthLabel}.`
                      : 'No earnings records yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default EarningsHistoryTable;
