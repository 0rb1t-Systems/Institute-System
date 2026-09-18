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
    <Card className="mb-6">
      <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-col">
                  <CardTitle className="text-lg flex items-center gap-2">
                      <Filter className="h-5 w-5 text-[var(--ds-accent,#1F8A5B)]" /> Filter Records
                  </CardTitle>
                  <p className="text-xs text-[var(--ds-text-secondary,#5B6B61)] mt-1">Showing {totalRecords || 0} filtered records</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearFilters} 
                    disabled={isExporting}
                    className="flex-1 sm:flex-none"
                  >
                      <RefreshCcw className="h-4 w-4 mr-2" /> Clear
                  </Button>
                  <Button 
                    onClick={onExport} 
                    disabled={isExporting || totalRecords === 0}
                    size="sm"
                    className="flex-1 sm:flex-none inst-excel-btn"
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
              <Label>Class</Label>
              <Select value={filters.classId} onValueChange={(val) => handleFilterChange('classId', val)} disabled={isExporting}>
                  <SelectTrigger>
                      <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {availableClasses.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>

          <div className="space-y-2">
              <Label>From Date</Label>
              <Input 
                type="date" 
                value={filters.dateFrom} 
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)} 
                disabled={isExporting}
              />
          </div>

          <div className="space-y-2">
              <Label>To Date</Label>
              <Input 
                type="date" 
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
