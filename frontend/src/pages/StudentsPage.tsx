import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { DsIconButton, DS_ICON_STROKE } from '@/components/ui/ds-actions';
import { 
  Pencil, 
  Trash2, 
  Loader2, 
  FileText, 
  ArrowLeftRight, 
  Printer, 
  ChevronLeft, 
  ChevronRight,
  UserPlus,
  Upload,
  ShieldCheck,
  Users,
  UserCheck,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { getRegistrationFeeAmount, getTenantPortalUrl, usesTenantSubdomainHosts } from '@/lib/institution';
import { computeStudentBalance } from '@/lib/finance';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatDate } from '@/lib/utils';
import StudentIdCard from '@/components/StudentIdCard';
import StudentRegistrationModal from '@/components/student/StudentRegistrationModal';
import BulkImportStudentsModal from '@/components/student/BulkImportStudentsModal';
import AlumniImportModal from '@/components/student/AlumniImportModal';
import EditStudentModal from '@/components/student/EditStudentModal';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPersonInitials, getStudentAvatarColor } from '@/lib/studentAvatar';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// --- Enroll (add class) or Transfer (move between classes) ---
const ManualTransferDialog = ({ student, closeDialog }) => {
    const { classes, enrollStudent, transferStudent, enrollments } = useData();
    const { toast } = useToast();
    const [mode, setMode] = useState('enroll');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [fromEnrollmentId, setFromEnrollmentId] = useState('');
    const [loading, setLoading] = useState(false);

    const activeEnrollments = useMemo(
      () =>
        enrollments.filter(
          (e) => e.student_id === student.id && (e.status === 'active' || !e.status),
        ),
      [enrollments, student.id],
    );
    const enrolledClassIds = useMemo(
      () => new Set(activeEnrollments.map((e) => e.class_id)),
      [activeEnrollments],
    );
    const activeClasses = useMemo(() => classes.filter((c) => c.is_active), [classes]);
    const availableClasses = useMemo(
      () => activeClasses.filter((c) => !enrolledClassIds.has(c.id)),
      [activeClasses, enrolledClassIds],
    );

    React.useEffect(() => {
      if (activeEnrollments.length === 0) setMode('enroll');
      else if (availableClasses.length === 0) setMode('transfer');
      else setMode('enroll');
      if (activeEnrollments.length === 1) {
        setFromEnrollmentId(activeEnrollments[0].id);
      }
    }, [activeEnrollments, availableClasses.length]);

    const handleAction = async () => {
        if (!selectedClassId) return;
        if (enrolledClassIds.has(selectedClassId)) {
          toast({
            variant: 'destructive',
            title: 'Already enrolled',
            description: 'This student is already in that class.',
          });
          return;
        }
        setLoading(true);
        try {
            if (mode === 'transfer') {
                const fromId =
                  fromEnrollmentId ||
                  (activeEnrollments.length === 1 ? activeEnrollments[0].id : '');
                if (!fromId) {
                  toast({
                    variant: 'destructive',
                    title: 'Choose current class',
                    description: 'Select which class to move the student from.',
                  });
                  setLoading(false);
                  return;
                }
                await transferStudent(fromId, selectedClassId);
                toast({ title: 'Success', description: MESSAGES.SUCCESS.TRANSFER_COMPLETED });
            } else {
                await enrollStudent({ student_id: student.id, class_id: selectedClassId });
                toast({ title: 'Success', description: MESSAGES.SUCCESS.ENROLLMENT_SAVED });
            }
            closeDialog();
        } catch (error) {
             notify.error(error, { context: 'StudentsPage - enroll/transfer', fallback: MESSAGES.DOMAIN.ENROLLMENT_FAILED });
        } finally {
            setLoading(false);
        }
    };

    const canEnrollMore = availableClasses.length > 0;
    const canTransfer = activeEnrollments.length > 0 && availableClasses.length > 0;

    return (
        <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>
                {mode === 'transfer' ? 'Transfer Student' : 'Enroll Student'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                {activeEnrollments.length > 0 && (
                  <div className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                    Currently in:{' '}
                    {activeEnrollments
                      .map((e) => classes.find((c) => c.id === e.class_id)?.name || 'Class')
                      .join(', ')}
                  </div>
                )}

                {activeEnrollments.length > 0 && (canEnrollMore || canTransfer) && (
                  <RadioGroup
                    value={mode}
                    onValueChange={(v) => {
                      setMode(v);
                      setSelectedClassId('');
                    }}
                    className="gap-3"
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="enroll" id="mode-enroll" disabled={!canEnrollMore} />
                      <Label htmlFor="mode-enroll" className="font-normal leading-snug cursor-pointer">
                        <span className="font-medium text-slate-100">Add to another class</span>
                        <span className="block text-xs text-slate-400">
                          Keep existing classes — enroll in an additional class.
                        </span>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="transfer" id="mode-transfer" disabled={!canTransfer} />
                      <Label htmlFor="mode-transfer" className="font-normal leading-snug cursor-pointer">
                        <span className="font-medium text-slate-100">Transfer</span>
                        <span className="block text-xs text-slate-400">
                          Move from one class to another (grades are preserved).
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                )}

                {mode === 'transfer' && activeEnrollments.length > 1 && (
                  <div className="space-y-2">
                    <Label className="text-slate-400 text-xs uppercase">From class</Label>
                    <Select value={fromEnrollmentId} onValueChange={setFromEnrollmentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose current class..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeEnrollments.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {classes.find((c) => c.id === e.class_id)?.name || 'Class'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs uppercase">
                    {mode === 'transfer' ? 'To class' : 'Class'}
                  </Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger><SelectValue placeholder="Choose a class..." /></SelectTrigger>
                      <SelectContent>
                          {availableClasses.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                  {availableClasses.length === 0 && (
                    <p className="text-xs text-slate-400">
                      This student is already enrolled in every active class.
                    </p>
                  )}
                </div>
            </div>
            <DialogFooter>
                 <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                 <Button
                   onClick={handleAction}
                   disabled={!selectedClassId || loading || (mode === 'transfer' && activeEnrollments.length > 1 && !fromEnrollmentId)}
                 >
                   {loading ? (
                     <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                   ) : mode === 'transfer' ? 'Transfer' : 'Enroll'}
                 </Button>
            </DialogFooter>
        </DialogContent>
    );
}

// --- Main Page ---
const StudentsPage = () => {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [isAlumniImportOpen, setIsAlumniImportOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [transferDialogStudent, setTransferDialogStudent] = useState(null);
    const [printData, setPrintData] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10; 

    // Deletion State
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletingRowId, setDeletingRowId] = useState(null);

    const { students, deleteStudentData, enrollments, classes, courses, diplomas, users, generalRegistrations, payments, refreshData } = useData();
    const { user, institution } = useAuth();
    const canManageStudents = user?.role === 'admin' || user?.role === 'staff';
    const canDeleteStudents = user?.role === 'admin';
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const navigate = useNavigate();
    const registrationFee = getRegistrationFeeAmount(institution);

    const tenantSlug = String(institution?.subdomain || '').trim().toLowerCase();
    const verifyCredentialPath = tenantSlug
        ? usesTenantSubdomainHosts()
            ? `${getTenantPortalUrl(institution)}/verify-credential`
            : `/verify-credential?tenant=${encodeURIComponent(tenantSlug)}`
        : '/verify-credential';

    const pendingCount = useMemo(
        () => generalRegistrations.filter((r) => r.status === 'pending').length,
        [generalRegistrations],
    );

    const filteredStudents = useMemo(() => {
        const pendingEmails = new Set(
            generalRegistrations
                .filter(r => r.status === 'pending')
                .map(r => r.student_email.toLowerCase())
        );

        const activeStudentIds = new Set(
            enrollments
                .filter(e => e.status === 'active')
                .map(e => e.student_id)
        );

        return students
            .filter(s => {
                if (activeStudentIds.has(s.id)) return true;
                if (pendingEmails.has(s.email?.toLowerCase())) return false;
                return true;
            })
            .filter(s => 
                s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                s.student_code?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => Number(new Date(b.registration_date || b.created_at)) - Number(new Date(a.registration_date || a.created_at)));
    }, [students, searchTerm, generalRegistrations, enrollments]);

    const studentMetrics = useMemo(() => {
        const activeStudentIds = new Set(
            enrollments.filter((e) => e.status === 'active').map((e) => e.student_id),
        );
        let outstanding = 0;
        for (const student of filteredStudents) {
            const enrollment = enrollments.find((e) => e.student_id === student.id && e.status === 'active');
            const activeClass = enrollment ? classes.find((c) => c.id === enrollment.class_id) : null;
            const studentPayments = payments.filter((p) => p.student_id === student.id);
            const { balance } = computeStudentBalance({
                payments: studentPayments,
                activeClass,
                enrollment,
                institution,
                registrationFeeAmount: registrationFee,
            });
            if (balance > 0) outstanding += 1;
        }
        return {
            total: filteredStudents.length,
            active: filteredStudents.filter((s) => activeStudentIds.has(s.id)).length,
            pending: pendingCount,
            outstanding,
        };
    }, [filteredStudents, enrollments, classes, payments, institution, registrationFee, pendingCount]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
    const currentStudents = filteredStudents.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleEdit = (student) => { 
        setEditingStudent(student); 
        setIsEditDialogOpen(true); 
    };
    
    const handleDeleteClick = (student) => { 
        setStudentToDelete(student); 
        setIsDeleteOpen(true); 
    };

    const handleConfirmDelete = async () => {
        if (!studentToDelete) return;
        setIsDeleting(true);
        setDeletingRowId(studentToDelete.id);
        
        try {
            await deleteStudentData(studentToDelete.id);
            toast({ title: "Success", description: MESSAGES.SUCCESS.STUDENT_DELETED });
            
            setTimeout(() => {
                setIsDeleteOpen(false);
                setStudentToDelete(null);
                setDeletingRowId(null);
                setIsDeleting(false);
            }, 500);
            
        } catch (error) {
            notify.error(error, {
              context: 'StudentsPage - deleteStudent',
              fallback: MESSAGES.DELETE_FAILED,
            });
            setIsDeleting(false);
            setDeletingRowId(null);
            setIsDeleteOpen(false);
            setStudentToDelete(null);
        }
    };

    const handlePrintClick = (student) => {
        const profile = users.find(u => u.id === student.profile_id) || users.find(u => u.email === student.email);
        const activeEnrollment = enrollments.find(e => e.student_id === student.id && e.status === 'active');
        const cls = activeEnrollment ? classes.find(c => c.id === activeEnrollment.class_id) : null;
        const course = cls?.course_id ? courses.find(c => c.id === cls.course_id) : null;
        const diploma = cls?.diploma_id ? diplomas.find(d => d.id === cls.diploma_id) : null;
        const classData = cls
            ? { ...cls, course: course || null, diploma: diploma || null }
            : null;
        const enrichedEnrollment = activeEnrollment
            ? { ...activeEnrollment, class: classData }
            : null;
        // Prefer course name; for diploma programs use diploma as program source
        const programSource = course || (diploma ? { name: diploma.name, duration: cls?.duration_months } : null);
        setPrintData({
            student: { ...student, avatar_url: student.avatar_url || profile?.avatar_url },
            enrollment: enrichedEnrollment,
            course: programSource,
            classData,
        });
    };

    return (
        <AnimatedPage>
            <Helmet><title>Students - Portal</title></Helmet>

            <PageHeader
              title="Student Management"
              subtitle={`Total Approved Students: ${filteredStudents.length}`}
            />

            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              <StatCard
                title="Total Students"
                value={studentMetrics.total}
                tone="primary"
                descriptionTone="secondary"
                icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
                description="In your institution directory"
              />
              <StatCard
                title="Active"
                value={studentMetrics.active}
                tone="primary"
                descriptionTone="accent"
                icon={<UserCheck className="h-5 w-5" strokeWidth={1.75} />}
                description="Currently enrolled"
              />
              <StatCard
                title="Pending"
                value={studentMetrics.pending}
                tone="warning"
                descriptionTone="warning"
                trendIcon={<Timer className="h-3 w-3 shrink-0" strokeWidth={2} />}
                icon={<Timer className="h-5 w-5" strokeWidth={1.75} />}
                description="Awaiting approval"
              />
              <StatCard
                title="Outstanding"
                value={studentMetrics.outstanding}
                tone="danger"
                descriptionTone="danger"
                trendIcon={<AlertCircle className="h-3 w-3 shrink-0" strokeWidth={2} />}
                icon={<AlertCircle className="h-5 w-5" strokeWidth={1.75} />}
                description="With balance due"
              />
            </div>

            <div className="mb-5 flex min-w-0 items-center gap-3">
                <Input
                  type="search"
                  placeholder="Search students..."
                  className="h-9 w-[200px] shrink-0"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                {canManageStudents ? (
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                        <Button asChild variant="outline" className="h-9 shrink-0 gap-2 px-3">
                            <a href={verifyCredentialPath} target="_blank" rel="noopener noreferrer">
                                <ShieldCheck className="h-4 w-4 shrink-0" />
                                Verify Credential
                            </a>
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/students/forms')} className="h-9 shrink-0 gap-2 px-3">
                          <FileText className="h-4 w-4 shrink-0" /> Forms
                        </Button>
                        <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} className="h-9 shrink-0 gap-2 px-3">
                          <Upload className="h-4 w-4 shrink-0" /> Bulk Import
                        </Button>
                        <Button variant="outline" onClick={() => setIsAlumniImportOpen(true)} className="h-9 shrink-0 gap-2 px-3">
                          <Upload className="h-4 w-4 shrink-0" /> Alumni Import
                        </Button>
                        <Button onClick={() => setIsRegistrationModalOpen(true)} className="h-9 shrink-0 gap-2 px-3">
                          <UserPlus className="h-4 w-4 shrink-0" /> Register New Student
                        </Button>
                    </div>
                ) : null}
            </div>

            <StudentRegistrationModal 
                isOpen={isRegistrationModalOpen} 
                onClose={() => setIsRegistrationModalOpen(false)} 
                onSuccess={() => refreshData()}
                classes={classes}
                users={users}
            />

            <BulkImportStudentsModal
                open={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={() => refreshData()}
                classes={classes}
            />

            <AlumniImportModal
                open={isAlumniImportOpen}
                onClose={() => setIsAlumniImportOpen(false)}
                onSuccess={() => refreshData()}
            />

            <EditStudentModal 
                student={editingStudent} 
                isOpen={isEditDialogOpen} 
                onClose={() => { setIsEditDialogOpen(false); setEditingStudent(null); }} 
                onSuccess={() => refreshData()} 
            />
            
            <Dialog open={!!transferDialogStudent} onOpenChange={(open) => !open && setTransferDialogStudent(null)}>
                {transferDialogStudent && <ManualTransferDialog student={transferDialogStudent} closeDialog={() => setTransferDialogStudent(null)} />}
            </Dialog>
            
            <Dialog open={!!printData} onOpenChange={(open) => !open && setPrintData(null)}>
                <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-fit p-0 bg-transparent border-none shadow-none text-white overflow-x-auto">
                     {printData && <div className="bg-slate-900/95 border border-slate-800 p-4 sm:p-8 rounded-xl shadow-2xl"><StudentIdCard student={printData.student} enrollment={printData.enrollment} course={printData.course} classData={printData.classData} /></div>}
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteOpen} onOpenChange={(open) => { if (!isDeleting) setIsDeleteOpen(open) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {studentToDelete?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the student account and related records (enrollments, payments, attendance) in your institution. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting} onClick={() => setStudentToDelete(null)}>Cancel</AlertDialogCancel>
                        <Button onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
                            {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Confirm Delete'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--ds-border,var(--tenant-line))] px-5 py-4">
                    <CardTitle className="text-base font-semibold">Student Directory</CardTitle>
                    <div className="text-[13px] text-[var(--ds-text-secondary,#5B6B61)]">
                        Page {currentPage} of {totalPages || 1}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                    <TableHead className="min-w-[240px] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Student</TableHead>
                                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Code</TableHead>
                                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Affiliate</TableHead>
                                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Registration</TableHead>
                                    <TableHead className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentStudents.length > 0 ? (
                                    currentStudents.map(s => {
                                        const avatarColor = getStudentAvatarColor(s.id || s.student_code || s.email || s.name)
                                        const initials = getPersonInitials(s.name)
                                        const affiliate = users.find((u) => u.id === s.affiliate_id)
                                        const affiliateLabel = affiliate?.name || affiliate?.full_name
                                        return (
                                        <TableRow 
                                            key={s.id} 
                                            className={`border-[var(--ds-border,#DDE5DF)] transition-colors hover:bg-[var(--ds-surface-muted,#F7FAF8)] ${deletingRowId === s.id ? 'pointer-events-none opacity-50' : ''}`}
                                        >
                                            <TableCell className="px-5 py-3.5">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar className="h-11 w-11 shrink-0 shadow-sm ring-2 ring-[var(--ds-surface,#fff)] ring-offset-1 ring-offset-[var(--ds-border,#DDE5DF)]">
                                                        <AvatarImage src={s.avatar_url} alt={s.name} className="object-cover" />
                                                        <AvatarFallback
                                                          className="text-[12px] font-semibold tracking-wide"
                                                          style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                                                        >
                                                            {initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-[14px] font-semibold leading-snug text-[var(--ds-text-primary,#122018)]">
                                                            {s.name}
                                                        </div>
                                                        <div className="mt-0.5 truncate text-[12px] text-[var(--ds-text-secondary,#5B6B61)]">
                                                            {s.email || 'No email on file'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-5">
                                                <span className="inline-flex rounded-[var(--ds-radius-md,8px)] bg-[var(--ds-primary-soft,#ECFDF5)] px-2 py-1 font-mono text-[12px] font-semibold text-[var(--ds-primary,#1F8A5B)]">
                                                    {s.student_code || '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-5">
                                              {affiliateLabel
                                                ? <span className="text-[13px] text-[var(--ds-text-secondary,#5B6B61)]">{affiliateLabel}</span>
                                                : <span className="text-[var(--ds-text-tertiary,#8A978E)]">—</span>}
                                            </TableCell>
                                            <TableCell className="px-5 text-[13px] tabular-nums text-[var(--ds-text-secondary,#5B6B61)]">{formatDate(s.registration_date)}</TableCell>
                                            <TableCell className="px-5 text-right">
                                                <div className="inline-flex items-center justify-end gap-2.5">
                                                    <DsIconButton
                                                      tone="muted"
                                                      onClick={() => handlePrintClick(s)}
                                                      title="Print ID"
                                                      disabled={isDeleting}
                                                    >
                                                      <Printer className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
                                                    </DsIconButton>
                                                    {canManageStudents && (
                                                      <>
                                                        <DsIconButton
                                                          tone="muted"
                                                          onClick={() => setTransferDialogStudent(s)}
                                                          title="Transfer/Enroll"
                                                          disabled={isDeleting}
                                                        >
                                                          <ArrowLeftRight className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
                                                        </DsIconButton>
                                                        <DsIconButton
                                                          tone="muted"
                                                          onClick={() => handleEdit(s)}
                                                          title="Edit Student"
                                                          disabled={isDeleting}
                                                        >
                                                          <Pencil className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
                                                        </DsIconButton>
                                                      </>
                                                    )}
                                                    {canDeleteStudents && (
                                                      <DsIconButton
                                                        tone="danger"
                                                        onClick={() => handleDeleteClick(s)}
                                                        title="Delete Student"
                                                        disabled={isDeleting}
                                                      >
                                                        <Trash2 className="h-4 w-4" strokeWidth={DS_ICON_STROKE} />
                                                      </DsIconButton>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="py-12 text-center text-[var(--ds-text-tertiary,#8A978E)]">
                                            No active/approved students found. Check the "Forms" section for pending approvals.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-[var(--ds-border,#DDE5DF)] p-4">
                            <div className="hidden text-sm text-[var(--ds-text-secondary,#5B6B61)] sm:block">
                                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || isDeleting}>
                                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || isDeleting}>
                                    Next <ChevronRight className="ml-1 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </AnimatedPage>
    );
};

export default StudentsPage;