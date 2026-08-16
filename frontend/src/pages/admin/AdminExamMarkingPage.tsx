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
import { getResults, getEnrollments, deleteResult } from '@/lib/api';
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
            return;
        }

        setLoading(true);
        try {
            // Error handling strictly defined: it will not throw but return [] if failed in api level.
            const allResults = await getResults();
            if (!Array.isArray(allResults)) throw new Error("Invalid results data");

            const enrollments = await getEnrollments();
            
            const exam = exams.find(e => e.id === selectedExamId);
            if (!exam) throw new Error("Exam not found");

            // Get students enrolled in the class associated with the exam
            const enrolledData = enrollments.filter(en => en.class_id === exam.class_id);
            
            const studentsList = enrolledData.map(en => {
                return students.find(s => s.id === en.student_id);
            }).filter(Boolean);
            
            setClassStudents(studentsList);
            
            // Filter results for this exam
            const examResults = allResults.filter(r => r.exam_id === selectedExamId);

            const processedData = examResults.map(r => {
                const student = students.find(s => s.id === r.student_id);
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
            <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row justify-between gap-4 items-end">
                        <div className="flex gap-4 w-full md:w-2/3">
                            <div className="w-1/2 space-y-2">
                                <label className="text-sm font-medium text-slate-400">Select Examination</label>
                                <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                                    <SelectTrigger className="bg-slate-950 border-slate-800">
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
                                <label className="text-sm font-medium text-slate-400">Search Student</label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input 
                                        placeholder="Name or ID..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-8 bg-slate-950 border-slate-800"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={loadSubmissions} className="border-slate-800" title="Refresh Results">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button onClick={handleOpenCreate} disabled={!selectedExamId} className="bg-blue-600 hover:bg-blue-700">
                                <Plus className="h-4 w-4 mr-2" /> Add Result
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results Table */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Recorded Results</span>
                        <Badge variant="outline" className="text-slate-400">{filteredSubmissions.length} Records</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-slate-800 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-950">
                                <TableRow className="border-slate-800 hover:bg-slate-950">
                                    <TableHead className="text-slate-400">Student</TableHead>
                                    <TableHead className="text-slate-400">Score</TableHead>
                                    <TableHead className="text-slate-400 hidden md:table-cell">Attendance</TableHead>
                                    <TableHead className="text-slate-400">Final</TableHead>
                                    <TableHead className="text-slate-400">Status</TableHead>
                                    <TableHead className="text-right text-slate-400">Actions</TableHead>
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
                                            <div className="flex flex-col items-center justify-center text-slate-500">
                                                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                                                <p>No results recorded for this examination.</p>
                                                <Button variant="link" onClick={handleOpenCreate} className="mt-2 text-blue-400">
                                                    Add the first result
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSubmissions.map((sub) => (
                                        <TableRow key={sub.id} className="border-slate-800 hover:bg-slate-800/50">
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium text-slate-200">{sub.student_name}</div>
                                                    <div className="text-xs text-slate-500">{sub.student_code}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-300">
                                                <span className="font-mono">{sub.score}</span> <span className="text-slate-500 text-xs">/ {sub.total_marks}</span>
                                            </TableCell>
                                            <TableCell className="text-slate-400 hidden md:table-cell">
                                                {sub.attendance_score || 0}
                                            </TableCell>
                                            <TableCell className="font-semibold text-white">
                                                {sub.final_score || sub.score}
                                            </TableCell>
                                            <TableCell>
                                                {sub.status === 'PASS' && <Badge className="bg-green-900/50 text-green-400 border-green-800">PASS</Badge>}
                                                {sub.status === 'FAIL' && <Badge className="bg-red-900/50 text-red-400 border-red-800">FAIL</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => handleOpenEdit(sub)}
                                                        className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                                    >
                                                        <FileEdit className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => handleDeleteClick(sub)}
                                                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
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
                <AlertDialogContent className="bg-slate-900 border-slate-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-500 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Delete Result
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                            Are you sure you want to delete the result for <strong className="text-white">{resultToDelete?.student_name}</strong>? 
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-800 border-slate-700 hover:bg-slate-700 text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
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