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
          present: 'border-green-500 text-green-400 bg-green-500/10',
          absent: 'border-red-500 text-red-400 bg-red-500/10',
          late: 'border-yellow-500 text-yellow-400 bg-yellow-500/10',
          excused: 'border-blue-500 text-blue-400 bg-blue-500/10'
      };
      return (
          <Badge variant="outline" className={`uppercase text-[10px] tracking-wide font-bold px-2.5 py-0.5 ${styles[status] || styles.excused}`}>
              {status}
          </Badge>
      );
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 shadow-xl flex flex-col">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
                <ListOrdered className="h-5 w-5 text-blue-500" /> 
                Filtered Records 
                <Badge variant="secondary" className="ml-2 bg-slate-800 text-slate-300">
                    {records.length} Total
                </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="text-sm text-slate-400">Rows:</span>
                <Select value={itemsPerPage.toString()} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                    <SelectTrigger className="h-8 w-[70px] bg-slate-950 border-slate-800 text-white text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
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
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-950/50">
                                <TableRow className="border-slate-800 hover:bg-transparent">
                                    <TableHead className="text-slate-300 py-4 px-6">Student Name</TableHead>
                                    <TableHead className="text-slate-300 py-4 px-6">Student ID</TableHead>
                                    <TableHead className="text-slate-300 py-4 px-6 hidden md:table-cell">Class</TableHead>
                                    <TableHead className="text-slate-300 py-4 px-6">Date</TableHead>
                                    <TableHead className="text-slate-300 py-4 px-6 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {currentRecords.length > 0 ? (
                                currentRecords.map(record => (
                                    <TableRow key={record.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                                        <TableCell className="font-medium text-slate-200 px-6">
                                            {record.studentName}
                                            <div className="text-xs text-slate-500 md:hidden mt-1">{record.className}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-400 font-mono text-sm px-6">
                                            {record.studentCode}
                                        </TableCell>
                                        <TableCell className="text-slate-400 hidden md:table-cell px-6">
                                            {record.className}
                                        </TableCell>
                                        <TableCell className="text-slate-300 whitespace-nowrap px-6">
                                            {format(new Date(record.date), 'MMM dd, yyyy')}
                                        </TableCell>
                                        <TableCell className="text-center px-6">
                                            {getStatusBadge(record.status)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-16 text-slate-500">
                                        No attendance records found for the selected filters.
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPages > 0 && (
                        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/20">
                            <div className="text-sm text-slate-400 hidden sm:block">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, records.length)} of {records.length}
                            </div>
                            
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white hidden sm:flex h-8"
                                >
                                    First
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white h-8 w-8"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                
                                <div className="text-sm text-slate-300 px-3 font-medium">
                                    {currentPage} / {totalPages}
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white h-8 w-8"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white hidden sm:flex h-8"
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