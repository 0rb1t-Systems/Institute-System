import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { isInstitutionSettingsComplete, getTenantLandingPath } from '@/lib/institution';

// Phase 1 — eager (core shell)
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import WelcomePage from '@/pages/WelcomePage';
import PrivacyPage from '@/pages/public/PrivacyPage';
import TermsPage from '@/pages/public/TermsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import DashboardPage from '@/pages/DashboardPage';
import CoursesPage from '@/pages/CoursesPage';
import AttendancePage from '@/pages/AttendancePage';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import InstructorsPage from '@/pages/admin/InstructorsPage';
import AdminProfilePage from '@/pages/admin/AdminProfilePage';
import InstructorDashboard from '@/pages/instructor/InstructorDashboard';
import InstructorClassesPage from '@/pages/instructor/InstructorClassesPage';
import InstructorProfilePage from '@/pages/instructor/InstructorProfilePage';
import InstructorEarningsPage from '@/pages/instructor/InstructorEarningsPage';
import StaffProfilePage from '@/pages/staff/StaffProfilePage';
import StudentDashboard from '@/pages/student/StudentDashboard';
import StudentProfilePage from '@/pages/student/StudentProfilePage';
import StudentFinancePage from '@/pages/student/StudentFinancePage';

// Heavier / Phase 2–3 — lazy (loaded only when opened)
// These pages transitively pull xlsx / jspdf / html2canvas / recharts / qr.
// Keeping them lazy stops ~1.7 MB of export/PDF/chart libraries from loading
// on the initial dashboard render.
const StudentsPage = lazy(() => import('@/pages/StudentsPage'));
const ClassesPage = lazy(() => import('@/pages/ClassesPage'));
const FinancePage = lazy(() => import('@/pages/FinancePage'));
const AttendanceReportsPage = lazy(() => import('@/pages/AttendanceReportsPage'));
const StudentAttendancePage = lazy(() => import('@/pages/student/StudentAttendancePage'));
const CredentialCheckPage = lazy(() => import('@/pages/public/CredentialCheckPage'));
const VerificationPage = lazy(() => import('@/pages/public/VerificationPage'));
const VerifyCertificatePage = lazy(() => import('@/pages/public/VerifyCertificatePage'));
const PublicRegistrationPage = lazy(() => import('@/pages/public/PublicRegistrationPage'));
const PublicGeneralRegistrationPage = lazy(() => import('@/pages/public/PublicGeneralRegistrationPage'));
const PublicCreateInstitutionPage = lazy(() => import('@/pages/public/PublicCreateInstitutionPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const CertificatePage = lazy(() => import('@/pages/CertificatePage'));
const AdminExamMarkingPage = lazy(() => import('@/pages/admin/AdminExamMarkingPage'));
const LandingCustomizePage = lazy(() => import('@/pages/admin/LandingCustomizePage'));
const OnlineFormsPage = lazy(() => import('@/pages/admin/OnlineFormsPage'));
const InstructorIdPage = lazy(() => import('@/pages/instructor/InstructorIdPage'));
const AssignmentsPage = lazy(() => import('@/pages/instructor/AssignmentsPage'));
const AssignmentGradingPage = lazy(() => import('@/pages/instructor/AssignmentGradingPage'));
const GradebookPage = lazy(() => import('@/pages/instructor/GradebookPage'));
const ExamGradingPage = lazy(() => import('@/pages/instructor/ExamGradingPage'));
const ExaminationsPage = lazy(() => import('@/pages/ExaminationsPage'));
const StaffIdPage = lazy(() => import('@/pages/staff/StaffIdPage'));
const StudentPortalPage = lazy(() => import('@/pages/StudentPortalPage'));
const StudentAssignmentsPage = lazy(() => import('@/pages/student/StudentAssignmentsPage'));
const StudentGradebookPage = lazy(() => import('@/pages/student/StudentGradebookPage'));
const StudentPortalIdPage = lazy(() => import('@/pages/student/StudentPortalIdPage'));
const StudentExamResultPage = lazy(() => import('@/pages/student/StudentExamResultPage'));
const AffiliatePage = lazy(() => import('@/pages/AffiliatePage'));
const SuperAdminDashboardPage = lazy(() => import('@/pages/super-admin/SuperAdminDashboardPage'));
const TenantsPage = lazy(() => import('@/pages/super-admin/TenantsPage'));
const CreateTenantPage = lazy(() => import('@/pages/super-admin/CreateTenantPage'));
const TenantDetailsPage = lazy(() => import('@/pages/super-admin/TenantDetailsPage'));
const TenantAdminsPage = lazy(() => import('@/pages/super-admin/TenantAdminsPage'));
const PlansPage = lazy(() => import('@/pages/super-admin/PlansPage'));
const RevenuePage = lazy(() => import('@/pages/super-admin/RevenuePage'));
const AnalyticsPage = lazy(() => import('@/pages/super-admin/AnalyticsPage'));
const SupportPage = lazy(() => import('@/pages/super-admin/SupportPage'));
const SystemUsersPage = lazy(() => import('@/pages/super-admin/SystemUsersPage'));
const SystemSettingsPage = lazy(() => import('@/pages/super-admin/SystemSettingsPage'));
const AuditLogsPage = lazy(() => import('@/pages/super-admin/AuditLogsPage'));
const SuperAdminProfilePage = lazy(() => import('@/pages/super-admin/SuperAdminProfilePage'));

const PageLoader = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const Lazy = ({ children }) => <Suspense fallback={<PageLoader />}>{children}</Suspense>;

/** Staff/instructor/affiliate/student must not enter via platform /login (no ?tenant=). */
const PLATFORM_BLOCKED_ROLES = new Set(['staff', 'instructor', 'affiliate', 'student']);

const PlatformLoginRoute = () => {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [denyMsg, setDenyMsg] = React.useState('');
  const tenant = String(searchParams.get('tenant') || searchParams.get('subdomain') || '').trim();
  const blockedOnPlatform =
    !!user && !tenant && PLATFORM_BLOCKED_ROLES.has(user.role);

  useEffect(() => {
    if (!blockedOnPlatform) return;
    setDenyMsg(
      'Access denied. Only institution admins can sign in on the platform. Use your institution landing page.',
    );
    logout();
  }, [blockedOnPlatform, logout]);

  if (user && !blockedOnPlatform) {
    if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />;
    if (user.role === 'student') return <Navigate to="/student/dashboard" replace />;
    if (user.role === 'instructor') return <Navigate to="/instructor/dashboard" replace />;
    if (user.role === 'affiliate') return <Navigate to="/affiliate" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginPage initialError={denyMsg} />;
};

const ProtectedRoute = ({ children, roles }) => {
  const { user, institution, initializing, logout } = useAuth();
  const location = useLocation();
  const tenantSuspended =
    !!user &&
    user.role !== 'super_admin' &&
    institution?.status === 'suspended';

  useEffect(() => {
    if (tenantSuspended) logout();
  }, [tenantSuspended, logout]);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-slate-400 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user || tenantSuspended) {
    const landing = getTenantLandingPath(institution, user?.role);
    return (
      <Navigate
        to={landing}
        state={tenantSuspended ? { tenantSuspended: true, from: location } : { from: location }}
        replace
      />
    );
  }

  // Defense-in-depth: never render app shell for non-approved profiles
  if (user.status !== 'approved') {
    return <Navigate to={getTenantLandingPath(institution, user.role)} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    let target = '/dashboard';
    if (user.role === 'super_admin') target = '/super-admin';
    else if (user.role === 'student') target = '/student/dashboard';
    else if (user.role === 'instructor') target = '/instructor/dashboard';
    else if (user.role === 'affiliate') target = '/affiliate';

    if (location.pathname === target || location.pathname.startsWith(target + '/')) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-4">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-6 text-center max-w-md">
            You do not have permission to access this feature. Please contact your administrator if you believe this is a mistake.
          </p>
          <Button
            onClick={async () => {
              const path = getTenantLandingPath(institution, user.role);
              await logout();
              window.location.assign(path);
            }}
            variant="destructive"
          >
            Sign Out
          </Button>
        </div>
      );
    }

    return <Navigate to={target} replace />;
  }

  // Institution Admin must complete Institution Settings before using the rest of the app
  if (
    user.role === 'admin' &&
    institution &&
    !isInstitutionSettingsComplete(institution) &&
    location.pathname !== '/admin/profile' &&
    location.pathname !== '/admin/landing'
  ) {
    return <Navigate to="/admin/profile" replace />;
  }

  return children;
};

const App = () => {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-slate-400 text-sm">Initializing application...</p>
        </div>
      </div>
    );
  }

  const getRootRedirect = () => {
    if (user?.role === 'super_admin') return '/super-admin';
    if (user?.role === 'student') return '/student/dashboard';
    if (user?.role === 'instructor') return '/instructor/dashboard';
    if (user?.role === 'affiliate') return '/affiliate';
    return '/dashboard';
  };

  return (
    <ErrorBoundary>
      <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/login" element={<PlatformLoginRoute />} />
          <Route path="/signup" element={user ? <Navigate to={getRootRedirect()} replace /> : <SignupPage />} />
          <Route
            path="/create-institution"
            element={user ? <Navigate to={getRootRedirect()} replace /> : <Lazy><PublicCreateInstitutionPage /></Lazy>}
          />
          <Route
            path="/register-institution"
            element={<Navigate to="/create-institution" replace />}
          />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          <Route path="/verify-credential" element={<Lazy><CredentialCheckPage /></Lazy>} />
          <Route path="/verify/:id" element={<Lazy><VerificationPage /></Lazy>} />
          <Route path="/verify-certificate/:id" element={<Lazy><VerifyCertificatePage /></Lazy>} />
          <Route path="/register/general" element={<Lazy><PublicGeneralRegistrationPage /></Lazy>} />
          <Route path="/register" element={<Lazy><PublicGeneralRegistrationPage /></Lazy>} />
          <Route path="/Registration" element={<Lazy><PublicGeneralRegistrationPage /></Lazy>} />
          <Route path="/register/:classId" element={<Lazy><PublicRegistrationPage /></Lazy>} />

          {/* Super Admin — System Owner only (isolated from tenant dashboards) */}
          <Route element={<ProtectedRoute roles={['super_admin']}><MainLayout /></ProtectedRoute>}>
            <Route path="/super-admin" element={<Lazy><SuperAdminDashboardPage /></Lazy>} />
            <Route path="/super-admin/tenants" element={<Lazy><TenantsPage /></Lazy>} />
            <Route path="/super-admin/tenants/create" element={<Lazy><CreateTenantPage /></Lazy>} />
            <Route path="/super-admin/tenants/:id" element={<Lazy><TenantDetailsPage /></Lazy>} />
            <Route path="/super-admin/tenant-admins" element={<Lazy><TenantAdminsPage /></Lazy>} />
            <Route path="/super-admin/plans" element={<Lazy><PlansPage /></Lazy>} />
            <Route path="/super-admin/revenue" element={<Lazy><RevenuePage /></Lazy>} />
            <Route path="/super-admin/analytics" element={<Lazy><AnalyticsPage /></Lazy>} />
            <Route path="/super-admin/support" element={<Lazy><SupportPage /></Lazy>} />
            <Route path="/super-admin/users" element={<Lazy><SystemUsersPage /></Lazy>} />
            <Route path="/super-admin/settings" element={<Lazy><SystemSettingsPage /></Lazy>} />
            <Route path="/super-admin/audit-logs" element={<Lazy><AuditLogsPage /></Lazy>} />
            <Route path="/super-admin/profile" element={<Lazy><SuperAdminProfilePage /></Lazy>} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin', 'instructor', 'student', 'staff', 'affiliate']}><MainLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<ProtectedRoute roles={['admin', 'staff']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><UserManagementPage /></ProtectedRoute>} />
            <Route path="/admin/instructors" element={<ProtectedRoute roles={['admin', 'staff']}><InstructorsPage /></ProtectedRoute>} />
            <Route path="/admin/profile" element={<ProtectedRoute roles={['admin']}><AdminProfilePage /></ProtectedRoute>} />
            <Route path="/admin/landing" element={<ProtectedRoute roles={['admin']}><Lazy><LandingCustomizePage /></Lazy></ProtectedRoute>} />
            <Route path="/admin/certificates" element={<ProtectedRoute roles={['admin', 'staff']}><Navigate to="/reports?tab=certificates" replace /></ProtectedRoute>} />
            <Route path="/admin/grading" element={<ProtectedRoute roles={['admin']}><Lazy><AdminExamMarkingPage /></Lazy></ProtectedRoute>} />

            <Route path="/instructor/dashboard" element={<ProtectedRoute roles={['instructor']}><InstructorDashboard /></ProtectedRoute>} />
            <Route path="/instructor/profile" element={<ProtectedRoute roles={['instructor']}><InstructorProfilePage /></ProtectedRoute>} />
            <Route path="/instructor/classes" element={<ProtectedRoute roles={['instructor']}><InstructorClassesPage /></ProtectedRoute>} />
            <Route path="/instructor/earnings" element={<ProtectedRoute roles={['instructor']}><InstructorEarningsPage /></ProtectedRoute>} />
            <Route path="/instructor/withdrawals" element={<ProtectedRoute roles={['instructor']}><Navigate to="/instructor/earnings" replace /></ProtectedRoute>} />
            <Route path="/instructor/id-card" element={<ProtectedRoute roles={['instructor']}><Lazy><InstructorIdPage /></Lazy></ProtectedRoute>} />

            <Route path="/assignments" element={<ProtectedRoute roles={['admin', 'instructor', 'staff']}><Lazy><AssignmentsPage /></Lazy></ProtectedRoute>} />
            <Route path="/assignments/:assignmentId/grading" element={<ProtectedRoute roles={['admin', 'instructor', 'staff']}><Lazy><AssignmentGradingPage /></Lazy></ProtectedRoute>} />
            <Route path="/gradebook" element={<ProtectedRoute roles={['admin', 'instructor', 'staff']}><Lazy><GradebookPage /></Lazy></ProtectedRoute>} />
            <Route path="/examinations" element={<ProtectedRoute roles={['admin', 'instructor', 'staff']}><Lazy><ExaminationsPage /></Lazy></ProtectedRoute>} />
            <Route path="/examinations/:examId/grading" element={<ProtectedRoute roles={['admin', 'instructor', 'staff']}><Lazy><ExamGradingPage /></Lazy></ProtectedRoute>} />

            <Route path="/staff/profile" element={<ProtectedRoute roles={['staff']}><StaffProfilePage /></ProtectedRoute>} />
            <Route path="/staff/id-card" element={<ProtectedRoute roles={['staff']}><Lazy><StaffIdPage /></Lazy></ProtectedRoute>} />
            <Route path="/affiliate" element={<ProtectedRoute roles={['admin', 'staff', 'affiliate']}><Lazy><AffiliatePage /></Lazy></ProtectedRoute>} />
            <Route path="/affiliate/profile" element={<ProtectedRoute roles={['affiliate']}><StaffProfilePage /></ProtectedRoute>} />

            <Route path="/students" element={<ProtectedRoute roles={['admin', 'staff']}><Lazy><StudentsPage /></Lazy></ProtectedRoute>} />
            <Route path="/students/forms" element={<ProtectedRoute roles={['admin', 'staff']}><Lazy><OnlineFormsPage /></Lazy></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute roles={['admin', 'staff']}><Lazy><ClassesPage /></Lazy></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute roles={['admin', 'staff']}><CoursesPage /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute roles={['admin', 'staff']}><Lazy><FinancePage /></Lazy></ProtectedRoute>} />
            {/* PRD Permission Matrix: Reports Center = Admin + Staff only */}
            <Route path="/reports" element={<ProtectedRoute roles={['admin', 'staff']}><Lazy><ReportsPage /></Lazy></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute roles={['admin', 'instructor', 'staff']}><AttendancePage /></ProtectedRoute>} />
            <Route path="/attendance/reports" element={<ProtectedRoute roles={['admin', 'instructor', 'staff']}><Lazy><AttendanceReportsPage /></Lazy></ProtectedRoute>} />
            <Route path="/certificate/:certificateId" element={<ProtectedRoute roles={['admin', 'instructor', 'staff']}><Lazy><CertificatePage /></Lazy></ProtectedRoute>} />

            <Route path="/student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/profile" element={<ProtectedRoute roles={['student']}><StudentProfilePage /></ProtectedRoute>} />
            <Route path="/student/classes" element={<ProtectedRoute roles={['student']}><Lazy><StudentPortalPage /></Lazy></ProtectedRoute>} />
            <Route path="/portal" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/portal/finance" element={<ProtectedRoute roles={['student']}><StudentFinancePage /></ProtectedRoute>} />
            <Route path="/portal/attendance" element={<ProtectedRoute roles={['student']}><Lazy><StudentAttendancePage /></Lazy></ProtectedRoute>} />
            <Route path="/portal/id-card" element={<ProtectedRoute roles={['student']}><Lazy><StudentPortalIdPage /></Lazy></ProtectedRoute>} />
            <Route path="/portal/assignments" element={<ProtectedRoute roles={['student']}><Lazy><StudentAssignmentsPage /></Lazy></ProtectedRoute>} />
            <Route path="/portal/gradebook" element={<ProtectedRoute roles={['student']}><Lazy><StudentGradebookPage /></Lazy></ProtectedRoute>} />
            <Route path="/portal/profile" element={<Navigate to="/student/profile" replace />} />
            {/* Transcript / certificates are admin-only documents — not shown to students */}
            <Route path="/portal/transcript" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/portal/documents" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/portal/certificates" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/portal/certificate/:certificateId" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/portal/exam-result/:resultId" element={<ProtectedRoute roles={['student']}><Lazy><StudentExamResultPage /></Lazy></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
};

export default App;
