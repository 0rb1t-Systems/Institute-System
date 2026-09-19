import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  BookOpen,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  Printer,
  Percent,
  ChevronRight,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import AnimatedPage from '@/components/AnimatedPage';
import { cn } from '@/lib/utils';
import {
  getExamScorePercent,
  getExamTotalMarks,
  getGradePoints,
  getLetterGrade,
  isCoursePassed,
} from '@/lib/examPass';
import { getCombinedExamWithBonus } from '@/lib/assignmentBonus';
import { getInstitutionGradeScale } from '@/lib/gradingScale';
import {
  coursesForDiploma,
  semestersForDiploma,
} from '@/lib/diplomaCourses';

const gradeTone = (grade: string) => {
  switch (grade) {
    case 'A':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
    case 'B':
      return 'text-sky-400 bg-sky-500/10 border-sky-500/25';
    case 'C':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    case 'D':
      return 'text-orange-400 bg-orange-500/10 border-orange-500/25';
    case 'F':
      return 'text-rose-400 bg-rose-500/10 border-rose-500/25';
    default:
      return 'text-slate-500 bg-slate-800/60 border-slate-700';
  }
};

const scoreBarColor = (pct: number, pending: boolean) => {
  if (pending) return 'bg-slate-700';
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 80) return 'bg-sky-500';
  if (pct >= 70) return 'bg-amber-500';
  if (pct >= 60) return 'bg-orange-500';
  return 'bg-rose-500';
};

const StudentGradebookPage = () => {
  const { user, institution } = useAuth();
  const navigate = useNavigate();
  const {
    results,
    exams,
    courses,
    classCourses,
    diplomaCourses = [],
    diplomaSemesters = [],
    diplomas = [],
    enrollments,
    classes,
    students,
    gradebookEntries,
    assignments,
    assignmentSubmissions,
  } = useData();
  const gradeScale = useMemo(() => getInstitutionGradeScale(institution), [institution]);

  const studentData = useMemo(() => {
    if (!user) return null;
    return (
      students.find((s) => s.profile_id === user.id) ||
      students.find((s) => s.id === user.studentId) ||
      students.find((s) => s.id === user.id) ||
      null
    );
  }, [students, user]);

  const studentGrades = useMemo(() => {
    if (!studentData) return [];

    const enrolledClassIds = enrollments
      .filter(e => e.student_id === studentData.id)
      .map(e => e.class_id);

    const allCourses = [];
    enrolledClassIds.forEach(classId => {
       const classData = classes.find(c => c.id === classId);
       if(!classData) return;

       const diplomaId = classData.diploma_id || null;
       const diplomaName = diplomaId
         ? diplomas.find((d) => d.id === diplomaId)?.name || null
         : null;
       const semesterLookup = diplomaId
         ? Object.fromEntries(
             semestersForDiploma(diplomaSemesters, diplomaId).map((s) => [s.id, s]),
           )
         : {};

       if(classData.course_id) {
         const c = courses.find(co => co.id === classData.course_id);
         if(c) {
           allCourses.push({
             ...c,
             classId,
             className: classData.name,
             diplomaId,
             diplomaName,
             semesterName: null,
             semesterSort: 9999,
           });
         }
       }

       if (diplomaId) {
         coursesForDiploma(courses, diplomaCourses, diplomaId).forEach((c) => {
           const sem = c.semester_id ? semesterLookup[c.semester_id] : null;
           allCourses.push({
             ...c,
             classId,
             className: classData.name,
             diplomaId,
             diplomaName,
             semesterName: sem?.name || null,
             semesterSort: sem ? Number(sem.sort_order ?? 0) : 9999,
           });
         });
       }
       
       const linked = classCourses
         .filter(cc => cc.class_id === classId)
         .map(cc => {
            const c = courses.find(co => co.id === cc.course_id);
            if (!c) return null;
            const link = (diplomaCourses || []).find(
              (dc) => dc.diploma_id === diplomaId && dc.course_id === c.id,
            );
            const sem = link?.semester_id ? semesterLookup[link.semester_id] : null;
            return {
              ...c,
              classId,
              className: classData.name,
              diplomaId,
              diplomaName,
              semesterName: sem?.name || null,
              semesterSort: sem ? Number(sem.sort_order ?? 0) : 9999,
            };
         })
         .filter(Boolean);
         
       allCourses.push(...linked);
    });

    // Diploma: one row per course across the program (not per class card).
    // Short courses: keep course+class uniqueness.
    const unique = allCourses.filter((c, i, arr) => {
      if (c.diplomaId) {
        return arr.findIndex((x) => x.id === c.id && x.diplomaId === c.diplomaId) === i;
      }
      return arr.findIndex((x) => x.id === c.id && x.classId === c.classId) === i;
    });

    return unique.map(course => {
      const gb =
        (gradebookEntries || []).find(
          (g) =>
            g.student_id === studentData.id &&
            g.course_id === course.id &&
            g.class_id === course.classId,
        ) ||
        (course.diplomaId
          ? (gradebookEntries || []).find(
              (g) => g.student_id === studentData.id && g.course_id === course.id,
            )
          : null);

      // Prefer the class that actually has gradebook/exam data (diploma may span enrollments).
      const resolveClassId = gb?.class_id || course.classId;
      const enrolledIds = new Set(enrolledClassIds);

      const courseExams = exams.filter(
        (e) =>
          e.course_id === course.id &&
          (e.class_id === resolveClassId ||
            (course.diplomaId && enrolledIds.has(e.class_id))),
      );
      const relevantExams =
        courseExams.length > 0
          ? courseExams
          : exams.filter(
              (e) =>
                (e.class_id === resolveClassId ||
                  (course.diplomaId && enrolledIds.has(e.class_id))) &&
                (!e.course_id || e.course_id === course.id),
            );

      const rankedResults = results
        .filter(
          (r) =>
            r.student_id === studentData.id &&
            r.score != null &&
            relevantExams.some((e) => e.id === r.exam_id)
        )
        .map((r) => {
          const exam = exams.find((e) => e.id === r.exam_id) || null;
          const pct = getExamScorePercent(r.score, exam);
          return { result: r, exam, pct };
        })
        .sort((a, b) => b.pct - a.pct);

      const best = rankedResults[0] || null;
      const bestResult = best?.result || null;
      const examDetails = best?.exam || relevantExams[0] || null;

      let grade = '-';
      let status = 'Pending';
      let points = 0;
      let percentage = 0;
      let scoreDisplay: string | number = '-';
      let totalDisplay: string | number = '-';
      let resultId = bestResult?.id || null;

      // Exam + gradebook assignment bonus (same formula as instructor Class Gradebook Final).
      if (best && Number.isFinite(best.pct)) {
        const examTotal = getExamTotalMarks(examDetails);
        const examScore = Number(bestResult.score ?? bestResult.final_score ?? 0);
        const classPrimaryCourseId =
          classes.find((c) => c.id === resolveClassId)?.course_id || null;
        const combined = getCombinedExamWithBonus({
          studentId: studentData.id,
          classId: resolveClassId,
          courseId: course.id,
          examScore,
          examTotal,
          assignments,
          submissions: assignmentSubmissions,
          classPrimaryCourseId,
        });
        percentage = combined.percentage;
        scoreDisplay = combined.combinedScore;
        totalDisplay = examTotal;
        // Prefer synced letter when % matches gradebook final; otherwise compute.
        if (gb && gb.final_mark != null && Math.abs(Number(gb.final_mark) - percentage) < 0.51) {
          grade = gb.letter_grade && gb.letter_grade !== '-' ? gb.letter_grade : getLetterGrade(percentage, gradeScale);
        } else {
          grade = getLetterGrade(percentage, gradeScale);
        }
        points = getGradePoints(percentage, gradeScale);
        status = isCoursePassed(percentage, gradeScale) ? 'Pass' : 'Fail';
      } else if (gb && gb.final_mark != null) {
        percentage = Number(gb.final_mark);
        scoreDisplay = percentage;
        totalDisplay = 100;
        grade = gb.letter_grade && gb.letter_grade !== '-' ? gb.letter_grade : getLetterGrade(percentage, gradeScale);
        points = getGradePoints(percentage, gradeScale);
        status = isCoursePassed(percentage, gradeScale) ? 'Pass' : 'Fail';
      }

      return {
        courseCode: course.code,
        courseName: course.name,
        className: course.className,
        classId: course.classId,
        diplomaId: course.diplomaId || null,
        diplomaName: course.diplomaName || null,
        semesterName: course.semesterName || null,
        semesterSort: course.semesterSort ?? 9999,
        score: scoreDisplay,
        total: totalDisplay,
        grade,
        points,
        status,
        percentage,
        resultId,
      };
    });

  }, [studentData, enrollments, classes, courses, classCourses, diplomaCourses, diplomaSemesters, diplomas, exams, results, gradebookEntries, assignments, assignmentSubmissions, gradeScale]);

  /** Diploma programs → one unified table; short courses stay class-grouped only when needed. */
  const gradeTables = useMemo(() => {
    type GradeTable = {
      key: string;
      title: string;
      isDiploma: boolean;
      courses: typeof studentGrades;
    };

    const diplomaGroups = new Map<string, GradeTable>();
    const shortCourseRows: typeof studentGrades = [];

    for (const g of studentGrades) {
      if (g.diplomaId) {
        if (!diplomaGroups.has(g.diplomaId)) {
          diplomaGroups.set(g.diplomaId, {
            key: g.diplomaId,
            title: g.diplomaName || g.className || 'Diploma program',
            isDiploma: true,
            courses: [],
          });
        }
        diplomaGroups.get(g.diplomaId)!.courses.push(g);
      } else {
        shortCourseRows.push(g);
      }
    }

    const tables: GradeTable[] = Array.from(diplomaGroups.values()).map((group) => ({
      ...group,
      courses: [...group.courses].sort((a, b) => {
        if (a.semesterSort !== b.semesterSort) return a.semesterSort - b.semesterSort;
        return String(a.courseName || '').localeCompare(String(b.courseName || ''));
      }),
    }));

    if (shortCourseRows.length > 0) {
      tables.push({
        key: 'short-courses',
        title: tables.length > 0 ? 'Other courses' : 'Courses',
        isDiploma: false,
        courses: shortCourseRows,
      });
    }

    return tables;
  }, [studentGrades]);

  const showSemesterColumn = useMemo(
    () => gradeTables.some((t) => t.isDiploma && t.courses.some((c) => c.semesterName)),
    [gradeTables],
  );

  const stats = useMemo(() => {
    const gradedCourses = studentGrades.filter(g => g.score !== '-');
    
    if (gradedCourses.length === 0) return { gpa: "0.00", total: 0, graded: 0, passed: 0, failed: 0, completion: 0 };
    
    const totalPoints = gradedCourses.reduce((sum: any, g: any) => sum + g.points, 0);
    const passed = gradedCourses.filter(g => g.status === 'Pass').length;
    const failed = gradedCourses.filter(g => g.status === 'Fail').length;
    
    return {
      gpa: (totalPoints / gradedCourses.length).toFixed(2),
      total: studentGrades.length,
      graded: gradedCourses.length,
      passed,
      failed,
      completion: Math.round((passed / studentGrades.length) * 100) || 0
    };
  }, [studentGrades]);

  const chartData = useMemo(() => {
      const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      studentGrades.forEach(g => {
          if(g.grade !== '-') distribution[g.grade]++;
      });
      return Object.entries(distribution).map(([name, value]) => ({ name, value })).filter(i => i.value > 0);
  }, [studentGrades]);

  const GRADE_COLORS: Record<string, string> = {
    A: '#10b981',
    B: '#3b82f6',
    C: '#f59e0b',
    D: '#f97316',
    F: '#ef4444',
  };

  const formatScore = (item: (typeof studentGrades)[number]) => {
    if (item.score === '-') return '—';
    if (item.total !== '-' && item.score !== '-') {
      return `${item.score} / ${item.total}`;
    }
    return String(item.score);
  };

  if (!studentData) return <div className="p-8 text-center text-slate-400">Loading academic records...</div>;

  return (
    <AnimatedPage>
      <div className="space-y-8 pb-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Academic Gradebook</h1>
            <p className="text-slate-400">Course marks, letter grades, and GPA</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()} className="gap-2 border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:text-slate-100">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <Card className="bg-slate-900/50 border-blue-500/25 hover:border-blue-500/40 transition-colors">
               <CardContent className="p-6 flex items-center justify-between">
                   <div>
                       <p className="text-sm font-medium text-blue-200">Cumulative GPA</p>
                       <h3 className="text-3xl font-bold text-white mt-1">{stats.gpa}</h3>
                   </div>
                   <div className="bg-blue-500/10 p-3 rounded-full">
                       <GraduationCap className="h-6 w-6 text-blue-400" />
                   </div>
               </CardContent>
           </Card>

           <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
               <CardContent className="p-6 flex items-center justify-between">
                   <div>
                       <p className="text-sm font-medium text-slate-400">Courses Taken</p>
                       <h3 className="text-3xl font-bold text-white mt-1">{stats.graded} <span className="text-sm font-normal text-slate-500">/ {stats.total}</span></h3>
                   </div>
                   <div className="bg-blue-500/10 p-3 rounded-full">
                       <BookOpen className="h-6 w-6 text-slate-400" />
                   </div>
               </CardContent>
           </Card>

           <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
               <CardContent className="p-6 flex items-center justify-between">
                   <div>
                       <p className="text-sm font-medium text-slate-400">Passed</p>
                       <h3 className="text-3xl font-bold text-green-400 mt-1">{stats.passed}</h3>
                   </div>
                   <div className="bg-green-500/10 p-3 rounded-full">
                       <CheckCircle className="h-6 w-6 text-green-500" />
                   </div>
               </CardContent>
           </Card>

           <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
               <CardContent className="p-6 flex items-center justify-between">
                   <div>
                       <p className="text-sm font-medium text-slate-400">Completion Rate</p>
                       <h3 className="text-3xl font-bold text-white mt-1">{stats.completion}%</h3>
                   </div>
                   <div className="bg-indigo-500/10 p-3 rounded-full">
                       <TrendingUp className="h-6 w-6 text-indigo-400" />
                   </div>
               </CardContent>
           </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Course marks — diploma = one table for the whole program */}
            <div className="lg:col-span-2 space-y-5">
              {gradeTables.length > 0 ? (
                gradeTables.map((group) => (
                  <Card
                    key={group.key}
                    className="bg-slate-900/50 border-slate-800 overflow-hidden shadow-sm"
                  >
                    <CardHeader className="border-b border-slate-800/80 bg-slate-900/40 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                            <BookOpen className="h-4 w-4 text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base text-white truncate">{group.title}</CardTitle>
                            <CardDescription className="text-slate-500">
                              {group.isDiploma
                                ? `${group.courses.length} course${group.courses.length !== 1 ? 's' : ''} in one gradebook`
                                : `${group.courses.length} course${group.courses.length !== 1 ? 's' : ''} · marks overview`}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 shrink-0">
                          {group.courses.filter((c) => c.score !== '-').length}/{group.courses.length} graded
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-transparent bg-slate-950/50">
                              {showSemesterColumn && group.isDiploma ? (
                                <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider pl-5">
                                  Semester
                                </TableHead>
                              ) : null}
                              <TableHead className={cn(
                                'text-slate-500 font-semibold text-[11px] uppercase tracking-wider',
                                !(showSemesterColumn && group.isDiploma) && 'pl-5',
                              )}>
                                Course
                              </TableHead>
                              <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center">Score</TableHead>
                              <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center w-[130px]">
                                <span className="inline-flex items-center gap-1"><Percent className="h-3 w-3" /> Mark</span>
                              </TableHead>
                              <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center">Grade</TableHead>
                              <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center hidden sm:table-cell">Points</TableHead>
                              <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-right">Status</TableHead>
                              <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-right pr-5 print:hidden w-[90px]">View</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.courses.map((item, i) => {
                              const pending = item.score === '-';
                              const barWidth = pending ? 0 : Math.min(100, Math.max(0, item.percentage));
                              return (
                                <TableRow
                                  key={`${item.courseCode || item.courseName}-${i}`}
                                  className="border-slate-800/80 hover:bg-slate-800/40 transition-colors"
                                >
                                  {showSemesterColumn && group.isDiploma ? (
                                    <TableCell className="pl-5 py-4 align-middle">
                                      <span className="text-[12px] text-slate-400">
                                        {item.semesterName || '—'}
                                      </span>
                                    </TableCell>
                                  ) : null}
                                  <TableCell className={cn(
                                    'py-4',
                                    !(showSemesterColumn && group.isDiploma) && 'pl-5',
                                  )}>
                                    <div className="font-medium text-white leading-snug">{item.courseName}</div>
                                    {item.courseCode && (
                                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 tracking-wide">
                                        {item.courseCode}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center py-4">
                                    <span className={cn(
                                      'text-sm font-semibold tabular-nums',
                                      pending ? 'text-slate-500' : 'text-slate-100'
                                    )}>
                                      {formatScore(item)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
                                      <span className={cn(
                                        'text-sm font-semibold tabular-nums',
                                        pending ? 'text-slate-500' : 'text-slate-100'
                                      )}>
                                        {pending ? '—' : `${Math.round(item.percentage)}%`}
                                      </span>
                                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                          className={cn('h-full rounded-full transition-all duration-500', scoreBarColor(item.percentage, pending))}
                                          style={{ width: `${barWidth}%` }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center py-4">
                                    <span
                                      className={cn(
                                        'inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm font-bold',
                                        gradeTone(item.grade)
                                      )}
                                    >
                                      {item.grade}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center hidden sm:table-cell py-4">
                                    <span className="font-mono text-sm text-slate-300 tabular-nums">
                                      {pending ? '—' : item.points.toFixed(1)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right py-4">
                                    <Badge
                                      variant={item.status === 'Pass' ? 'default' : item.status === 'Fail' ? 'destructive' : 'secondary'}
                                      className={cn(
                                        'font-medium',
                                        item.status === 'Pass' && 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20',
                                        item.status === 'Fail' && 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20',
                                        item.status === 'Pending' && 'bg-slate-800/60 text-slate-500 border border-slate-700'
                                      )}
                                    >
                                      {item.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right pr-5 print:hidden py-4">
                                    {item.resultId ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 gap-0.5 h-8 px-2"
                                        onClick={() =>
                                          navigate(`/portal/exam-result/${item.resultId}`, {
                                            state: {
                                              gradeRow: {
                                                courseName: item.courseName,
                                                courseCode: item.courseCode,
                                                className: item.className,
                                                score: item.score,
                                                total: item.total,
                                                percentage: item.percentage,
                                                grade: item.grade,
                                                points: item.points,
                                                status: item.status,
                                              },
                                            },
                                          })
                                        }
                                      >
                                        View
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : (
                                      <span className="text-slate-600 text-xs">—</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="py-16">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <AlertCircle className="h-10 w-10 opacity-40" />
                      <p className="font-medium text-slate-400">No graded courses found yet</p>
                      <p className="text-sm text-slate-600">Marks will appear here once your instructor posts results.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Distribution Chart */}
            <Card className="bg-slate-900/50 border-slate-800 h-fit lg:sticky lg:top-6">
                <CardHeader>
                    <CardTitle className="text-base text-slate-200">Grade Distribution</CardTitle>
                    <CardDescription>Letter grades across your courses</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center min-h-[280px]">
                    {chartData.length > 0 ? (
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.map((entry) => (
                                            <Cell key={`cell-${entry.name}`} fill={GRADE_COLORS[entry.name] || '#64748b'} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'var(--tenant-surface)', borderColor: 'var(--tenant-line)', color: 'var(--tenant-text)' }}
                                        itemStyle={{ color: 'var(--tenant-text)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-slate-500 text-sm italic py-8">Not enough data to visualize</div>
                    )}
                    
                    <div className="w-full mt-4 space-y-2">
                         <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                             <span className="text-slate-400">Total Credit Points</span>
                             <span className="text-white font-mono">{studentGrades.reduce((a: any, b: any) => a + b.points, 0).toFixed(1)}</span>
                         </div>
                         <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                             <span className="text-slate-400">Failed courses</span>
                             <span className="text-white font-mono">{stats.failed}</span>
                         </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default StudentGradebookPage;
