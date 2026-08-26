import React, { useMemo, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Calendar, Clock, ArrowRight, Activity, TrendingUp, CheckCircle, Percent, LogOut, CreditCard } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAttendanceEnriched } from '@/lib/api';
import { formatCurrency, formatDate, getMonthsBetween } from '@/lib/utils';
import { goToTenantLanding } from '@/lib/institution';
import { computeStudentBalance, computeMonthlyFee } from '@/lib/finance';

const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    if (!y || !m) return ym;
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
    });
};

const StudentDashboard = () => {
    const { user, institution, loading: authLoading, logout } = useAuth();
    const { enrollments, classes, results, payments, gradebookEntries, loading: dataLoading } = useData();
    const navigate = useNavigate();

    const [attendance, setAttendance] = useState([]);
    const [loadingAttendance, setLoadingAttendance] = useState(true);

    const studentId = user?.studentId || user?.id;

    useEffect(() => {
        if (!authLoading && !user) {
            goToTenantLanding(institution, null, navigate);
        }
    }, [user, authLoading, navigate, institution]);

    useEffect(() => {
        if (!studentId) return;
        let cancelled = false;
        (async () => {
            setLoadingAttendance(true);
            try {
                const rows = await getAttendanceEnriched({ student_id: studentId });
                if (!cancelled) setAttendance(rows || []);
            } catch {
                if (!cancelled) setAttendance([]);
            } finally {
                if (!cancelled) setLoadingAttendance(false);
            }
        })();
        return () => { cancelled = true; };
    }, [studentId]);

    const myEnrollments = useMemo(() => {
        if (!studentId) return [];
        return enrollments.filter(e => e.student_id === studentId);
    }, [studentId, enrollments]);

    const activeClasses = useMemo(() => {
        return myEnrollments
            .filter(e => e.status === 'active')
            .map(e => classes.find(c => c.id === e.class_id))
            .filter(Boolean);
    }, [myEnrollments, classes]);

    const myAttendance = useMemo(() => {
        if (!studentId) return [];
        return attendance.filter(a => a.student_id === studentId);
    }, [studentId, attendance]);

    const myResults = useMemo(() => {
        if (!studentId) return [];
        return results.filter(r => r.student_id === studentId);
    }, [studentId, results]);

    const overallAttendanceStats = useMemo(() => {
        const total = myAttendance.length;
        if (total === 0) return { present: 0, absent: 0, rate: 0 };
        
        const present = myAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const absent = myAttendance.filter(a => a.status === 'absent').length;
        return {
            present,
            absent,
            rate: (present / total) * 100
        };
    }, [myAttendance]);

    const averageGrade = useMemo(() => {
        if (!studentId) return 0;
        const gbRows = (gradebookEntries || []).filter(
          (g) => g.student_id === studentId && g.final_mark != null
        );
        if (gbRows.length > 0) {
          const sum = gbRows.reduce((acc, g) => acc + Number(g.final_mark), 0);
          return sum / gbRows.length;
        }
        if (myResults.length === 0) return 0;
        const sum = myResults.reduce((acc: any, r: any) => {
          const total = Number(r.total_marks) || 100;
          return acc + ((Number(r.score) / total) * 100);
        }, 0);
        return sum / myResults.length;
    }, [studentId, myResults, gradebookEntries]);

    const myPayments = useMemo(() => {
        if (!studentId) return [];
        return payments.filter((p) => p.student_id === studentId);
    }, [payments, studentId]);

    const activeEnrollment = useMemo(() => {
        if (!studentId) return null;
        return enrollments.find((e) => e.student_id === studentId && e.status === 'active') || null;
    }, [enrollments, studentId]);

    const activeClass = useMemo(() => {
        if (!activeEnrollment) return null;
        return classes.find((c) => c.id === activeEnrollment.class_id) || null;
    }, [activeEnrollment, classes]);

    const financialSummary = useMemo(() => {
        return computeStudentBalance({
            payments: myPayments,
            activeClass,
            enrollment: activeEnrollment,
            institution,
        });
    }, [myPayments, activeClass, activeEnrollment, institution]);

    const monthlyBreakdown = useMemo(() => {
        if (!activeClass?.start_date || !activeClass?.end_date) return [];
        const months = getMonthsBetween(activeClass.start_date, activeClass.end_date);
        const monthlyFee = computeMonthlyFee(activeClass, activeEnrollment);
        const paidByMonth = new Map<string, number>();

        myPayments.forEach((p) => {
            if (p.is_registration_fee) return;
            if (p.status && p.status !== 'completed') return;
            const key = p.month_paid ? String(p.month_paid).slice(0, 7) : null;
            if (!key) return;
            paidByMonth.set(key, (paidByMonth.get(key) || 0) + Number(p.amount || 0));
        });

        return months.map((month) => {
            const paidAmount = paidByMonth.get(month) || 0;
            const remaining = Math.max(0, monthlyFee - paidAmount);
            const status =
                paidAmount <= 0 ? 'unpaid' : remaining > 0 ? 'partial' : 'paid';
            return {
                month,
                label: formatMonthLabel(month),
                monthlyFee,
                paidAmount,
                remaining,
                status,
            };
        });
    }, [activeClass, activeEnrollment, myPayments]);

    const handleLogout = async () => {
        await logout();
        goToTenantLanding(institution, user?.role, navigate);
    };

    if (authLoading || dataLoading || loadingAttendance) {
        return <div className="p-8 text-slate-400 flex justify-center mt-20">Loading your dashboard...</div>;
    }

    if (!user) return null;

    return (
        <AnimatedPage>
            <Helmet><title>Dashboard - Student Portal</title></Helmet>

            {/* Profile Overview Header */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 shadow-sm mb-8 flex flex-col md:flex-row items-center gap-6">
                <Avatar className="h-24 w-24 border-4 border-slate-800 shadow-sm">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="bg-indigo-600 text-3xl font-bold text-white">
                        {user?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold text-white mb-1">Welcome, {user?.name}</h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm">
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-mono text-base px-3 py-1">
                            {user?.studentCode || 'N/A'}
                        </Badge>
                        <span className="text-slate-400">{user?.email}</span>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto justify-center mt-4 md:mt-0">
                    <Button variant="outline" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={() => navigate('/student/profile')}>
                        Profile
                    </Button>
                    <Button variant="destructive" className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" /> Logout
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                <Card className="bg-slate-900/50 border-slate-800 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute top-4 right-4 p-2.5 rounded-full bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                        <BookOpen className="h-6 w-6" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Active Classes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-white">{activeClasses.length}</div>
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <Activity className="h-3 w-3 text-blue-400" /> Enrolled courses
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 relative overflow-hidden group hover:border-green-500/50 transition-colors">
                    <div className="absolute top-4 right-4 p-2.5 rounded-full bg-green-500/10 text-green-500 group-hover:bg-green-500/20 transition-colors">
                        <CheckCircle className="h-6 w-6" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Overall Attendance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-white flex items-baseline gap-1">
                            {overallAttendanceStats.rate.toFixed(0)}<span className="text-2xl text-slate-500">%</span>
                        </div>
                        <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full transition-all duration-1000" style={{ width: `${overallAttendanceStats.rate}%` }}></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                    <div className="absolute top-4 right-4 p-2.5 rounded-full bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Avg Grade Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="text-4xl font-bold text-white flex items-baseline gap-1">
                            {averageGrade.toFixed(1)}<span className="text-2xl text-slate-500">%</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <Percent className="h-3 w-3 text-purple-400" /> Across {myResults.length} exams
                        </p>
                    </CardContent>
                </Card>

                <Card
                    className="bg-slate-900/50 border-slate-800 relative overflow-hidden group hover:border-amber-500/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/portal/finance')}
                >
                    <div className="absolute top-4 right-4 p-2.5 rounded-full bg-amber-500/15 text-amber-500 group-hover:bg-amber-500/25 transition-colors">
                        <CreditCard className="h-6 w-6" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Outstanding Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${financialSummary.balance > 0 ? 'text-rose-500' : 'text-green-400'}`}>
                            {formatCurrency(financialSummary.balance)}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Paid {formatCurrency(financialSummary.totalPaid)} · View finance
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Monthly balance breakdown */}
            {monthlyBreakdown.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-800 mb-8">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <CardTitle className="text-lg text-white flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-indigo-400" /> Monthly Balance
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {activeClass?.name
                                    ? `Tuition months for ${activeClass.name}`
                                    : 'Tuition months for your active class'}
                                {financialSummary.monthlyFee > 0
                                    ? ` · ${formatCurrency(financialSummary.monthlyFee)} / month`
                                    : ''}
                            </CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 self-start sm:self-auto"
                            onClick={() => navigate('/portal/finance')}
                        >
                            Full finance <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {monthlyBreakdown.map((row) => (
                                <div
                                    key={row.month}
                                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 flex items-center justify-between gap-3 transition-colors hover:border-indigo-500/40 hover:bg-slate-800/40"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-slate-200">{row.label}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {row.status === 'paid'
                                                ? `Paid ${formatCurrency(row.paidAmount)}`
                                                : row.status === 'partial'
                                                  ? `Paid ${formatCurrency(row.paidAmount)} · Due ${formatCurrency(row.remaining)}`
                                                  : `Due ${formatCurrency(row.monthlyFee)}`}
                                        </div>
                                    </div>
                                    {row.status === 'paid' ? (
                                        <Badge className="bg-green-900/30 text-green-400 border-green-900 shrink-0">Paid</Badge>
                                    ) : row.status === 'partial' ? (
                                        <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-900 shrink-0">Partial</Badge>
                                    ) : (
                                        <Badge className="bg-red-900/30 text-red-400 border-red-900 shrink-0">Unpaid</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                        {financialSummary.regBalance > 0 && (
                            <p className="text-sm text-amber-400/90 mt-4">
                                Registration fee still due: {formatCurrency(financialSummary.regBalance)}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content: Active Classes */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-indigo-400" /> My Current Classes
                        </h2>
                        <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10" onClick={() => navigate('/student/classes')}>
                            View All <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                    </div>

                    {activeClasses.length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-4">
                            {activeClasses.map(cls => (
                                <Card key={cls.id} className="bg-slate-900/50 border-slate-800 hover:border-indigo-500/50 transition-colors">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg text-slate-200 leading-tight">{cls.name}</CardTitle>
                                        <CardDescription className="flex items-center gap-2 text-slate-400 mt-1">
                                            <Calendar className="h-3 w-3" /> {formatDate(cls.start_date)}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex justify-between items-center mt-2">
                                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Active</Badge>
                                            <Button variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-white hover:bg-slate-800/40" onClick={() => navigate(`/student/classes`)}>
                                                Details
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="bg-slate-900/30 border border-dashed border-slate-800">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <BookOpen className="h-12 w-12 text-slate-600 mb-3" />
                                <h3 className="text-lg font-medium text-slate-300 mb-1">No Active Classes</h3>
                                <p className="text-slate-500 text-sm max-w-sm">You are not currently enrolled in any active classes. Contact your institution if this looks wrong.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar: Quick Actions */}
                <div className="space-y-6">
                    <Card className="bg-slate-900/50 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-5 w-5 text-indigo-400" /> Quick Actions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Link to="/portal/gradebook" className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/40 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-md text-indigo-400 group-hover:bg-indigo-500/20">
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-slate-200">My Grades</span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                            </Link>
                            
                            <Link to="/portal/attendance" className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-green-500/50 hover:bg-slate-800/40 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-md text-green-400 group-hover:bg-green-500/20">
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-slate-200">Attendance Log</span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-green-400 transition-colors" />
                            </Link>

                            <Link to="/portal/finance" className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-yellow-500/50 hover:bg-slate-800/40 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/10 rounded-md text-yellow-400 group-hover:bg-yellow-500/20">
                                        <TrendingUp className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-slate-200">Financial Status</span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-yellow-400 transition-colors" />
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AnimatedPage>
    );
};

export default StudentDashboard;