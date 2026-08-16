import React, { useMemo, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getAttendanceEnriched } from '@/lib/api';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

const StudentAttendancePage = () => {
    const { user } = useAuth();
    const { classes, enrollments } = useData();
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);

    const studentId = user?.studentId || user?.id;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const rows = await getAttendanceEnriched({});
                if (!cancelled) {
                    setAttendance((rows || []).filter((a) => a.student_id === studentId));
                }
            } catch {
                if (!cancelled) setAttendance([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [studentId]);

    const myAttendance = useMemo(() => {
        return [...attendance].sort((a, b) => Number(new Date(b.date)) - Number(new Date(a.date)));
    }, [attendance]);

    const myClasses = useMemo(() => {
        const classIds = enrollments
            .filter(e => e.student_id === studentId && e.status === 'active')
            .map(e => e.class_id);
        return classes.filter(c => classIds.includes(c.id));
    }, [enrollments, classes, studentId]);

    const classStats = useMemo(() => {
        return myClasses.map(cls => {
            const records = myAttendance.filter(a => a.class_id === cls.id);
            const total = records.length;
            const present = records.filter(a => a.status === 'present').length;
            const late = records.filter(a => a.status === 'late').length;
            const absent = records.filter(a => a.status === 'absent').length;
            const rate = total > 0 ? ((present + late) / total) * 100 : 100;
            return { id: cls.id, name: cls.name, records, present, late, absent, total, rate };
        });
    }, [myClasses, myAttendance]);

    const overallStats = useMemo(() => {
        const total = myAttendance.length;
        const present = myAttendance.filter(a => a.status === 'present').length;
        const late = myAttendance.filter(a => a.status === 'late').length;
        const absent = myAttendance.filter(a => a.status === 'absent').length;
        const excused = myAttendance.filter(a => a.status === 'excused').length;
        return { total, present, late, absent, excused };
    }, [myAttendance]);

    const pieData = [
        { name: 'Present', value: overallStats.present },
        { name: 'Absent', value: overallStats.absent },
        { name: 'Late', value: overallStats.late },
        { name: 'Excused', value: overallStats.excused },
    ].filter(d => d.value > 0);

    const barData = classStats.map(c => ({
        name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
        rate: Math.round(c.rate),
    }));

    const statusBadge = (status) => {
        const map = {
            present: 'bg-emerald-500/20 text-emerald-400',
            absent: 'bg-red-500/20 text-red-400',
            late: 'bg-amber-500/20 text-amber-400',
            excused: 'bg-blue-500/20 text-blue-400',
        };
        return <Badge className={map[status] || ''}>{status}</Badge>;
    };

    if (loading) {
        return (
            <AnimatedPage>
                <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading attendance…
                </div>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage>
            <Helmet><title>My Attendance - Portal</title></Helmet>
            <PageHeader title="My Attendance" subtitle="Your attendance records across enrolled classes." />

            <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Sessions</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-white">{overallStats.total}</div></CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Present</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-emerald-400">{overallStats.present}</div></CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400 flex items-center gap-2"><Clock className="h-4 w-4" /> Late</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-amber-400">{overallStats.late}</div></CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400 flex items-center gap-2"><XCircle className="h-4 w-4" /> Absent</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-400">{overallStats.absent}</div></CardContent>
                </Card>
            </div>

            <Tabs defaultValue="records" className="space-y-4">
                <TabsList className="bg-slate-900 border border-slate-800">
                    <TabsTrigger value="records">Records</TabsTrigger>
                    <TabsTrigger value="charts">Charts</TabsTrigger>
                </TabsList>
                <TabsContent value="records">
                    <Card className="bg-slate-900/50 border-slate-800">
                        <CardContent className="pt-6">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-slate-800">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Class</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {myAttendance.length > 0 ? myAttendance.map((record) => {
                                        const cls = classes.find(c => c.id === record.class_id);
                                        return (
                                            <TableRow key={record.id} className="border-slate-800">
                                                <TableCell>{formatDate(record.date)}</TableCell>
                                                <TableCell>{cls?.name || '—'}</TableCell>
                                                <TableCell>{statusBadge(record.status)}</TableCell>
                                                <TableCell className="text-slate-500 italic text-sm">{record.notes || '-'}</TableCell>
                                            </TableRow>
                                        );
                                    }) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 text-slate-500">
                                                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                                No attendance records yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="charts">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card className="bg-slate-900/50 border-slate-800">
                            <CardHeader><CardTitle className="text-base">Status breakdown</CardTitle></CardHeader>
                            <CardContent className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                            {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip /><Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-900/50 border-slate-800">
                            <CardHeader><CardTitle className="text-base">Attendance rate by class</CardTitle></CardHeader>
                            <CardContent className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                                        <YAxis stroke="#94a3b8" domain={[0, 100]} />
                                        <Tooltip /><Bar dataKey="rate" fill="#10b981" name="Rate %" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </AnimatedPage>
    );
};

export default StudentAttendancePage;
