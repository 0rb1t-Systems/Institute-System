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
import { getNavItemsForRole, resolveActiveNavHref } from '@/components/layout/navConfig';
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

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-[4.25rem] items-center gap-2 border-b px-3 sm:px-5 min-w-0',
        isPlatform
          ? 'border-[var(--pf-line)] bg-[var(--pf-bg)]/92 backdrop-blur-xl'
            : 'h-14 sm:h-16 border-[var(--tenant-line)] bg-[var(--tenant-bg)]/85 backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:px-8',
      )}
    >
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className={cn(
              'lg:hidden shrink-0',
              isPlatform
                ? 'bg-[var(--pf-surface)] border-[var(--pf-line)] text-[var(--pf-text)]'
                : 'bg-[var(--tenant-surface)] border-[var(--tenant-line)] text-[var(--tenant-text)]',
            )}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className={cn(
            'w-[min(100vw-2rem,300px)] p-0 flex flex-col border-r',
            isPlatform
              ? 'bg-[var(--pf-bg)] border-[var(--pf-line)] text-[var(--pf-text)]'
              : 'bg-[var(--tenant-bg-2)] border-[var(--tenant-line)] text-[var(--tenant-text)]',
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center h-20 p-4 border-b shrink-0',
              isPlatform ? 'bg-[var(--pf-bg-2)] border-[var(--pf-line)]' : 'bg-[var(--tenant-bg)] border-[var(--tenant-line)]',
            )}
          >
            <Logo className="h-10" />
          </div>
          <nav className="grid gap-1 p-4 overflow-y-auto flex-1">
            <div className={cn('text-[10px] font-bold uppercase tracking-wider px-3 mb-2', isPlatform ? 'text-[var(--pf-faint)]' : 'text-slate-500')}>
              {user?.role === 'super_admin' ? 'Platform' : 'Main Menu'}
            </div>
            {navItems.map((item) => {
              const active = item.href === activeHref;
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors',
                      active
                        ? isPlatform
                          ? 'bg-teal-500/15 text-[var(--pf-text)] border-l-2 border-teal-500 pl-[10px]'
                          : 'bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] text-[var(--tenant-text)] border-l-2 pl-[10px]'
                        : isPlatform
                          ? 'text-[var(--pf-muted)] hover:bg-[var(--pf-hover)]'
                          : 'bg-transparent text-[var(--tenant-muted)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,transparent)] hover:text-[var(--tenant-text)]'
                    )}
                    style={!isPlatform && active ? { borderLeftColor: 'var(--brand-primary)' } : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium truncate">{item.label}</span>
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
          <div className={cn('p-3 border-t shrink-0 space-y-2', isPlatform ? 'border-[var(--pf-line)]' : 'border-[var(--tenant-line)]')}>
            {isPlatform ? <ThemeToggle className="mb-1" /> : <ThemeToggle variant="brand" className="mb-1" />}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/40"
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

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 shrink-0">
        {isPlatform ? <ThemeToggle /> : <ThemeToggle variant="brand" />}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          className={cn(
            isPlatform
              ? 'text-[var(--pf-muted)] hover:text-[var(--pf-text)] hover:bg-[var(--pf-hover)]'
              : 'text-[var(--tenant-muted)] hover:text-[var(--tenant-text)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)]',
          )}
          title="Refresh System Data"
        >
          <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin text-primary')} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative hidden sm:inline-flex',
            isPlatform
              ? 'text-[var(--pf-muted)] hover:text-[var(--pf-text)] hover:bg-[var(--pf-hover)]'
              : 'text-[var(--tenant-muted)] hover:text-[var(--tenant-text)] hover:bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)]',
          )}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
        </Button>

        <div className={cn('h-6 w-px mx-1 hidden sm:block', isPlatform ? 'bg-[var(--pf-line)]' : 'bg-slate-800')} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2 pr-1 py-1 h-auto rounded-full border border-transparent transition-all max-w-[min(100vw-8rem,16rem)]',
                isPlatform ? 'hover:bg-[var(--pf-hover)]' : 'hover:bg-slate-800',
              )}
            >
              <div className="text-right hidden md:block min-w-0">
                <p className={cn('text-sm font-medium leading-none truncate', isPlatform ? 'text-[var(--pf-text)]' : 'text-white')}>{user?.name}</p>
                <p className={cn('text-xs mt-1 capitalize truncate', isPlatform ? 'text-[var(--pf-faint)]' : 'text-slate-500')}>{user?.role}</p>
              </div>
              <Avatar className={cn('h-8 w-8 sm:h-9 sm:w-9 border-2 shrink-0', isPlatform ? 'border-[var(--pf-line)]' : 'border-slate-800')}>
                <AvatarImage src={user?.avatar_url} alt={user?.name} />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
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
                ? 'bg-[var(--pf-surface)] border-[var(--pf-line)] text-[var(--pf-text)]'
                : 'bg-slate-950 border-slate-800 text-slate-200',
            )}
          >
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <Link to={getProfilePath()}>
              <DropdownMenuItem className="cursor-pointer hover:bg-slate-800 focus:bg-slate-800">
                <Settings className="mr-2 h-4 w-4" />
                {user?.role === 'super_admin' ? 'Profile' : 'Settings'}
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-950/50 focus:bg-red-950/50"
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
