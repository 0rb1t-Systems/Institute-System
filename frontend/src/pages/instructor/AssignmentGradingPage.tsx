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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { ArrowLeft, Download } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { resolveAssignmentFileUrl } from '@/lib/api';
import { getAssignmentBonusRoom, assignmentCountsTowardGrade } from '@/lib/assignmentBonus';

const AssignmentGradingPage = () => {
    const { assignmentId } = useParams();
    const navigate = useNavigate();
    const {
      assignments,
      assignmentSubmissions,
      enrollments,
      saveSubmissionGrade,
      createManualSubmission,
      students,
      exams,
      results,
      classes,
    } = useData();
    const { toast } = useToast();
    
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [gradeData, setGradeData] = useState({ grade: '', feedback: '' });
    const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const openSubmissionFile = async (pathOrUrl) => {
        if (!pathOrUrl) return;
        try {
            const url = await resolveAssignmentFileUrl(pathOrUrl);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error) {
            notify.error(error, { context: 'AssignmentGradingPage - open file', fallback: MESSAGES.LOAD_FAILED });
        }
    };

    const assignment = useMemo(() => assignments.find(a => a.id === assignmentId), [assignments, assignmentId]);
    const classPrimaryCourseId = useMemo(() => {
      if (!assignment) return null;
      return classes.find((c) => c.id === assignment.class_id)?.course_id || null;
    }, [assignment, classes]);
    
    const classStudents = useMemo(() => {
        if (!assignment) return [];
        return enrollments
            .filter(e => e.class_id === assignment.class_id && e.status === 'active')
            .map(e => {
                const student = students.find(s => s.id === e.student_id);
                const submission = assignmentSubmissions.find(sub => sub.assignment_id === assignmentId && sub.student_id === e.student_id);
                return {
                    student,
                    submission
                };
            })
            .filter((item) => item.student);
    }, [assignment, enrollments, assignmentSubmissions, students, assignmentId]);

    const bonusPreview = useMemo(() => {
      if (!assignment || !selectedStudent?.student?.id) return null;
      return getAssignmentBonusRoom({
        studentId: selectedStudent.student.id,
        assignment,
        assignments,
        exams,
        results,
        submissions: assignmentSubmissions,
        classPrimaryCourseId,
      });
    }, [assignment, selectedStudent, assignments, exams, results, assignmentSubmissions, classPrimaryCourseId]);

    const handleOpenGradeDialog = (item) => {
        setSelectedStudent(item);
        const existing = item.submission?.score ?? item.submission?.grade;
        setGradeData({
            grade: existing != null && existing !== '' ? String(existing) : '',
            feedback: item.submission?.feedback || ''
        });
        setIsGradeDialogOpen(true);
    };

    const handleSaveGrade = async () => {
        setLoading(true);
        try {
            const gradeVal = Number(gradeData.grade);
            if (!Number.isFinite(gradeVal) || gradeVal < 0) {
                throw new Error('Enter a valid grade (0 or higher).');
            }
            if (gradeVal > assignment.total_marks) {
                throw new Error(`Grade cannot exceed assignment max (${assignment.total_marks}).`);
            }

            const roomInfo = getAssignmentBonusRoom({
              studentId: selectedStudent.student.id,
              assignment,
              assignments,
              exams,
              results,
              submissions: assignmentSubmissions,
              classPrimaryCourseId,
            });

            if (
              assignmentCountsTowardGrade(assignment) &&
              roomInfo.examScore != null &&
              gradeVal > roomInfo.maxAllowedForThisAssignment
            ) {
              throw new Error(
                `Only ${roomInfo.maxAllowedForThisAssignment} point(s) can be added. ` +
                `Exam is ${roomInfo.examScore}/${roomInfo.examTotal}` +
                (roomInfo.otherAssignmentPoints > 0 ? ` (+${roomInfo.otherAssignmentPoints} from other assignments)` : '') +
                `. Final cannot exceed ${roomInfo.examTotal}.`
              );
            }

            if (selectedStudent.submission) {
                await saveSubmissionGrade(selectedStudent.submission.id, {
                    grade: gradeVal,
                    feedback: gradeData.feedback,
                });
            } else {
                await createManualSubmission({
                    assignment_id: assignmentId,
                    student_id: selectedStudent.student.id,
                    grade: gradeVal,
                    feedback: gradeData.feedback,
                    submission_content: '[Manual Grade Entry]',
                    submission_date: new Date().toISOString()
                });
            }
            
            toast({ title: "Success", description: MESSAGES.SUCCESS.GRADE_SAVED });
            setIsGradeDialogOpen(false);
        } catch (error) {
            notify.error(error, { context: 'AssignmentGradingPage - save', fallback: MESSAGES.SAVE_FAILED });
        } finally {
            setLoading(false);
        }
    };

    const countsTowardGrade = assignmentCountsTowardGrade(assignment);

    if (!assignment) return <div className="p-8 text-center">Assignment not found.</div>;

    return (
        <AnimatedPage>
            <Helmet><title>Grading: {assignment.title}</title></Helmet>
            
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-6 min-w-0">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/assignments')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold text-white break-words">{assignment.title}</h1>
                        <p className="text-slate-400 text-sm break-words">
                            Due: {formatDateTime(assignment.due_date)} |{' '}
                            {countsTowardGrade
                              ? `Bonus max: ${assignment.total_marks} (added to exam)`
                              : `Practice max: ${assignment.total_marks} (not in gradebook)`}
                        </p>
                    </div>
            </div>

            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle>Student Submissions</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Submitted On</TableHead>
                                <TableHead>Content</TableHead>
                                <TableHead>Grade</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classStudents.map(item => {
                                const isGraded = item.submission?.score != null || item.submission?.graded_at;
                                const hasFile = item.submission?.file_url || item.submission?.attachment_url;
                                return (
                                <TableRow key={item.student.id}>
                                    <TableCell className="font-medium">
                                        {item.student.name}
                                        <div className="text-xs text-slate-500">{item.student.student_code}</div>
                                    </TableCell>
                                    <TableCell>
                                        {item.submission ? (
                                            <Badge
                                                className={isGraded ? 'bg-green-900 text-green-400' : 'bg-blue-900 text-blue-400'}
                                            >
                                                {isGraded ? 'Graded' : 'Submitted'}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-500 border-slate-700">Not Submitted</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {item.submission
                                          ? formatDateTime(item.submission.submission_date || item.submission.submitted_at)
                                          : '-'}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">
                                        {hasFile ? (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 px-2 text-blue-400"
                                              type="button"
                                              onClick={() => openSubmissionFile(item.submission.file_url || item.submission.attachment_url)}
                                            >
                                              <Download className="h-3.5 w-3.5 mr-1" />
                                              File
                                            </Button>
                                        ) : (
                                          item.submission?.submission_content || item.submission?.content || '-'
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {item.submission?.score != null || item.submission?.grade != null ? (
                                            <span className="font-bold text-white">
                                              {item.submission.score ?? item.submission.grade}{' '}
                                              <span className="text-slate-500 text-xs">/ {assignment.total_marks}</span>
                                            </span>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" onClick={() => handleOpenGradeDialog(item)}>
                                            {isGraded ? 'Edit Grade' : 'Grade'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Grade Submission</DialogTitle>
                        <DialogDescription>
                          {countsTowardGrade
                            ? `Enter bonus marks for ${selectedStudent?.student.name}. Points are added to the exam score and cannot exceed the exam total.`
                            : `Enter practice marks for ${selectedStudent?.student.name}. This does not change their Gradebook or GPA.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Submission Content</Label>
                            <div className="p-3 bg-slate-950 rounded border border-slate-800 text-sm min-h-[60px] max-h-[200px] overflow-y-auto">
                                {selectedStudent?.submission?.submission_content
                                  || selectedStudent?.submission?.content
                                  || <span className="text-slate-500 italic">No content submitted.</span>}
                            </div>
                            {(selectedStudent?.submission?.file_url || selectedStudent?.submission?.attachment_url) ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openSubmissionFile(
                                  selectedStudent.submission.file_url || selectedStudent.submission.attachment_url
                                )}
                              >
                                <Download className="h-4 w-4 mr-2" /> Open submitted file
                              </Button>
                            ) : null}
                        </div>
                        {countsTowardGrade && bonusPreview && (
                          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 space-y-1">
                            {bonusPreview.examScore != null ? (
                              <>
                                <p>
                                  Exam: <span className="text-slate-200">{bonusPreview.examScore}</span> / {bonusPreview.examTotal}
                                  {bonusPreview.otherAssignmentPoints > 0
                                    ? <> · Other bonuses: <span className="text-slate-200">+{bonusPreview.otherAssignmentPoints}</span></>
                                    : null}
                                </p>
                                <p>
                                  Max you can give now:{' '}
                                  <span className="text-emerald-400 font-semibold">{bonusPreview.maxAllowedForThisAssignment}</span>
                                  {' '}(final would be{' '}
                                  {Math.min(
                                    bonusPreview.examTotal,
                                    bonusPreview.examScore + bonusPreview.otherAssignmentPoints + (Number(gradeData.grade) || 0)
                                  )}
                                  /{bonusPreview.examTotal})
                                </p>
                              </>
                            ) : (
                              <p>No exam grade yet — you can grade up to {assignment.total_marks}. Points will apply once the exam is graded.</p>
                            )}
                          </div>
                        )}
                        {!countsTowardGrade && (
                          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                            Practice assignment — score is for feedback only and will not appear in the Gradebook.
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label>
                                  Marks (Max:{' '}
                                  {countsTowardGrade
                                    ? (bonusPreview?.maxAllowedForThisAssignment ?? assignment.total_marks)
                                    : assignment.total_marks}
                                  )
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={
                                    countsTowardGrade
                                      ? (bonusPreview?.maxAllowedForThisAssignment ?? assignment.total_marks)
                                      : assignment.total_marks
                                  }
                                  value={gradeData.grade}
                                  onChange={(e) => setGradeData({...gradeData, grade: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Feedback</Label>
                            <Textarea 
                                value={gradeData.feedback} 
                                onChange={(e) => setGradeData({...gradeData, feedback: e.target.value})} 
                                placeholder="Optional comments for the student..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsGradeDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveGrade} disabled={loading}>{loading ? 'Saving...' : 'Save Grade'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AnimatedPage>
    );
};

export default AssignmentGradingPage;
