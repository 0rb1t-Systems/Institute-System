import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TranscriptView from '@/components/TranscriptView';

const TranscriptReport = () => {
    const { classes, students, enrollments } = useData();
    const [selectedClassId, setSelectedClassId] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewStudentId, setViewStudentId] = useState(null);

    const filteredStudents = useMemo(() => {
        let list = students;

        // Filter by Class
        if (selectedClassId !== 'all') {
            const enrolledIds = new Set(
                enrollments
                    .filter(e => e.class_id === selectedClassId && e.status === 'active')
                    .map(e => e.student_id)
            );
            list = list.filter(s => enrolledIds.has(s.id));
        }

        // Filter by Search
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            list = list.filter(s => 
                s.name.toLowerCase().includes(lower) || 
                s.student_code.toLowerCase().includes(lower)
            );
        }

        return list;
    }, [students, enrollments, selectedClassId, searchQuery]);

    return (
        <div className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader><CardTitle>Academic Transcripts Report</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="w-full md:w-1/3 space-y-2">
                            <Label>Filter by Class</Label>
                            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                                <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue placeholder="Select Class" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Students</SelectItem>
                                    {classes.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full md:w-1/3 space-y-2">
                            <Label>Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                                <Input 
                                    placeholder="Name or Student Code" 
                                    value={searchQuery} 
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-8 bg-slate-950 border-slate-700"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-md border border-slate-800 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-950 hover:bg-slate-950">
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Student ID</TableHead>
                                    <TableHead>University / Org</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.map(student => (
                                    <TableRow key={student.id}>
                                        <TableCell className="font-medium text-slate-200">{student.name}</TableCell>
                                        <TableCell>{student.student_code}</TableCell>
                                        <TableCell>{student.university_name || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800">
                                                        <FileText className="mr-2 h-4 w-4 text-blue-400" /> View Transcript
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-4xl h-[90vh] overflow-y-auto p-0 bg-white">
                                                    <TranscriptView studentId={student.id} />
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">No students found matching filters.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TranscriptReport;