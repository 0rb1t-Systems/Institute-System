import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Filter, RefreshCcw, Download, Loader2 } from 'lucide-react';

const AttendanceReportFilters = ({ filters, setFilters, availableClasses, clearFilters, onExport, isExporting, totalRecords }) => {
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 shadow-lg mb-6">
      <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-col">
                  <CardTitle className="text-lg flex items-center gap-2 text-white">
                      <Filter className="h-5 w-5 text-blue-500" /> Filter Records
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-1">Showing {totalRecords || 0} filtered records</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearFilters} 
                    disabled={isExporting}
                    className="flex-1 sm:flex-none text-slate-300 border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-white"
                  >
                      <RefreshCcw className="h-4 w-4 mr-2" /> Clear
                  </Button>
                  <Button 
                    onClick={onExport} 
                    disabled={isExporting || totalRecords === 0}
                    size="sm"
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white border-none shadow-md"
                  >
                      {isExporting ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting...</>
                      ) : (
                          <><Download className="h-4 w-4 mr-2" /> Download Excel</>
                      )}
                  </Button>
              </div>
          </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3 items-end">
          <div className="space-y-2">
              <Label className="text-slate-300">Class</Label>
              <Select value={filters.classId} onValueChange={(val) => handleFilterChange('classId', val)} disabled={isExporting}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                      <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="all">All Classes</SelectItem>
                      {availableClasses.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>

          <div className="space-y-2">
              <Label className="text-slate-300">From Date</Label>
              <Input 
                type="date" 
                className="bg-slate-950 border-slate-800 text-white" 
                value={filters.dateFrom} 
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)} 
                disabled={isExporting}
              />
          </div>

          <div className="space-y-2">
              <Label className="text-slate-300">To Date</Label>
              <Input 
                type="date" 
                className="bg-slate-950 border-slate-800 text-white" 
                value={filters.dateTo} 
                onChange={(e) => handleFilterChange('dateTo', e.target.value)} 
                disabled={isExporting}
              />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceReportFilters;