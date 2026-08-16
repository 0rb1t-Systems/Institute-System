import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Calendar, ClipboardList, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { getAttendanceByClass } from '@/lib/api';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';

// --- Internal Attendance Report Component ---
const ClassAttendanceReport = ({ classData, students }) => {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!classData?.id) return;
            setLoading(true);
            setError(null);
            try {
                const rows = await getAttendanceByClass(classData.id);
                if (!cancelled) setAttendance(rows || []);
            } catch (err) {
                if (!cancelled) {
                    setAttendance([]);
                    setError(getUserMessage(err, { context: 'ClassAttendanceReport', fallback: MESSAGES.LOAD_FAILED }));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [classData?.id]);

    const reportData = useMemo(() => {
        const classAttendance = (attendance || []).filter(a => a.class_id === classData.id);

        return students.map(student => {
            const studentRecords = classAttendance.filter(a => a.student_id === student.id);
            const present = studentRecords.filter(a => a.status === 'present').length;
            const absent = studentRecords.filter(a => a.status === 'absent').length;
            const late = studentRecords.filter(a => a.status === 'late').length;
            const recordedSessions = studentRecords.length;
            const rate = recordedSessions > 0 ? ((present + late) / recordedSessions) * 100 : 0;

            return { student, present, absent, late, rate, recordedSessions };
        }).sort((a, b) => b.rate - a.rate);
    }, [classData, students, attendance]);

    const overallRate = reportData.length > 0 
        ? reportData.reduce((sum: any, r: any) => sum + r.rate, 0) / reportData.length 
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading attendance…
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-red-400 text-sm">{error}</div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-950 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-sm text-slate-400 uppercase tracking-wider font-medium">Average Attendance</span>
                        <span className={`text-3xl font-bold mt-2 ${overallRate >= 80 ? 'text-green-400' : overallRate >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {overallRate.toFixed(1)}%
                        </span>
                    </CardContent>
                </Card>
                <Card className="bg-slate-950 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-sm text-slate-400 uppercase tracking-wider font-medium">Total Students</span>
                        <span className="text-3xl font-bold mt-2 text-blue-400">{students.length}</span>
                    </CardContent>
                </Card>
                <Card className="bg-slate-950 border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-sm text-slate-400 uppercase tracking-wider font-medium">At Risk</span>
                        <span className="text-3xl font-bold mt-2 text-red-400">
                            {reportData.filter(r => r.rate < 75 && r.recordedSessions > 0).length}
                        </span>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-md border border-slate-800 overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                    <TableHeader className="bg-slate-950 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="text-slate-300">Student Name</TableHead>
                            <TableHead className="text-center text-slate-300">Rate</TableHead>
                            <TableHead className="text-center text-green-400">Present</TableHead>
                            <TableHead className="text-center text-red-400">Absent</TableHead>
                            <TableHead className="text-center text-yellow-400">Late</TableHead>
                            <TableHead className="text-right text-slate-300">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.map((row) => (
                            <TableRow key={row.student.id} className="border-slate-800 hover:bg-slate-800/50">
                                <TableCell className="font-medium text-slate-200">
                                    {row.student.name}
                                    <div className="text-xs text-slate-500">{row.student.student_code}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <span className={`font-bold ${row.rate >= 80 ? 'text-green-400' : row.recordedSessions === 0 ? 'text-slate-500' : 'text-red-400'}`}>
                                            {row.recordedSessions === 0 ? '—' : `${row.rate.toFixed(0)}%`}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center text-green-500/80 font-mono">{row.present}</TableCell>
                                <TableCell className="text-center text-red-500/80 font-mono">{row.absent}</TableCell>
                                <TableCell className="text-center text-yellow-500/80 font-mono">{row.late}</TableCell>
                                <TableCell className="text-right">
                                    {row.recordedSessions === 0 ? (
                                        <Badge variant="outline" className="border-slate-700 text-slate-500">Not recorded</Badge>
                                    ) : row.rate >= 80 ? (
                                        <Badge className="bg-green-900/20 text-green-400 hover:bg-green-900/30 border-0">Good</Badge>
                                    ) : (
                                        <Badge variant="destructive" className="bg-red-900/20 text-red-400 hover:bg-red-900/30 border-0">Risk</Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {reportData.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No enrolled students in this class.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

const InstructorClassesPage = () => {
  const { user } = useAuth();
  const { classes, enrollments, students, courses, diplomas } = useData();
  const [selectedClassForReport, setSelectedClassForReport] = useState(null);

  // Only classes assigned to this instructor within their institution (RLS + client filter)
  const instructorClasses = useMemo(() => {
    if (!user?.id) return [];

    const courseById = new Map<any, any>((courses || []).map((c) => [c.id, c]));
    const diplomaById = new Map<any, any>((diplomas || []).map((d) => [d.id, d]));

    return classes
      .filter((c) =>
        c.instructor_id === user.id &&
        c.is_active &&
        (!user.institution_id || c.institution_id === user.institution_id)
      )
      .map(cls => {
         const classEnrollments = enrollments.filter(e => e.class_id === cls.id && e.status === 'active');
         const activeStudents = classEnrollments
           .map(e => students.find(s => s.id === e.student_id))
           .filter(Boolean);

         const programLabel =
           courseById.get(cls.course_id)?.name ||
           diplomaById.get(cls.diploma_id)?.name ||
           (cls.program_type === 'diploma' ? 'Diploma' : 'Course');

         const start = new Date(cls.start_date).getTime();
         const end = new Date(cls.end_date).getTime();
         const now = Date.now();
         const totalDuration = end - start;
         const elapsed = now - start;
         const progress = totalDuration > 0
           ? Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
           : 0;

         return {
             ...cls,
             programLabel,
             studentCount: activeStudents.length,
             students: activeStudents,
             progress
         };
      })
      .sort((a, b) => Number(new Date(a.start_date)) - Number(new Date(b.start_date)));
  }, [classes, enrollments, user, students, courses, diplomas]);

  return (
    <AnimatedPage>
      <Helmet>
        <title>My Classes - Instructor Portal</title>
      </Helmet>
      
      <PageHeader 
        title="My Active Classes" 
        subtitle="Manage and view your currently assigned courses."
      />

      <Dialog open={!!selectedClassForReport} onOpenChange={(open) => !open && setSelectedClassForReport(null)}>
         <DialogContent className="max-w-4xl bg-slate-900 border-slate-800 text-slate-100">
             <DialogHeader>
                 <DialogTitle className="flex items-center gap-2">
                     <ClipboardList className="h-5 w-5 text-indigo-400" /> 
                     Attendance Report: {selectedClassForReport?.name}
                 </DialogTitle>
             </DialogHeader>
             {selectedClassForReport && selectedClassForReport.instructor_id === user?.id && (
                 <ClassAttendanceReport 
                    classData={selectedClassForReport} 
                    students={selectedClassForReport.students}
                 />
             )}
         </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instructorClasses.length > 0 ? (
            instructorClasses.map((cls) => (
                <Card key={cls.id} className="bg-slate-900/50 border-slate-800 hover:border-indigo-500/30 transition-all duration-300 group flex flex-col overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start mb-2">
                            <Badge className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20">
                                {cls.programLabel}
                            </Badge>
                            {cls.progress >= 100 ? (
                                <Badge className="bg-green-500/10 text-green-400 border-0">Completed</Badge>
                            ) : (
                                <Badge variant="outline" className="text-slate-500 border-slate-700">In Progress</Badge>
                            )}
                        </div>
                        <CardTitle className="text-xl text-slate-100 group-hover:text-white transition-colors">{cls.name}</CardTitle>
                        <CardDescription className="line-clamp-1">
                             {formatDate(cls.start_date)} - {formatDate(cls.end_date)}
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="flex-grow space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>Timeline Progress</span>
                                <span>{Math.round(cls.progress)}%</span>
                            </div>
                            <Progress value={cls.progress} className="h-1.5 bg-slate-800" indicatorClassName="bg-indigo-500" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50 flex flex-col items-center justify-center">
                                <Users className="h-5 w-5 text-blue-400 mb-1" />
                                <span className="text-lg font-bold text-slate-200">{cls.studentCount}</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Students</span>
                            </div>
                            <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50 flex flex-col items-center justify-center">
                                <Calendar className="h-5 w-5 text-purple-400 mb-1" />
                                <span className="text-lg font-bold text-slate-200">{cls.duration_months}</span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Months</span>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="pt-2 border-t border-slate-800/50">
                        <Button 
                            variant="outline" 
                            className="w-full border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white group-hover:border-indigo-500/50 group-hover:text-indigo-300"
                            onClick={() => setSelectedClassForReport(cls)}
                        >
                            <ClipboardList className="h-4 w-4 mr-2" /> View Attendance Report
                        </Button>
                    </CardFooter>
                </Card>
            ))
        ) : (
            <div className="col-span-full text-center py-16 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-6 w-6 text-slate-500" />
                </div>
                <h3 className="text-xl font-medium text-slate-200 mb-2">No Active Classes</h3>
                <p className="text-slate-500 max-w-md mx-auto">You don't have any active classes assigned to you at the moment. Contact administration if this is an error.</p>
            </div>
        )}
      </div>
    </AnimatedPage>
  );
};

export default InstructorClassesPage;
