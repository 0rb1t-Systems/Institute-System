import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import TranscriptView from '@/components/TranscriptView';
import { Loader2 } from 'lucide-react';

const StudentTranscriptPage = () => {
  const { user } = useAuth();
  const { students } = useData();

  const studentId = useMemo(() => {
    if (!user) return null;
    if (user.studentId) return user.studentId;
    const match = (students || []).find(
      (stu) =>
        stu.id === user.id ||
        stu.profile_id === user.id ||
        stu.user_id === user.id
    );
    return match?.id || (user.role === 'student' ? user.id : null);
  }, [user, students]);

  if (!studentId) {
    return (
      <div className="h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>My Transcript - Portal</title>
      </Helmet>
      <PageHeader title="Academic Transcript" subtitle="Your detailed academic performance record." />
      <div className="mt-6">
        <TranscriptView studentId={studentId} />
      </div>
    </AnimatedPage>
  );
};

export default StudentTranscriptPage;
