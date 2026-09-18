import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StatCard from '@/components/StatCard';
import { format } from 'date-fns';
import { Users, CheckCircle, Percent, Clock } from 'lucide-react';

const AttendanceReportSummary = ({ records, loading, lastUpdated }) => {
  const stats = useMemo(() => {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const percentage = total > 0 ? ((present + late) / total) * 100 : 0;

    // Class-wise summary
    const classMap: any = {};
    records.forEach(r => {
        if (!classMap[r.className]) {
            classMap[r.className] = { total: 0, present: 0, late: 0, absent: 0 };
        }
        classMap[r.className].total += 1;
        if (r.status === 'present') classMap[r.className].present += 1;
        if (r.status === 'late') classMap[r.className].late += 1;
        if (r.status === 'absent') classMap[r.className].absent += 1;
    });

    const classSummary = Object.entries(classMap).map(([className, counts]: [string, any]) => ({
        className,
        ...counts,
        percentage: counts.total > 0 ? ((counts.present + counts.late) / counts.total) * 100 : 0
    }));

    return { total, present, late, absent, percentage, classSummary };
  }, [records]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4">
             <Skeleton className="h-8 w-16 mb-2" />
             <Skeleton className="h-4 w-24" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Records"
              value={stats.total}
              icon={<Users className="h-5 w-5" />}
              tone="info"
            />
            <StatCard
              title="Total Attended"
              value={stats.present + stats.late}
              icon={<CheckCircle className="h-5 w-5" />}
              tone="primary"
            />
            <StatCard
              title="Overall %"
              value={`${stats.percentage.toFixed(1)}%`}
              icon={<Percent className="h-5 w-5" />}
              tone="corporate"
            />
            <StatCard
              title="Last Updated"
              value={lastUpdated ? format(lastUpdated, 'HH:mm:ss') : '--:--'}
              icon={<Clock className="h-5 w-5" />}
            />
        </div>

        {stats.classSummary.length > 0 && (
            <Card>
                <CardContent className="p-4 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="text-[var(--ds-text-secondary,#5B6B61)] border-b border-[var(--ds-border,#DDE5DF)]">
                                <th className="pb-2 font-medium">Class Name</th>
                                <th className="pb-2 font-medium text-center">Records</th>
                                <th className="pb-2 font-medium text-center">Present/Late</th>
                                <th className="pb-2 font-medium text-center">Absent</th>
                                <th className="pb-2 font-medium text-right">Attendance Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.classSummary.map((c, idx) => (
                                <tr key={idx} className="border-b border-[var(--ds-border,#DDE5DF)] last:border-0">
                                    <td className="py-3 font-medium">{c.className}</td>
                                    <td className="py-3 text-[var(--ds-text-secondary,#5B6B61)] text-center">{c.total}</td>
                                    <td className="py-3 text-[var(--ds-accent,#1F8A5B)] text-center">{c.present + c.late}</td>
                                    <td className="py-3 text-[var(--ds-danger,#DC2626)] text-center">{c.absent}</td>
                                    <td className={`py-3 text-right font-bold ${c.percentage >= 80 ? 'text-[var(--ds-accent,#1F8A5B)]' : c.percentage >= 60 ? 'text-[var(--ds-warning,#C2410C)]' : 'text-[var(--ds-danger,#DC2626)]'}`}>
                                        {c.percentage.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        )}
    </div>
  );
};

export default AttendanceReportSummary;
