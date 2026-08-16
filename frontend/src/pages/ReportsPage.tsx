import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, Loader2, Award } from 'lucide-react';

import FinanceReport from '@/components/reports/FinanceReport';
import AttendanceReport from '@/components/reports/AttendanceReport';
import ExamReport from '@/components/reports/ExamReport';
import RevenueReport from '@/components/reports/RevenueReport';
import AffiliateReport from '@/components/reports/AffiliateReport';
import SettlementReport from '@/components/reports/SettlementReport';
import TranscriptReport from '@/components/reports/TranscriptReport';
import CertificateReport from '@/components/reports/CertificateReport';
import { getUserMessage, MESSAGES } from '@/lib/notify';

const VALID_TABS = new Set([
  'finance',
  'revenue',
  'settlement',
  'attendance',
  'exams',
  'transcripts',
  'certificates',
  'affiliates',
]);

const ReportsPage = () => {
  const { user } = useAuth();
  const { loading, error, refreshData } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('finance');
  const [isRetrying, setIsRetrying] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const isInstructor = user?.role === 'instructor';

  const showFinance = isAdmin || isStaff;
  // PRD: Reports Center = Admin + Staff view; instructor settlements = Admin only (Staff —)
  const showRevenue = isAdmin || isStaff;
  const showSettlement = isAdmin;
  const showAffiliates = isAdmin || isStaff;
  const showAttendance = isAdmin || isStaff || isInstructor;
  const showExams = isAdmin || isStaff || isInstructor;
  const showTranscripts = isAdmin || isStaff;
  const showCertificates = isAdmin || isStaff;

  const defaultTab = isInstructor ? 'attendance' : 'finance';

  const canAccessTab = (tab) => {
    if (tab === 'settlement') return showSettlement;
    if (tab === 'finance') return showFinance;
    if (tab === 'revenue') return showRevenue;
    if (tab === 'affiliates') return showAffiliates;
    if (tab === 'attendance') return showAttendance;
    if (tab === 'exams') return showExams;
    if (tab === 'transcripts') return showTranscripts;
    if (tab === 'certificates') return showCertificates;
    return false;
  };

  // Deep-link support: /reports?tab=certificates | affiliates (no separate menu items)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TABS.has(tab) && canAccessTab(tab)) {
      setActiveTab(tab);
      return;
    }
    setActiveTab(defaultTab);
  }, [searchParams, defaultTab, isAdmin, isStaff, isInstructor]);

  const handleTabChange = (value) => {
    if (!canAccessTab(value)) return;
    setActiveTab(value);
    setSearchParams(value === defaultTab ? {} : { tab: value }, { replace: true });
  };

  const handleRetry = async () => {
      setIsRetrying(true);
      await refreshData();
      setIsRetrying(false);
  };

  if (error) {
      return (
          <div className="p-8 max-w-2xl mx-auto mt-20">
              <Alert variant="destructive" className="bg-red-950/20 border-red-900/50">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="text-lg ml-2">Data Load Failed</AlertTitle>
                  <AlertDescription className="mt-2 ml-2">
                      <p>{getUserMessage(error, { context: 'ReportsPage', fallback: MESSAGES.LOAD_FAILED })}</p>
                      <Button onClick={handleRetry} disabled={isRetrying} variant="outline" className="mt-4 border-red-900 text-red-100 hover:bg-red-900/30">
                          {isRetrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Retry Loading Data
                      </Button>
                  </AlertDescription>
              </Alert>
          </div>
      );
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Reports & Analytics - Portal</title>
      </Helmet>

      <PageHeader 
        title="Reports Center" 
        subtitle="Comprehensive analytics for finance, attendance, and performance."
        action={
            <Button variant="ghost" size="sm" onClick={handleRetry} disabled={loading || isRetrying}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading || isRetrying ? 'animate-spin' : ''}`} /> Refresh
            </Button>
        }
      />

      {loading && !error && (
          <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-3 text-slate-400">Loading Report Data...</span>
          </div>
      )}

      {!loading && !error && (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="flex flex-wrap w-full bg-slate-900 border border-slate-800 h-auto p-1 gap-1 justify-start">
            {showFinance && <TabsTrigger value="finance">Fees / Finance</TabsTrigger>}
            {showRevenue && <TabsTrigger value="revenue">Revenue</TabsTrigger>}
            {showSettlement && <TabsTrigger value="settlement">Settlement</TabsTrigger>}
            {showAttendance && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
            {showExams && <TabsTrigger value="exams">Exams</TabsTrigger>}
            {showTranscripts && <TabsTrigger value="transcripts">Academic / Transcripts</TabsTrigger>}
            {showCertificates && (
              <TabsTrigger value="certificates" className="gap-2">
                <Award className="h-4 w-4" />
                Certificates
              </TabsTrigger>
            )}
            {showAffiliates && <TabsTrigger value="affiliates">Affiliate System</TabsTrigger>}
            </TabsList>
            
            <div className="mt-6">
            {showFinance && <TabsContent value="finance"><FinanceReport /></TabsContent>}
            {showRevenue && <TabsContent value="revenue"><RevenueReport /></TabsContent>}
            {showSettlement && <TabsContent value="settlement"><SettlementReport /></TabsContent>}
            {showAttendance && <TabsContent value="attendance"><AttendanceReport /></TabsContent>}
            {showExams && <TabsContent value="exams"><ExamReport /></TabsContent>}
            {showTranscripts && <TabsContent value="transcripts"><TranscriptReport /></TabsContent>}
            {showCertificates && <TabsContent value="certificates"><CertificateReport /></TabsContent>}
            {showAffiliates && <TabsContent value="affiliates"><AffiliateReport /></TabsContent>}
            </div>
        </Tabs>
      )}
    </AnimatedPage>
  );
};

export default ReportsPage;
