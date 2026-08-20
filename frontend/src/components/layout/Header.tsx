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
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notify';
import { getNavItemsForRole, resolveActiveNavHref } from '@/components/layout/navConfig';
import { getTenantLandingPath, goToTenantLanding } from '@/lib/institution';

const Header = () => {
  const { user, institution, logout } = useAuth();
  const { refreshData, loading } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl px-3 sm:px-4 sm:static sm:border-0 sm:bg-transparent sm:px-8 transition-all min-w-0">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="lg:hidden shrink-0 bg-slate-900 border-slate-800 text-slate-200">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[min(100vw-2rem,300px)] bg-slate-950 border-r border-slate-800 text-white p-0 flex flex-col">
          <div className="flex items-center justify-center h-20 bg-slate-900/50 p-4 border-b border-slate-800 shrink-0">
            <Logo className="h-10" />
          </div>
          <nav className="grid gap-1 p-4 overflow-y-auto flex-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
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
                        ? 'bg-slate-800 text-white border-l-2 border-blue-500 pl-[10px]'
                        : 'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium truncate">{item.label}</span>
                  </Link>
                </SheetClose>
              );
            })}
          </nav>
          <div className="p-3 border-t border-slate-800 shrink-0">
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

      <div className="flex-1 min-w-0" />

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          className="text-slate-300 hover:text-slate-100 hover:bg-slate-800"
          title="Refresh System Data"
        >
          <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin text-blue-500')} />
        </Button>

        <Button variant="ghost" size="icon" className="text-slate-300 hover:text-slate-100 hover:bg-slate-800 relative hidden sm:inline-flex">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
        </Button>

        <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2 pr-1 py-1 h-auto rounded-full border border-transparent hover:bg-slate-800 transition-all max-w-[min(100vw-8rem,16rem)]"
            >
              <div className="text-right hidden md:block min-w-0">
                <p className="text-sm font-medium leading-none text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 mt-1 capitalize truncate">{user?.role}</p>
              </div>
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border-2 border-slate-800 shrink-0">
                <AvatarImage src={user?.avatar_url} alt={user?.name} />
                <AvatarFallback className="bg-indigo-600 text-white font-bold">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-slate-950 border-slate-800 text-slate-200">
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
