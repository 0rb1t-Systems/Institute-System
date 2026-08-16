import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import UniversalIdCard from '@/components/UniversalIdCard';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';

const InstructorIdPage = () => {
  const { user } = useAuth();
  const { classes } = useData();

  // Calculate expiration based on the LATEST end date of assigned classes
  const expirationDate = useMemo(() => {
    const myClasses = classes.filter(c => c.instructor_id === user.id);
    if (myClasses.length === 0) return null;
    
    // Get max date
    const maxDate = myClasses.reduce((max: any, c: any) => {
        const current = new Date(c.end_date);
        return current > max ? current : max;
    }, new Date(0));

    return maxDate.toISOString().split('T')[0];
  }, [classes, user.id]);

  return (
    <AnimatedPage>
      <Helmet>
        <title>Instructor ID - Portal</title>
      </Helmet>
      
      <PageHeader 
        title="Digital ID Card" 
        subtitle="Your official instructor credential."
      />

      <div className="flex flex-col items-center justify-center min-h-[500px] py-12 px-4 bg-slate-900/50 rounded-xl border border-slate-800">
        <UniversalIdCard 
            user={user}
            roleLabel="INSTRUCTOR"
            department="Faculty Member"
            expirationDate={expirationDate}
            code={`INST-${user.id.substring(0,6).toUpperCase()}`}
        />
        
        <div className="text-center text-xs text-slate-500 max-w-sm mt-8">
            <p>This digital ID is valid for official use within your institution premises. Expiration is automatically synced with your active class schedule.</p>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default InstructorIdPage;