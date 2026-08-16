import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, DollarSign, FileText, Send, CreditCard, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
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
      setCurrentPage(1); // Reset to first page on search
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
           <div className="flex flex-col gap-1">
               <CardTitle>Student Billing Status</CardTitle>
               <p className="text-sm text-slate-500">{filteredData.length} Students Found</p>
           </div>
           <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search student..." 
                className="pl-8 bg-slate-950/50 border-slate-700" 
                value={searchTerm}
                onChange={handleSearchChange}
              />
           </div>
        </div>
      </CardHeader>
      <CardContent>
         <div className="overflow-x-auto rounded-md border border-slate-800">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-950 border-slate-800 hover:bg-slate-950">
                        <TableHead className="text-slate-400 font-medium">Student</TableHead>
                        <TableHead className="text-slate-400 font-medium">Class</TableHead>
                        <TableHead className="text-slate-400 font-medium">Fee Details</TableHead>
                        <TableHead className="text-slate-400 font-medium">Reg. Fee</TableHead>
                        <TableHead className="text-slate-400 font-medium">Paid</TableHead>
                        <TableHead className="text-slate-400 font-medium">Balance</TableHead>
                        <TableHead className="text-slate-400 font-medium">Status</TableHead>
                        <TableHead className="text-right text-slate-400 font-medium">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {currentData.length > 0 ? currentData.map((item) => (
                        <TableRow key={item.student.id} className="border-slate-800 hover:bg-slate-800/50">
                            <TableCell>
                                <div className="font-medium text-slate-200">{item.student.name}</div>
                                <div className="text-xs text-slate-500 font-mono">{item.student.student_code}</div>
                            </TableCell>
                            <TableCell>
                                {item.activeClass ? (
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-300">{item.activeClass.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-slate-500 italic text-sm">Not Enrolled</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-400">{formatCurrency(item.classFee)}</span>
                                    {item.discountTotal > 0 && (
                                        <span className="text-[10px] text-green-400">
                                            (Orig: {formatCurrency(item.originalFee)} - {formatCurrency(item.discountTotal)} Disc)
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {item.registrationPaid ? (
                                    <Badge className="bg-green-900/20 text-green-400 border-0 hover:bg-green-900/30">Paid</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 bg-yellow-500/10">Pending</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-slate-300">{formatCurrency(item.totalTuitionPaid)}</TableCell>
                            <TableCell className="font-bold text-red-400">
                                {item.balance > 0 ? formatCurrency(item.balance) : <span className="text-green-500">{formatCurrency(0)}</span>}
                                {item.totalPending > 0 && (
                                    <div className="text-[10px] text-orange-400 font-normal mt-0.5">
                                        {formatCurrency(item.totalPending)} Pending
                                    </div>
                                )}
                            </TableCell>
                            <TableCell>
                                {item.totalPending > 0 ? (
                                    <Badge className="bg-orange-900/20 text-orange-300 border-0 hover:bg-orange-900/30">Inv. Sent</Badge>
                                ) : item.balance > 0 ? (
                                    <Badge variant="destructive" className="bg-red-900/20 text-red-400 border-0 hover:bg-red-900/30">Overdue</Badge>
                                ) : (
                                    <Badge className="bg-green-600/20 text-green-400 border-0 hover:bg-green-600/30">Fully Paid</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {item.balance > 0 && (
                                        <Button size="sm" variant="outline" className="h-8 border-orange-500/50 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400" onClick={() => onChargeBalance(item.student.id)} title="Create Charge/Invoice">
                                            <CreditCard className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-8 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={() => onRecordPayment(item.student.id)}>
                                        <DollarSign className="h-3.5 w-3.5 md:mr-1" />
                                        <span className="hidden md:inline">Pay</span>
                                    </Button>
                                    
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20" onClick={() => setSelectedStudent(item)} title="Edit / View History">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-4xl bg-transparent border-none shadow-none p-0">
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
                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                No students matching your criteria found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
         </div>

         {/* Pagination Controls */}
         {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0 bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-400 font-medium">
                    Page {currentPage} of {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0 bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
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