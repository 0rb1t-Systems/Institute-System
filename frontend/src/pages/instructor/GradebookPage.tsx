import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Loader2, ScrollText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';

const GradebookPage = () => {
  const { user } = useAuth();
  const { classes, enrollments, students, exams, results, courses, assignments, assignmentSubmissions, gradebookEntries, finalizeGradebookForClass } = useData();
  const { toast } = useToast();

  const [selectedClassId, setSelectedClassId] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const availableClasses = useMemo(() => {
    if (user?.role === 'instructor') {
      return classes.filter((c) => c.instructor_id === user.id);
    }
    return classes;
  }, [classes, user]);

  const classData = useMemo(() => {
    if (!selectedClassId) return null;

    const classStudents = enrollments
      .filter((e) => e.class_id === selectedClassId && e.status === 'active')
      .map((e) => students.find((s) => s.id === e.student_id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    const classExams = exams.filter((e) => e.class_id === selectedClassId && e.marking_type === 'manual');
    const enrichedExams = classExams.map((e) => {
      const course = courses.find((c) => c.id === e.course_id);
      return { ...e, courseName: course?.name || e.title };
    });

    const classAssignments = (assignments || [])
      .filter((a) => a.class_id === selectedClassId && a.counts_toward_grade !== false)
      .map((a) => ({
        ...a,
        courseName: courses.find((c) => c.id === (a.course_id || classes.find((cl) => cl.id === selectedClassId)?.course_id))?.name || 'Assignment',
      }));

    const courseIds = [
      ...new Set([
        ...enrichedExams.map((e) => e.course_id).filter(Boolean),
        ...classAssignments
          .map((a) => a.course_id || classes.find((cl) => cl.id === selectedClassId)?.course_id)
          .filter(Boolean),
      ]),
    ];

    return { students: classStudents, exams: enrichedExams, assignments: classAssignments, courseIds };
  }, [selectedClassId, enrollments, students, exams, courses, assignments, classes]);

  const getStudentScore = (studentId, examId) => {
    const res = results.find((r) => r.student_id === studentId && r.exam_id === examId);
    if (!res) return '-';
    if (res.score !== null && res.score !== undefined) return res.score;
    return res.final_score ?? '-';
  };

  const getAssignmentScore = (studentId, assignmentId) => {
    const sub = (assignmentSubmissions || []).find(
      (s) => s.student_id === studentId && s.assignment_id === assignmentId
    );
    if (!sub || sub.score == null) return '-';
    return sub.score;
  };

  const getFinalMark = (studentId, courseId) => {
    const entry = (gradebookEntries || []).find(
      (g) => g.student_id === studentId && g.course_id === courseId && g.class_id === selectedClassId
    );
    return entry ? `${entry.final_mark}${entry.letter_grade ? ` (${entry.letter_grade})` : ''}` : '—';
  };

  const handleFinalize = async () => {
    if (!selectedClassId) return;
    setFinalizing(true);
    try {
      await finalizeGradebookForClass(selectedClassId);
      toast({ title: 'Synced', description: 'Gradebook finalized to student transcripts.' });
    } catch (err) {
      notify.error(err, { context: 'GradebookPage - finalize', fallback: MESSAGES.SAVE_FAILED });
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <AnimatedPage>
      <Helmet>
        <title>Class Gradebook - Portal</title>
      </Helmet>
      <PageHeader
        title="Class Gradebook"
        subtitle="Exam score + assignment bonus points (capped at exam total). Sync finals to transcripts."
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
          <SelectTrigger className="w-full sm:w-[300px] bg-slate-900 border-slate-800">
            <SelectValue placeholder="Select a Class" />
          </SelectTrigger>
          <SelectContent>
            {availableClasses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedClassId && (
          <Button onClick={handleFinalize} disabled={finalizing} className="bg-indigo-600 hover:bg-indigo-700">
            {finalizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScrollText className="h-4 w-4 mr-2" />}
            Sync to Transcripts
          </Button>
        )}
      </div>

      {selectedClassId && classData ? (
        <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-950">
                  <TableRow>
                    <TableHead className="min-w-[250px] sticky left-0 bg-slate-950 z-10">Student Name</TableHead>
                    {classData.exams.map((exam) => (
                      <TableHead key={exam.id} className="min-w-[150px] text-center border-l border-slate-800">
                        <div className="font-bold text-indigo-400 truncate" title={exam.courseName}>
                          {exam.courseName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          Exam / {exam.total_marks || exam.final_marks}
                        </div>
                      </TableHead>
                    ))}
                    {(classData.assignments || []).map((assign) => (
                      <TableHead key={assign.id} className="min-w-[140px] text-center border-l border-slate-800">
                        <div className="font-bold text-amber-400 truncate" title={assign.title}>
                          {assign.title}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          Bonus / {assign.total_marks}
                        </div>
                      </TableHead>
                    ))}
                    {classData.courseIds.map((courseId) => {
                      const course = courses.find((c) => c.id === courseId);
                      return (
                        <TableHead
                          key={`final-${courseId}`}
                          className="min-w-[120px] text-center border-l border-slate-700 bg-slate-900"
                        >
                          <div className="font-bold text-emerald-400">Final</div>
                          <div className="text-[10px] text-slate-500">{course?.name || ''}</div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classData.students.length > 0 ? (
                    classData.students.map((student) => (
                      <TableRow key={student.id} className="border-slate-800 hover:bg-slate-800/30">
                        <TableCell className="sticky left-0 bg-slate-900/95 z-10 font-medium">
                          {student.name}
                          <div className="text-xs text-slate-500">{student.student_code}</div>
                        </TableCell>
                        {classData.exams.map((exam) => (
                          <TableCell key={exam.id} className="text-center border-l border-slate-800">
                            {getStudentScore(student.id, exam.id)}
                          </TableCell>
                        ))}
                        {(classData.assignments || []).map((assign) => (
                          <TableCell key={assign.id} className="text-center border-l border-slate-800 text-amber-200/90">
                            {getAssignmentScore(student.id, assign.id)}
                          </TableCell>
                        ))}
                        {classData.courseIds.map((courseId) => (
                          <TableCell
                            key={`f-${student.id}-${courseId}`}
                            className="text-center border-l border-slate-700 font-semibold text-emerald-400"
                          >
                            {getFinalMark(student.id, courseId)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(
                          2,
                          classData.exams.length +
                            (classData.assignments?.length || 0) +
                            classData.courseIds.length +
                            1
                        )}
                        className="text-center py-10 text-slate-500"
                      >
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No enrolled students in this class.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <p>Please select a class to view the gradebook.</p>
        </div>
      )}
    </AnimatedPage>
  );
};

export default GradebookPage;
