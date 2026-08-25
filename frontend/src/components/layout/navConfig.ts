/**
 * Single source of truth for role-based navigation.
 * Used by desktop Sidebar and mobile Header sheet so menus stay in parity.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  CreditCard,
  FileBarChart,
  ClipboardCheck,
  GraduationCap,
  Library,
  User,
  DollarSign,
  LineChart,
  Building2,
  ScrollText,
  UserCog,
  Package,
  BarChart3,
  LifeBuoy,
  FileText,
  PenTool,
  ClipboardList,
  Share2,
} from 'lucide-react';

export type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

export function getNavItemsForRole(role?: string | null): NavItem[] {
  if (!role) return [];

  switch (role) {
    case 'super_admin':
      return [
        { href: '/super-admin', icon: LayoutDashboard, label: 'Overview' },
        { href: '/super-admin/tenants', icon: Building2, label: 'Tenants' },
        { href: '/super-admin/tenant-admins', icon: UserCog, label: 'Tenant Admins' },
        { href: '/super-admin/plans', icon: Package, label: 'Plans' },
        { href: '/super-admin/revenue', icon: DollarSign, label: 'Revenue' },
        { href: '/super-admin/analytics', icon: BarChart3, label: 'Analytics' },
        { href: '/super-admin/support', icon: LifeBuoy, label: 'Support' },
        { href: '/super-admin/audit-logs', icon: ScrollText, label: 'Audit Logs' },
        { href: '/super-admin/settings', icon: Settings, label: 'Settings' },
        { href: '/super-admin/profile', icon: User, label: 'Profile' },
      ];
    case 'admin':
      return [
        { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { href: '/students', icon: GraduationCap, label: 'Students' },
        { href: '/admin/instructors', icon: UserCog, label: 'Instructors' },
        { href: '/classes', icon: BookOpen, label: 'Classes' },
        { href: '/courses', icon: Library, label: 'Courses' },
        { href: '/finance', icon: CreditCard, label: 'Finance & Payments' },
        { href: '/attendance', icon: ClipboardCheck, label: 'Mark Attendance' },
        { href: '/attendance/reports', icon: LineChart, label: 'Attendance Reports' },
        { href: '/examinations', icon: FileText, label: 'Examinations' },
        { href: '/assignments', icon: ClipboardList, label: 'Assignments' },
        { href: '/gradebook', icon: PenTool, label: 'Gradebook' },
        { href: '/reports', icon: FileBarChart, label: 'Reports Center' },
        { href: '/admin/users', icon: Users, label: 'Staff & Affiliates' },
        { href: '/admin/profile', icon: Settings, label: 'Institution Settings' },
      ];
    case 'staff':
      return [
        { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { href: '/students', icon: GraduationCap, label: 'Students' },
        { href: '/admin/instructors', icon: UserCog, label: 'Instructors' },
        { href: '/classes', icon: BookOpen, label: 'Classes' },
        { href: '/courses', icon: Library, label: 'Courses' },
        { href: '/finance', icon: CreditCard, label: 'Finance' },
        { href: '/attendance', icon: ClipboardCheck, label: 'Mark Attendance' },
        { href: '/attendance/reports', icon: LineChart, label: 'Attendance Reports' },
        { href: '/examinations', icon: FileText, label: 'Examinations' },
        { href: '/assignments', icon: ClipboardList, label: 'Assignments' },
        { href: '/gradebook', icon: PenTool, label: 'Gradebook' },
        { href: '/reports', icon: FileBarChart, label: 'Reports Center' },
        { href: '/staff/id-card', icon: CreditCard, label: 'My ID Card' },
        { href: '/staff/profile', icon: User, label: 'My Profile' },
      ];
    case 'affiliate':
      return [
        { href: '/affiliate', icon: Share2, label: 'My Referrals' },
        { href: '/affiliate/profile', icon: User, label: 'My Profile' },
      ];
    case 'instructor':
      return [
        { href: '/instructor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { href: '/instructor/classes', icon: BookOpen, label: 'My Classes' },
        { href: '/attendance', icon: ClipboardCheck, label: 'Mark Attendance' },
        { href: '/attendance/reports', icon: LineChart, label: 'Attendance Reports' },
        { href: '/assignments', icon: ClipboardList, label: 'Assignments' },
        { href: '/examinations', icon: FileText, label: 'Examinations' },
        { href: '/gradebook', icon: PenTool, label: 'Gradebook' },
        { href: '/instructor/earnings', icon: DollarSign, label: 'My Earnings' },
        { href: '/instructor/id-card', icon: CreditCard, label: 'My ID Card' },
        { href: '/instructor/profile', icon: User, label: 'My Profile' },
      ];
    case 'student':
      return [
        { href: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { href: '/student/classes', icon: BookOpen, label: 'My Classes' },
        { href: '/portal/finance', icon: DollarSign, label: 'Finance' },
        { href: '/portal/attendance', icon: ClipboardCheck, label: 'Attendance' },
        { href: '/portal/assignments', icon: ClipboardList, label: 'Assignments' },
        { href: '/portal/gradebook', icon: PenTool, label: 'Gradebook' },
        { href: '/portal/id-card', icon: CreditCard, label: 'Student ID' },
        { href: '/student/profile', icon: User, label: 'Settings' },
      ];
    default:
      return [];
  }
}

/** Active nav href: exact match first, otherwise longest prefix (avoids /attendance lighting /attendance/reports). */
export function resolveActiveNavHref(pathname: string, navItems: NavItem[]): string | null {
  const exact = navItems.find((item) => item.href === pathname);
  if (exact) return exact.href;
  const prefixes = navItems
    .filter((item) => item.href !== '/' && pathname.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length);
  return prefixes[0]?.href ?? null;
}
