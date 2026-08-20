import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { getNavItemsForRole, resolveActiveNavHref } from '@/components/layout/navConfig';
import { goToTenantLanding } from '@/lib/institution';

const Sidebar = () => {
  const { user, institution, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    goToTenantLanding(institution, user?.role, navigate);
  };

  const NavItem = ({ href, icon: Icon, label, active }) => (
    <Link
      to={href}
      replace={active}
      onClick={(e) => {
        if (active) e.preventDefault();
      }}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md mb-1 relative overflow-hidden',
        'outline-none focus-visible:ring-2 focus-visible:ring-slate-600',
        active
          ? 'bg-slate-800 text-white pointer-events-none border-l-2 border-blue-500 pl-[10px]'
          : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-current opacity-90" />
      <span className="truncate">{label}</span>
    </Link>
  );

  const navItems = getNavItemsForRole(user?.role);
  const activeHref = resolveActiveNavHref(location.pathname, navItems);
  const isActive = (href: string) => href === activeHref;

  return (
    <div className="hidden lg:flex flex-col h-full bg-slate-950 border-r border-slate-800 w-64 shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-800/50">
        <Logo className="h-8 w-auto" />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-6 space-y-1 custom-scrollbar">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2 mt-1">
          {user?.role === 'super_admin' ? 'Platform' : 'Main Menu'}
        </div>
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-900/30">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 pl-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/40"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
