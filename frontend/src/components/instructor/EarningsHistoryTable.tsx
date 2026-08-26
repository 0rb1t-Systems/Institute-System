import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';
import { dashboardStyles } from './InstructorDashboardStyles';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';

export function mapEarningHistoryRows(
  earnings = [],
  { students = [], classes = [], payments = [], defaultRate = 0 } = {}
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
  title = 'Earnings History',
}) => {
  const rows = useMemo(
    () => mapEarningHistoryRows(earnings, { students, classes, payments, defaultRate }),
    [earnings, students, classes, payments, defaultRate]
  );
  const monthLabel =
    selectedDate instanceof Date && !Number.isNaN(selectedDate.getTime())
      ? format(selectedDate, 'MMMM yyyy')
      : null;
  const totalEarned = rows.reduce((sum, row) => sum + row.earned, 0);

  return (
    <div className={dashboardStyles.section}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-2">
        <div>
          <h3 className="text-xl font-bold text-[var(--tenant-text)] flex items-center gap-2">
            <Receipt className="h-5 w-5 text-green-500" />
            {title}
          </h3>
          <p className="text-[var(--tenant-muted)] text-sm mt-1">
            {monthLabel ? (
              <>
                Student payments that earned you a share in{' '}
                <span className="text-green-600 dark:text-green-400 font-medium">{monthLabel}</span>.
              </>
            ) : (
              'Each row is a student payment (or class fixed fee) and your share.'
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--tenant-muted)] uppercase font-bold tracking-wider">
            {monthLabel ? 'Month total' : 'Shown total'}
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalEarned)}
          </p>
        </div>
      </div>

      <div className={`${dashboardStyles.card} p-0 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[var(--tenant-bg-2)] text-[var(--tenant-muted)] text-xs uppercase font-semibold border-b border-[var(--tenant-line)]">
              <tr>
                <th className="p-4 pl-6">Date</th>
                <th className="p-4">Student / Type</th>
                <th className="p-4">Class</th>
                <th className="p-4 text-right">Base</th>
                <th className="p-4 text-right text-green-600 dark:text-green-400">Earned</th>
                <th className="p-4 text-right pr-6">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((item) => (
                  <tr key={item.id} className={dashboardStyles.tableRow}>
                    <td className="p-4 pl-6 text-sm text-[var(--tenant-muted)] whitespace-nowrap">
                      {formatDate(item.date)}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-[var(--tenant-text)]">{item.studentName}</div>
                      <div className="text-xs text-[var(--tenant-muted)] uppercase tracking-wide">
                        {item.studentCode}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-[var(--tenant-text)]">{item.className}</td>
                    <td className="p-4 text-right text-sm text-[var(--tenant-muted)] tabular-nums">
                      {item.isFixed ? '—' : formatCurrency(item.paymentAmount)}
                    </td>
                    <td className="p-4 text-right text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                      + {formatCurrency(item.earned)}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <Badge
                        className={
                          item.isFixed
                            ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                            : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                        }
                      >
                        {item.isFixed ? 'Fixed fee' : 'Commission'}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--tenant-muted)] text-sm">
                    {monthLabel
                      ? `No student payments earned a share in ${monthLabel}.`
                      : 'No earnings records yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EarningsHistoryTable;
