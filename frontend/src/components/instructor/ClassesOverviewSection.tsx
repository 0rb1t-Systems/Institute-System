import React from 'react';
import { dashboardStyles } from './InstructorDashboardStyles';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

function formatSafeDate(value) {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return format(d, 'MMM d, yyyy');
}

const ClassesOverviewSection = ({ classes = [], enrollments = [], periodEarnings = [], selectedDate }) => {
  const navigate = useNavigate();
  const monthName = selectedDate ? format(selectedDate, 'MMMM') : '';

  // Calculate stats for each class
  const classStats = (classes || []).map(cls => {
    const classEnrollments = (enrollments || []).filter(e => e.class_id === cls.id && e.status === 'active');
    const enrollmentCount = classEnrollments.length;
    const capacity = cls.capacity || 30; // Default capacity if missing
    const fillRate = capacity > 0 ? (enrollmentCount / capacity) * 100 : 0;
    
    // Calculate earnings for this specific class IN THE SELECTED PERIOD
    const periodClassEarnings = (periodEarnings || [])
        .filter(e => e.class_id === cls.id)
        .reduce((sum: any, e: any) => sum + (Number(e.amount) || 0), 0);

    return {
      ...cls,
      enrollmentCount,
      capacity,
      fillRate,
      periodEarnings: periodClassEarnings
    };
  });

  // Sort by active status first, then by earnings (descending)
  const sortedClasses = [...classStats].sort((a, b) => {
    if (a.is_active !== b.is_active) return b.is_active ? 1 : -1;
    return b.periodEarnings - a.periodEarnings;
  });

  return (
    <div className={dashboardStyles.section}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            Active Classes & Performance
          </h3>
          <p className="text-slate-400 text-sm mt-1">
            Overview of your assigned classes and their financial performance for <span className="text-blue-400 font-medium">{monthName}</span>.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate('/instructor/classes')}
          className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Manage All Classes
        </Button>
      </div>

      <div className={`${dashboardStyles.card} p-0 overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4 pl-6">Class Name</th>
                <th className="p-4">Schedule</th>
                <th className="p-4">Enrollment</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Earnings ({monthName})</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedClasses.map((cls) => (
                <tr key={cls.id} className="group hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 pl-6">
                    <div>
                      <h4 className="font-medium text-slate-200 group-hover:text-white transition-colors">
                        {cls.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{cls.course?.name || 'General Course'}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-slate-400">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatSafeDate(cls.start_date)}</span>
                      </div>
                      <div className="text-xs text-slate-600">
                        {cls.duration_months || 1} Month(s) Duration
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="w-[140px]">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-300 font-medium">{cls.enrollmentCount} Students</span>
                        <span className="text-slate-500">{Math.round(cls.fillRate)}%</span>
                      </div>
                      <Progress value={Math.min(100, Math.max(0, cls.fillRate))} className="h-1.5 bg-slate-800" />
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className={cls.is_active ? dashboardStyles.badgeSuccess : dashboardStyles.badgeInfo}>
                      {cls.is_active ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Active</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Ended</>
                      )}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-mono font-medium text-green-400">
                      {formatCurrency(cls.periodEarnings)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {Math.round(Number(cls.commission_rate || 0) * 100)}% Share
                    </div>
                  </td>
                  <td className="p-4 text-right pr-6">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0 text-slate-500 hover:text-white hover:bg-slate-700 rounded-full"
                      onClick={() => navigate(`/instructor/classes`)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {sortedClasses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    No classes found for this instructor.
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

export default ClassesOverviewSection;