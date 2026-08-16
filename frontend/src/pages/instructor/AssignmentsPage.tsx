import React, { useState, useMemo } from 'react';
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
import { Plus, Calendar, BookOpen, Clock, Trash2, Edit, CheckCircle, Users, File } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { uploadAssignmentFile } from '@/lib/api';
import {
  DateTimePickerField,
  splitDateTimeLocal,
  combineDateAndTime,
} from '@/components/ui/DateTimeFields';

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
  const { assignments, classes, courses, classCourses, saveAssignment, deleteAssignmentData, assignmentSubmissions } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  
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
    if (!cls) return [];
    const list = [];
    if (cls.course_id) {
      const c = courses.find((co) => co.id === cls.course_id);
      if (c) list.push(c);
    }
    (classCourses || [])
      .filter((cc) => cc.class_id === formData.class_id)
      .forEach((cc) => {
        const c = courses.find((co) => co.id === cc.course_id);
        if (c && !list.some((x) => x.id === c.id)) list.push(c);
      });
    return list;
  }, [classes, courses, classCourses, formData.class_id]);

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
          });
          setUploadedFileUrl(assignment.attachment_url || '');
      } else {
          setEditingAssignment(null);
          const defaultClassId = availableClasses.length > 0 ? availableClasses[0].id : '';
          const cls = classes.find((c) => c.id === defaultClassId);
          setFormData({
              title: '',
              description: '',
              class_id: defaultClassId,
              course_id: cls?.course_id || '',
              due_date: '',
              due_time: '14:00',
              total_marks: 10,
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
              course_id: formData.course_id || null,
              total_marks: marks,
              due_date: new Date(dueLocal).toISOString(),
              attachment_url: uploadedFileUrl || null,
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
            <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" /> New Assignment
            </Button>
        </PageHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAssignments.map(assign => {
                const stats = getSubmissionStats(assign.id);
                return (
                    <Card key={assign.id} className="bg-slate-900/50 border-slate-800 flex flex-col">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg text-slate-100 line-clamp-1" title={assign.title}>{assign.title}</CardTitle>
                                    <CardDescription className="mt-1">{assign.class?.name}</CardDescription>
                                </div>
                                <div className="p-2 bg-slate-800 rounded-full">
                                    <BookOpen className="h-4 w-4 text-indigo-400" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-4">
                            <div className="flex items-center text-sm text-slate-400 gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>Due: {formatDateTime(assign.due_date)}</span>
                            </div>
                            <div className="flex items-center text-sm text-slate-400 gap-2">
                                <CheckCircle className="h-4 w-4" />
                                <span>Bonus marks: {assign.total_marks} (added to exam)</span>
                            </div>
                            {assign.attachment_url && (
                                <div className="flex items-center text-sm text-blue-400 gap-2 bg-blue-950/20 p-2 rounded border border-blue-900/30">
                                    <File className="h-3 w-3" />
                                    <span className="truncate w-full">File Attached</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t border-slate-800/50 mt-2">
                                <div className="text-xs text-slate-500">
                                    Submitted: <span className="text-slate-300 font-medium">{stats.total}</span>
                                </div>
                                <div className="text-xs text-slate-500">
                                    Graded: <span className="text-slate-300 font-medium">{stats.graded}</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-2 gap-2">
                            <Button variant="secondary" className="flex-1" onClick={() => navigate(`/assignments/${assign.id}/grading`)}>
                                <Users className="mr-2 h-4 w-4" /> View Submissions
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(assign)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="hover:bg-red-900/20 hover:text-red-400">
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
                                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(assign.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                );
            })}
            
            {filteredAssignments.length === 0 && (
                <div className="col-span-full text-center py-12 border-2 border-dashed border-slate-800 rounded-xl">
                    <BookOpen className="h-12 w-12 mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-300">No Assignments</h3>
                    <p className="text-slate-500 mb-6">Create your first assignment to get started.</p>
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
                            setFormData({
                              ...formData,
                              class_id: val,
                              course_id: cls?.course_id || formData.course_id || '',
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
                        <Label>Course (exam this boosts)</Label>
                        <Select
                          value={formData.course_id || 'none'}
                          onValueChange={(val) =>
                            setFormData({ ...formData, course_id: val === 'none' ? '' : val })
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Use class course" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Class primary course</SelectItem>
                            {selectedClassCourses.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-slate-500">
                          Graded assignment points are added to this course&apos;s exam score (capped at exam total).
                        </p>
                      </div>
                    )}
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
                        <Label>Bonus Marks</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={formData.total_marks}
                          onChange={(e) => setFormData({...formData, total_marks: parseInt(e.target.value) || 0})}
                        />
                        <p className="text-[10px] text-slate-500">e.g. 2, 5, 10, 20 — added to exam, never above exam total.</p>
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
                         {uploadedFileUrl && <p className="text-xs text-green-500">File attached successfully.</p>}
                         <p className="text-[10px] text-slate-500">PDF, Word, TXT, or image — max 10MB.</p>
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
    </AnimatedPage>
  );
};

export default AssignmentsPage;