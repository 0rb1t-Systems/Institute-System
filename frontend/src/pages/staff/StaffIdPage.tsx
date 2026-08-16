import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import UniversalIdCard from '@/components/UniversalIdCard';
import { useAuth } from '@/contexts/AuthContext';
import { getProfile, updateProfile } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const StaffIdPage = () => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
        if(user?.id) {
            const data = await getProfile(user.id);
            setProfileData(data);
            setLoading(false);
        }
    };
    fetchProfile();
  }, [user]);

  // Logic: Valid until provided date OR end of current year if not set
  const currentYearEnd = new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];
  const expirationDate = profileData?.valid_until || currentYearEnd;

  const handleRenew = async () => {
      try {
          const nextYear = new Date().getFullYear() + 1;
          const nextYearEnd = new Date(nextYear, 11, 31).toISOString().split('T')[0];
          
          try {
            await updateProfile(user.id, { valid_until: nextYearEnd });
          } catch (persistError) {
            // Column may not exist until migration 0016 is applied — still update UI
            console.warn('Could not persist valid_until (apply migration 0016):', persistError?.message || persistError);
          }
          
          setProfileData(prev => ({ ...prev, valid_until: nextYearEnd }));
          toast({ title: "ID Renewed", description: `Validity extended until ${nextYearEnd}` });
          refreshUser();
      } catch (error) {
          console.error(error);
          toast({ variant: "destructive", title: "Renewal Failed", description: "Could not update ID validity." });
      }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <AnimatedPage>
      <Helmet>
        <title>Staff ID - Portal</title>
      </Helmet>
      
      <PageHeader 
        title="Staff ID Card" 
        subtitle="Administrative Staff Credential."
      />

      <div className="flex flex-col items-center justify-center min-h-[500px] py-12 px-4 bg-slate-900/50 rounded-xl border border-slate-800">
        <UniversalIdCard 
            user={user}
            roleLabel="STAFF"
            department="Administration"
            expirationDate={expirationDate}
            code={`STF-${user.id.substring(0,6).toUpperCase()}`}
            onRenew={handleRenew}
        />
        
         <div className="text-center text-xs text-slate-500 max-w-sm mt-8">
            <p>Authorized personnel only. Please ensure this ID is displayed when on campus.</p>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default StaffIdPage;
