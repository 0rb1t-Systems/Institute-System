import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, DollarSign, CreditCard, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import InvoiceView from './InvoiceView';

const StudentFinanceList = ({ students, financials, onRecordPayment, onChargeBalance, onEditPayment, onSendReminder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const filteredData = React.useMemo(() => {
      const filtered = financials.filter(f => {
          const searchLower = searchTerm.toLowerCase();
          return (
              f.student.name.toLowerCase().includes(searchLower) ||
              f.student.student_code.toLowerCase().includes(searchLower)
          );
      });
      return filtered;
  }, [financials, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const currentData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSearchChange = (e) => {
      setSearchTerm(e.target.value);
      setCurrentPage(1);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 border-b border-[var(--ds-border,#DDE5DF)] px-5 py-4 md:flex-row md:items-center md:justify-between">
           <div className="flex flex-col gap-1">
               <CardTitle className="text-base font-semibold">Student Billing Status</CardTitle>
               <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">{filteredData.length} Students Found</p>
           </div>
           <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--ds-text-tertiary,#8A978E)]" />
              <Input 
                placeholder="Search student..." 
                className="h-9 pl-8" 
                value={searchTerm}
                onChange={handleSearchChange}
              />
           </div>
      </CardHeader>
      <CardContent className="p-0">
         <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                        <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Student</TableHead>
                        <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Class</TableHead>
                        <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Fee Details</TableHead>
                        <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Reg. Fee</TableHead>
                        <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Paid</TableHead>
                        <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Balance</TableHead>
                        <TableHead className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Status</TableHead>
                        <TableHead className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentData.length > 0 ? currentData.map((item) => (
                        <TableRow key={item.student.id} className="border-[var(--ds-border,#DDE5DF)] transition-colors hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                            <TableCell className="px-5 py-3">
                                <div className="font-medium text-[var(--ds-text-primary,#122018)]">{item.student.name}</div>
                                <div className="text-xs font-medium text-[var(--ds-primary,#1F8A5B)]">{item.student.student_code}</div>
                            </TableCell>
                            <TableCell className="px-5 py-3">
                                {item.activeClass ? (
                                    <span className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">{item.activeClass.name}</span>
                                ) : (
                                    <span className="text-sm italic text-[var(--ds-text-tertiary,#8A978E)]">Not Enrolled</span>
                                )}
                            </TableCell>
                            <TableCell className="px-5 py-3">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-[var(--ds-text-primary,#122018)]">{formatCurrency(item.classFee)}</span>
                                    {item.discountTotal > 0 && (
                                        <span className="text-[10px] text-[var(--ds-primary,#1F8A5B)]">
                                            (Orig: {formatCurrency(item.originalFee)} - {formatCurrency(item.discountTotal)} Disc)
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="px-5 py-3">
                                {item.registrationPaid ? (
                                    <Badge className="border-0 bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)] hover:bg-[var(--ds-primary-soft,#ECFDF5)]">Paid</Badge>
                                ) : (
                                    <Badge variant="outline" className="border-[var(--ds-warning,#C2410C)]/40 bg-[var(--ds-warning-bg,#FFF7ED)] text-[var(--ds-warning,#C2410C)]">Pending</Badge>
                                )}
                            </TableCell>
                            <TableCell className="px-5 py-3 text-[var(--ds-text-secondary,#5B6B61)]">{formatCurrency(item.totalTuitionPaid)}</TableCell>
                            <TableCell className="px-5 py-3 font-bold text-[var(--ds-danger,#DC2626)]">
                                {item.balance > 0 ? formatCurrency(item.balance) : <span className="text-[var(--ds-primary,#1F8A5B)]">{formatCurrency(0)}</span>}
                                {item.totalPending > 0 && (
                                    <div className="mt-0.5 text-[10px] font-normal text-[var(--ds-warning,#C2410C)]">
                                        {formatCurrency(item.totalPending)} Pending
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="px-5 py-3">
                                {item.totalPending > 0 ? (
                                    <Badge className="border-0 bg-[var(--ds-warning-bg,#FFF7ED)] text-[var(--ds-warning,#C2410C)] hover:bg-[var(--ds-warning-bg,#FFF7ED)]">Inv. Sent</Badge>
                                ) : item.balance > 0 ? (
                                    <Badge className="border-0 bg-[var(--ds-danger-bg,#FEF2F2)] text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)]">Overdue</Badge>
                                ) : (
                                    <Badge className="border-0 bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)] hover:bg-[var(--ds-primary-soft,#ECFDF5)]">Fully Paid</Badge>
                                )}
                            </TableCell>
                            <TableCell className="px-5 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                    {item.balance > 0 && (
                                        <Button size="sm" variant="outline" className="h-8 border-[var(--ds-warning,#C2410C)]/40 text-[var(--ds-warning,#C2410C)] hover:bg-[var(--ds-warning-bg,#FFF7ED)]" onClick={() => onChargeBalance(item.student.id)} title="Create Charge/Invoice">
                                            <CreditCard className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-8" onClick={() => onRecordPayment(item.student.id)}>
                                        <DollarSign className="h-3.5 w-3.5 md:mr-1" />
                                        <span className="hidden md:inline">Pay</span>
                                    </Button>
                                    
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-[var(--ds-primary,#1F8A5B)] hover:bg-[var(--ds-primary-soft,#ECFDF5)] hover:text-[var(--ds-primary,#1F8A5B)]" onClick={() => setSelectedStudent(item)} title="Edit / View History">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
                                            {selectedStudent && (
                                                <InvoiceView 
                                                    student={selectedStudent.student}
                                                    payments={selectedStudent.payments}
                                                    enrollment={selectedStudent.activeEnrollment}
                                                    activeClass={selectedStudent.activeClass}
                                                    onEditPayment={onEditPayment}
                                                />
                                            )}
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={8} className="py-12 text-center text-[var(--ds-text-secondary,#5B6B61)]">
                                No students matching your criteria found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
         </div>

         {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-[var(--ds-border,#DDE5DF)] px-5 py-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium text-[var(--ds-text-secondary,#5B6B61)]">
                    Page {currentPage} of {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
         )}
      </CardContent>
    </Card>
  );
};

export default StudentFinanceList;
