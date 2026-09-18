import React, { useState, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Plus, Calendar, BookOpen, Clock, Trash2, Edit, CheckCircle, Users, File, Star } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { uploadAssignmentFile } from '@/lib/api';
import { coursesForClass } from '@/lib/diplomaCourses';
import {
  DateTimePickerField,
  splitDateTimeLocal,
  combineDateAndTime,
} from '@/components/ui/DateTimeFields';
import RatingEvaluationsSection from '@/components/ratings/RatingEvaluationsSection';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const AssignmentsPage = () => {
  const { user } = useAuth();
  const { assignments, classes, courses, classCourses, diplomaCourses = [], saveAssignment, deleteAssignmentData, assignmentSubmissions } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const canManageRatings = user?.role === 'admin' || user?.role === 'staff';
  const openCreateRatingRef = useRef<(() => void) | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
      title: '',
      description: '',
      class_id: '',
      course_id: '',
      due_date: '',
      due_time: '14:00',
      total_marks: 10,
      counts_toward_grade: true,
  });

  const availableClasses = useMemo(() => {
      if (user?.role === 'instructor') {
          return classes.filter(c => c.instructor_id === user.id && c.is_active);
      }
      if (user?.role === 'admin' || user?.role === 'staff') return classes.filter(c => c.is_active);
      return [];
  }, [classes, user]);

  const selectedClassCourses = useMemo(() => {
    const cls = classes.find((c) => c.id === formData.class_id);
    return coursesForClass(cls, courses, classCourses, diplomaCourses);
  }, [classes, courses, classCourses, diplomaCourses, formData.class_id]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === formData.class_id) || null,
    [classes, formData.class_id],
  );
  const isDiplomaClass = Boolean(selectedClass?.diploma_id) || selectedClassCourses.length > 1;

  const filteredAssignments = useMemo(() => {
      if (user?.role === 'admin' || user?.role === 'staff') return assignments;
      const classIds = availableClasses.map(c => c.id);
      return assignments.filter(a => classIds.includes(a.class_id));
  }, [assignments, availableClasses, user]);

  const handleOpenDialog = (assignment = null) => {
      if (assignment) {
          setEditingAssignment(assignment);
          const parts = splitDateTimeLocal(assignment.due_date);
          setFormData({
              title: assignment.title,
              description: assignment.description || '',
              class_id: assignment.class_id,
              course_id: assignment.course_id || '',
              due_date: parts.date,
              due_time: parts.time,
              total_marks: assignment.total_marks,
              counts_toward_grade: assignment.counts_toward_grade !== false,
          });
          setUploadedFileUrl(assignment.attachment_url || '');
      } else {
          setEditingAssignment(null);
          const defaultClassId = availableClasses.length > 0 ? availableClasses[0].id : '';
          const cls = classes.find((c) => c.id === defaultClassId);
          const classCourseList = coursesForClass(cls, courses, classCourses, diplomaCourses);
          setFormData({
              title: '',
              description: '',
              class_id: defaultClassId,
              course_id: classCourseList.length === 1 ? classCourseList[0].id : '',
              due_date: '',
              due_time: '14:00',
              total_marks: 10,
              counts_toward_grade: true,
          });
          setUploadedFileUrl('');
      }
      setIsDialogOpen(true);
  };

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsUploading(true);
      try {
          const url = await uploadAssignmentFile(file, `resources`);
          setUploadedFileUrl(url);
          toast({ title: "File Attached", description: "Assignment file uploaded successfully." });
      } catch (error) {
          notify.error(error, { context: 'AssignmentsPage - upload', fallback: MESSAGES.SAVE_FAILED });
      } finally {
          setIsUploading(false);
      }
  };

  const handleSave = async () => {
      if (!formData.title?.trim()) {
          notify.validation('Please enter an assignment title.');
          return;
      }
      if (!formData.class_id) {
          notify.validation('Please select a class.');
          return;
      }
      if (selectedClassCourses.length > 1 && !formData.course_id) {
          notify.validation('Please select which diploma course this assignment belongs to.');
          return;
      }
      if (!formData.due_date) {
          notify.validation('Please choose a due date.');
          return;
      }
      if (!formData.due_time) {
          notify.validation('Please choose a due time.');
          return;
      }
      const dueLocal = combineDateAndTime(formData.due_date, formData.due_time);
      const marks = Number(formData.total_marks);
      if (!Number.isFinite(marks) || marks <= 0) {
          notify.validation('Total marks must be greater than 0 (e.g. 2, 5, 10, 20).');
          return;
      }

      setLoading(true);
      try {
          await saveAssignment({
              id: editingAssignment?.id,
              title: formData.title,
              description: formData.description,
              class_id: formData.class_id,
              course_id: formData.course_id || selectedClassCourses[0]?.id || null,
              total_marks: marks,
              due_date: new Date(dueLocal).toISOString(),
              attachment_url: uploadedFileUrl || null,
              counts_toward_grade: formData.counts_toward_grade !== false,
          });
          setIsDialogOpen(false);
          toast({ title: "Success", description: editingAssignment ? MESSAGES.SUCCESS.ASSIGNMENT_UPDATED : MESSAGES.SUCCESS.ASSIGNMENT_CREATED });
      } catch (error) {
          notify.error(error, { context: 'AssignmentsPage - save', fallback: MESSAGES.SAVE_FAILED });
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id) => {
      try {
          await deleteAssignmentData(id);
          toast({ title: "Success", description: MESSAGES.SUCCESS.ASSIGNMENT_DELETED });
      } catch (error) {
          notify.error(error, { context: 'AssignmentsPage - delete', fallback: MESSAGES.DELETE_FAILED });
      }
  };

 const getSubmissionStats = (assignmentId) => {
      const subs = assignmentSubmissions.filter(s => s.assignment_id === assignmentId);
      const graded = subs.filter(s => s.score != null || s.grade != null).length;
      return { total: subs.length, graded };
  };

  return (
    <AnimatedPage>
        <Helmet><title>Assignments - Portal</title></Helmet>
        <PageHeader 
            title="Assignments" 
            subtitle="Create and manage course assignments."
        >
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" /> New Assignment
              </Button>
              {canManageRatings && (
                <Button
                  variant="outline"
                  onClick={() => openCreateRatingRef.current?.()}
                >
                  <Star className="mr-2 h-4 w-4" /> Create Rating
                </Button>
              )}
            </div>
        </PageHeader>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredAssignments.map(assign => {
                const stats = getSubmissionStats(assign.id);
                const cls = classes.find((c) => c.id === assign.class_id);
                const courseName = courses.find((c) => c.id === assign.course_id)?.name;
                return (
                    <Card key={assign.id} className="flex min-h-[280px] min-w-0 flex-col overflow-hidden">
                        <CardHeader className="space-y-0 pb-3">
                            <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="text-base line-clamp-2 leading-snug" title={assign.title}>{assign.title}</CardTitle>
                                    <CardDescription className="mt-1.5 line-clamp-1">
                                      {courseName ? (
                                        <>
                                          <span className="text-[var(--ds-accent,#1F8A5B)]">{courseName}</span>
                                          {cls?.name ? <span> · {cls.name}</span> : null}
                                        </>
                                      ) : (
                                        assign.class?.name || cls?.name
                                      )}
                                    </CardDescription>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2">
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${
                                        assign.counts_toward_grade !== false
                                          ? 'border-[var(--ds-warning,#C2410C)]/40 text-[var(--ds-warning,#C2410C)] bg-[var(--ds-warning-bg,#FFF7ED)]'
                                          : 'border-[var(--ds-border,#DDE5DF)] text-[var(--ds-text-secondary,#5B6B61)] bg-[var(--ds-surface-muted,#F7FAF8)]'
                                      }`}
                                    >
                                      {assign.counts_toward_grade !== false ? 'Gradebook' : 'Practice'}
                                    </span>
                                    <div className="p-2 bg-[var(--ds-primary-soft,#ECFDF5)] rounded-full">
                                        <BookOpen className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-3 pt-0">
                            <div className="flex items-center text-sm text-[var(--ds-text-secondary,#5B6B61)] gap-2 min-w-0">
                                <Calendar className="h-4 w-4 shrink-0" />
                                <span className="truncate">Due: {formatDateTime(assign.due_date)}</span>
                            </div>
                            <div className="flex items-start text-sm text-[var(--ds-text-secondary,#5B6B61)] gap-2 min-w-0">
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span className="leading-snug">
                                  {assign.counts_toward_grade !== false
                                    ? `Gradebook bonus: ${assign.total_marks} pts (added to exam)`
                                    : `Practice: ${assign.total_marks} pts (not in gradebook)`}
                                </span>
                            </div>
                            {assign.attachment_url && (
                                <div className="flex items-center text-sm text-[var(--ds-info,#2563EB)] gap-2 bg-[var(--ds-info-bg,#EFF6FF)] p-2 rounded border border-[var(--ds-info,#2563EB)]/20 min-w-0">
                                    <File className="h-3 w-3 shrink-0" />
                                    <span className="truncate">File Attached</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t border-[var(--ds-border,#DDE5DF)] mt-auto">
                                <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                                    Submitted: <span className="text-[var(--ds-text-primary,#122018)] font-medium">{stats.total}</span>
                                </div>
                                <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                                    Graded: <span className="text-[var(--ds-text-primary,#122018)] font-medium">{stats.graded}</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-2 gap-2">
                            <Button variant="secondary" className="min-w-0 flex-1" onClick={() => navigate(`/assignments/${assign.id}/grading`)}>
                                <Users className="mr-2 h-4 w-4 shrink-0" /> <span className="truncate">View Submissions</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleOpenDialog(assign)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="shrink-0 text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)] hover:text-[var(--ds-danger,#DC2626)]">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will delete the assignment and all student submissions associated with it.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-hover,#B91C1C)]" onClick={() => handleDelete(assign.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                );
            })}
            
            {filteredAssignments.length === 0 && (
                <div className="col-span-full text-center py-12 border-2 border-dashed border-[var(--ds-border,#DDE5DF)] rounded-[var(--ds-radius-xl,16px)]">
                    <BookOpen className="h-12 w-12 mx-auto text-[var(--ds-text-tertiary,#8A978E)] mb-4" />
                    <h3 className="text-lg font-medium">No Assignments</h3>
                    <p className="text-[var(--ds-text-secondary,#5B6B61)] mb-6">Create your first assignment to get started.</p>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Create Assignment
                    </Button>
                </div>
            )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}</DialogTitle>
                    <DialogDescription>Set up assignment details for your class.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2 pr-1">
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Essay #1" />
                    </div>
                    <div className="space-y-2">
                        <Label>Class</Label>
                        <Select
                          value={formData.class_id}
                          onValueChange={(val) => {
                            const cls = classes.find((c) => c.id === val);
                            const classCourseList = coursesForClass(cls, courses, classCourses, diplomaCourses);
                            setFormData({
                              ...formData,
                              class_id: val,
                              course_id: classCourseList.length === 1 ? classCourseList[0].id : '',
                            });
                          }}
                        >
                            <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                            <SelectContent>
                                {availableClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedClassCourses.length > 0 && (
                      <div className="space-y-2">
                        <Label>{isDiplomaClass ? 'Diploma course' : 'Course'}</Label>
                        <Select
                          value={formData.course_id || undefined}
                          onValueChange={(val) =>
                            setFormData({ ...formData, course_id: val })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={isDiplomaClass ? 'Select a course in this diploma' : 'Select course'} />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedClassCourses.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">
                          {isDiplomaClass
                            ? 'Students will see this course name on the assignment. Graded bonus points go to this course exam.'
                            : 'Graded assignment points are added to this course exam score (capped at exam total).'}
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                        <Label>Counts toward grade?</Label>
                        <Select
                          value={formData.counts_toward_grade !== false ? 'gradebook' : 'practice'}
                          onValueChange={(val) =>
                            setFormData({ ...formData, counts_toward_grade: val === 'gradebook' })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gradebook">
                              Add to Gradebook (boosts exam grade)
                            </SelectItem>
                            <SelectItem value="practice">
                              Practice only (not in Gradebook)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">
                          {formData.counts_toward_grade !== false
                            ? 'Scores appear in Gradebook and are added to the student exam grade (never above exam total).'
                            : 'Students can submit and be graded for feedback only — no Gradebook or GPA impact.'}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Due Date & Time</Label>
                        <DateTimePickerField
                          date={formData.due_date}
                          time={formData.due_time}
                          onChange={({ date, time }) =>
                            setFormData({ ...formData, due_date: date, due_time: time })
                          }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{formData.counts_toward_grade !== false ? 'Bonus Marks' : 'Max Marks'}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.total_marks}
                          onChange={(e) => setFormData({...formData, total_marks: parseInt(e.target.value) || 0})}
                        />
                        <p className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">
                          {formData.counts_toward_grade !== false
                            ? 'e.g. 2, 5, 10, 20 — added to exam, never above exam total.'
                            : 'Practice score only — does not change the student grade.'}
                        </p>
                    </div>
                    <div className="space-y-2">
                         <Label>Attach File (Optional)</Label>
                         <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              className="text-xs"
                              accept=".txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.zip"
                              onChange={handleFileUpload}
                              disabled={isUploading}
                            />
                            {isUploading && <span className="text-xs animate-pulse">Uploading...</span>}
                         </div>
                         {uploadedFileUrl && <p className="text-xs text-[var(--ds-accent,#1F8A5B)]">File attached successfully.</p>}
                         <p className="text-[10px] text-[var(--ds-text-tertiary,#8A978E)]">PDF, Word, TXT, or image — max 10MB.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Description / Instructions</Label>
                        <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={loading || isUploading}>{loading ? 'Saving...' : 'Save Assignment'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {canManageRatings && (
          <RatingEvaluationsSection createOpenerRef={openCreateRatingRef} />
        )}
    </AnimatedPage>
  );
};

export default AssignmentsPage;