import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import StudentIdCard from '@/components/StudentIdCard';
import { Loader2, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const StudentPortalIdPage = () => {
    const { user, loading: authLoading } = useAuth();
    const { students, enrollments, classes, courses, diplomas, payments, loading: dataLoading } = useData();
    const navigate = useNavigate();

    const student = useMemo(() => {
        if (!user) return null;
        const foundStudent = students.find(s => s.profile_id === user.id) || students.find(s => s.email === user.email);
        if (foundStudent) {
             return {
                ...foundStudent,
                avatar_url: user.avatar_url || foundStudent.avatar_url
            };
        }
        return null;
    }, [students, user]);

    const enrollment = useMemo(() => {
        if (!student) return null;
        return enrollments.find(e => e.student_id === student.id && e.status === 'active');
    }, [student, enrollments]);

    const classData = useMemo(() => {
        if (!enrollment) return null;
        const cls = classes.find(c => c.id === enrollment.class_id);
        if (!cls) return null;
        const course = cls.course_id ? courses.find(c => c.id === cls.course_id) : null;
        const diploma = cls.diploma_id ? diplomas.find(d => d.id === cls.diploma_id) : null;
        return { ...cls, course: course || null, diploma: diploma || null };
    }, [enrollment, classes, courses, diplomas]);

    const course = useMemo(() => {
        if (!classData) return null;
        if (classData.course) return classData.course;
        if (classData.diploma) {
            return { name: classData.diploma.name, duration: classData.duration_months };
        }
        return null;
    }, [classData]);

    const enrichedEnrollment = useMemo(() => {
        if (!enrollment) return null;
        return { ...enrollment, class: classData };
    }, [enrollment, classData]);

    const paymentStatus = useMemo(() => {
        if (!student) return { totalPaid: 0 };
        const myPayments = payments.filter(p => p.student_id === student.id);
        const totalPaid = myPayments.reduce((sum: any, p: any) => sum + Number(p.amount), 0);
        return { totalPaid };
    }, [student, payments]);

    if (authLoading || dataLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!student) {
        return (
            <AnimatedPage>
                 <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                    <div className="bg-yellow-500/10 p-4 rounded-full mb-4">
                         <AlertCircle className="h-8 w-8 text-yellow-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-white">Student Profile Not Found</h2>
                    <p className="text-slate-400 mt-2 max-w-md">
                        We couldn't find your student records. Please contact the administration.
                    </p>
                    <Button variant="link" onClick={() => navigate('/portal')}>Return to Dashboard</Button>
                </div>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage>
            <Helmet>
                <title>My ID Card - Portal</title>
            </Helmet>
            
            <div className="container max-w-4xl mx-auto py-8 px-4">
                <div className="flex items-center mb-8">
                    <Button variant="ghost" onClick={() => navigate('/portal')} className="mr-4 hover:bg-slate-800 text-slate-300">
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <h1 className="text-2xl font-bold text-white">Digital ID Card</h1>
                </div>

                <div className="flex flex-col items-center justify-center py-16 bg-slate-900/50 border border-slate-800 rounded-xl shadow-inner min-h-[600px]">
                    
                    {enrollment ? (
                        paymentStatus.totalPaid > 0 ? (
                            <StudentIdCard
                                student={student}
                                enrollment={enrichedEnrollment}
                                course={course}
                                classData={classData}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 border border-red-500/30 bg-red-500/10 rounded-xl max-w-md mx-auto text-center space-y-4">
                                <div className="bg-red-500/20 p-3 rounded-full">
                                    <Lock className="h-8 w-8 text-red-500" />
                                </div>
                                <h3 className="text-lg font-bold text-white">ID Card Locked</h3>
                                <p className="text-slate-300 text-sm font-medium leading-relaxed">
                                    "Weli ma dhamaystirna Ardeynimadaada fadlan booqo xafiska oo buuxi hanaanka diwan gelinta"
                                </p>
                                <p className="text-xs text-slate-500">
                                    Please make a payment to generate your student ID.
                                </p>
                            </div>
                        )
                    ) : (
                        <div className="text-center text-yellow-500 p-6 border border-yellow-500/20 bg-yellow-500/10 rounded-lg max-w-md">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                            <h3 className="font-semibold">No Active Enrollment</h3>
                            <p className="text-sm mt-1 opacity-80">You need to be enrolled in a class to generate a Student ID.</p>
                        </div>
                    )}
                </div>
            </div>
        </AnimatedPage>
    );
};

export default StudentPortalIdPage;