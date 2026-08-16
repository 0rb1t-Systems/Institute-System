import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import StudentIdCard from '@/components/StudentIdCard';
import StudentRegistrationModal from '@/components/student/StudentRegistrationModal';
import BulkImportStudentsModal from '@/components/student/BulkImportStudentsModal';
import EditStudentModal from '@/components/student/EditStudentModal';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// --- Manual Transfer ---
const ManualTransferDialog = ({ student, closeDialog }) => {
    const { classes, enrollStudent, transferStudent, enrollments } = useData();
    const { toast } = useToast();
    const [selectedClassId, setSelectedClassId] = useState('');
    const [loading, setLoading] = useState(false);
    const activeClasses = useMemo(() => classes.filter(c => c.is_active), [classes]);
    const currentActiveEnrollment = enrollments.find(e => e.student_id === student.id && e.status === 'active');

    const handleAction = async () => {
        if (!selectedClassId) return;
        setLoading(true);
        try {
            if (currentActiveEnrollment) {
                if (selectedClassId === currentActiveEnrollment.class_id) return;
                await transferStudent(currentActiveEnrollment.id, selectedClassId);
                toast({ title: "Success", description: MESSAGES.SUCCESS.TRANSFER_COMPLETED });
            } else {
                await enrollStudent({ student_id: student.id, class_id: selectedClassId });
                toast({ title: "Success", description: MESSAGES.SUCCESS.ENROLLMENT_SAVED });
            }
            closeDialog();
        } catch (error) {
             notify.error(error, { context: 'StudentsPage - enroll/transfer', fallback: MESSAGES.DOMAIN.ENROLLMENT_FAILED });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[400px] bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader><DialogTitle>{currentActiveEnrollment ? 'Transfer Student' : 'Enroll Student'}</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue placeholder="Choose a class..." /></SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                        {activeClasses.map(c => (
                            <SelectItem key={c.id} value={c.id} disabled={currentActiveEnrollment?.class_id === c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                 <Button variant="outline" onClick={closeDialog} className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300">Cancel</Button>
                 <Button onClick={handleAction} disabled={!selectedClassId || loading}>{loading ? 'Processing...' : 'Confirm'}</Button>
            </DialogFooter>
        </DialogContent>
    );
}

// --- Main Page ---
const StudentsPage = () => {
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
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

    const { students, deleteStudentData, enrollments, classes, courses, diplomas, users, generalRegistrations, refreshData } = useData();
    const { user, institution } = useAuth();
    const canManageStudents = user?.role === 'admin' || user?.role === 'staff';
    const canDeleteStudents = user?.role === 'admin';
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const navigate = useNavigate();

    const tenantSlug = String(institution?.subdomain || '').trim().toLowerCase();
    const verifyCredentialPath = tenantSlug
        ? `/verify-credential?tenant=${encodeURIComponent(tenantSlug)}`
        : '/verify-credential';

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

            {canManageStudents ? (
                <div className="mb-4">
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 border-blue-500/30 bg-blue-950/40 text-blue-300 hover:bg-blue-900/50 hover:text-blue-200 hover:border-blue-400/40 shadow-sm"
                    >
                        <Link to={verifyCredentialPath} target="_blank" rel="noopener noreferrer">
                            <ShieldCheck className="h-4 w-4" />
                            Verify Credential
                        </Link>
                    </Button>
                </div>
            ) : null}

            <PageHeader title="Student Management" subtitle={`Total Approved Students: ${filteredStudents.length}`}>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Input type="search" placeholder="Search students..." className="w-full sm:w-[250px] bg-slate-900 border-slate-700 text-white" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                    <div className="flex flex-wrap gap-2">
                        {canManageStudents && (
                          <>
                            <Button variant="outline" onClick={() => navigate('/students/forms')} className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 flex-1 sm:flex-none"><FileText className="mr-2 h-4 w-4 shrink-0" /> Forms</Button>
                            <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200 flex-1 sm:flex-none"><Upload className="mr-2 h-4 w-4 shrink-0" /> Bulk Import</Button>
                            <Button onClick={() => setIsRegistrationModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"><UserPlus className="mr-2 h-4 w-4 shrink-0" /> Register New Student</Button>
                          </>
                        )}
                    </div>
                </div>
            </PageHeader>

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
                <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {studentToDelete?.name}?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            This permanently deletes the student account and related records (enrollments, payments, attendance) in your institution. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting} onClick={() => setStudentToDelete(null)} className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300">Cancel</AlertDialogCancel>
                        <Button onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
                            {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Confirm Delete'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card className="bg-slate-900/50 border-slate-800 shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
                    <CardTitle className="text-white">Student Directory</CardTitle>
                    <div className="text-sm text-slate-400">
                        Page {currentPage} of {totalPages || 1}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-950/50 border-slate-800 hover:bg-transparent">
                                    <TableHead className="text-slate-400 py-4 px-6 w-[80px]">Avatar</TableHead>
                                    <TableHead className="text-slate-400 py-4 px-6">Code</TableHead>
                                    <TableHead className="text-slate-400 py-4 px-6">Name</TableHead>
                                    <TableHead className="text-slate-400 py-4 px-6">Affiliate</TableHead>
                                    <TableHead className="text-slate-400 py-4 px-6">Registration</TableHead>
                                    <TableHead className="text-right text-slate-400 py-4 px-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentStudents.length > 0 ? (
                                    currentStudents.map(s => (
                                        <TableRow 
                                            key={s.id} 
                                            className={`border-slate-800 hover:bg-slate-800/40 transition-colors ${deletingRowId === s.id ? 'opacity-50 pointer-events-none' : ''}`}
                                        >
                                            <TableCell className="px-6 py-3">
                                                <Avatar className="h-10 w-10 border border-slate-700 bg-slate-800">
                                                    <AvatarImage src={s.avatar_url} alt={s.name} className="object-cover" />
                                                    <AvatarFallback className="bg-slate-800 text-slate-400 text-xs font-medium">
                                                        {s.name?.substring(0, 2).toUpperCase() || 'ST'}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell className="font-medium text-indigo-400 font-mono px-6">{s.student_code}</TableCell>
                                            <TableCell className="px-6">
                                                <div className="text-slate-200 font-medium">{s.name}</div>
                                                <div className="text-xs text-slate-500">{s.email}</div>
                                            </TableCell>
                                            <TableCell className="px-6">
                                              {(() => {
                                                const aff = users.find((u) => u.id === s.affiliate_id);
                                                return aff?.name || aff?.full_name
                                                  ? <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">{aff.name || aff.full_name}</span>
                                                  : <span className="text-slate-600">-</span>;
                                              })()}
                                            </TableCell>
                                            <TableCell className="text-slate-400 px-6">{formatDate(s.registration_date)}</TableCell>
                                            <TableCell className="text-right px-6">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="icon" className="h-8 w-8 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300" onClick={() => handlePrintClick(s)} title="Print ID" disabled={isDeleting}><Printer className="h-4 w-4" /></Button>
                                                    {canManageStudents && (
                                                      <>
                                                        <Button variant="outline" size="icon" className="h-8 w-8 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300" onClick={() => setTransferDialogStudent(s)} title="Transfer/Enroll" disabled={isDeleting}><ArrowLeftRight className="h-3 w-3" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20" onClick={() => handleEdit(s)} title="Edit Student" disabled={isDeleting}><Pencil className="h-4 w-4" /></Button>
                                                      </>
                                                    )}
                                                    {canDeleteStudents && (
                                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => handleDeleteClick(s)} title="Delete Student" disabled={isDeleting}><Trash2 className="h-4 w-4" /></Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-slate-500 bg-slate-900/20">
                                            No active/approved students found. Check the "Forms" section for pending approvals.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/20">
                            <div className="text-sm text-slate-400 hidden sm:block">
                                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || isDeleting} className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white h-8 w-8">
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm text-slate-300 px-3 font-medium">{currentPage} / {totalPages}</span>
                                <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || isDeleting} className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white h-8 w-8">
                                    <ChevronRight className="h-4 w-4" />
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