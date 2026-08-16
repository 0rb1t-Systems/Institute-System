import React, { useMemo, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Calendar, Clock, ArrowRight, Activity, TrendingUp, CheckCircle, Percent, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAttendanceEnriched } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const StudentDashboard = () => {
    const { user, loading: authLoading, logout } = useAuth();
    const { enrollments, classes, results, loading: dataLoading } = useData();
    const navigate = useNavigate();

    const [attendance, setAttendance] = useState([]);
    const [loadingAttendance, setLoadingAttendance] = useState(true);

    const studentId = user?.studentId || user?.id;

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/login');
        }
    }, [user, authLoading, navigate]);

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
        if (myResults.length === 0) return 0;
        const sum = myResults.reduce((acc: any, r: any) => acc + ((r.score / r.total_marks) * 100), 0);
        return sum / myResults.length;
    }, [myResults]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (authLoading || dataLoading || loadingAttendance) {
        return <div className="p-8 text-slate-400 flex justify-center mt-20">Loading your dashboard...</div>;
    }

    if (!user) return null;

    return (
        <AnimatedPage>
            <Helmet><title>Dashboard - Student Portal</title></Helmet>

            {/* Profile Overview Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950/30 rounded-2xl p-6 border border-slate-800 shadow-xl mb-8 flex flex-col md:flex-row items-center gap-6">
                <Avatar className="h-24 w-24 border-4 border-slate-800 shadow-lg">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-slate-900/50 border-slate-800 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BookOpen className="h-16 w-16 text-blue-500" />
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
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Overall Attendance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-white flex items-baseline gap-1">
                            {overallAttendanceStats.rate.toFixed(0)}<span className="text-2xl text-slate-500">%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full transition-all duration-1000" style={{ width: `${overallAttendanceStats.rate}%` }}></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-16 w-16 text-purple-500" />
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
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Content: Active Classes */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-indigo-400" /> My Current Classes
                        </h2>
                        <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-indigo-300" onClick={() => navigate('/student/classes')}>
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
                                            <Button variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-white" onClick={() => navigate(`/student/classes`)}>
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
                            <Link to="/portal/gradebook" className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-md text-indigo-400 group-hover:bg-indigo-500/20">
                                        <Activity className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-slate-200">My Grades</span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                            </Link>
                            
                            <Link to="/portal/attendance" className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-green-500/50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-500/10 rounded-md text-green-400 group-hover:bg-green-500/20">
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-slate-200">Attendance Log</span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-green-400 transition-colors" />
                            </Link>

                            <Link to="/portal/finance" className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-yellow-500/50 transition-colors group">
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