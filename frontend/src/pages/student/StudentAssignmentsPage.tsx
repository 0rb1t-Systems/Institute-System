import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, Download, FileText, Clock, CheckCircle2, Star } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { uploadAssignmentFile, resolveAssignmentFileUrl } from '@/lib/api';
import { likertToneClass } from '@/lib/ratingEvaluation';

const StudentAssignmentsPage = () => {
    const { user } = useAuth();
    const {
      assignments,
      assignmentSubmissions,
      enrollments,
      classes,
      courses,
      createManualSubmission,
      ratingEvaluations,
      ratingQuestions,
      ratingResponses,
      submitRatingResponseData,
    } = useData();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(null);
    const [activeEval, setActiveEval] = useState(null);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const openAssignmentFile = async (pathOrUrl) => {
        if (!pathOrUrl) return;
        try {
            const url = await resolveAssignmentFileUrl(pathOrUrl);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error) {
            notify.error(error, { context: 'StudentAssignmentsPage - open file', fallback: MESSAGES.LOAD_FAILED });
        }
    };

    const student = React.useMemo(() => {
         return user?.studentId ? { id: user.studentId } : null;
    }, [user]);

    const myClassIds = useMemo(() => {
        if (!student) return [];
        return enrollments
            .filter(e => e.student_id === student.id && e.status === 'active')
            .map(e => e.class_id);
    }, [enrollments, student]);

    const myAssignments = useMemo(() => {
        return assignments
            .filter(a => myClassIds.includes(a.class_id))
            .map(a => {
                const cls = classes.find(c => c.id === a.class_id);
                const courseName = courses.find(c => c.id === a.course_id)?.name;
                const submission = assignmentSubmissions.find(s => s.assignment_id === a.id && s.student_id === student?.id);
                
                const dueDate = new Date(a.due_date);
                const now = new Date();
                const isPastDeadline = Number.isFinite(dueDate.getTime()) && now > dueDate;
                
                const gradedDate = submission?.graded_at
                  ? new Date(submission.graded_at)
                  : submission?.score != null
                    ? new Date(submission.submitted_at || submission.created_at)
                    : null;
                const isArchived = gradedDate && (Number(now) - Number(gradedDate) > 1000 * 60 * 60 * 24 * 60);
                const isGraded = submission?.score != null || Boolean(submission?.graded_at);

                return {
                    ...a,
                    className: cls?.name,
                    courseName,
                    submission,
                    isPastDeadline,
                    isArchived,
                    isGraded,
                };
            })
            .filter(a => !a.isArchived)
            .sort((a, b) => Number(new Date(a.due_date)) - Number(new Date(b.due_date)));
    }, [assignments, myClassIds, classes, courses, assignmentSubmissions, student]);

    const myEvaluations = useMemo(() => {
        if (!student?.id) return [];
        return ratingEvaluations
            .filter((e) => e.is_active !== false && myClassIds.includes(e.class_id))
            .map((e) => {
                const cls = classes.find((c) => c.id === e.class_id);
                const courseName = courses.find((c) => c.id === e.course_id)?.name;
                const response = ratingResponses.find(
                    (r) => r.evaluation_id === e.id && r.student_id === student.id
                );
                const questions = ratingQuestions
                    .filter((q) => q.evaluation_id === e.id)
                    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
                return {
                    ...e,
                    className: cls?.name,
                    courseName,
                    response,
                    questions,
                    isSubmitted: Boolean(response),
                };
            })
            .sort((a, b) => Number(new Date(b.created_at)) - Number(new Date(a.created_at)));
    }, [ratingEvaluations, myClassIds, classes, courses, ratingResponses, ratingQuestions, student]);

    const handleFileUpload = async (event, assignmentId) => {
        const file = event.target.files[0];
        if (!file) return;
        if (!student?.id) {
            notify.validation(MESSAGES.SESSION_EXPIRED.description);
            return;
        }
        
        setUploading(assignmentId);
        try {
            const storagePath = await uploadAssignmentFile(file, `submissions/${assignmentId}`);
            
            await createManualSubmission({
                assignment_id: assignmentId,
                student_id: student.id,
                content: file.name,
                file_url: storagePath,
            });

            toast({ title: "Success", description: MESSAGES.SUCCESS.DOCUMENT_UPLOADED });
        } catch (error) {
            notify.error(error, { context: 'StudentAssignmentsPage - upload', fallback: MESSAGES.SAVE_FAILED });
        } finally {
            setUploading(null);
            event.target.value = '';
        }
    };

    const openTake = (ev) => {
        setActiveEval(ev);
        const initial = {};
        if (ev.response?.answers) {
            ev.response.answers.forEach((a) => {
                if (a.question_id) initial[a.question_id] = a.value || '';
            });
        }
        setAnswers(initial);
    };

    const handleRatingSubmit = async () => {
        if (!activeEval || !student?.id) return;
        const missing = activeEval.questions.filter((q) => !String(answers[q.id] || '').trim());
        if (missing.length > 0) {
            notify.validation('Please answer every question before submitting.');
            return;
        }
        setSubmitting(true);
        try {
            await submitRatingResponseData({
                evaluation_id: activeEval.id,
                answers: activeEval.questions.map((q) => ({
                    question_id: q.id,
                    value: String(answers[q.id] || '').trim(),
                })),
            });
            toast({ title: 'Success', description: MESSAGES.SUCCESS.RATING_SUBMITTED });
            setActiveEval(null);
        } catch (error) {
            notify.error(error, { context: 'StudentAssignmentsPage - rating', fallback: MESSAGES.SAVE_FAILED });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AnimatedPage>
            <Helmet><title>My Assignments - Portal</title></Helmet>
            <PageHeader title="Assignments" subtitle="Open an assignment, upload your file, and wait for your instructor to grade it." />

            <div className="grid gap-6">
                {myAssignments.length > 0 ? (
                    myAssignments.map(assign => {
                        const fileUrl = assign.submission?.file_url || assign.submission?.attachment_url;
                        const canUpload = !assign.isGraded;
                        return (
                        <Card key={assign.id} className="bg-slate-900/50 border-slate-800">
                            <CardHeader>
                                <div className="flex justify-between items-start gap-3">
                                    <div>
                                        <CardTitle>{assign.title}</CardTitle>
                                        <CardDescription className="mt-1">
                                          {assign.courseName ? (
                                            <>
                                              <span className="font-medium text-indigo-300">{assign.courseName}</span>
                                              {assign.className ? <span> · {assign.className}</span> : null}
                                            </>
                                          ) : (
                                            assign.className
                                          )}
                                        </CardDescription>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {assign.submission ? (
                                            <Badge className={assign.isGraded ? 'bg-green-500' : 'bg-blue-500'}>
                                                {assign.isGraded ? 'Graded' : 'Submitted'}
                                            </Badge>
                                        ) : assign.isPastDeadline ? (
                                            <Badge variant="destructive">Late — upload still open</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-yellow-500 border-yellow-500">Pending</Badge>
                                        )}
                                        <span className="text-xs text-slate-400 flex items-center gap-1 text-right">
                                            <Clock className="h-3 w-3 shrink-0" /> Due: {formatDateTime(assign.due_date)}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          {assign.counts_toward_grade !== false
                                            ? `Bonus up to ${assign.total_marks} pts (added to exam)`
                                            : `Practice up to ${assign.total_marks} pts (not in gradebook)`}
                                        </span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="text-sm text-slate-300 bg-slate-950/50 p-4 rounded border border-slate-800">
                                    {assign.description || "No description provided."}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                    {assign.attachment_url && (
                                        <Button
                                          variant="outline"
                                          className="flex-1 border-dashed"
                                          type="button"
                                          onClick={() => openAssignmentFile(assign.attachment_url)}
                                        >
                                            <Download className="mr-2 h-4 w-4" /> Download Resources
                                        </Button>
                                    )}

                                    {canUpload && (
                                        <div className="flex-1">
                                            <div className="relative">
                                                <Input 
                                                    type="file" 
                                                    className="hidden" 
                                                    id={`upload-${assign.id}`} 
                                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.zip"
                                                    onChange={(e) => handleFileUpload(e, assign.id)}
                                                    disabled={uploading === assign.id}
                                                />
                                                <Label 
                                                    htmlFor={`upload-${assign.id}`} 
                                                    className={`flex items-center justify-center w-full h-10 px-4 py-2 text-sm font-medium transition-colors rounded-md cursor-pointer ${uploading === assign.id ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                                >
                                                    {uploading === assign.id
                                                      ? 'Uploading...'
                                                      : (
                                                        <>
                                                          <Upload className="mr-2 h-4 w-4" />
                                                          {assign.submission ? 'Replace File' : 'Upload Submission'}
                                                        </>
                                                      )}
                                                </Label>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 text-center">
                                              PDF, Word, image, or ZIP — max 10MB.
                                              {assign.isPastDeadline
                                                ? ' Due date passed — late upload allowed until graded.'
                                                : ` Deadline: ${formatDateTime(assign.due_date)}`}
                                            </p>
                                        </div>
                                    )}

                                    {assign.submission && (
                                        <div className="flex-1 flex items-center justify-center gap-2 bg-green-950/20 border border-green-900/50 rounded px-4 py-2 text-sm text-green-400">
                                            <CheckCircle2 className="h-4 w-4" />
                                            {assign.isGraded ? 'Graded submission' : 'Submission received'}
                                            {fileUrl && (
                                                 <button type="button" onClick={() => openAssignmentFile(fileUrl)} className="ml-2 underline text-xs opacity-80 hover:opacity-100">View File</button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {assign.isGraded && (
                                    <div className="mt-4 p-4 bg-slate-900 rounded border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-white">
                                              {assign.counts_toward_grade !== false ? 'Bonus' : 'Score'}:{' '}
                                              {assign.submission.score ?? assign.submission.grade} / {assign.total_marks}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                              Graded on {formatDateTime(assign.submission.graded_at || assign.submission.updated_at || new Date().toISOString())}
                                            </span>
                                        </div>
                                        {assign.submission.feedback && (
                                            <div className="text-sm text-slate-400">
                                                <span className="font-semibold text-slate-300">Feedback: </span>
                                                {assign.submission.feedback}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                        <FileText className="h-12 w-12 mb-4 opacity-20" />
                        <p>No assignments active at the moment.</p>
                    </div>
                )}
            </div>

            {myEvaluations.length > 0 && (
              <div className="mt-10 space-y-4">
                <h2 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-400" />
                  Rating Evaluations
                </h2>
                <div className="grid gap-6">
                  {myEvaluations.map((ev) => (
                    <Card key={ev.id} className="bg-slate-900/50 border-slate-800">
                      <CardHeader>
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-amber-400" />
                              {ev.title}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {ev.courseName ? (
                                <>
                                  <span className="font-medium text-indigo-300">{ev.courseName}</span>
                                  {ev.className ? <span> · {ev.className}</span> : null}
                                </>
                              ) : (
                                ev.className
                              )}
                            </CardDescription>
                          </div>
                          {ev.isSubmitted ? (
                            <Badge className="bg-green-600/80">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Submitted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-400 border-amber-500/50">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-400 space-y-1">
                          <p>{ev.questions.length} question{ev.questions.length === 1 ? '' : 's'}</p>
                          {ev.due_date && (
                            <p className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Due: {formatDateTime(ev.due_date)}
                            </p>
                          )}
                        </div>
                        <Button onClick={() => openTake(ev)} variant={ev.isSubmitted ? 'outline' : 'default'}>
                          {ev.isSubmitted ? 'View / Update' : 'Start Rating'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Dialog open={Boolean(activeEval)} onOpenChange={(open) => !open && setActiveEval(null)}>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{activeEval?.title}</DialogTitle>
                  <DialogDescription>
                    {activeEval?.description ||
                      'Answer each question about the instructor and how well you understood the course.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-2">
                  {activeEval?.questions?.map((q, idx) => {
                    const options = Array.isArray(q.options) ? q.options : [];
                    return (
                      <div key={q.id} className="space-y-3">
                        <Label className="text-slate-200 leading-snug">
                          {idx + 1}. {q.text}
                        </Label>
                        {q.type === 'text' ? (
                          <Textarea
                            rows={3}
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Write your answer…"
                          />
                        ) : (
                          <div className="space-y-2">
                            {options.map((opt) => {
                              const selected = answers[q.id] === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))
                                  }
                                  className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                                    selected
                                      ? 'border-indigo-500 bg-indigo-950/40 text-slate-100'
                                      : `border-slate-800 hover:border-slate-600 ${likertToneClass(opt.tone)}`
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setActiveEval(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleRatingSubmit} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </AnimatedPage>
    );
};

export default StudentAssignmentsPage;
