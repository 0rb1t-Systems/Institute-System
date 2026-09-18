import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Menu, Settings, LogOut, RefreshCw, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/platform/ThemeToggle';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notify';
import {
  getNavItemsForRole,
  getNavSectionsForRole,
  resolveActiveNavHref,
} from '@/components/layout/navConfig';
import { goToTenantLanding } from '@/lib/institution';

const Header = () => {
  const { user, institution, logout } = useAuth();
  const { refreshData, loading } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isPlatform = user?.role === 'super_admin';

  const navItems = getNavItemsForRole(user?.role);
  const navSections = getNavSectionsForRole(user?.role);

  const handleLogout = async () => {
    setSheetOpen(false);
    await logout();
    goToTenantLanding(institution, user?.role, navigate);
  };
  const activeHref = resolveActiveNavHref(location.pathname, navItems);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => {
      setIsRefreshing(false);
      notify.success('Data has been refreshed successfully.');
    }, 800);
  };

  const getProfilePath = () => {
    switch (user?.role) {
      case 'super_admin':
        return '/super-admin/profile';
      case 'admin':
        return '/admin/profile';
      case 'instructor':
        return '/instructor/profile';
      case 'student':
        return '/student/profile';
      case 'staff':
        return '/staff/profile';
      case 'affiliate':
        return '/affiliate/profile';
      default:
        return '/dashboard';
    }
  };

  const iconBtnClass = isPlatform
    ? 'text-[var(--pf-muted)] hover:text-[var(--pf-text)] hover:bg-[var(--pf-hover)]'
    : 'h-9 w-9 rounded-[var(--ds-radius-md,8px)] text-[var(--ds-text-secondary,#5B6B61)] hover:bg-[var(--ds-surface-muted,#F7FAF8)] hover:text-[var(--ds-text-primary,#122018)]';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-[4.25rem] min-w-0 items-center gap-2 border-b px-3 sm:px-5',
        isPlatform
          ? 'border-[var(--pf-line)] bg-[var(--pf-bg)]/92 backdrop-blur-xl'
          : 'h-14 border-[var(--ds-border,var(--tenant-line))] bg-[var(--ds-bg,var(--tenant-bg))]/90 backdrop-blur-xl sm:static sm:h-16 sm:border-0 sm:bg-transparent sm:px-7',
      )}
    >
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className={cn(
              'shrink-0 lg:hidden',
              isPlatform
                ? 'border-[var(--pf-line)] bg-[var(--pf-surface)] text-[var(--pf-text)]'
                : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] text-[var(--ds-text-primary,#122018)]',
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className={cn(
            'flex w-[min(100vw-2rem,300px)] flex-col border-r p-0',
            isPlatform
              ? 'border-[var(--pf-line)] bg-[var(--pf-bg)] text-[var(--pf-text)]'
              : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] text-[var(--ds-text-primary,#122018)]',
          )}
        >
          <div
            className={cn(
              'flex h-20 shrink-0 items-center justify-center border-b p-4',
              isPlatform
                ? 'border-[var(--pf-line)] bg-[var(--pf-bg-2)]'
                : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)]',
            )}
          >
            <Logo className="h-10" />
          </div>
          <nav className="grid flex-1 gap-1 overflow-y-auto p-4">
            {isPlatform ? (
              <>
                <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--pf-faint)]">
                  Platform
                </div>
                {navItems.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <SheetClose asChild key={item.href}>
                      <Link
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors',
                          active
                            ? 'border-l-2 border-teal-500 bg-teal-500/15 pl-[10px] text-[var(--pf-text)]'
                            : 'text-[var(--pf-muted)] hover:bg-[var(--pf-hover)]',
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="truncate font-medium">{item.label}</span>
                      </Link>
                    </SheetClose>
                  );
                })}
              </>
            ) : (
              navSections.map((section) => (
                <div key={section.label ?? section.items[0]?.href} className="mb-2">
                  {section.label ? (
                    <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--ds-text-tertiary,#8A978E)]">
                      {section.label}
                    </div>
                  ) : null}
                  {section.items.map((item) => {
                    const active = item.href === activeHref;
                    return (
                      <SheetClose asChild key={item.href}>
                        <Link
                          to={item.href}
                          className={cn(
                            'flex items-center gap-3 rounded-[var(--ds-radius-md,8px)] px-3 py-2.5 transition-colors',
                            active
                              ? 'bg-[var(--ds-primary-soft,#ECFDF5)] font-semibold text-[var(--ds-primary,#1F8A5B)]'
                              : 'text-[var(--ds-text-secondary,#5B6B61)] hover:bg-[var(--ds-surface-muted,#F7FAF8)] hover:text-[var(--ds-text-primary,#122018)]',
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="truncate font-medium">{item.label}</span>
                        </Link>
                      </SheetClose>
                    );
                  })}
                </div>
              ))
            )}
          </nav>
          <div
            className={cn(
              'shrink-0 space-y-2 border-t p-3',
              isPlatform ? 'border-[var(--pf-line)]' : 'border-[var(--ds-border,#DDE5DF)]',
            )}
          >
            {isPlatform ? (
              <ThemeToggle className="mb-1" />
            ) : (
              <ThemeToggle variant="brand" className="mb-1" />
            )}
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-sm',
                isPlatform
                  ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
                  : 'text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)]',
              )}
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {isPlatform ? (
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <Logo className="h-8" />
        </div>
      ) : null}

      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {isPlatform ? <ThemeToggle /> : <ThemeToggle variant="brand" />}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          className={iconBtnClass}
          title="Refresh System Data"
        >
          <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin text-primary')} />
        </Button>

        <Button variant="ghost" size="icon" className={cn('relative hidden sm:inline-flex', iconBtnClass)}>
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--ds-danger,#DC2626)] ring-2 ring-[var(--ds-surface,#fff)]" />
        </Button>

        <div
          className={cn(
            'mx-1 hidden h-7 w-px sm:block',
            isPlatform ? 'bg-[var(--pf-line)]' : 'bg-[var(--ds-border,#DDE5DF)]',
          )}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'flex h-auto max-w-[min(100vw-8rem,16rem)] items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-1 transition-all sm:gap-3 sm:pl-2',
                isPlatform ? 'hover:bg-[var(--pf-hover)]' : 'hover:bg-[var(--ds-surface-muted,#F7FAF8)]',
              )}
            >
              <div className="hidden min-w-0 text-right md:block">
                <p
                  className={cn(
                    'truncate text-sm font-semibold leading-none',
                    isPlatform
                      ? 'text-[var(--pf-text)]'
                      : 'text-[var(--ds-text-primary,var(--tenant-text))]',
                  )}
                >
                  {user?.name}
                </p>
                <p
                  className={cn(
                    'mt-1 truncate text-xs capitalize',
                    isPlatform
                      ? 'text-[var(--pf-faint)]'
                      : 'font-medium text-[var(--ds-text-secondary,var(--tenant-muted))]',
                  )}
                >
                  {user?.role}
                </p>
              </div>
              <Avatar
                className={cn(
                  'h-8 w-8 shrink-0 border-2 sm:h-9 sm:w-9',
                  isPlatform ? 'border-[var(--pf-line)]' : 'border-[var(--ds-border,#DDE5DF)]',
                )}
              >
                <AvatarImage src={user?.avatar_url} alt={user?.name} />
                <AvatarFallback className="bg-primary font-bold text-primary-foreground">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(
              'w-56',
              isPlatform
                ? 'border-[var(--pf-line)] bg-[var(--pf-surface)] text-[var(--pf-text)]'
                : 'border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] text-[var(--ds-text-primary,#122018)]',
            )}
          >
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator
              className={isPlatform ? 'bg-slate-800' : 'bg-[var(--ds-border,#DDE5DF)]'}
            />
            <Link to={getProfilePath()}>
              <DropdownMenuItem
                className={cn(
                  'cursor-pointer',
                  isPlatform
                    ? 'hover:bg-slate-800 focus:bg-slate-800'
                    : 'hover:bg-[var(--ds-surface-muted,#F7FAF8)] focus:bg-[var(--ds-surface-muted,#F7FAF8)]',
                )}
              >
                <Settings className="mr-2 h-4 w-4" />
                {user?.role === 'super_admin' ? 'Profile' : 'Settings'}
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator
              className={isPlatform ? 'bg-slate-800' : 'bg-[var(--ds-border,#DDE5DF)]'}
            />
            <DropdownMenuItem
              onClick={handleLogout}
              className={cn(
                'cursor-pointer',
                isPlatform
                  ? 'text-red-400 hover:bg-red-950/50 hover:text-red-300 focus:bg-red-950/50'
                  : 'text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)] focus:bg-[var(--ds-danger-bg,#FEF2F2)]',
              )}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
