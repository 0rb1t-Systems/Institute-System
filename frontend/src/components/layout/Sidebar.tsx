import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { getNavItemsForRole, getNavSectionsForRole, resolveActiveNavHref } from '@/components/layout/navConfig';
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
        'flex items-center gap-2.5 px-3 py-2.5 text-[14px] rounded-[var(--ds-radius-md,8px)] mb-0.5 transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]/50',
        active
          ? isPlatform
            ? 'bg-teal-500/15 text-[var(--pf-text)] pointer-events-none font-semibold'
            : 'bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)] pointer-events-none font-semibold'
          : isPlatform
            ? 'font-medium text-[var(--pf-muted)] hover:bg-[var(--pf-hover)] hover:text-[var(--pf-text)]'
            : 'font-medium text-[var(--ds-text-secondary,#5B6B61)] hover:bg-[var(--ds-surface-muted,#F7FAF8)] hover:text-[var(--ds-text-primary,#122018)]'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-current opacity-90" />
      <span className="truncate">{label}</span>
    </Link>
  );

  const navItems = getNavItemsForRole(user?.role);
  const navSections = getNavSectionsForRole(user?.role);
  const activeHref = resolveActiveNavHref(location.pathname, navItems);
  const isActive = (href: string) => href === activeHref;

  return (
    <div
      className={cn(
        'hidden lg:flex flex-col h-full shrink-0 border-r',
        isPlatform
          ? 'w-[13.5rem] bg-[var(--pf-bg)] border-[var(--pf-line)]'
          : 'w-[268px] bg-[var(--ds-surface,var(--tenant-bg-2))] border-[var(--ds-border,var(--tenant-line))]',
      )}
    >
      <div
        className={cn(
          'h-[4.25rem] flex items-center px-4 border-b',
          isPlatform ? 'border-[var(--pf-line)]' : 'border-[var(--ds-border,var(--tenant-line))] px-3.5',
        )}
      >
        <Logo className="h-8 w-auto" />
      </div>

      <div
        className={cn(
          'flex-1 overflow-y-auto px-2 py-4 space-y-0.5 custom-scrollbar',
          isPlatform ? 'pt-5' : 'px-3.5 py-5',
        )}
      >
        {isPlatform ? (
          navItems.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))
        ) : (
          navSections.map((section) => (
            <div key={section.label ?? section.items[0]?.href} className="mb-1">
              {section.label ? (
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--ds-text-tertiary,#8A978E)]">
                  {section.label}
                </div>
              ) : null}
              {section.items.map((item) => (
                <NavItem key={item.href} {...item} active={isActive(item.href)} />
              ))}
            </div>
          ))
        )}
      </div>

      <div
        className={cn(
          'p-3 border-t',
          isPlatform
            ? 'border-[var(--pf-line)] bg-[var(--pf-bg-2)]'
            : 'border-[var(--ds-border,var(--tenant-line))] bg-[var(--ds-surface-muted,#F7FAF8)]',
        )}
      >
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 pl-3 text-sm',
            isPlatform
              ? 'text-red-400 hover:text-red-300 hover:bg-red-950/40'
              : 'text-[var(--ds-danger,#DC2626)] hover:text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)]',
          )}
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
