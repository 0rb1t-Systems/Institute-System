import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import StudentProfileSettings from '@/components/student/StudentProfileSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';

const StudentProfilePage = () => {
    const { user, refreshUser } = useAuth();
    const { students, refreshData } = useData();

    const student = useMemo(() => {
        if (!user) return null;
        // The student record may not have profile_id right away after creation,
        // so we check both profile_id and the studentId stored in the auth user context.
        return students.find(s => s.profile_id === user.id || s.id === user.studentId);
    }, [user, students]);

    const handleUpdate = async () => {
        // Refresh both auth user data (for avatar, name) and global data context
        await Promise.all([refreshUser(), refreshData()]);
    };

    if (!student) return <div>Loading profile...</div>;

    return (
        <AnimatedPage>
            <Helmet><title>My Profile - Portal</title></Helmet>
            <PageHeader title="My Profile" subtitle="Manage your personal information." />
            
            <div className="max-w-3xl mx-auto">
                <StudentProfileSettings student={student} onUpdate={handleUpdate} />
            </div>
        </AnimatedPage>
    );
};

export default StudentProfilePage;