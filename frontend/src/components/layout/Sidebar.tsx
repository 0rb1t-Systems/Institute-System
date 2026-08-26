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
  const isPlatform = user?.role === 'super_admin';

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
        'flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium rounded-lg mb-0.5',
        'outline-none focus-visible:ring-2 focus-visible:ring-teal-700/50',
        active
          ? isPlatform
            ? 'bg-teal-500/15 text-[var(--pf-text)] pointer-events-none'
            : 'bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--tenant-text)] pointer-events-none border-l-2 pl-[10px]'
          : isPlatform
            ? 'text-[var(--pf-muted)] hover:bg-[var(--pf-hover)] hover:text-[var(--pf-text)]'
            : 'text-[var(--tenant-muted)] hover:bg-[var(--tenant-line)] hover:text-[var(--tenant-text)]'
      )}
      style={!isPlatform && active ? { borderLeftColor: 'var(--brand-primary)' } : undefined}
    >
      <Icon className="h-4 w-4 shrink-0 text-current opacity-90" />
      <span className="truncate">{label}</span>
    </Link>
  );

  const navItems = getNavItemsForRole(user?.role);
  const activeHref = resolveActiveNavHref(location.pathname, navItems);
  const isActive = (href: string) => href === activeHref;

  return (
    <div
      className={cn(
        'hidden lg:flex flex-col h-full shrink-0 border-r',
        isPlatform
          ? 'w-[13.5rem] bg-[var(--pf-bg)] border-[var(--pf-line)]'
          : 'w-64 bg-[var(--tenant-bg-2)] border-[var(--tenant-line)]',
      )}
    >
      <div
        className={cn(
          'h-[4.25rem] flex items-center px-4 border-b',
          isPlatform ? 'border-[var(--pf-line)]' : 'border-[var(--tenant-line)]',
        )}
      >
        <Logo className="h-8 w-auto" />
      </div>

      <div className={cn('flex-1 overflow-y-auto px-2 py-4 space-y-0.5 custom-scrollbar', isPlatform && 'pt-5')}>
        {isPlatform ? null : (
        <div
          className="text-[10px] font-bold uppercase tracking-wider text-[var(--tenant-muted)] px-3 mb-2 mt-1"
        >
          Main Menu
        </div>
        )}
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </div>

      <div
        className={cn(
          'p-3 border-t',
          isPlatform ? 'border-[var(--pf-line)] bg-[var(--pf-bg-2)]' : 'border-[var(--tenant-line)] bg-[var(--tenant-bg)]',
        )}
      >
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
