import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { getExamResultById } from '@/lib/api';
import { Printer, ArrowLeft, Award, Loader2 } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import {
  getExamScorePercent,
  isExamPassed,
  getExamTotalMarks,
  getLetterGrade,
  getGradePoints,
  isCoursePassed,
} from '@/lib/examPass';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';

/**
 * Student grading detail — opened from Gradebook "View".
 * Shows a grading table (not question cards).
 */
const StudentExamResultPage = () => {
  const params = useParams();
  const resultId = params.resultId || params.examId;
  const navigate = useNavigate();
  const location = useLocation();
  const gradeRowFromNav = location.state?.gradeRow || null;
  const { results, exams, courses, classes, assignments, assignmentSubmissions } = useData();
  const [fetchedResult, setFetchedResult] = useState(() => location.state?.result || null);
  const [loading, setLoading] = useState(!location.state?.result && !gradeRowFromNav);
  const [fetchError, setFetchError] = useState(null);

  const contextResult = useMemo(() => {
    if (!resultId) return null;
    return (
      results.find((r) => r.id === resultId) ||
      results.find((r) => r.exam_id === resultId) ||
      null
    );
  }, [results, resultId]);

  const result = contextResult || fetchedResult;

  useEffect(() => {
    if (contextResult) {
      setFetchedResult(contextResult);
      setLoading(false);
      setFetchError(null);
      return;
    }
    if (!resultId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getExamResultById(resultId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setFetchError('Result not found.');
          setFetchedResult(null);
        } else {
          setFetchedResult(row);
          setFetchError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(getUserMessage(err, { context: 'StudentExamResultPage', fallback: MESSAGES.LOAD_FAILED }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resultId, contextResult]);

  const exam = useMemo(() => {
    if (!result) return null;
    return exams.find((e) => e.id === result.exam_id) || null;
  }, [result, exams]);

  const course = useMemo(() => {
    if (!exam?.course_id) return null;
    return courses.find((c) => c.id === exam.course_id) || null;
  }, [exam, courses]);

  const classData = useMemo(() => {
    if (!exam?.class_id) return null;
    return classes.find((c) => c.id === exam.class_id) || null;
  }, [exam, classes]);

  const gradingRows = useMemo(() => {
    const rows = [];

    if (result) {
      const totalMarks = exam ? getExamTotalMarks(exam) : Number(result.total_marks) || 100;
      const score = Number(result.score ?? result.final_score ?? 0);
      const percentage = getExamScorePercent(score, exam || { total_marks: totalMarks });
      const letter = getLetterGrade(percentage);
      const points = getGradePoints(percentage);
      const passed = isCoursePassed(percentage);

      rows.push({
        key: 'exam',
        component: exam?.title || gradeRowFromNav?.courseName || 'Final Exam',
        type: 'Exam',
        score,
        total: totalMarks,
        percentage,
        grade: letter,
        points,
        status: passed ? 'Pass' : 'Fail',
      });

      // Assignment bonus points for same class/course (if graded)
      const relatedAssignments = (assignments || []).filter(
        (a) =>
          a.class_id === exam?.class_id &&
          (!a.course_id || !exam?.course_id || a.course_id === exam.course_id)
      );
      relatedAssignments.forEach((a) => {
        const sub = (assignmentSubmissions || []).find(
          (s) => s.assignment_id === a.id && s.student_id === result.student_id && s.score != null
        );
        if (!sub) return;
        const bonusScore = Number(sub.score);
        const bonusTotal = Number(a.total_marks) || 0;
        rows.push({
          key: `assign-${a.id}`,
          component: a.title || 'Assignment',
          type: 'Bonus',
          score: bonusScore,
          total: bonusTotal,
          percentage: bonusTotal > 0 ? (bonusScore / bonusTotal) * 100 : 0,
          grade: '—',
          points: '—',
          status: 'Bonus',
        });
      });
    } else if (gradeRowFromNav) {
      rows.push({
        key: 'nav',
        component: gradeRowFromNav.courseName || 'Course',
        type: 'Course',
        score: gradeRowFromNav.score,
        total: gradeRowFromNav.total,
        percentage: gradeRowFromNav.percentage,
        grade: gradeRowFromNav.grade,
        points: gradeRowFromNav.points,
        status: gradeRowFromNav.status,
      });
    }

    return rows;
  }, [result, exam, assignments, assignmentSubmissions, gradeRowFromNav]);

  if (loading) {
    return (
      <div className="p-8 text-center flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading grading…
      </div>
    );
  }

  if ((!result && !gradeRowFromNav) || fetchError) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-400">{fetchError || 'Grading record not found.'}</p>
        <Button variant="outline" onClick={() => navigate('/portal/gradebook')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Gradebook
        </Button>
      </div>
    );
  }

  const totalMarks = exam ? getExamTotalMarks(exam) : Number(result?.total_marks) || Number(gradeRowFromNav?.total) || 100;
  const score = result
    ? Number(result.score ?? result.final_score ?? 0)
    : Number(gradeRowFromNav?.score ?? 0);
  const percentage = Math.round(
    gradeRowFromNav?.percentage != null
      ? Number(gradeRowFromNav.percentage)
      : getExamScorePercent(score, exam || { total_marks: totalMarks })
  );
  const passed = result
    ? isExamPassed(score, exam || { total_marks: totalMarks, passing_score: 50 })
    : gradeRowFromNav?.status === 'Pass';
  const letter = getLetterGrade(percentage);
  const points = getGradePoints(percentage);
  const submittedAt = result?.submission_date || result?.graded_at || result?.created_at;
  const title =
    course?.name ||
    gradeRowFromNav?.courseName ||
    exam?.title ||
    'Course Grading';
  const subtitle = [classData?.name || gradeRowFromNav?.className, exam?.title]
    .filter(Boolean)
    .join(' · ');

  return (
    <AnimatedPage>
      <Helmet>
        <title>Grading - {title}</title>
      </Helmet>

      <div className="max-w-5xl mx-auto pb-20 print:max-w-none print:pb-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
          <Button variant="ghost" onClick={() => navigate('/portal/gradebook')} className="justify-start w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Gradebook
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 mt-1">{subtitle}</p>}
          {submittedAt && (
            <p className="text-slate-500 text-sm mt-1">Graded: {formatDate(submittedAt)}</p>
          )}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-4 text-center">
              <div className="text-xs uppercase text-slate-500 font-semibold">Score</div>
              <div className="text-2xl font-bold text-white mt-1 tabular-nums">
                {score} <span className="text-sm text-slate-500 font-normal">/ {totalMarks}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-4 text-center">
              <div className="text-xs uppercase text-slate-500 font-semibold">Mark %</div>
              <div className={`text-2xl font-bold mt-1 ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {percentage}%
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-4 text-center">
              <div className="text-xs uppercase text-slate-500 font-semibold">Grade</div>
              <div className={`text-2xl font-bold mt-1 ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {letter}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-4 text-center">
              <div className="text-xs uppercase text-slate-500 font-semibold">Result</div>
              <div className={`text-2xl font-bold mt-1 ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {passed ? 'PASS' : 'FAIL'}
              </div>
            </CardContent>
          </Card>
        </div>

        {passed && (
          <p className="text-emerald-400 flex items-center gap-2 text-sm print:hidden">
            <Award className="h-4 w-4" /> You passed this assessment.
          </p>
        )}

        {/* Grading table */}
        <Card className="bg-slate-900/60 border-slate-800 overflow-hidden print:bg-white print:border">
          <CardHeader className="border-b border-slate-800 print:border-slate-200">
            <CardTitle className="text-base text-slate-100 print:text-black">Grading Table</CardTitle>
            <CardDescription>Marks breakdown for this course</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent bg-slate-950/50 print:bg-slate-100">
                    <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider pl-5">Component</TableHead>
                    <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center">Type</TableHead>
                    <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center">Score</TableHead>
                    <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center">Mark %</TableHead>
                    <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center">Grade</TableHead>
                    <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-center hidden sm:table-cell">Points</TableHead>
                    <TableHead className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider text-right pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradingRows.map((row) => (
                    <TableRow key={row.key} className="border-slate-800/80 print:border-slate-200">
                      <TableCell className="pl-5 py-3 font-medium text-white print:text-black">
                        {row.component}
                      </TableCell>
                      <TableCell className="text-center py-3 text-slate-400 text-sm">{row.type}</TableCell>
                      <TableCell className="text-center py-3 font-semibold tabular-nums text-slate-100 print:text-black">
                        {row.score} / {row.total}
                      </TableCell>
                      <TableCell className="text-center py-3 tabular-nums text-slate-200 print:text-black">
                        {Math.round(Number(row.percentage) || 0)}%
                      </TableCell>
                      <TableCell className="text-center py-3 font-bold text-white print:text-black">
                        {row.grade}
                      </TableCell>
                      <TableCell className="text-center py-3 hidden sm:table-cell font-mono text-sm text-slate-300 print:text-black">
                        {row.points === '—' ? '—' : Number(row.points).toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right pr-5 py-3">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'font-medium border',
                            row.status === 'Pass' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
                            row.status === 'Fail' && 'bg-rose-500/10 text-rose-400 border-rose-500/25',
                            row.status === 'Bonus' && 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                          )}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-slate-700 bg-slate-950/40 print:bg-slate-50">
                    <TableCell className="pl-5 py-3 font-bold text-white print:text-black" colSpan={2}>
                      Course Total
                    </TableCell>
                    <TableCell className="text-center py-3 font-bold tabular-nums text-white print:text-black">
                      {score} / {totalMarks}
                    </TableCell>
                    <TableCell className="text-center py-3 font-bold tabular-nums text-white print:text-black">
                      {percentage}%
                    </TableCell>
                    <TableCell className="text-center py-3 font-bold text-white print:text-black">{letter}</TableCell>
                    <TableCell className="text-center py-3 hidden sm:table-cell font-mono font-bold text-white print:text-black">
                      {points.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right pr-5 py-3">
                      <Badge
                        className={cn(
                          'font-medium border',
                          passed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                        )}
                      >
                        {passed ? 'Pass' : 'Fail'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
};

export default StudentExamResultPage;
