import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
          <Card key={i} className="bg-slate-900/50 border-slate-800 p-4">
             <Skeleton className="h-8 w-16 mb-2 bg-slate-800" />
             <Skeleton className="h-4 w-24 bg-slate-800" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <div className="text-3xl font-bold text-white">{stats.total}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Total Records</div>
                    </div>
                    <Users className="h-8 w-8 text-blue-500 opacity-50" />
                </CardContent>
            </Card>
            
            <Card className="bg-slate-900/50 border-slate-800 border-b-4 border-b-green-500">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <div className="text-3xl font-bold text-green-400">{stats.present + stats.late}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Total Attended</div>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
                </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 border-b-4 border-b-blue-500">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <div className="text-3xl font-bold text-blue-400">{stats.percentage.toFixed(1)}%</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Overall %</div>
                    </div>
                    <Percent className="h-8 w-8 text-blue-500 opacity-50" />
                </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium text-slate-200 mt-2">
                            {lastUpdated ? format(lastUpdated, 'HH:mm:ss') : '--:--'}
                        </div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Last Updated</div>
                    </div>
                    <Clock className="h-8 w-8 text-slate-500 opacity-50" />
                </CardContent>
            </Card>
        </div>

        {stats.classSummary.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-800">
                                <th className="pb-2 font-medium">Class Name</th>
                                <th className="pb-2 font-medium text-center">Records</th>
                                <th className="pb-2 font-medium text-center">Present/Late</th>
                                <th className="pb-2 font-medium text-center">Absent</th>
                                <th className="pb-2 font-medium text-right">Attendance Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.classSummary.map((c, idx) => (
                                <tr key={idx} className="border-b border-slate-800/50 last:border-0">
                                    <td className="py-3 text-slate-200 font-medium">{c.className}</td>
                                    <td className="py-3 text-slate-400 text-center">{c.total}</td>
                                    <td className="py-3 text-green-400 text-center">{c.present + c.late}</td>
                                    <td className="py-3 text-red-400 text-center">{c.absent}</td>
                                    <td className={`py-3 text-right font-bold ${c.percentage >= 80 ? 'text-green-400' : c.percentage >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
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