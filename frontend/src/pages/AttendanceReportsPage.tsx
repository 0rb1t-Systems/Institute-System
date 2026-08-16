import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { format } from 'date-fns';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';

// Components
import AttendanceReportFilters from '@/components/attendance/AttendanceReportFilters';
import AttendanceReportSummary from '@/components/attendance/AttendanceReportSummary';
import AttendanceReportTable from '@/components/attendance/AttendanceReportTable';

// Hooks & Utils
import { useAttendanceFiltering } from '@/hooks/useAttendanceFiltering';
import { exportAttendanceToExcel } from '@/lib/AttendanceExcelExporter';

const AttendanceReportsPage = () => {
  const { user } = useAuth();
  const { classes } = useData();
  const { toast } = useToast();

  // Filter State
  const defaultDateFrom = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
  const defaultDateTo = format(new Date(), 'yyyy-MM-dd');
  
  const [filters, setFilters] = useState({
    dateFrom: defaultDateFrom,
    dateTo: defaultDateTo,
    classId: 'all'
  });

  const [isExporting, setIsExporting] = useState(false);

  // Get accessible classes based on role (instructor = assigned only, same institution)
  const availableClasses = useMemo(() => {
    if (!user) return [];
    const active = (classes || []).filter((c) => c.is_active);
    if (user.role === 'instructor') {
      return active.filter(
        (c) =>
          c.instructor_id === user.id &&
          (!user.institution_id || c.institution_id === user.institution_id)
      );
    }
    if (user.institution_id) {
      return active.filter((c) => c.institution_id === user.institution_id);
    }
    return active;
  }, [classes, user]);

  // Reset class filter if the selection is no longer in the instructor's list
  useEffect(() => {
    if (user?.role !== 'instructor') return;
    if (filters.classId === 'all') return;
    const stillAllowed = availableClasses.some((c) => c.id === filters.classId);
    if (!stillAllowed) {
      setFilters((prev) => ({ ...prev, classId: 'all' }));
    }
  }, [availableClasses, filters.classId, user?.role]);

  // Use the new filtering hook
  const {
    records,
    loading,
    error,
    lastUpdated
  } = useAttendanceFiltering(
      filters.dateFrom, 
      filters.dateTo, 
      filters.classId, 
      user, 
      availableClasses
  );

  const handleClearFilters = () => {
      setFilters({
          dateFrom: defaultDateFrom,
          dateTo: defaultDateTo,
          classId: 'all'
      });
  };

  const handleExportExcel = async () => {
      if (!records || records.length === 0) {
          toast({
              variant: "destructive",
              title: "Export Failed",
              description: "There are no records to export for the selected filters."
          });
          return;
      }

      setIsExporting(true);
      
      try {
          // Add a small delay to allow UI to update the loading state
          await new Promise(resolve => setTimeout(resolve, 100));
          
          exportAttendanceToExcel(records, filters.dateFrom, filters.dateTo);
          
          toast({
              title: "Export Successful",
              description: "Attendance report downloaded successfully."
          });
      } catch (err) {
          notify.error(err, { context: 'AttendanceReportsPage - export', fallback: { title: 'Export Failed', description: MESSAGES.DOMAIN.EXPORT_FAILED } });
      } finally {
          setIsExporting(false);
      }
  };

  return (
    <AnimatedPage>
      <Helmet><title>Attendance Reports - Portal</title></Helmet>
      
      <PageHeader 
        title="Attendance Reports" 
        subtitle="Filter and analyze student attendance data"
      />

      {error && (
          <Alert variant="destructive" className="mb-6 bg-red-950/50 border-red-900 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error fetching data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}

      <AttendanceReportFilters 
          filters={filters}
          setFilters={setFilters}
          availableClasses={availableClasses}
          clearFilters={handleClearFilters}
          onExport={handleExportExcel}
          isExporting={isExporting}
          totalRecords={records?.length || 0}
      />

      <AttendanceReportSummary 
          records={records}
          loading={loading}
          lastUpdated={lastUpdated}
      />

      <AttendanceReportTable 
          records={records}
          loading={loading}
      />

    </AnimatedPage>
  );
};

export default AttendanceReportsPage;