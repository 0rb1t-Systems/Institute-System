import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileDown, Wallet, GraduationCap, Briefcase, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from '@/contexts/AuthContext';
import { getAffiliateCommissionRate, getDefaultInstructorCommissionRate, rateToPercent } from '@/lib/institution';

const cardShell =
  'overflow-hidden rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)] transition-shadow hover:border-[var(--ds-border-strong,#C5D0C8)] hover:shadow-[0_8px_28px_#1F8A5B18]';

const iconBadge =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[var(--ds-accent,#1F8A5B)]/15 bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-accent,#1F8A5B)] shadow-[inset_0_1px_0_#ffffff80]';

const SettlementReport = () => {
  const { payments, instructorEarnings, classes, students, users, affiliateSettlements = [] } = useData();
  const { institution } = useAuth();
  const affiliateRatePct = rateToPercent(getAffiliateCommissionRate(institution), 1).toFixed(1);
  const defaultInstPct = rateToPercent(getDefaultInstructorCommissionRate(institution), 1);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedClassId, setSelectedClassId] = useState('all');

  // --- Data Processing & Filtering ---
  const reportData = useMemo(() => {
    // Helper to check if a date string falls in the selected month
    const isMonthMatch = (dateStr) => dateStr && dateStr.startsWith(selectedMonth);

    // 1. Filter Payments (Collections)
    const filteredPayments = payments.filter(p => {
        const monthMatch = isMonthMatch(p.payment_date) || isMonthMatch(p.month_paid);
        const classMatch = selectedClassId === 'all' || p.class_id === selectedClassId;
        return monthMatch && classMatch && p.status === 'completed';
    });

    // 2. Filter Instructor Earnings (instructor_settlements only — do not double-count as affiliate)
    const filteredEarnings = instructorEarnings.filter(e => {
        const monthMatch = isMonthMatch(e.created_at);
        const classMatch = selectedClassId === 'all' || e.class_id === selectedClassId;
        return monthMatch && classMatch;
    });

    // Affiliate commissions from affiliate_settlements (tenant-scoped)
    const filteredCommissions = (affiliateSettlements || []).filter((c) => {
      const monthMatch = isMonthMatch(c.created_at);
      const classMatch = selectedClassId === 'all' || c.class_id === selectedClassId;
      return monthMatch && classMatch;
    });

    // 4. Calculate Totals
    const totalCollection = filteredPayments.reduce((sum: any, p: any) => sum + Number(p.amount), 0);
    const totalInstructorShare = filteredEarnings.reduce((sum: any, e: any) => sum + Number(e.amount), 0);
    const totalCommissions = filteredCommissions.reduce((sum: any, c: any) => sum + Number(c.amount || 0), 0);
    const schoolRevenue = totalCollection - totalInstructorShare - totalCommissions;

    // 5. Group by Class (For Class Summary View)
    const classSummary: any = {};
    
    // Initialize with active classes if no filter, or just the selected one
    const classesToTrack = selectedClassId === 'all' ? classes : classes.filter(c => c.id === selectedClassId);
    
    classesToTrack.forEach(c => {
        classSummary[c.id] = {
            id: c.id,
            name: c.name,
            instructorName:
              users.find((u) => u.id === c.instructor_id)?.name ||
              users.find((u) => u.id === c.instructor_id)?.full_name ||
              c.instructor?.name ||
              c.instructor?.full_name ||
              (c.instructor_id ? 'Unknown instructor' : 'Unassigned'),
            totalCollected: 0,
            tuitionCollected: 0,
            registrationCollected: 0,
            instructorPay: 0,
            affiliatePay: 0,
            netRevenue: 0,
            transactionCount: 0
        };
    });

    // Aggregate Payments
    filteredPayments.forEach(p => {
        if (classSummary[p.class_id]) {
            const amount = Number(p.amount);
            classSummary[p.class_id].totalCollected += amount;
            classSummary[p.class_id].transactionCount += 1;
            
            // Split between Registration and Tuition
            if (p.is_registration_fee) {
                classSummary[p.class_id].registrationCollected += amount;
            } else {
                classSummary[p.class_id].tuitionCollected += amount;
            }
        }
    });

    // Aggregate Earnings
    filteredEarnings.forEach(e => {
        if (classSummary[e.class_id]) {
            classSummary[e.class_id].instructorPay += Number(e.amount);
        }
    });

    // Aggregate Commissions (Need to link back to class via payment)
    filteredCommissions.forEach(c => {
        const parentPayment = payments.find(p => p.id === c.payment_id);
        if (parentPayment && classSummary[parentPayment.class_id]) {
            classSummary[parentPayment.class_id].affiliatePay += Number(c.amount);
        }
    });

    // Calculate Net for each class
    Object.values(classSummary).forEach((item: any) => {
        item.netRevenue = item.totalCollected - item.instructorPay - item.affiliatePay;
    });

    const sortedClassSummary = Object.values(classSummary)
        .filter((item: any) => item.totalCollected > 0 || item.instructorPay > 0) // Only show classes with activity
        .sort((a: any, b: any) => b.totalCollected - a.totalCollected);

    return {
        payments: filteredPayments,
        earnings: filteredEarnings,
        commissions: filteredCommissions,
        totalCollection,
        totalInstructorShare,
        totalCommissions,
        schoolRevenue,
        classSummary: sortedClassSummary
    };
  }, [payments, instructorEarnings, classes, users, selectedMonth, selectedClassId, affiliateSettlements]);

  // --- PDF Export ---
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(18);
    doc.text('Settlement & Revenue Report', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Period: ${selectedMonth}`, 14, 28);
    const className = selectedClassId === 'all' ? 'All Classes' : classes.find(c => c.id === selectedClassId)?.name || 'Unknown Class';
    doc.text(`Filter: ${className}`, 14, 33);

    // Summary Box
    doc.setFillColor(240, 240, 245);
    doc.rect(14, 40, pageWidth - 28, 25, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('Total Collections', 20, 48);
    doc.text('Instructor Pay', 70, 48);
    doc.text('Affiliate Comm.', 120, 48);
    doc.text('Net Revenue', 170, 48);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(reportData.totalCollection), 20, 58);
    doc.text(formatCurrency(reportData.totalInstructorShare), 70, 58);
    doc.text(formatCurrency(reportData.totalCommissions), 120, 58);
    doc.text(formatCurrency(reportData.schoolRevenue), 170, 58);
    
    // Detailed Table: Class Breakdown
    doc.setFont(undefined, 'normal');
    doc.setFontSize(12);
    doc.text('Class Breakdown', 14, 75);
    
    const classRows = reportData.classSummary.map((c: any) => [
        c.name,
        c.instructorName,
        formatCurrency(c.tuitionCollected),
        formatCurrency(c.registrationCollected),
        formatCurrency(c.totalCollected),
        formatCurrency(c.instructorPay),
        formatCurrency(c.affiliatePay),
        formatCurrency(c.netRevenue)
    ]);

    doc.autoTable({
        startY: 80,
        head: [['Class Name', 'Instructor', 'Tuition', 'Reg. Fee', 'Total', 'Inst. Pay', 'Aff. Pay', 'Net Rev']],
        body: classRows,
        theme: 'grid',
        headStyles: { fillColor: [41, 37, 36] }, // Slate-900 like
        styles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 30 }
        }
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    // Detailed Table: Instructor Earnings
    doc.setFontSize(12);
    doc.text('Instructor Earnings Detail', 14, finalY);

    const earningRows = reportData.earnings.map(e => {
        const cls = classes.find(c => c.id === e.class_id) || e.class;
        const stu = e.student || students.find(s => s.id === e.student_id);
        const pay = e.payment || payments.find(p => p.id === e.payment_id);
        // Map instructor via ID for accuracy, fallback to class instructor
        const instructor = users.find(u => u.id === e.instructor_id);
        const instructorName = instructor?.name || cls?.instructor?.name || 'Unknown';

        return [
             formatDate(e.created_at),
             instructorName,
             cls?.name || 'Unknown',
             stu?.name || 'Unknown',
             `${formatCurrency(pay?.amount || 0)}`,
             formatCurrency(e.amount)
        ];
    });

    doc.autoTable({
        startY: finalY + 5,
        head: [['Date', 'Instructor', 'Class', 'Student Source', 'Tuition Paid', 'Instructor Earning']],
        body: earningRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        styles: { fontSize: 8 }
    });

    doc.save(`Settlement_Report_${selectedMonth}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-4 md:flex-row md:items-end md:gap-3">
        <div className="min-w-[10rem] shrink-0 space-y-2 md:w-[11rem]">
          <Label>Report Month</Label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-[var(--ds-surface,#fff)]"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Label>Filter by Class</Label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-full bg-[var(--ds-surface,#fff)]">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="shrink-0">
          <Button onClick={generatePDF} className="w-full whitespace-nowrap md:w-auto">
            <FileDown className="mr-2 h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={`${cardShell} flex h-full flex-col`}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
            <CardTitle className="text-[12px] font-semibold leading-none text-[var(--ds-text-secondary,#5B6B61)]">
              Total Gross Collection
            </CardTitle>
            <div className={iconBadge} aria-hidden>
              <Wallet className="h-[22px] w-[22px]" strokeWidth={1.6} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-3">
            <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--ds-text-primary,#122018)]">
              {formatCurrency(reportData.totalCollection)}
            </div>
            <p className="mt-auto border-t border-[var(--ds-border,#DDE5DF)] pt-3 text-[12px] font-medium text-[var(--ds-text-tertiary,#8A978E)]">
              From {reportData.payments.length} transactions
            </p>
          </CardContent>
        </Card>

        <Card className={`${cardShell} flex h-full flex-col`}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
            <CardTitle className="text-[12px] font-semibold leading-none text-[var(--ds-text-secondary,#5B6B61)]">
              Instructor Shares
            </CardTitle>
            <div className={iconBadge} aria-hidden>
              <GraduationCap className="h-[22px] w-[22px]" strokeWidth={1.6} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-3">
            <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--ds-text-primary,#122018)]">
              {formatCurrency(reportData.totalInstructorShare)}
            </div>
            <p className="mt-auto border-t border-[var(--ds-border,#DDE5DF)] pt-3 text-[12px] font-medium text-[var(--ds-text-tertiary,#8A978E)]">
              Default {defaultInstPct}% · class rates may vary
            </p>
          </CardContent>
        </Card>

        <Card className={`${cardShell} flex h-full flex-col`}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
            <CardTitle className="text-[12px] font-semibold leading-none text-[var(--ds-text-secondary,#5B6B61)]">
              Affiliate Commission
            </CardTitle>
            <div className={iconBadge} aria-hidden>
              <Briefcase className="h-[22px] w-[22px]" strokeWidth={1.6} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-3">
            <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--ds-text-primary,#122018)]">
              {formatCurrency(reportData.totalCommissions)}
            </div>
            <p className="mt-auto border-t border-[var(--ds-border,#DDE5DF)] pt-3 text-[12px] font-medium text-[var(--ds-text-tertiary,#8A978E)]">
              {affiliateRatePct}% of referred tuition
            </p>
          </CardContent>
        </Card>

        <Card className={`${cardShell} flex h-full flex-col`}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
            <CardTitle className="text-[12px] font-semibold leading-none text-[var(--ds-text-secondary,#5B6B61)]">
              Net School Revenue
            </CardTitle>
            <div className={iconBadge} aria-hidden>
              <Building2 className="h-[22px] w-[22px]" strokeWidth={1.6} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-3">
            <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--ds-text-primary,#122018)]">
              {formatCurrency(reportData.schoolRevenue)}
            </div>
            <p className="mt-auto border-t border-[var(--ds-border,#DDE5DF)] pt-3 text-[12px] font-medium text-[var(--ds-text-tertiary,#8A978E)]">
              After all deductions
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Breakdown Tabs */}
      <Tabs defaultValue="class-summary" className="w-full">
          <TabsList className="bg-[var(--ds-surface-muted,#F7FAF8)] border border-[var(--ds-border,#DDE5DF)] p-1 w-full justify-start overflow-x-auto">
              <TabsTrigger value="class-summary" className="data-[state=active]:bg-[var(--ds-surface,#fff)]">Class Breakdown</TabsTrigger>
              <TabsTrigger value="instructor-details" className="data-[state=active]:bg-[var(--ds-surface,#fff)]">Instructor Earnings Detail</TabsTrigger>
              <TabsTrigger value="affiliate-details" className="data-[state=active]:bg-[var(--ds-surface,#fff)]">Affiliate Earnings Detail</TabsTrigger>
          </TabsList>

          <TabsContent value="class-summary" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle className="text-lg">Earnings by Class</CardTitle>
                      <CardDescription>Breakdown of revenue and payouts grouped by active classes.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Table>
                          <TableHeader>
                              <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                  <TableHead className="w-[150px] text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Class Name</TableHead>
                                  <TableHead className="w-[150px] text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Instructor</TableHead>
                                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Txns</TableHead>
                                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-info,#2563EB)]">Tuition</TableHead>
                                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-info,#2563EB)]">Reg. Fees</TableHead>
                                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Total Collected</TableHead>
                                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Inst. Share</TableHead>
                                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-warning,#C2410C)]">Aff. Comm.</TableHead>
                                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Net Revenue</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {reportData.classSummary.length > 0 ? reportData.classSummary.map((item: any) => (
                                  <TableRow key={item.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                      <TableCell className="font-medium text-[var(--ds-text-primary,#122018)]">{item.name}</TableCell>
                                      <TableCell className="text-[var(--ds-text-secondary,#5B6B61)] text-sm">{item.instructorName}</TableCell>
                                      <TableCell className="text-center text-[var(--ds-text-secondary,#5B6B61)]">{item.transactionCount}</TableCell>
                                      <TableCell className="text-[var(--ds-info,#2563EB)]">{formatCurrency(item.tuitionCollected)}</TableCell>
                                      <TableCell className="text-[var(--ds-info,#2563EB)]">{formatCurrency(item.registrationCollected)}</TableCell>
                                      <TableCell className="text-[var(--ds-text-primary,#122018)] font-semibold">{formatCurrency(item.totalCollected)}</TableCell>
                                      <TableCell className="text-red-700">
                                        {item.instructorPay > 0 ? `(${formatCurrency(item.instructorPay)})` : '-'}
                                      </TableCell>
                                      <TableCell className="text-[var(--ds-warning,#C2410C)]">
                                        {item.affiliatePay > 0 ? `(${formatCurrency(item.affiliatePay)})` : '-'}
                                      </TableCell>
                                      <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(item.netRevenue)}</TableCell>
                                  </TableRow>
                              )) : (
                                  <TableRow>
                                      <TableCell colSpan={9} className="text-center py-8 text-[var(--ds-text-tertiary,#8A978E)]">No data found for this period.</TableCell>
                                  </TableRow>
                              )}
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="instructor-details" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle className="text-lg">Detailed Instructor Earnings</CardTitle>
                      <CardDescription>Line-by-line record of instructor earnings generated from student payments.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="rounded-md border border-[var(--ds-border,#DDE5DF)] overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Date</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Instructor</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Class</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Student</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Tuition Paid</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-violet-700">Earning</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.earnings.length > 0 ? reportData.earnings.map((earning) => {
                                    const cls = classes.find(c => c.id === earning.class_id) || earning.class;
                                    const stu =
                                      earning.student ||
                                      students.find((s) => s.id === earning.student_id);
                                    const pay =
                                      earning.payment ||
                                      payments.find((p) => p.id === earning.payment_id);
                                    const instructor = users.find(u => u.id === earning.instructor_id);
                                    const instructorName = instructor?.name || cls?.instructor?.name || 'Unknown';
                                    
                                    return (
                                        <TableRow key={earning.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                            <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{formatDate(earning.created_at)}</TableCell>
                                            <TableCell className="font-medium text-[var(--ds-text-primary,#122018)]">{instructorName}</TableCell>
                                            <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{cls?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{stu?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-[var(--ds-text-tertiary,#8A978E)]">{formatCurrency(pay?.amount || 0)}</TableCell>
                                            <TableCell className="text-right font-mono text-violet-700">
                                                +{formatCurrency(earning.amount)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-[var(--ds-text-tertiary,#8A978E)]">No instructor earnings found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="affiliate-details" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle className="text-lg">Detailed Affiliate Commissions</CardTitle>
                      <CardDescription>Line-by-line record of commissions generated from referrals.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="rounded-md border border-[var(--ds-border,#DDE5DF)] overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Date</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Affiliate</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Referred Student</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Class Source</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-warning,#C2410C)]">Commission ({affiliateRatePct}%)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.commissions.length > 0 ? reportData.commissions.map((comm) => {
                                    const stu = students.find(s => s.id === comm.student_id);
                                    const aff = users.find(u => u.id === comm.affiliate_id);
                                    const cls = classes.find(c => c.id === comm.class_id);
                                    
                                    return (
                                        <TableRow key={comm.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                            <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{formatDate(comm.created_at)}</TableCell>
                                            <TableCell className="font-medium text-[var(--ds-text-primary,#122018)]">{aff?.name || aff?.full_name || 'Unknown'}</TableCell>
                                            <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{stu?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-[var(--ds-text-tertiary,#8A978E)] text-sm">{cls?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-right font-mono text-[var(--ds-warning,#C2410C)]">
                                                +{formatCurrency(comm.amount)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-[var(--ds-text-tertiary,#8A978E)]">No affiliate commissions found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettlementReport;