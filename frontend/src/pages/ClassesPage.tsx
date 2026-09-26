import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, X, Search, ArrowRightLeft, Eye, FileSpreadsheet, Printer, Pencil, Trash2, CheckCircle2, XCircle, BookOpen, DollarSign, Clock, Percent, AlertTriangle, History, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { DsIconButton, DsOutlineAction, DsPrimaryAction, DS_ICON_STROKE } from '@/components/ui/ds-actions';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { formatDate, formatCurrency, parseLocalDate, isPlausibleCalendarDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { DatePickerField } from '@/components/ui/DateTimeFields';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InstructorPaymentTransferLog from '@/components/instructor/InstructorPaymentTransferLog';

const ClassCoursesDialog = ({ classData, isOpen, onClose }) => {
    const { courses, classCourses, addCourseToClass, removeCourseFromClass } = useData();
    const { toast } = useToast();
    const [selectedCourseId, setSelectedCourseId] = useState('');

    if (!classData) return null;

    const linkedCourses = classCourses.filter(cc => cc.class_id === classData.id);
    const linkedCourseIds = linkedCourses.map(cc => cc.course_id);
    const availableCourses = courses.filter(c => !linkedCourseIds.includes(c.id));

    const handleAdd = async () => {
        if (!selectedCourseId) return;
        try {
            await addCourseToClass(classData.id, selectedCourseId);
            setSelectedCourseId('');
            toast({ title: "Course Added", description: "Course successfully assigned to this class." });
        } catch (error) {
            notify.error(error, { context: 'ClassesPage - addCourse', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    const handleRemove = async (id) => {
        try {
            await removeCourseFromClass(id);
            toast({ title: "Removed", description: "Course removed from class." });
        } catch (error) {
            notify.error(error, { context: 'ClassesPage - removeCourse', fallback: MESSAGES.DELETE_FAILED });
        }
    };

    return (
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>Manage Courses for {classData.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div className="flex items-end gap-2 border-b border-[var(--ds-border,#DDE5DF)] pb-4">
                    <div className="flex-1 space-y-2">
                        <Label>Add Course to Class</Label>
                        <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                            <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                            <SelectContent>
                                {availableCourses.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAdd} disabled={!selectedCourseId}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                </div>

                <div>
                    <h3 className="mb-2 font-medium text-[var(--ds-text-secondary,#5B6B61)]">Assigned Courses</h3>
                    <div className="overflow-hidden rounded-md border border-[var(--ds-border,#DDE5DF)]">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                    <TableHead className="text-[var(--ds-text-tertiary,#8A978E)]">Course Name</TableHead>
                                    <TableHead className="text-right text-[var(--ds-text-tertiary,#8A978E)]">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {linkedCourses.map(cc => (
                                    <TableRow key={cc.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                        <TableCell>{cc.course?.name || 'Unknown'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)] hover:text-[var(--ds-danger,#DC2626)]" onClick={() => handleRemove(cc.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {linkedCourses.length === 0 && (
                                    <TableRow><TableCell colSpan={2} className="py-4 text-center text-muted-foreground">No courses assigned.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </DialogContent>
    );
};

const ClassForm = ({ classInfo, onSave, closeDialog }: any) => {
    const { courses, diplomas, users, addClass, updateClassData, classes, payments } = useData(); 
    const { institution } = useAuth();
    const { toast } = useToast();
    
    const instructors = useMemo(() => {
        return users.filter(u => u.role === 'instructor');
    }, [users]);

    const defaultCommissionPct = useMemo(() => {
      const rate = Number(institution?.default_instructor_commission_rate);
      if (Number.isFinite(rate) && rate >= 0) {
        return Math.round(rate * 10000) / 100;
      }
      return 0;
    }, [institution]);

    const [name, setName] = useState(classInfo?.name || '');
    const [type, setType] = useState(classInfo?.diploma_id ? 'diploma' : 'course');
    const [selectedId, setSelectedId] = useState(classInfo?.diploma_id || classInfo?.course_id || '');
    const [instructor_id, setInstructorId] = useState(classInfo?.instructor_id || '');

    const selectedInstructor = useMemo(
      () => instructors.find((i) => i.id === instructor_id) || null,
      [instructors, instructor_id]
    );
    const uniqueInstructorRate =
      selectedInstructor?.instructor_commission_rate != null &&
      selectedInstructor.instructor_commission_rate !== ''
        ? Number(selectedInstructor.instructor_commission_rate)
        : null;
    const hasUniqueCommission =
      Number.isFinite(uniqueInstructorRate) && uniqueInstructorRate != null;
    const effectiveCommissionPct = hasUniqueCommission
      ? Math.round(Number(uniqueInstructorRate) * 10000) / 100
      : defaultCommissionPct;
    const effectiveCommissionRate = hasUniqueCommission
      ? Math.max(0, Math.min(1, Number(uniqueInstructorRate)))
      : Math.max(0, Math.min(1, Number(institution?.default_instructor_commission_rate) || 0));
    const [settlementModel, setSettlementModel] = useState(
      classInfo?.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission'
    );
    const [instructorFixedFee, setInstructorFixedFee] = useState(
      classInfo?.instructor_fixed_fee != null ? Number(classInfo.instructor_fixed_fee) : 0
    );
    
    const toDateInput = (value?: string | null) => {
        if (!value) return '';
        const raw = String(value).trim();
        // Prefer YYYY-MM-DD; fall back to YYYY-MM → first day
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
        if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
        return '';
    };
    const [startDate, setStartDate] = useState(toDateInput(classInfo?.start_date));
    const [endDate, setEndDate] = useState(toDateInput(classInfo?.end_date));
    
    const [fee, setFee] = useState(classInfo?.fee || 0);
    
    // Prefill settlement model from instructor defaults when instructor changes (new class or switch)
    useEffect(() => {
      if (!instructor_id) return;
      const instructor = instructors.find((i) => i.id === instructor_id);
      if (!instructor) return;
      // Keep existing class values when editing same instructor
      if (classInfo && instructor_id === classInfo.instructor_id) return;
      const model = instructor.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission';
      setSettlementModel(model);
      setInstructorFixedFee(
        model === 'fixed_fee' ? Math.max(0, Number(instructor.fixed_fee_amount) || 0) : 0
      );
    }, [instructor_id, instructors, classInfo]);

    // NEW: Track instructor change
    const [showInstructorWarning, setShowInstructorWarning] = useState(false);
    const instructorChanged = classInfo && instructor_id && instructor_id !== classInfo.instructor_id;

    // Calculate payment count for instructor change warning
    const classPaymentCount = useMemo(() => {
        if (!classInfo?.id) return 0;
        return payments.filter(p => p.class_id === classInfo.id && p.status === 'completed' && !p.is_registration_fee).length;
    }, [classInfo, payments]);

    useEffect(() => {
        if (instructorChanged && classPaymentCount > 0) {
            setShowInstructorWarning(true);
        } else {
            setShowInstructorWarning(false);
        }
    }, [instructorChanged, classPaymentCount]);

    const duration_months = useMemo(() => {
        if (!startDate || !endDate) return 0;
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        
        if (!start || !end) return 0;
        if (end < start) return 0;
        
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
        return Math.max(0, months);
    }, [startDate, endDate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedId || !instructor_id) {
            notify.validation('Please select a program and instructor.');
            return;
        }

        if (!startDate || !endDate) {
            notify.validation('Please choose both start and end dates.');
            return;
        }

        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        if (!isPlausibleCalendarDate(start) || !isPlausibleCalendarDate(end)) {
          notify.validation('Please choose a valid start and end date (year 2000–2100).');
          return;
        }

        if (end < start) {
             notify.validation('End date must be on or after the start date.');
             return;
        }

        if (duration_months <= 0) {
             notify.validation('End date must be on or after the start date.');
             return;
        }

        const duplicate = classes.find(c => 
            c.name.trim().toLowerCase() === name.trim().toLowerCase() && 
            c.id !== classInfo?.id
        );

        if (duplicate) {
            notify.validation('A class with this name already exists. Please choose a different name.');
            return;
        }

        if (settlementModel === 'fixed_fee' && Number(instructorFixedFee) <= 0) {
          notify.validation('Enter a fixed fee amount greater than 0 for this instructor.');
          return;
        }

        try {
            const payload = { 
                name: name.trim(), 
                instructor_id, 
                start_date: startDate, 
                end_date: endDate,
                course_id: type === 'course' ? selectedId : null,
                diploma_id: type === 'diploma' ? selectedId : null,
                duration_months: Number(duration_months),
                fee: Number(fee),
                commission_rate: effectiveCommissionRate,
                settlement_model: settlementModel === 'fixed_fee' ? 'fixed_fee' : 'commission',
                instructor_fixed_fee:
                  settlementModel === 'fixed_fee' ? Math.max(0, Number(instructorFixedFee) || 0) : 0,
            };
            
            if (classInfo) {
                await updateClassData(classInfo.id, payload);
                
                // Show success with transfer info if instructor changed
                if (instructorChanged && classPaymentCount > 0) {
                    toast({ 
                        title: "Class Updated Successfully", 
                        description: `Instructor payment shares are being automatically transferred for ${classPaymentCount} payment(s). Check the Transfer Log tab for details.`,
                        duration: 6000
                    });
                } else {
                    toast({ title: "Success", description: MESSAGES.SUCCESS.CLASS_UPDATED });
                }
            } else {
                await addClass(payload);
                toast({ title: "Success", description: MESSAGES.SUCCESS.CLASS_CREATED });
            }
            closeDialog();
        } catch (error) {
            notify.error(error, { context: 'ClassesPage - saveClass', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{classInfo ? 'Edit Class' : 'Create New Class'}</DialogTitle>
                {showInstructorWarning && (
                    <Alert className="mt-4 border-[var(--ds-warning,#C2410C)]/30 bg-[var(--ds-warning,#C2410C)]/10">
                        <AlertTriangle className="h-4 w-4 text-[var(--ds-warning,#C2410C)]" />
                        <AlertDescription className="text-[var(--ds-warning,#C2410C)]">
                            <strong>Instructor Change Detected:</strong> Payment shares for {classPaymentCount} completed payment(s) will be automatically transferred to the new instructor. Previous instructor's shares will only be transferred if they haven't already withdrawn their earnings.
                        </AlertDescription>
                    </Alert>
                )}
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-left sm:text-right">Class Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required placeholder="e.g., WD-Jan25"/>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label className="text-left sm:text-right">Program Type</Label>
                    <Select value={type} onValueChange={(val) => { setType(val); setSelectedId(''); }}>
                        <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="course">Single Course</SelectItem>
                            <SelectItem value="diploma">Diploma Program</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label className="text-left sm:text-right">{type === 'course' ? 'Select Course' : 'Select Diploma'}</Label>
                    <Select value={selectedId} onValueChange={setSelectedId}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                            {type === 'course' 
                                ? courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                                : diplomas.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)
                            }
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="instructor" className="text-left sm:text-right">Instructor</Label>
                     <Select value={instructor_id} onValueChange={setInstructorId}>
                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Select an instructor" /></SelectTrigger>
                        <SelectContent>
                            {instructors.length > 0 ? (
                                instructors.map(i => <SelectItem key={i.id} value={i.id}>{i.name || i.email || 'Unknown'}</SelectItem>)
                            ) : (
                                <div className="p-2 text-sm text-muted-foreground text-center">No instructors found</div>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="start_date" className="text-left sm:text-right">Start Date</Label>
                    <div className="col-span-3">
                      <DatePickerField
                        id="start_date"
                        value={startDate}
                        onChange={setStartDate}
                      />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="end_date" className="text-left sm:text-right">End Date</Label>
                    <div className="col-span-3">
                      <DatePickerField
                        id="end_date"
                        value={endDate}
                        onChange={setEndDate}
                        min={startDate || undefined}
                      />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label className="text-left sm:text-right">Duration</Label>
                    <div className="col-span-3 flex h-10 items-center rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-3 text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                        {duration_months > 0 ? `${duration_months} Months` : '-'}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="fee" className="text-left sm:text-right">Total Fee ($)</Label>
                    <Input id="fee" type="number" min="0" value={fee} onChange={e => setFee(e.target.value)} className="col-span-3" required />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label className="text-left sm:text-right">Instructor pay</Label>
                    <Select
                      value={settlementModel}
                      onValueChange={(val) => {
                        setSettlementModel(val);
                        if (val === 'commission') setInstructorFixedFee(0);
                      }}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commission">Commission (% of each payment)</SelectItem>
                        <SelectItem value="fixed_fee">Fixed fee (one amount for this class)</SelectItem>
                      </SelectContent>
                    </Select>
                </div>

                {settlementModel === 'commission' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                      <Label htmlFor="commission" className="text-left sm:text-right">Instructor %</Label>
                      <div className="col-span-3 space-y-1">
                        <Input
                          id="commission"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={effectiveCommissionPct}
                          readOnly
                          className="bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-secondary,#5B6B61)]"
                        />
                        <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                          {hasUniqueCommission
                            ? `Unique rate for this instructor (${effectiveCommissionPct}%). Set on Instructors — Institution Settings will not override it.`
                            : `Institution default (${defaultCommissionPct}%). Set a unique % on Instructors if this person should keep a different rate.`}
                        </p>
                      </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                      <Label htmlFor="fixed_fee" className="text-left sm:text-right">Fixed fee</Label>
                      <div className="col-span-3 space-y-1">
                        <Input
                          id="fixed_fee"
                          type="number"
                          min="0"
                          step="0.01"
                          value={instructorFixedFee}
                          onChange={(e) => setInstructorFixedFee(e.target.value)}
                          required
                        />
                        <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                          One-time instructor pay for this class. Accrues when the class is saved — not per student payment.
                        </p>
                      </div>
                    </div>
                )}

                 {duration_months > 0 && fee > 0 && (
                     <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                        <Label className="text-left sm:text-right">Est. Monthly</Label>
                        <div className="col-span-3 font-mono text-sm text-[var(--ds-primary,#1F8A5B)]">
                            {formatCurrency(fee / duration_months)} / month
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter><Button type="submit">{classInfo ? 'Update Class' : 'Create Class'}</Button></DialogFooter>
        </form>
    );
};

const TransferStudentDialog = ({ enrollment, currentClass, onClose }) => {
    const { classes, transferStudent } = useData();
    const { toast } = useToast();
    const [targetClassId, setTargetClassId] = useState('');
    const availableClasses = classes.filter(c => c.id !== currentClass.id && c.is_active && new Date(c.end_date) > new Date());

    const handleTransfer = async () => {
        try {
            await transferStudent(enrollment.id, targetClassId);
            toast({ title: "Success", description: MESSAGES.SUCCESS.TRANSFER_COMPLETED });
            onClose();
        } catch (error) {
            notify.error(error, { context: 'ClassesPage - transfer', fallback: { title: 'Error', description: MESSAGES.DOMAIN.TRANSFER_FAILED } });
        }
    };

    return (
        <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Transfer Student</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                <Select value={targetClassId} onValueChange={setTargetClassId}>
                    <SelectTrigger><SelectValue placeholder="Select destination class" /></SelectTrigger>
                    <SelectContent>
                        {availableClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button onClick={handleTransfer} disabled={!targetClassId}>Confirm Transfer</Button>
            </DialogFooter>
        </DialogContent>
    );
};

const ManageDiscountDialog = ({ enrollment, onClose }) => {
    const { updateEnrollment } = useData();
    const { toast } = useToast();
    const [discount, setDiscount] = useState(enrollment?.discount_amount || 0);

    const handleSave = async () => {
        try {
            const amount = parseFloat(discount);
            if (isNaN(amount) || amount < 0) {
                 notify.validation(MESSAGES.VALIDATION.AMOUNT);
                 return;
            }
            
            await updateEnrollment(enrollment.id, { discount_amount: amount });
            toast({ title: "Success", description: MESSAGES.SUCCESS.DISCOUNT_SAVED });
            onClose();
        } catch (error) {
            notify.error(error, { context: 'ClassesPage - discount', fallback: MESSAGES.SAVE_FAILED });
        }
    };

    return (
        <DialogContent className="sm:max-w-[400px]">
            <DialogHeader><DialogTitle>Student Discount</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label>Monthly Discount Amount ($)</Label>
                    <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={discount} 
                        onChange={(e) => setDiscount(e.target.value)} 
                    />
                    <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                        This amount will be deducted from the monthly fee for this student.
                    </p>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSave}>Save Discount</Button>
            </DialogFooter>
        </DialogContent>
    );
};

const ClassRosterDialog = ({ classData, isOpen, onClose }) => {
    const { students, enrollments, enrollStudents, unenrollStudent } = useData();
    const { toast } = useToast();
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [transferEnrollment, setTransferEnrollment] = useState(null);
    const [discountEnrollment, setDiscountEnrollment] = useState(null);
    const [enrolling, setEnrolling] = useState(false);
    const [removingId, setRemovingId] = useState(null);

    if (!classData) return null;

    const classEnrollments = enrollments
        .filter((e) => e.class_id === classData.id && e.status !== 'inactive')
        .sort((a, b) => Number(new Date(b.enrollment_date)) - Number(new Date(a.enrollment_date)));
    const enrolledStudentIds = classEnrollments.map(e => e.student_id);
    const availableStudents = students.filter(s => !enrolledStudentIds.includes(s.id) && s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleEnroll = async () => {
        if (selectedStudentIds.length === 0 || enrolling) return;
        setEnrolling(true);
        try {
            // One batch + one enrollments refresh (not per-student full gradebook reload).
            await enrollStudents(
              selectedStudentIds.map((studentId) => ({
                student_id: studentId,
                class_id: classData.id,
              })),
            );
            setSelectedStudentIds([]);
            toast({ title: "Success", description: MESSAGES.SUCCESS.ENROLLMENT_SAVED });
        } catch (error) { notify.error(error, { context: 'ClassesPage - enroll', fallback: { title: 'Enrollment Failed', description: MESSAGES.DOMAIN.ENROLLMENT_FAILED } }); }
        finally { setEnrolling(false); }
    };

    const handleRemove = async (enrollmentId) => {
        if (removingId) return;
        setRemovingId(enrollmentId);
        try { await unenrollStudent(enrollmentId); toast({ title: "Success", description: MESSAGES.SUCCESS.UPDATED }); } 
        catch (error) { notify.error(error, { context: 'ClassesPage - unenroll', fallback: MESSAGES.UPDATE_FAILED }); }
        finally { setRemovingId(null); }
    };

    const toggleSelection = (id) => setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);

    return (
        <DialogContent className="sm:max-w-[1000px] h-[85vh] max-h-[90dvh] flex flex-col">
            <DialogHeader><DialogTitle className="break-words">Class Roster - {classData.name}</DialogTitle></DialogHeader>
            {transferEnrollment && (
                <Dialog open={!!transferEnrollment} onOpenChange={(open) => !open && setTransferEnrollment(null)}>
                    <TransferStudentDialog enrollment={transferEnrollment} currentClass={classData} onClose={() => setTransferEnrollment(null)} />
                </Dialog>
            )}
             {discountEnrollment && (
                <Dialog open={!!discountEnrollment} onOpenChange={(open) => !open && setDiscountEnrollment(null)}>
                    <ManageDiscountDialog enrollment={discountEnrollment} onClose={() => setDiscountEnrollment(null)} />
                </Dialog>
            )}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-4 md:flex-row md:gap-6">
                <div className="flex w-full max-h-[40vh] shrink-0 flex-col gap-3 border-[var(--ds-border,#DDE5DF)] md:max-h-none md:w-1/3 md:gap-4 md:border-r md:pr-6">
                    <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
                    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-md border border-[var(--ds-border,#DDE5DF)] p-2">
                        {availableStudents.map(student => (
                            <div key={student.id} className="flex items-center space-x-2 rounded-md p-2 hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                <Checkbox id={`s-${student.id}`} checked={selectedStudentIds.includes(student.id)} onCheckedChange={() => toggleSelection(student.id)}/>
                                <label htmlFor={`s-${student.id}`} className="min-w-0 flex-1 cursor-pointer text-sm font-medium">
                                    <div className="truncate font-semibold">{student.name}</div><div className="text-xs text-muted-foreground">{student.student_code}</div>
                                </label>
                            </div>
                        ))}
                    </div>
                    <Button onClick={handleEnroll} disabled={selectedStudentIds.length === 0 || enrolling} className="w-full shrink-0">
                      {enrolling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                      {enrolling ? 'Enrolling...' : 'Enroll'}
                    </Button>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--ds-border,#DDE5DF)]">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                    <TableHead className="text-[var(--ds-text-tertiary,#8A978E)]">Name</TableHead>
                                    <TableHead className="text-[var(--ds-text-tertiary,#8A978E)]">Status</TableHead>
                                    <TableHead className="text-[var(--ds-text-tertiary,#8A978E)]">Discount</TableHead>
                                    <TableHead className="text-right text-[var(--ds-text-tertiary,#8A978E)]">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classEnrollments.map(e => {
                                    const s = students.find(stu => stu.id === e.student_id);
                                    return s ? (
                                        <TableRow key={e.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                            <TableCell>{s.name}</TableCell>
                                            <TableCell><Badge variant={e.status === 'active' ? 'default' : 'secondary'}>{e.status}</Badge></TableCell>
                                            <TableCell>
                                                {e.discount_amount > 0 ? (
                                                    <span className="rounded border border-[var(--ds-primary,#1F8A5B)]/20 bg-[var(--ds-primary-soft,#ECFDF5)] px-1 py-0.5 font-mono text-xs text-[var(--ds-primary,#1F8A5B)]">
                                                        -{formatCurrency(e.discount_amount)}/mo
                                                    </span>
                                                ) : <span className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                 <Button variant="ghost" size="sm" onClick={() => setDiscountEnrollment(e)} className="mr-1 text-[var(--ds-warning,#C2410C)] hover:bg-[var(--ds-warning,#C2410C)]/10 hover:text-[var(--ds-warning,#C2410C)]" title="Manage Discount"><Percent className="h-3 w-3" /></Button>
                                                 <Button variant="ghost" size="sm" onClick={() => setTransferEnrollment(e)} className="mr-1" title="Transfer"><ArrowRightLeft className="h-3 w-3" /></Button>
                                                 <Button variant="ghost" size="sm" className="text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)] hover:text-[var(--ds-danger,#DC2626)]" onClick={() => handleRemove(e.id)} title="Remove" disabled={!!removingId}>
                                                   {removingId === e.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                                                 </Button>
                                            </TableCell>
                                        </TableRow>
                                    ) : null;
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </DialogContent>
    );
};

const ClassDetailsDialog = ({ classData, isOpen, onClose }) => {
    if (!classData) return null;

    return (
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="text-2xl">{classData.name}</DialogTitle>
                <DialogDescription className="text-[var(--ds-text-secondary,#5B6B61)]">{classData.displayProgram}</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="overview" className="mt-4 w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="transfers">
                        <History className="mr-2 h-4 w-4" />
                        Transfer Log
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Class Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <Label className="text-xs uppercase text-[var(--ds-text-tertiary,#8A978E)]">Instructor</Label>
                                <p className="font-medium text-[var(--ds-text-primary,#122018)]">{classData.instructorName || 'Unassigned'}</p>
                            </div>
                            <div>
                                <Label className="text-xs uppercase text-[var(--ds-text-tertiary,#8A978E)]">Duration</Label>
                                <p className="font-medium text-[var(--ds-text-primary,#122018)]">{classData.duration_months} Months</p>
                            </div>
                            <div>
                                <Label className="text-xs uppercase text-[var(--ds-text-tertiary,#8A978E)]">Total Fee</Label>
                                <p className="font-medium text-[var(--ds-text-primary,#122018)]">{formatCurrency(classData.fee)}</p>
                            </div>
                            <div>
                                <Label className="text-xs uppercase text-[var(--ds-text-tertiary,#8A978E)]">Enrolled Students</Label>
                                <p className="font-medium text-[var(--ds-text-primary,#122018)]">{classData.studentCount} Students</p>
                            </div>
                            <div>
                                <Label className="text-xs uppercase text-[var(--ds-text-tertiary,#8A978E)]">Start Date</Label>
                                <p className="font-medium text-[var(--ds-text-primary,#122018)]">{formatDate(classData.start_date)}</p>
                            </div>
                            <div>
                                <Label className="text-xs uppercase text-[var(--ds-text-tertiary,#8A978E)]">End Date</Label>
                                <p className="font-medium text-[var(--ds-text-primary,#122018)]">{formatDate(classData.end_date)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="transfers" className="mt-4">
                    <InstructorPaymentTransferLog classId={classData.id} />
                </TabsContent>
            </Tabs>
        </DialogContent>
    );
};

const ClassesPage = () => {
    const { user } = useAuth();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [rosterDialogOpen, setRosterDialogOpen] = useState(false);
    const [coursesDialogOpen, setCoursesDialogOpen] = useState(false);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    
    const [selectedClass, setSelectedClass] = useState(null);
    const [classToDelete, setClassToDelete] = useState(null);
    
    const { classes, courses, diplomas, users, enrollments, updateClassData, deleteClassData, classCourses, payments } = useData();
    const { toast } = useToast();

    const classesWithDetails = useMemo(() => {
        const visibleClasses =
            user?.role === 'instructor'
                ? classes.filter((c) => c.instructor_id === user.id)
                : classes;

        return visibleClasses.map((c) => {
        const course = courses.find(co => co.id === c.course_id);
        const diploma = diplomas.find(d => d.id === c.diploma_id);
        const instructor = users.find(u => u.id === c.instructor_id);
        const studentCount = enrollments.filter(e => e.class_id === c.id && e.status === 'active').length;
        const assignedCourses = classCourses.filter(cc => cc.class_id === c.id);
        
        let displayProgram = "N/A";
        if (diploma) displayProgram = `Diploma: ${diploma.name}`;
        else if (course) displayProgram = `Course: ${course.name}`;

        const instructorName =
          c.instructorName ||
          c.instructor?.name ||
          c.instructor?.full_name ||
          instructor?.name ||
          instructor?.full_name ||
          null;

        return { ...c, displayProgram, instructorName, studentCount, courseCount: assignedCourses.length };
    });
    }, [classes, courses, diplomas, users, enrollments, classCourses, user]);

    const filteredClasses = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return classesWithDetails;
        return classesWithDetails.filter((c) =>
            c.name?.toLowerCase().includes(q) ||
            c.displayProgram?.toLowerCase().includes(q) ||
            c.instructorName?.toLowerCase().includes(q)
        );
    }, [classesWithDetails, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredClasses.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const currentClasses = filteredClasses.slice(
        (safePage - 1) * ITEMS_PER_PAGE,
        safePage * ITEMS_PER_PAGE
    );

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    const openRosterDialog = (classData) => { setSelectedClass(classData); setRosterDialogOpen(true); };
    const openDetailsDialog = (classData) => { setSelectedClass(classData); setDetailsDialogOpen(true); };
    const handleEdit = (classData) => { setSelectedClass(classData); setEditDialogOpen(true); };
    const handleManageCourses = (classData) => { setSelectedClass(classData); setCoursesDialogOpen(true); };
    
    const handleDeleteClick = (classData) => { setClassToDelete(classData); setDeleteAlertOpen(true); };
    
    const confirmDelete = async () => {
        if (!classToDelete) return;
        try { 
            await deleteClassData(classToDelete.id); 
            toast({ title: "Success", description: MESSAGES.SUCCESS.CLASS_DELETED }); 
        } catch (error) { 
            notify.error(error, { context: 'ClassesPage - deleteClass', fallback: { title: 'Delete Failed', description: MESSAGES.DOMAIN.DELETION_DEPENDENCIES } }); 
        } finally { 
            setDeleteAlertOpen(false); 
            setClassToDelete(null); 
        }
    };
    
    const toggleStatus = async (classData) => {
        try { await updateClassData(classData.id, { is_active: !classData.is_active }); }
        catch (error) { notify.error(error, { context: 'ClassesPage - toggleStatus', fallback: MESSAGES.UPDATE_FAILED }); }
    };

    return (
        <AnimatedPage>
            <Helmet><title>Classes - Portal</title></Helmet>
            <PageHeader title="Class Management" subtitle={`Active classes and schedules.`}>
               {(user.role === 'admin' || user.role === 'staff') && (
                    <Button onClick={() => setCreateDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />Create Class</Button>
               )}
            </PageHeader>

            <div className="mb-5 flex min-w-0 items-center gap-3">
                <div className="relative w-full max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-tertiary,#8A978E)]" />
                    <Input
                      type="search"
                      placeholder="Search classes..."
                      className="h-9 pl-9"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                </div>
            </div>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-[480px]"><ClassForm closeDialog={() => setCreateDialogOpen(false)} /></DialogContent>
            </Dialog>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[480px]"><ClassForm classInfo={selectedClass} closeDialog={() => setEditDialogOpen(false)} /></DialogContent>
            </Dialog>
            <Dialog open={rosterDialogOpen} onOpenChange={setRosterDialogOpen}>
                <ClassRosterDialog classData={selectedClass} isOpen={rosterDialogOpen} onClose={() => setRosterDialogOpen(false)} />
            </Dialog>
            <Dialog open={coursesDialogOpen} onOpenChange={setCoursesDialogOpen}>
                <ClassCoursesDialog classData={selectedClass} isOpen={coursesDialogOpen} onClose={() => setCoursesDialogOpen(false)} />
            </Dialog>
            <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                <ClassDetailsDialog classData={selectedClass} isOpen={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} />
            </Dialog>

            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete Class?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the class, including all enrollments, attendance records, exams, and results. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger,#DC2626)]/90">Delete Class</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="grid grid-cols-1 gap-6">
                {currentClasses.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-[var(--ds-text-tertiary,#8A978E)]">
                            {searchTerm.trim()
                              ? 'No classes match your search.'
                              : 'No classes found.'}
                        </CardContent>
                    </Card>
                ) : currentClasses.map(c => (
                    <Card key={c.id} className="transition-all hover:border-[var(--ds-primary,#1F8A5B)]/40">
                        <CardContent className="p-6">
                            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                                <div className="flex-1">
                                    <div className="mb-2 flex items-center gap-3">
                                        <h3 className="cursor-pointer text-xl font-bold text-[var(--ds-text-primary,#122018)] transition-colors hover:text-[var(--ds-primary,#1F8A5B)]" onClick={() => openDetailsDialog(c)}>{c.name}</h3>
                                        <Badge variant={c.is_active ? "default" : "secondary"} className={c.is_active ? "bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)] hover:bg-[var(--ds-primary-soft,#ECFDF5)]" : ""}>{c.is_active ? "Active" : "Inactive"}</Badge>
                                    </div>
                                    <p className="mb-4 text-sm text-[var(--ds-text-secondary,#5B6B61)]">{c.displayProgram}</p>
                                    <div className="flex flex-wrap gap-4 text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                                        <div className="flex items-center gap-1.5 rounded border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-2 py-1">
                                            <Clock className="h-3.5 w-3.5 text-[var(--ds-primary,#1F8A5B)]" /> 
                                            {c.duration_months} Mo
                                        </div>
                                        <div className="flex items-center gap-1.5 rounded border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-2 py-1">
                                            <DollarSign className="h-3.5 w-3.5 text-[var(--ds-primary,#1F8A5B)]" /> 
                                            {formatCurrency(c.fee)}
                                        </div>
                                        <div className="flex items-center gap-1.5 rounded border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-2 py-1">
                                            <Users className="h-3.5 w-3.5 text-[var(--ds-primary,#1F8A5B)]" /> 
                                            {c.studentCount} Students
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">
                                        <span className="text-xs uppercase tracking-wider text-[var(--ds-text-tertiary,#8A978E)]">Instructor:</span>
                                        {c.instructorName || 'Unassigned'}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        {(user.role === 'admin' || user.role === 'staff') && (
                                            <>
                                                <DsOutlineAction
                                                  tone="secondary"
                                                  onClick={() => toggleStatus(c)}
                                                >
                                                    {c.is_active
                                                      ? <XCircle className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} />
                                                      : <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} />}
                                                    {c.is_active ? 'Deactivate' : 'Activate'}
                                                </DsOutlineAction>
                                                <DsIconButton
                                                  tone="secondary"
                                                  onClick={() => handleManageCourses(c)}
                                                  title="Manage Courses"
                                                >
                                                  <BookOpen className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
                                                </DsIconButton>
                                                <DsIconButton
                                                  tone="info"
                                                  onClick={() => handleEdit(c)}
                                                  title="Edit Class"
                                                >
                                                  <Pencil className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
                                                </DsIconButton>
                                                <DsIconButton
                                                  tone="danger"
                                                  onClick={() => handleDeleteClick(c)}
                                                  title="Delete Class"
                                                >
                                                  <Trash2 className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
                                                </DsIconButton>
                                            </>
                                        )}
                                        <DsPrimaryAction onClick={() => openRosterDialog(c)}>
                                          <Eye className="h-3.5 w-3.5" strokeWidth={DS_ICON_STROKE} /> Roster
                                        </DsPrimaryAction>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredClasses.length > ITEMS_PER_PAGE && (
                <div className="mt-6 flex items-center justify-between border-t border-[var(--ds-border,#DDE5DF)] pt-4">
                    <div className="hidden text-sm text-[var(--ds-text-secondary,#5B6B61)] sm:block">
                        Showing {(safePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(safePage * ITEMS_PER_PAGE, filteredClasses.length)} of {filteredClasses.length}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={safePage === 1}
                        >
                            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                        </Button>
                        <span className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                            Page {safePage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={safePage === totalPages}
                        >
                            Next <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </AnimatedPage>
    );
};
export default ClassesPage;