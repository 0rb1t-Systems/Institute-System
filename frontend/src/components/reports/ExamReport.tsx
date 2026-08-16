import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { isExamPassed } from '@/lib/examPass';

const COLORS = ['#00C49F', '#FF8042', '#FFBB28', '#0088FE'];

const ExamReport = () => {
    const { results, exams, students, classes, courses } = useData();
    
    const [classFilter, setClassFilter] = useState('all');
    const [courseFilter, setCourseFilter] = useState('all');
    const [studentFilter, setStudentFilter] = useState('');

    // --- Data Filtering ---
    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const exam = exams.find(e => e.id === r.exam_id);
            const student = students.find(s => s.id === r.student_id);
            if (!exam || !student) return false;

            const examClass = classes.find(c => c.id === exam.class_id);
            
            // Class Filter
            if (classFilter !== 'all' && exam.class_id !== classFilter) return false;
            
            // Course Filter
            if (courseFilter !== 'all' && examClass?.course_id !== courseFilter) return false;

            // Student Filter
            if (studentFilter) {
                const term = studentFilter.toLowerCase();
                if (!student.name.toLowerCase().includes(term) && !student.student_code.toLowerCase().includes(term)) return false;
            }

            return true;
        });
    }, [results, exams, students, classes, classFilter, courseFilter, studentFilter]);

    // --- Chart Data ---
    
    // 1. Pass/Fail Distribution
    const passFailData = useMemo(() => {
        let passed = 0;
        let failed = 0;
        filteredResults.forEach(r => {
            const exam = exams.find(e => e.id === r.exam_id);
            if (isExamPassed(r.final_score ?? r.score, exam)) passed++; else failed++;
        });
        return [
            { name: 'Passed', value: passed },
            { name: 'Failed', value: failed }
        ];
    }, [filteredResults, exams]);

    // 2. Average Score by Exam (Top 5 in filtered set)
    const avgScoreData = useMemo(() => {
        const examMap: any = {};
        filteredResults.forEach(r => {
            if (!examMap[r.exam_id]) {
                const exam = exams.find(e => e.id === r.exam_id);
                examMap[r.exam_id] = { name: exam?.title || 'Unknown', total: 0, count: 0 };
            }
            examMap[r.exam_id].total += r.final_score;
            examMap[r.exam_id].count += 1;
        });
        
        return Object.values(examMap)
            .map((e: any) => ({ name: e.name, average: Math.round(e.total / e.count) }))
            .slice(0, 10); // Top 10 to fit chart
    }, [filteredResults, exams]);


    const generatePDF = () => {
        const doc = new jsPDF();
        doc.text(`Examination Report`, 14, 20);
        
        const tableRows = filteredResults.map(r => {
            const exam = exams.find(e => e.id === r.exam_id);
            const student = students.find(s => s.id === r.student_id);
            const status = isExamPassed(r.final_score ?? r.score, exam) ? 'Passed' : 'Failed';
            return [
                formatDate(r.submission_date),
                student?.name || 'Unknown',
                exam?.title || 'Unknown',
                `${r.final_score}/${r.total_marks}`,
                status
            ];
        });

        doc.autoTable({
            startY: 30,
            head: [['Date', 'Student', 'Exam', 'Score', 'Status']],
            body: tableRows,
        });
        doc.save('Exam_Report.pdf');
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="grid gap-2 w-full md:min-w-[200px] min-w-0">
                    <Label className="text-white">Filter by Class</Label>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue placeholder="All Classes" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
                            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2 w-full md:min-w-[200px] min-w-0">
                    <Label className="text-white">Filter by Course</Label>
                    <Select value={courseFilter} onValueChange={setCourseFilter}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue placeholder="All Courses" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Courses</SelectItem>
                            {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2 flex-1 min-w-0 w-full">
                    <Label className="text-white">Search Student</Label>
                    <Input 
                        placeholder="Student Name..." 
                        value={studentFilter} 
                        onChange={e => setStudentFilter(e.target.value)} 
                        className="bg-slate-950 border-slate-700 text-white"
                    />
                </div>
                <div className="flex items-end">
                     <Button onClick={generatePDF} variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export PDF</Button>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Performance Overview</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={passFailData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, value }) => `${name}: ${value}`}
                                >
                                    {passFailData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Average Scores by Exam</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={avgScoreData} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 100]} />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                <Tooltip />
                                <Bar dataKey="average" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardHeader><CardTitle>Detailed Results</CardTitle></CardHeader>
                <CardContent>
                     <div className="rounded-md border max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Exam Title</TableHead>
                                    <TableHead className="text-center">Score</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredResults.length > 0 ? (
                                    filteredResults.map(r => {
                                        const exam = exams.find(e => e.id === r.exam_id);
                                        const student = students.find(s => s.id === r.student_id);
                                        const isPassed = isExamPassed(r.final_score ?? r.score, exam);
                                        return (
                                            <TableRow key={r.id}>
                                                <TableCell>{formatDate(r.submission_date)}</TableCell>
                                                <TableCell className="font-medium">{student?.name || 'Unknown'}</TableCell>
                                                <TableCell>{exam?.title || 'Unknown'}</TableCell>
                                                <TableCell className="text-center font-bold">{r.final_score} / {r.total_marks}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${isPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {isPassed ? 'PASSED' : 'FAILED'}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-4">No results match your filters.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ExamReport;