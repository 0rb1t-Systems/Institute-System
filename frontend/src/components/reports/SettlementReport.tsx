import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileDown, DollarSign, Briefcase, UserCheck, Building, Filter, Users, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from '@/contexts/AuthContext';
import { getAffiliateCommissionRate, getDefaultInstructorCommissionRate, rateToPercent } from '@/lib/institution';

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
            instructorName: c.instructor?.name || 'Unassigned',
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
  }, [payments, instructorEarnings, classes, selectedMonth, selectedClassId, affiliateSettlements]);

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
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <div className="space-y-2 w-full md:w-[200px]">
                        <Label className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Report Month</Label>
                        <Input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)} 
                            className="bg-slate-950 border-slate-700 text-white"
                        />
                    </div>
                    <div className="space-y-2 w-full md:w-[250px]">
                        <Label className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Filter by Class</Label>
                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                                <SelectValue placeholder="All Classes" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-[300px]">
                                <SelectItem value="all">All Classes</SelectItem>
                                {classes.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button onClick={generatePDF} className="bg-indigo-600 hover:bg-indigo-700 w-full md:w-auto">
                    <FileDown className="mr-2 h-4 w-4" /> Export Report
                </Button>
            </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-blue-950/20 border-blue-900/50 relative overflow-hidden">
           <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-900/10 to-transparent" />
           <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
                   <DollarSign className="h-4 w-4" /> Total Gross Collection
               </CardTitle>
           </CardHeader>
           <CardContent>
               <div className="text-3xl font-bold text-blue-100 tracking-tight">{formatCurrency(reportData.totalCollection)}</div>
               <p className="text-xs text-blue-400/60 mt-1">From {reportData.payments.length} transactions</p>
           </CardContent>
        </Card>

        <Card className="bg-purple-950/20 border-purple-900/50 relative overflow-hidden">
            <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-purple-900/10 to-transparent" />
           <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-purple-400 flex items-center gap-2">
                   <UserCheck className="h-4 w-4" /> Instructor Shares
               </CardTitle>
           </CardHeader>
           <CardContent>
               <div className="text-3xl font-bold text-purple-100 tracking-tight">{formatCurrency(reportData.totalInstructorShare)}</div>
               <p className="text-xs text-purple-400/60 mt-1">
                 Instructor commission (default {defaultInstPct}% from settings; per-class rates apply)
               </p>
           </CardContent>
        </Card>

        <Card className="bg-orange-950/20 border-orange-900/50 relative overflow-hidden">
            <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-orange-900/10 to-transparent" />
           <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-orange-400 flex items-center gap-2">
                   <Briefcase className="h-4 w-4" /> Affiliate Commission
               </CardTitle>
           </CardHeader>
           <CardContent>
               <div className="text-3xl font-bold text-orange-100 tracking-tight">{formatCurrency(reportData.totalCommissions)}</div>
               <p className="text-xs text-orange-400/60 mt-1">{affiliateRatePct}% of referred tuition (when rate &gt; 0)</p>
           </CardContent>
        </Card>

        <Card className="bg-green-950/20 border-green-900/50 relative overflow-hidden">
            <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-green-900/10 to-transparent" />
           <CardHeader className="pb-2">
               <CardTitle className="text-sm font-bold text-green-400 flex items-center gap-2">
                   <Building className="h-4 w-4" /> Net School Revenue
               </CardTitle>
           </CardHeader>
           <CardContent>
               <div className="text-3xl font-bold text-green-100 tracking-tight">{formatCurrency(reportData.schoolRevenue)}</div>
               <p className="text-xs text-green-400/60 mt-1">After all deductions</p>
           </CardContent>
        </Card>
      </div>
      
      {/* Detailed Breakdown Tabs */}
      <Tabs defaultValue="class-summary" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full justify-start overflow-x-auto">
              <TabsTrigger value="class-summary" className="data-[state=active]:bg-slate-800">Class Breakdown</TabsTrigger>
              <TabsTrigger value="instructor-details" className="data-[state=active]:bg-slate-800">Instructor Earnings Detail</TabsTrigger>
              <TabsTrigger value="affiliate-details" className="data-[state=active]:bg-slate-800">Affiliate Earnings Detail</TabsTrigger>
          </TabsList>

          <TabsContent value="class-summary" className="mt-4">
              <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                      <CardTitle className="text-lg">Earnings by Class</CardTitle>
                      <CardDescription>Breakdown of revenue and payouts grouped by active classes.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Table>
                          <TableHeader>
                              <TableRow className="border-slate-800 hover:bg-transparent">
                                  <TableHead className="text-slate-400 w-[150px]">Class Name</TableHead>
                                  <TableHead className="text-slate-400 w-[150px]">Instructor</TableHead>
                                  <TableHead className="text-slate-400 text-center">Txns</TableHead>
                                  <TableHead className="text-slate-400 text-blue-400">Tuition</TableHead>
                                  <TableHead className="text-slate-400 text-blue-400">Reg. Fees</TableHead>
                                  <TableHead className="text-slate-400 font-semibold">Total Collected</TableHead>
                                  <TableHead className="text-slate-400 text-red-400">Inst. Share</TableHead>
                                  <TableHead className="text-slate-400 text-orange-400">Aff. Comm.</TableHead>
                                  <TableHead className="text-right text-green-400 font-bold">Net Revenue</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {reportData.classSummary.length > 0 ? reportData.classSummary.map((item: any) => (
                                  <TableRow key={item.id} className="border-slate-800 hover:bg-slate-800/30">
                                      <TableCell className="font-medium text-slate-200">{item.name}</TableCell>
                                      <TableCell className="text-slate-300 text-sm">{item.instructorName}</TableCell>
                                      <TableCell className="text-center text-slate-400">{item.transactionCount}</TableCell>
                                      <TableCell className="text-blue-300/80">{formatCurrency(item.tuitionCollected)}</TableCell>
                                      <TableCell className="text-blue-300/80">{formatCurrency(item.registrationCollected)}</TableCell>
                                      <TableCell className="text-slate-200 font-semibold">{formatCurrency(item.totalCollected)}</TableCell>
                                      <TableCell className="text-red-300">
                                        {item.instructorPay > 0 ? `(${formatCurrency(item.instructorPay)})` : '-'}
                                      </TableCell>
                                      <TableCell className="text-orange-300">
                                        {item.affiliatePay > 0 ? `(${formatCurrency(item.affiliatePay)})` : '-'}
                                      </TableCell>
                                      <TableCell className="text-right font-bold text-green-400">{formatCurrency(item.netRevenue)}</TableCell>
                                  </TableRow>
                              )) : (
                                  <TableRow>
                                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">No data found for this period.</TableCell>
                                  </TableRow>
                              )}
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="instructor-details" className="mt-4">
              <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                      <CardTitle className="text-lg">Detailed Instructor Earnings</CardTitle>
                      <CardDescription>Line-by-line record of instructor earnings generated from student payments.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="rounded-md border border-slate-800 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-950 border-slate-800 hover:bg-transparent">
                                    <TableHead className="text-slate-400">Date</TableHead>
                                    <TableHead className="text-slate-400">Instructor</TableHead>
                                    <TableHead className="text-slate-400">Class</TableHead>
                                    <TableHead className="text-slate-400">Student</TableHead>
                                    <TableHead className="text-slate-400">Tuition Paid</TableHead>
                                    <TableHead className="text-right text-purple-400">Earning</TableHead>
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
                                        <TableRow key={earning.id} className="border-slate-800 hover:bg-slate-800/30">
                                            <TableCell className="text-slate-400">{formatDate(earning.created_at)}</TableCell>
                                            <TableCell className="font-medium text-slate-200">{instructorName}</TableCell>
                                            <TableCell className="text-slate-300">{cls?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-slate-300">{stu?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-slate-500">{formatCurrency(pay?.amount || 0)}</TableCell>
                                            <TableCell className="text-right font-mono text-purple-400">
                                                +{formatCurrency(earning.amount)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">No instructor earnings found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                      </div>
                  </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="affiliate-details" className="mt-4">
              <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                      <CardTitle className="text-lg">Detailed Affiliate Commissions</CardTitle>
                      <CardDescription>Line-by-line record of commissions generated from referrals.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="rounded-md border border-slate-800 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-950 border-slate-800 hover:bg-transparent">
                                    <TableHead className="text-slate-400">Date</TableHead>
                                    <TableHead className="text-slate-400">Affiliate</TableHead>
                                    <TableHead className="text-slate-400">Referred Student</TableHead>
                                    <TableHead className="text-slate-400">Class Source</TableHead>
                                    <TableHead className="text-right text-orange-400">Commission ({affiliateRatePct}%)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.commissions.length > 0 ? reportData.commissions.map((comm) => {
                                    const stu = students.find(s => s.id === comm.student_id);
                                    const aff = users.find(u => u.id === comm.affiliate_id);
                                    const cls = classes.find(c => c.id === comm.class_id);
                                    
                                    return (
                                        <TableRow key={comm.id} className="border-slate-800 hover:bg-slate-800/30">
                                            <TableCell className="text-slate-400">{formatDate(comm.created_at)}</TableCell>
                                            <TableCell className="font-medium text-slate-200">{aff?.name || aff?.full_name || 'Unknown'}</TableCell>
                                            <TableCell className="text-slate-300">{stu?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-slate-500 text-sm">{cls?.name || 'Unknown'}</TableCell>
                                            <TableCell className="text-right font-mono text-orange-400">
                                                +{formatCurrency(comm.amount)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">No affiliate commissions found.</TableCell>
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