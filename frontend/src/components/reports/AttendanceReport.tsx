import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileSpreadsheet, FileDown, Search, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, subMonths } from 'date-fns';
import { getAttendanceEnriched } from '@/lib/api';

const AttendanceReport = () => {
    const { classes, students, users } = useData();
    const [attendance, setAttendance] = useState([]);
    const [loadingAtt, setLoadingAtt] = useState(true);
    
    // Default range: Last 30 days
    const [dateRange, setDateRange] = useState({
        start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [classFilter, setClassFilter] = useState('all');
    const [instructorFilter, setInstructorFilter] = useState('all');
    const [studentSearch, setStudentSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingAtt(true);
            try {
                const rows = await getAttendanceEnriched({
                    dateFrom: dateRange.start,
                    dateTo: dateRange.end,
                    ...(classFilter !== 'all' ? { classId: classFilter } : {}),
                });
                if (!cancelled) setAttendance(rows || []);
            } catch {
                if (!cancelled) setAttendance([]);
            } finally {
                if (!cancelled) setLoadingAtt(false);
            }
        })();
        return () => { cancelled = true; };
    }, [dateRange.start, dateRange.end, classFilter]);

    // --- Helpers ---
    // Get unique instructors from classes
    const instructors = useMemo(() => {
        const map = new Map();
        classes.forEach(c => {
            const inst = users.find(u => u.id === c.instructor_id);
            if (inst) {
                map.set(inst.id, inst.name || inst.full_name);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [classes, users]);

    // Filter Logic
    const filteredData = useMemo(() => {
        return attendance.filter(record => {
            // Date Filter
            if (record.date < dateRange.start || record.date > dateRange.end) return false;

            // Class Filter
            if (classFilter !== 'all' && record.class_id !== classFilter) return false;

            // Instructor Filter
            if (instructorFilter !== 'all') {
                const cls = classes.find(c => c.id === record.class_id);
                if (cls?.instructor_id !== instructorFilter) return false;
            }

            // Student Search
            if (studentSearch) {
                const stu = students.find(s => s.id === record.student_id);
                if (!stu?.name.toLowerCase().includes(studentSearch.toLowerCase())) return false;
            }

            return true;
        });
    }, [attendance, dateRange, classFilter, instructorFilter, studentSearch, classes, students]);

    // --- Aggregated Stats per Student ---
    const aggregatedStudentData = useMemo(() => {
        const studentStats: any = {};

        filteredData.forEach(record => {
            if (!studentStats[record.student_id]) {
                const student = students.find(s => s.id === record.student_id);
                studentStats[record.student_id] = {
                    id: record.student_id,
                    name: student?.name || 'Unknown Student',
                    code: student?.student_code || 'N/A',
                    totalClasses: 0,
                    present: 0,
                    absent: 0,
                    late: 0,
                    excused: 0,
                };
            }

            const stats = studentStats[record.student_id];
            stats.totalClasses++;
            
            if (record.status === 'present') stats.present++;
            else if (record.status === 'absent') stats.absent++;
            else if (record.status === 'late') stats.late++;
            else if (record.status === 'excused') stats.excused++;
        });

        // Calculate Percentages
        return Object.values(studentStats).map((stat: any) => {
            // We count 'present' and 'late' as attending, 'excused' is neutral but often counts towards total
            // Calculating raw attendance rate: (Present + Late) / Total
            const rawRate = stat.totalClasses > 0 
                ? ((stat.present + stat.late) / stat.totalClasses) * 100 
                : 0;
            
            return {
                ...stat,
                attendanceRate: rawRate.toFixed(1)
            };
        }).sort((a: any, b: any) => b.attendanceRate - a.attendanceRate); // Sort by attendance high to low
    }, [filteredData, students]);

    // --- Stats & Charts ---
    const chartData = useMemo(() => {
        const daily: any = {};
        filteredData.forEach(r => {
            if (!daily[r.date]) daily[r.date] = { date: r.date, present: 0, absent: 0, late: 0, excused: 0 };
            if (r.status === 'present') daily[r.date].present++;
            else if (r.status === 'absent') daily[r.date].absent++;
            else if (r.status === 'late') daily[r.date].late++;
            else if (r.status === 'excused') daily[r.date].excused++;
        });
        return Object.values(daily).sort((a: any, b: any) => a.date.localeCompare(b.date));
    }, [filteredData]);

    const kpi = useMemo(() => {
        const total = filteredData.length;
        const present = filteredData.filter(r => r.status === 'present').length;
        const absent = filteredData.filter(r => r.status === 'absent').length;
        const late = filteredData.filter(r => r.status === 'late').length;
        const excused = filteredData.filter(r => r.status === 'excused').length;
        
        return {
            total,
            present,
            absent,
            late,
            excused,
            rate: total > 0 ? ((present + late) / total * 100).toFixed(1) : 0
        };
    }, [filteredData]);

    // --- Exports ---
    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text('Attendance Summary Report', 14, 20);
        doc.setFontSize(10);
        doc.text(`Range: ${dateRange.start} to ${dateRange.end}`, 14, 28);
        doc.text(`Total Records: ${filteredData.length}`, 14, 34);

        const rows = aggregatedStudentData.map(s => {
            return [
                s.name, 
                s.totalClasses, 
                s.present, 
                s.absent, 
                s.excused, 
                `${s.attendanceRate}%`
            ];
        });

        doc.autoTable({
            startY: 40,
            head: [['Student Name', 'Total Classes', 'Present', 'Absent', 'Excused', 'Rate']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [41, 37, 36] }
        });
        doc.save('attendance_summary_report.pdf');
    };

    const exportXLS = () => {
        const rows = aggregatedStudentData.map(s => ({
            "Student Name": s.name,
            "Student Code": s.code,
            "Total Classes": s.totalClasses,
            "Present": s.present,
            "Absent": s.absent,
            "Late": s.late,
            "Excused": s.excused,
            "Attendance Rate (%)": s.attendanceRate
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Attendance Summary");
        XLSX.writeFile(wb, "attendance_summary_data.xlsx");
    };

    const getAttendanceStatusBadge = (rate) => {
        const numRate = parseFloat(rate);
        if (numRate >= 80) return <Badge className="bg-green-900/50 text-green-400 border-green-700">Good ({rate}%)</Badge>;
        if (numRate >= 60) return <Badge className="bg-yellow-900/50 text-yellow-400 border-yellow-700">Warning ({rate}%)</Badge>;
        return <Badge className="bg-red-900/50 text-red-400 border-red-700">Poor ({rate}%)</Badge>;
    };

    return (
        <div className="space-y-6">
            {/* Advanced Filtering */}
            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-lg">Report Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Date Range (Start)</Label>
                            <Input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="bg-slate-950 border-slate-700" />
                        </div>
                        <div className="space-y-2">
                            <Label>Date Range (End)</Label>
                            <Input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="bg-slate-950 border-slate-700" />
                        </div>
                        <div className="space-y-2">
                            <Label>Filter by Class</Label>
                            <Select value={classFilter} onValueChange={setClassFilter}>
                                <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue placeholder="All Classes" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white max-h-[300px]">
                                    <SelectItem value="all">All Classes</SelectItem>
                                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Filter by Instructor</Label>
                            <Select value={instructorFilter} onValueChange={setInstructorFilter}>
                                <SelectTrigger className="bg-slate-950 border-slate-700"><SelectValue placeholder="All Instructors" /></SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                    <SelectItem value="all">All Instructors</SelectItem>
                                    {instructors.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 col-span-1 md:col-span-2">
                            <Label>Search Student</Label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                                <Input 
                                    placeholder="Search by student name..." 
                                    className="pl-8 bg-slate-950 border-slate-700"
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                />
                            </div>
                        </div>
                         <div className="flex gap-2 col-span-1 md:col-span-2 justify-end">
                            <Button onClick={exportPDF} variant="outline" className="w-full md:w-auto bg-slate-900 border-slate-700 text-white hover:bg-slate-800">
                                <FileDown className="mr-2 h-4 w-4 text-red-400" /> Export PDF
                            </Button>
                            <Button onClick={exportXLS} variant="outline" className="w-full md:w-auto bg-slate-900 border-slate-700 text-white hover:bg-slate-800">
                                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-400" /> Export XLS
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-white">{kpi.total}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Total Logs</div>
                    </CardContent>
                </Card>
                <Card className="bg-green-950/20 border-green-900/30">
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-green-400">{kpi.present}</div>
                        <div className="text-xs text-green-400/60 uppercase tracking-wider mt-1">Total Present</div>
                    </CardContent>
                </Card>
                <Card className="bg-red-950/20 border-red-900/30">
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-red-400">{kpi.absent}</div>
                        <div className="text-xs text-red-400/60 uppercase tracking-wider mt-1">Total Absent</div>
                    </CardContent>
                </Card>
                 <Card className="bg-blue-950/20 border-blue-900/30">
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-blue-400">{kpi.rate}%</div>
                        <div className="text-xs text-blue-400/60 uppercase tracking-wider mt-1">Avg. Attendance Rate</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts & Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-3 xl:col-span-1 bg-slate-900/50 border-slate-800">
                    <CardHeader>
                        <CardTitle>Daily Trends</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'MMM dd')} stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                                <Legend />
                                <Bar dataKey="present" stackId="a" fill="#22c55e" name="Present" />
                                <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" />
                                <Bar dataKey="late" stackId="a" fill="#eab308" name="Late" />
                                <Bar dataKey="excused" stackId="a" fill="#3b82f6" name="Excused" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 xl:col-span-2 bg-slate-900/50 border-slate-800">
                    <CardHeader>
                        <CardTitle>Aggregated Student Attendance</CardTitle>
                        <CardDescription>Summary of attendance performance by student.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[300px] overflow-y-auto rounded-md border border-slate-800">
                            <Table>
                                <TableHeader className="bg-slate-950 sticky top-0 z-10">
                                    <TableRow className="border-slate-800 hover:bg-transparent">
                                        <TableHead className="text-slate-300">Student Name</TableHead>
                                        <TableHead className="text-center text-slate-300">Total Classes</TableHead>
                                        <TableHead className="text-center text-slate-300 text-green-400">Present</TableHead>
                                        <TableHead className="text-center text-slate-300 text-red-400">Absent</TableHead>
                                        <TableHead className="text-center text-slate-300 text-blue-400">Excused</TableHead>
                                        <TableHead className="text-right text-slate-300">Attendance Rate</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {aggregatedStudentData.length > 0 ? aggregatedStudentData.map((stat) => (
                                        <TableRow key={stat.id} className="border-slate-800 hover:bg-slate-800/30">
                                            <TableCell className="text-slate-200 font-medium">
                                                {stat.name}
                                                <div className="text-xs text-slate-500">{stat.code}</div>
                                            </TableCell>
                                            <TableCell className="text-center text-slate-300">{stat.totalClasses}</TableCell>
                                            <TableCell className="text-center text-green-400 font-mono">{stat.present + stat.late}</TableCell>
                                            <TableCell className="text-center text-red-400 font-mono">{stat.absent}</TableCell>
                                            <TableCell className="text-center text-blue-400 font-mono">{stat.excused}</TableCell>
                                            <TableCell className="text-right">
                                                {getAttendanceStatusBadge(stat.attendanceRate)}
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                                No records match the current filters.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AttendanceReport;