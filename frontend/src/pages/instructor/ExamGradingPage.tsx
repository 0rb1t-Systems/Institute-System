import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getExamScorePercent, getLetterGrade, isExamPassed } from '@/lib/examPass';
import { useAuth } from '@/contexts/AuthContext';
import { getInstitutionGradeScale } from '@/lib/gradingScale';

const ExamGradingPage = () => {
    const { examId } = useParams();
    const navigate = useNavigate();
    const { institution } = useAuth();
    const gradeScale = useMemo(() => getInstitutionGradeScale(institution), [institution]);
    const { exams, results, enrollments, students, saveManualGrades } = useData();
    const { toast } = useToast();
    
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [gradeData, setGradeData] = useState({ score: '' });
    const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const exam = useMemo(() => exams.find(e => e.id === examId), [exams, examId]);
    
    // Get all students in the class, regardless of whether they took the exam
    const classStudents = useMemo(() => {
        if (!exam) return [];
        return enrollments
            .filter(e => e.class_id === exam.class_id && e.status === 'active')
            .map(e => {
                const student = students.find(s => s.id === e.student_id);
                const result = results.find(r => r.exam_id === examId && r.student_id === e.student_id);
                return {
                    student,
                    result
                };
            })
            .filter((item) => item.student);
    }, [exam, enrollments, results, students, examId]);

    const handleOpenGradeDialog = (item) => {
        setSelectedStudent(item);
        setGradeData({
            score: item.result?.final_score !== undefined ? item.result.final_score : ''
        });
        setIsGradeDialogOpen(true);
    };

    const handleSaveGrade = async () => {
        setLoading(true);
        try {
            const scoreVal = parseInt(gradeData.score);
            if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > exam.total_marks) {
                throw new Error(`Score must be between 0 and ${exam.total_marks}`);
            }

            const payload = {
                ...(selectedStudent.result || {}),
                exam_id: examId,
                student_id: selectedStudent.student.id,
                score: scoreVal,
                final_score: scoreVal, // Assuming final score matches raw score for manual grading
                total_marks: exam.total_marks,
                submission_date: selectedStudent.result?.submission_date || new Date().toISOString()
            };

            await saveManualGrades([payload]);
            
            toast({ title: "Success", description: MESSAGES.SUCCESS.GRADE_SAVED });
            setIsGradeDialogOpen(false);
        } catch (error) {
            notify.error(error, { context: 'ExamGradingPage - save', fallback: MESSAGES.SAVE_FAILED });
        } finally {
            setLoading(false);
        }
    };

    if (!exam) return <div className="p-8 text-center text-white">Exam not found.</div>;

    return (
        <AnimatedPage>
            <Helmet><title>Grading: {exam.title}</title></Helmet>
            
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-6 min-w-0">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/examinations')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold text-white break-words">{exam.title}</h1>
                        <p className="text-slate-400 text-sm break-words">
                            Date: {formatDate(exam.open_time)} | Max Marks: {exam.total_marks}
                        </p>
                    </div>
            </div>

            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle>Student Results</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-transparent">
                                <TableHead>Student</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center hidden sm:table-cell">Date</TableHead>
                                <TableHead className="text-center">Score</TableHead>
                                <TableHead className="text-center">Mark %</TableHead>
                                <TableHead className="text-center">Grade</TableHead>
                                <TableHead className="text-center">Result</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classStudents.map(item => {
                                const rawScore = item.result?.final_score ?? item.result?.score;
                                const hasScore = rawScore !== undefined && rawScore !== null && rawScore !== '';
                                const pct = hasScore ? Math.round(getExamScorePercent(Number(rawScore), exam)) : null;
                                const letter = pct != null ? getLetterGrade(pct, gradeScale) : '—';
                                const passed = hasScore ? isExamPassed(Number(rawScore), exam) : null;

                                return (
                                <TableRow key={item.student.id} className="border-slate-800">
                                    <TableCell className="font-medium">
                                        {item.student.name}
                                        <div className="text-xs text-slate-500">{item.student.student_code}</div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {item.result ? (
                                            <Badge variant="success" className="bg-green-900 text-green-400">
                                                Graded
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-500 border-slate-700">Pending</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center hidden sm:table-cell text-slate-400">
                                        {item.result ? formatDate(item.result.submission_date) : '—'}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {hasScore ? (
                                            <span className="font-bold text-white tabular-nums">
                                              {rawScore} <span className="text-slate-500 text-xs font-normal">/ {exam.total_marks}</span>
                                            </span>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell className="text-center font-semibold tabular-nums text-slate-200">
                                        {pct != null ? `${pct}%` : '—'}
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-white">{letter}</TableCell>
                                    <TableCell className="text-center">
                                        {passed == null ? (
                                          <span className="text-slate-600">—</span>
                                        ) : passed ? (
                                          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Pass</Badge>
                                        ) : (
                                          <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20">Fail</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" onClick={() => handleOpenGradeDialog(item)}>
                                            {item.result ? 'Edit' : 'Grade'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Grade Exam</DialogTitle>
                        <DialogDescription>Enter score for {selectedStudent?.student.name}.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>Score (Max: {exam.total_marks})</Label>
                                <Input type="number" value={gradeData.score} onChange={(e) => setGradeData({...gradeData, score: e.target.value})} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGradeDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveGrade} disabled={loading}>{loading ? 'Saving...' : 'Save Score'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AnimatedPage>
    );
};

export default ExamGradingPage;