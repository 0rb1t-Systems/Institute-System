import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Loader2, Search, FileEdit, Plus, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { getResultsForExam, getClassGradingContext, deleteResult } from '@/lib/api';
import ExamResultForm from '@/components/admin/ExamResultForm';
import ResultsErrorBoundary from '@/components/ui/ResultsErrorBoundary';
import { handleFetchError } from '@/lib/resultErrorHandler';
import { isExamPassed } from '@/lib/examPass';
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

const AdminExamMarkingPageContent = () => {
    const { toast } = useToast();
    const { exams, classes, students, refreshData } = useData();
    
    const [selectedExamId, setSelectedExamId] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [submissions, setSubmissions] = useState([]);
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingResult, setEditingResult] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [resultToDelete, setResultToDelete] = useState(null);

    // Derived data for form
    const currentExam = exams.find(e => e.id === selectedExamId);
    const [classStudents, setClassStudents] = useState([]);

    const loadSubmissions = useCallback(async () => {
        if (!selectedExamId) {
            setSubmissions([]);
            setClassStudents([]);
            return;
        }

        setLoading(true);
        try {
            const exam = exams.find(e => e.id === selectedExamId);
            if (!exam) throw new Error("Exam not found");

            // Exam-scoped fetch only — never download all 4k+ institution results.
            let examResults = [];
            let studentsList = [];
            if (exam.class_id) {
              const ctx = await getClassGradingContext(exam.class_id, selectedExamId);
              examResults = ctx.results || [];
              studentsList = ctx.students || [];
            } else {
              examResults = await getResultsForExam(selectedExamId);
              studentsList = (students || []).filter((s) =>
                examResults.some((r) => r.student_id === s.id),
              );
            }

            setClassStudents(studentsList);

            const processedData = examResults.map(r => {
                const student =
                  studentsList.find(s => s.id === r.student_id) ||
                  students.find(s => s.id === r.student_id);
                return {
                    ...r,
                    student_name: student?.name || 'Unknown',
                    student_code: student?.student_code || 'N/A',
                    exam_title: exam.title,
                    status: isExamPassed(r.score ?? r.final_score, exam) ? 'PASS' : 'FAIL',
                };
            });

            setSubmissions(processedData);
        } catch (error) {
            handleFetchError(error, 'loadSubmissions in AdminExamMarkingPage');
        } finally {
            setLoading(false);
        }
    }, [selectedExamId, exams, students]);

    // Initial selected exam setter
    useEffect(() => {
        if (exams.length > 0 && selectedExamId === '' && classes.length > 0) {
            setSelectedExamId(exams[0].id);
        }
    }, [exams, classes, selectedExamId]);

    // Fetch data specifically when selectedExamId changes (avoids infinite loops)
    useEffect(() => {
        loadSubmissions();
    }, [loadSubmissions]);

    const handleOpenCreate = () => {
        if (!selectedExamId) {
            toast({ variant: "destructive", title: "Select Exam", description: "Please select an examination first." });
            return;
        }
        setEditingResult(null);
        setIsFormOpen(true);
    };

    const handleOpenEdit = (result) => {
        setEditingResult(result);
        setIsFormOpen(true);
    };

    const handleDeleteClick = (result) => {
        setResultToDelete(result);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!resultToDelete) return;
        
        try {
            await deleteResult(resultToDelete.id);
            toast({ title: "Success", description: MESSAGES.SUCCESS.RESULT_DELETED });
            loadSubmissions();
            refreshData(); 
        } catch (error) {
            notify.error(error, { context: 'AdminExamMarkingPage - delete', fallback: MESSAGES.DELETE_FAILED });
        } finally {
            setDeleteConfirmOpen(false);
            setResultToDelete(null);
        }
    };

    const filteredSubmissions = submissions.filter(sub => 
        sub.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.student_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="grid gap-6">
            {/* Filters & Actions */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4 items-end">
                        <div className="flex gap-4 w-full md:w-2/3">
                            <div className="w-1/2 space-y-2">
                                <label className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">Select Examination</label>
                                <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Exam" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {exams.map(exam => (
                                            <SelectItem key={exam.id} value={exam.id}>
                                                {exam.title} ({classes.find(c => c.id === exam.class_id)?.name || 'Unknown'})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-1/2 space-y-2">
                                <label className="text-sm font-medium text-[var(--ds-text-secondary,#5B6B61)]">Search Student</label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-[var(--ds-text-tertiary,#8A978E)]" />
                                    <Input 
                                        placeholder="Name or ID..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={loadSubmissions} title="Refresh Results">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button onClick={handleOpenCreate} disabled={!selectedExamId}>
                                <Plus className="h-4 w-4 mr-2" /> Add Result
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Recorded Results</span>
                        <Badge variant="outline" className="text-[var(--ds-text-secondary,#5B6B61)]">{filteredSubmissions.length} Records</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-hidden rounded-md border border-[var(--ds-border,#DDE5DF)]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Student</TableHead>
                                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Score</TableHead>
                                    <TableHead className="hidden px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)] md:table-cell">Attendance</TableHead>
                                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Final</TableHead>
                                    <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Status</TableHead>
                                    <TableHead className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSubmissions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
                                            <div className="flex flex-col items-center justify-center text-[var(--ds-text-tertiary,#8A978E)]">
                                                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                                                <p>No results recorded for this examination.</p>
                                                <Button variant="link" onClick={handleOpenCreate} className="mt-2">
                                                    Add the first result
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSubmissions.map((sub) => (
                                        <TableRow key={sub.id}>
                                            <TableCell className="px-5">
                                                <div>
                                                    <div className="font-medium text-[var(--ds-text-primary,#122018)]">{sub.student_name}</div>
                                                    <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">{sub.student_code}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-5 text-[var(--ds-text-secondary,#5B6B61)]">
                                                <span className="font-mono">{sub.score}</span>{' '}
                                                <span className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">/ {sub.total_marks}</span>
                                            </TableCell>
                                            <TableCell className="hidden px-5 text-[var(--ds-text-secondary,#5B6B61)] md:table-cell">
                                                {sub.attendance_score || 0}
                                            </TableCell>
                                            <TableCell className="px-5 font-semibold text-[var(--ds-text-primary,#122018)]">
                                                {sub.final_score || sub.score}
                                            </TableCell>
                                            <TableCell className="px-5">
                                                {sub.status === 'PASS' && (
                                                  <Badge className="border-0 bg-[var(--ds-success-bg,#ECFDF5)] text-[var(--ds-success,#059669)]">PASS</Badge>
                                                )}
                                                {sub.status === 'FAIL' && (
                                                  <Badge className="border-0 bg-[var(--ds-danger-bg,#FEF2F2)] text-[var(--ds-danger,#DC2626)]">FAIL</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => handleOpenEdit(sub)}
                                                        className="h-8 w-8 p-0 text-[var(--ds-accent,#1F8A5B)] hover:bg-[var(--ds-surface-muted,#F7FAF8)] hover:text-[var(--ds-accent,#1F8A5B)]"
                                                    >
                                                        <FileEdit className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => handleDeleteClick(sub)}
                                                        className="h-8 w-8 p-0 text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)] hover:text-[var(--ds-danger,#DC2626)]"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Form Modal */}
            <ExamResultForm 
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={() => {
                    loadSubmissions();
                    refreshData();
                }}
                exam={currentExam}
                students={classStudents}
                initialData={editingResult}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-[var(--ds-danger,#DC2626)]">
                            <AlertCircle className="h-5 w-5" />
                            Delete Result
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the result for{' '}
                            <strong className="text-[var(--ds-text-primary,#122018)]">{resultToDelete?.student_name}</strong>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-[var(--ds-danger,#DC2626)] text-[var(--ds-text-on-primary,#fff)] hover:bg-[var(--ds-danger-hover,#B91C1C)]"
                        >
                            Delete Result
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

const AdminExamMarkingPage = () => {
  return (
    <AnimatedPage>
        <Helmet><title>Exam Results Management - Admin Portal</title></Helmet>
        
        <PageHeader 
            title="Exam Results Management" 
            subtitle="View, add, edit, or delete student examination results."
        />

        <ResultsErrorBoundary>
            <AdminExamMarkingPageContent />
        </ResultsErrorBoundary>
    </AnimatedPage>
  );
};

export default AdminExamMarkingPage;