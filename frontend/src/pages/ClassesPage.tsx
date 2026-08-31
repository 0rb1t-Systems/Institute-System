import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users, X, Search, ArrowRightLeft, Eye, FileSpreadsheet, Printer, Pencil, Trash2, CheckCircle2, XCircle, BookOpen, DollarSign, Clock, Percent, AlertTriangle, History } from 'lucide-react';
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
        <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader>
                <DialogTitle>Manage Courses for {classData.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div className="flex gap-2 items-end border-b border-slate-800 pb-4">
                    <div className="flex-1 space-y-2">
                        <Label>Add Course to Class</Label>
                        <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                            <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue placeholder="Select course..." /></SelectTrigger>
                            <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                                {availableCourses.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleAdd} disabled={!selectedCourseId}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                </div>

                <div>
                    <h3 className="font-medium mb-2 text-slate-300">Assigned Courses</h3>
                    <div className="border border-slate-800 rounded-md overflow-hidden">
                        <Table>
                            <TableHeader><TableRow className="border-slate-800 hover:bg-slate-800/50"><TableHead className="text-slate-400">Course Name</TableHead><TableHead className="text-right text-slate-400">Action</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {linkedCourses.map(cc => (
                                    <TableRow key={cc.id} className="border-slate-800 hover:bg-slate-800/50">
                                        <TableCell>{cc.course?.name || 'Unknown'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-900/20" onClick={() => handleRemove(cc.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {linkedCourses.length === 0 && (
                                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">No courses assigned.</TableCell></TableRow>
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
                    <Alert className="mt-4 border-yellow-700 bg-yellow-900/20">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <AlertDescription className="text-yellow-200">
                            <strong>Instructor Change Detected:</strong> Payment shares for {classPaymentCount} completed payment(s) will be automatically transferred to the new instructor. Previous instructor's shares will only be transferred if they haven't already withdrawn their earnings.
                        </AlertDescription>
                    </Alert>
                )}
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-left sm:text-right">Class Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3 bg-slate-950 border-slate-800" required placeholder="e.g., WD-Jan25"/>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label className="text-left sm:text-right">Program Type</Label>
                    <Select value={type} onValueChange={(val) => { setType(val); setSelectedId(''); }}>
                        <SelectTrigger className="col-span-3 bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                            <SelectItem value="course">Single Course</SelectItem>
                            <SelectItem value="diploma">Diploma Program</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label className="text-left sm:text-right">{type === 'course' ? 'Select Course' : 'Select Diploma'}</Label>
                    <Select value={selectedId} onValueChange={setSelectedId}>
                        <SelectTrigger className="col-span-3 bg-slate-950 border-slate-800"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
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
                        <SelectTrigger className="col-span-3 bg-slate-950 border-slate-800"><SelectValue placeholder="Select an instructor" /></SelectTrigger>
                        <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
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
                    <div className="col-span-3 flex items-center px-3 h-10 rounded-md bg-slate-900 border border-slate-800 text-slate-400 text-sm">
                        {duration_months > 0 ? `${duration_months} Months` : '-'}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                    <Label htmlFor="fee" className="text-left sm:text-right">Total Fee ($)</Label>
                    <Input id="fee" type="number" min="0" value={fee} onChange={e => setFee(e.target.value)} className="col-span-3 bg-slate-950 border-slate-800" required />
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
                      <SelectTrigger className="col-span-3 bg-slate-950 border-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
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
                          className="bg-slate-900 border-slate-800 text-slate-300"
                        />
                        <p className="text-xs text-slate-500">
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
                          className="bg-slate-950 border-slate-800"
                          required
                        />
                        <p className="text-xs text-slate-500">
                          One-time instructor pay for this class. Accrues when the class is saved — not per student payment.
                        </p>
                      </div>
                    </div>
                )}

                 {duration_months > 0 && fee > 0 && (
                     <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                        <Label className="text-left sm:text-right">Est. Monthly</Label>
                        <div className="col-span-3 text-sm text-green-400 font-mono">
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
        <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader><DialogTitle>Transfer Student</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                <Select value={targetClassId} onValueChange={setTargetClassId}>
                    <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue placeholder="Select destination class" /></SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
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
        <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-800 text-slate-100">
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
                        className="bg-slate-950 border-slate-800"
                    />
                    <p className="text-xs text-slate-500">
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
    const { students, enrollments, enrollStudent, unenrollStudent } = useData();
    const { toast } = useToast();
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [transferEnrollment, setTransferEnrollment] = useState(null);
    const [discountEnrollment, setDiscountEnrollment] = useState(null);

    if (!classData) return null;

    const classEnrollments = enrollments.filter(e => e.class_id === classData.id).sort((a, b) => Number(new Date(b.enrollment_date)) - Number(new Date(a.enrollment_date)));
    const enrolledStudentIds = classEnrollments.map(e => e.student_id);
    const availableStudents = students.filter(s => !enrolledStudentIds.includes(s.id) && s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleEnroll = async () => {
        if (selectedStudentIds.length === 0) return;
        try {
            for (const studentId of selectedStudentIds) await enrollStudent({ student_id: studentId, class_id: classData.id });
            setSelectedStudentIds([]);
            toast({ title: "Success", description: MESSAGES.SUCCESS.ENROLLMENT_SAVED });
        } catch (error) { notify.error(error, { context: 'ClassesPage - enroll', fallback: { title: 'Enrollment Failed', description: MESSAGES.DOMAIN.ENROLLMENT_FAILED } }); }
    };

    const handleRemove = async (enrollmentId) => {
        try { await unenrollStudent(enrollmentId); toast({ title: "Success", description: MESSAGES.SUCCESS.UPDATED }); } 
        catch (error) { notify.error(error, { context: 'ClassesPage - unenroll', fallback: MESSAGES.UPDATE_FAILED }); }
    };

    const toggleSelection = (id) => setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);

    return (
        <DialogContent className="sm:max-w-[1000px] h-[85vh] max-h-[90dvh] flex flex-col bg-slate-900 border-slate-800 text-slate-100">
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
            <div className="flex flex-col md:flex-row flex-1 gap-4 md:gap-6 overflow-hidden pt-4 min-h-0">
                <div className="w-full md:w-1/3 flex flex-col gap-3 md:gap-4 md:border-r border-slate-800 md:pr-6 max-h-[40vh] md:max-h-none shrink-0">
                    <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-slate-950 border-slate-800"/>
                    <div className="flex-1 overflow-y-auto border border-slate-800 rounded-md p-2 space-y-1 min-h-0">
                        {availableStudents.map(student => (
                            <div key={student.id} className="flex items-center space-x-2 p-2 hover:bg-slate-800/50 rounded-md">
                                <Checkbox id={`s-${student.id}`} checked={selectedStudentIds.includes(student.id)} onCheckedChange={() => toggleSelection(student.id)}/>
                                <label htmlFor={`s-${student.id}`} className="text-sm font-medium flex-1 cursor-pointer min-w-0">
                                    <div className="font-semibold truncate">{student.name}</div><div className="text-xs text-muted-foreground">{student.student_code}</div>
                                </label>
                            </div>
                        ))}
                    </div>
                    <Button onClick={handleEnroll} disabled={selectedStudentIds.length === 0} className="w-full shrink-0"><PlusCircle className="mr-2 h-4 w-4" /> Enroll</Button>
                </div>
                <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0">
                    <div className="flex-1 overflow-auto border border-slate-800 rounded-md min-h-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-slate-800 hover:bg-slate-800/50">
                                    <TableHead className="text-slate-400">Name</TableHead>
                                    <TableHead className="text-slate-400">Status</TableHead>
                                    <TableHead className="text-slate-400">Discount</TableHead>
                                    <TableHead className="text-right text-slate-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classEnrollments.map(e => {
                                    const s = students.find(stu => stu.id === e.student_id);
                                    return s ? (
                                        <TableRow key={e.id} className="border-slate-800 hover:bg-slate-800/30">
                                            <TableCell>{s.name}</TableCell>
                                            <TableCell><Badge variant={e.status === 'active' ? 'default' : 'secondary'}>{e.status}</Badge></TableCell>
                                            <TableCell>
                                                {e.discount_amount > 0 ? (
                                                    <span className="text-green-400 text-xs font-mono border border-green-900 bg-green-900/20 px-1 py-0.5 rounded">
                                                        -{formatCurrency(e.discount_amount)}/mo
                                                    </span>
                                                ) : <span className="text-slate-600 text-xs">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                 <Button variant="ghost" size="sm" onClick={() => setDiscountEnrollment(e)} className="hover:bg-slate-800 text-yellow-500 hover:text-yellow-400 mr-1" title="Manage Discount"><Percent className="h-3 w-3" /></Button>
                                                 <Button variant="ghost" size="sm" onClick={() => setTransferEnrollment(e)} className="hover:bg-slate-800 mr-1" title="Transfer"><ArrowRightLeft className="h-3 w-3" /></Button>
                                                 <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-900/20 hover:text-red-300" onClick={() => handleRemove(e.id)} title="Remove"><X className="h-3 w-3" /></Button>
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
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader>
                <DialogTitle className="text-2xl">{classData.name}</DialogTitle>
                <DialogDescription className="text-slate-400">{classData.displayProgram}</DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="overview" className="w-full mt-4">
                <TabsList className="grid w-full grid-cols-2 bg-slate-950">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="transfers">
                        <History className="h-4 w-4 mr-2" />
                        Transfer Log
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4 mt-4">
                    <Card className="bg-slate-900/50 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg">Class Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-slate-400 text-xs uppercase">Instructor</Label>
                                <p className="text-slate-100 font-medium">{classData.instructorName || 'Unassigned'}</p>
                            </div>
                            <div>
                                <Label className="text-slate-400 text-xs uppercase">Duration</Label>
                                <p className="text-slate-100 font-medium">{classData.duration_months} Months</p>
                            </div>
                            <div>
                                <Label className="text-slate-400 text-xs uppercase">Total Fee</Label>
                                <p className="text-slate-100 font-medium">{formatCurrency(classData.fee)}</p>
                            </div>
                            <div>
                                <Label className="text-slate-400 text-xs uppercase">Enrolled Students</Label>
                                <p className="text-slate-100 font-medium">{classData.studentCount} Students</p>
                            </div>
                            <div>
                                <Label className="text-slate-400 text-xs uppercase">Start Date</Label>
                                <p className="text-slate-100 font-medium">{formatDate(classData.start_date)}</p>
                            </div>
                            <div>
                                <Label className="text-slate-400 text-xs uppercase">End Date</Label>
                                <p className="text-slate-100 font-medium">{formatDate(classData.end_date)}</p>
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
                    <Button onClick={() => setCreateDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><PlusCircle className="mr-2 h-4 w-4" />Create Class</Button>
               )}
            </PageHeader>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-800 text-slate-100"><ClassForm closeDialog={() => setCreateDialogOpen(false)} /></DialogContent>
            </Dialog>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-800 text-slate-100"><ClassForm classInfo={selectedClass} closeDialog={() => setEditDialogOpen(false)} /></DialogContent>
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
                <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-100">
                    <AlertDialogHeader><AlertDialogTitle>Delete Class?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the class, including all enrollments, attendance records, exams, and results. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="bg-slate-800 border-slate-700 hover:bg-slate-700">Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete Class</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="grid grid-cols-1 gap-6">
                {classesWithDetails.map(c => (
                    <Card key={c.id} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-all">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-bold text-slate-100 cursor-pointer hover:text-primary transition-colors" onClick={() => openDetailsDialog(c)}>{c.name}</h3>
                                        <Badge variant={c.is_active ? "default" : "secondary"} className={c.is_active ? "bg-green-900/50 text-green-400 hover:bg-green-900/70" : "bg-slate-800 text-slate-400"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4">{c.displayProgram}</p>
                                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded border border-slate-800/50">
                                            <Clock className="w-3.5 h-3.5 text-indigo-400" /> 
                                            {c.duration_months} Mo
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded border border-slate-800/50">
                                            <DollarSign className="w-3.5 h-3.5 text-green-400" /> 
                                            {formatCurrency(c.fee)}
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded border border-slate-800/50">
                                            <Users className="w-3.5 h-3.5 text-blue-400" /> 
                                            {c.studentCount} Students
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                    <div className="text-sm text-slate-400 font-medium flex items-center gap-2">
                                        <span className="text-xs uppercase tracking-wider text-slate-500">Instructor:</span>
                                        {c.instructorName || 'Unassigned'}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        {(user.role === 'admin' || user.role === 'staff') && (
                                            <>
                                                <Button variant="outline" size="sm" onClick={() => toggleStatus(c)} className={`border-slate-700 ${c.is_active ? "text-yellow-500 hover:bg-yellow-950/30" : "text-green-500 hover:bg-green-950/30"}`}>
                                                    {c.is_active ? <XCircle className="h-4 w-4 mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                                    {c.is_active ? "Deactivate" : "Activate"}
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleManageCourses(c)} title="Manage Courses" className="hover:bg-slate-800 text-blue-400"><BookOpen className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(c)} className="hover:bg-slate-800"><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(c)} className="hover:bg-red-950/30 text-red-400"><Trash2 className="h-4 w-4" /></Button>
                                            </>
                                        )}
                                        <Button size="sm" onClick={() => openRosterDialog(c)} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0"><Eye className="h-4 w-4 mr-1" /> Roster</Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </AnimatedPage>
    );
};
export default ClassesPage;