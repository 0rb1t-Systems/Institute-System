import React from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import UserProfileSettings from '@/components/UserProfileSettings';
import { useAuth } from '@/contexts/AuthContext';

const StaffProfilePage = () => {
  const { user, refreshUser } = useAuth();

  return (
    <AnimatedPage>
      <Helmet>
        <title>My Profile - Staff Portal</title>
      </Helmet>
      
      <PageHeader 
        title="Profile Settings" 
        subtitle="Manage your account information."
      />

      <div className="max-w-3xl mx-auto">
        <UserProfileSettings user={user} onUpdate={refreshUser} />
      </div>
    </AnimatedPage>
  );
};

export default StaffProfilePage;