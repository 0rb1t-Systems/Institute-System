import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const MainLayout = () => {
  const { user } = useAuth();
  const isPlatform = user?.role === 'super_admin';

  return (
    <div
      className={cn(
        'flex h-screen overflow-hidden',
        isPlatform
          ? 'platform-shell text-[var(--pf-text)]'
          : 'tenant-shell bg-[var(--tenant-bg)] text-[var(--tenant-text)]',
      )}
    >
      <Sidebar />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Header />
        <main
          className={cn(
            'flex-1 overflow-x-hidden overflow-y-auto',
            isPlatform
              ? 'platform-main p-4 lg:p-5'
              : 'bg-[var(--ds-bg,var(--tenant-bg))] p-4 md:px-7 md:pb-7 md:pt-2',
          )}
        >
          <div className="h-full w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
