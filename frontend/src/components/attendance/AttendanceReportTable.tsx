import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Loader2, ListOrdered } from 'lucide-react';
import { format } from 'date-fns';

const AttendanceReportTable = ({ records, loading }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const totalPages = Math.ceil(records.length / itemsPerPage);
  
  if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
  }

  const currentRecords = records.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  const getStatusBadge = (status) => {
      const styles = {
          present: 'border-[var(--ds-accent,#1F8A5B)] text-[var(--ds-accent,#1F8A5B)] bg-[var(--ds-success-bg,#ECFDF5)]',
          absent: 'border-[var(--ds-danger,#DC2626)] text-[var(--ds-danger,#DC2626)] bg-[var(--ds-danger-bg,#FEF2F2)]',
          late: 'border-[var(--ds-warning,#C2410C)] text-[var(--ds-warning,#C2410C)] bg-[var(--ds-warning-bg,#FFF7ED)]',
          excused: 'border-[var(--ds-info,#2563EB)] text-[var(--ds-info,#2563EB)] bg-[var(--ds-info-bg,#EFF6FF)]'
      };
      return (
          <Badge variant="outline" className={`uppercase text-[10px] tracking-wide font-bold px-2.5 py-0.5 ${styles[status] || styles.excused}`}>
              {status}
          </Badge>
      );
  };

  return (
    <Card className="flex flex-col">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[var(--ds-border,#DDE5DF)]">
            <CardTitle className="text-lg flex items-center gap-2">
                <ListOrdered className="h-5 w-5 text-[var(--ds-accent,#1F8A5B)]" /> 
                Filtered Records 
                <Badge variant="secondary" className="ml-2">
                    {records.length} Total
                </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">Rows:</span>
                <Select value={itemsPerPage.toString()} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px] text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent className="p-0 flex flex-col">
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="py-4 px-6">Student Name</TableHead>
                                    <TableHead className="py-4 px-6">Student ID</TableHead>
                                    <TableHead className="py-4 px-6 hidden md:table-cell">Class</TableHead>
                                    <TableHead className="py-4 px-6">Date</TableHead>
                                    <TableHead className="py-4 px-6 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {currentRecords.length > 0 ? (
                                currentRecords.map(record => (
                                    <TableRow key={record.id}>
                                        <TableCell className="font-medium px-6">
                                            {record.studentName}
                                            <div className="text-xs text-[var(--ds-text-tertiary,#8A978E)] md:hidden mt-1">{record.className}</div>
                                        </TableCell>
                                        <TableCell className="text-[var(--ds-text-secondary,#5B6B61)] font-mono text-sm px-6">
                                            {record.studentCode}
                                        </TableCell>
                                        <TableCell className="text-[var(--ds-text-secondary,#5B6B61)] hidden md:table-cell px-6">
                                            {record.className}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap px-6">
                                            {format(new Date(record.date), 'MMM dd, yyyy')}
                                        </TableCell>
                                        <TableCell className="text-center px-6">
                                            {getStatusBadge(record.status)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-16 text-[var(--ds-text-tertiary,#8A978E)]">
                                        No attendance records found for the selected filters.
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPages > 0 && (
                        <div className="flex items-center justify-between p-4 border-t border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)]">
                            <div className="text-sm text-[var(--ds-text-secondary,#5B6B61)] hidden sm:block">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, records.length)} of {records.length}
                            </div>
                            
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="hidden sm:flex h-8"
                                >
                                    First
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                
                                <div className="text-sm px-3 font-medium">
                                    {currentPage} / {totalPages}
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 w-8"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="hidden sm:flex h-8"
                                >
                                    Last
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </CardContent>
    </Card>
  );
};

export default AttendanceReportTable;
