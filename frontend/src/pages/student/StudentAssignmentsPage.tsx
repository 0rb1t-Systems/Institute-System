import React, { useState, useMemo } from 'react';
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
import { Upload, Download, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { uploadAssignmentFile, resolveAssignmentFileUrl } from '@/lib/api';

const StudentAssignmentsPage = () => {
    const { user } = useAuth();
    const { assignments, assignmentSubmissions, enrollments, classes, courses, createManualSubmission } = useData();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(null);

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

    return (
        <AnimatedPage>
            <Helmet><title>My Assignments - Portal</title></Helmet>
            <PageHeader title="Assignments" subtitle="Open an assignment, upload your file, and wait for your instructor to grade it." />

            <div className="grid gap-6">
                {myAssignments.length > 0 ? (
                    myAssignments.map(assign => {
                        const fileUrl = assign.submission?.file_url || assign.submission?.attachment_url;
                        // Upload stays open past due date until the instructor grades.
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
        </AnimatedPage>
    );
};

export default StudentAssignmentsPage;
