import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Loader2, AlertCircle } from 'lucide-react';
import { checkResultExists, createOrUpdateExamResult } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  canManageCourseProjects,
  COURSE_PROJECT_MAX_LEN,
  sanitizeCourseProject,
} from '@/lib/institution';
import { handleValidationError } from '@/lib/resultErrorHandler';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ExamResultForm = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  exam, 
  students = [], 
  initialData = null 
}) => {
  const { toast } = useToast();
  const { user, institution } = useAuth();
  const showCourseProject = canManageCourseProjects(institution, user?.role);
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState(null);
  
  const isEditMode = !!initialData?.id;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      student_id: '',
      score: '',
      attendance_score: '0',
      final_score: '',
      total_marks: exam?.total_marks || '100',
      comments: '',
      course_project: '',
    }
  });

  const watchStudentId = watch('student_id');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          student_id: initialData.student_id,
          score: initialData.score?.toString() || '',
          attendance_score: initialData.attendance_score?.toString() || '0',
          final_score: initialData.final_score?.toString() || '',
          total_marks: initialData.total_marks?.toString() || exam?.total_marks?.toString() || '100',
          comments: initialData.comments || '',
          course_project: initialData.course_project || '',
        });
      } else {
        reset({
          student_id: '',
          score: '',
          attendance_score: '0',
          final_score: '',
          total_marks: exam?.total_marks?.toString() || '100',
          comments: '',
          course_project: '',
        });
      }
      setDuplicateWarning(null);
      setPendingSubmitData(null);
      setShowConfirmDialog(false);
    }
  }, [isOpen, initialData, exam, reset]);

  // Check for duplicates when student changes in create mode
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!isEditMode && watchStudentId && exam?.id) {
        try {
          const { exists, result } = await checkResultExists(exam.id, watchStudentId);
          if (exists) {
            setDuplicateWarning(result);
          } else {
            setDuplicateWarning(null);
          }
        } catch (error) {
          console.error('Error checking duplicates:', error);
        }
      }
    };
    checkDuplicate();
  }, [watchStudentId, exam?.id, isEditMode]);

  const processSubmit = async (data) => {
    if (!exam?.id) {
      handleValidationError("No exam selected.");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        exam_id: exam.id,
        student_id: data.student_id,
        score: parseInt(data.score, 10),
        attendance_score: parseInt(data.attendance_score, 10) || 0,
        final_score: parseInt(data.final_score, 10) || parseInt(data.score, 10),
        total_marks: parseInt(data.total_marks, 10) || exam.total_marks,
        comments: data.comments,
        submission_date: new Date().toISOString()
      };
      if (showCourseProject) {
        payload.course_project = sanitizeCourseProject(data.course_project);
      }

      if (isEditMode) {
        payload.id = initialData.id;
      } else if (duplicateWarning) {
        // Overriding a warning uses the existing ID to update
        payload.id = duplicateWarning.id;
      }

      const response = await createOrUpdateExamResult(payload);

      if (response) {
        toast({
          title: "Success",
          description: MESSAGES.SUCCESS.RESULT_SAVED,
          className: "bg-green-600 border-green-700 text-white"
        });
        onSuccess();
        onClose();
      } else {
        notify.error(new Error(response.error || 'Submission failed'), {
          context: 'ExamResultForm - response',
          fallback: MESSAGES.SAVE_FAILED,
        });
      }
    } catch (error) {
      notify.error(error, { context: 'ExamResultForm', fallback: MESSAGES.UNEXPECTED });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
      setPendingSubmitData(null);
    }
  };

  const onSubmit = (data) => {
    // Client-side duplicate confirmation logic
    if (!isEditMode && duplicateWarning) {
      setPendingSubmitData(data);
      setShowConfirmDialog(true);
      return;
    }
    processSubmit(data);
  };

  return (
    <>
      <Dialog open={isOpen && !showConfirmDialog} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Exam Result' : 'Add Exam Result'}</DialogTitle>
            <DialogDescription>
              {exam?.title} {exam?.total_marks ? `(Total Marks: ${exam.total_marks})` : ''}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">Student <span className="text-[var(--ds-danger,#DC2626)]">*</span></label>
              <Select 
                value={watchStudentId} 
                onValueChange={(val) => setValue('student_id', val, { shouldValidate: true })}
                disabled={isEditMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} ({student.student_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.student_id && <p className="mt-1 text-xs text-[var(--ds-danger,#DC2626)]">Student is required</p>}
            </div>

            {duplicateWarning && !isEditMode && (
              <div className="flex items-start gap-3 rounded-md border border-[var(--ds-warning,#C2410C)]/30 bg-[var(--ds-warning-bg,#FFF7ED)] p-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ds-warning,#C2410C)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--ds-warning,#C2410C)]">Result Already Exists</p>
                  <p className="mt-1 text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                    This student already has a result for this exam (Score: {duplicateWarning.score}). 
                    Submitting this form will update the existing result instead of creating a duplicate.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">Score <span className="text-[var(--ds-danger,#DC2626)]">*</span></label>
                <Input 
                  type="number" 
                  {...register('score', { required: true, min: 0 })} 
                />
                {errors.score && <p className="mt-1 text-xs text-[var(--ds-danger,#DC2626)]">Valid score required</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">Total Marks</label>
                <Input 
                  type="number" 
                  {...register('total_marks')} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">Attendance Score</label>
                <Input 
                  type="number" 
                  {...register('attendance_score', { min: 0 })} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">Final Score</label>
                <Input 
                  type="number" 
                  placeholder="Auto-calculated if blank"
                  {...register('final_score', { min: 0 })} 
                />
              </div>
            </div>

            {showCourseProject ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">Course project</label>
                <Input
                  maxLength={COURSE_PROJECT_MAX_LEN}
                  placeholder="e.g. Research Proposal Development"
                  {...register('course_project')}
                />
                <p className="text-[11px] text-[var(--ds-text-tertiary,#8A978E)]">Shown under the course title on the student transcript.</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">Comments</label>
              <Textarea 
                className="min-h-[80px]" 
                placeholder="Add feedback or notes..."
                {...register('comments')} 
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Update Result' : (duplicateWarning ? 'Update Existing' : 'Save Result')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Overwriting Duplicates */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[var(--ds-warning,#C2410C)]">
              <AlertCircle className="h-5 w-5" />
              Overwrite Existing Result?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A result already exists for this student-exam combination (Previous Score:{' '}
              <strong className="text-[var(--ds-text-primary,#122018)]">{duplicateWarning?.score}</strong>).
              <br /><br />
              Are you sure you want to update it to the new score of{' '}
              <strong className="text-[var(--ds-text-primary,#122018)]">{pendingSubmitData?.score}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => processSubmit(pendingSubmitData)} 
              className="bg-[var(--ds-warning,#C2410C)] text-[var(--ds-text-on-primary,#fff)] hover:opacity-90"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Yes, Update Result"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ExamResultForm;