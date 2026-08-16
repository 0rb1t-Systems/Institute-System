import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon } from 'lucide-react';
import { dashboardStyles } from './InstructorDashboardStyles';

const MonthYearSelector = ({ selectedDate, onChange }) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i); // Last 5 years
  
  const months = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  const handleMonthChange = (val) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(parseInt(val));
    onChange(newDate);
  };

  const handleYearChange = (val) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(parseInt(val));
    onChange(newDate);
  };

  return (
    <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800 backdrop-blur-sm">
      <div className="p-2 rounded-md bg-slate-800 text-slate-400">
        <CalendarIcon className="h-4 w-4" />
      </div>
      
      {/* Month Selector */}
      <Select 
        value={selectedDate.getMonth().toString()} 
        onValueChange={handleMonthChange}
      >
        <SelectTrigger className="w-[130px] bg-transparent border-none text-slate-200 focus:ring-0 focus:ring-offset-0 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-4 w-[1px] bg-slate-700 mx-1" />

      {/* Year Selector */}
      <Select 
        value={selectedDate.getFullYear().toString()} 
        onValueChange={handleYearChange}
      >
        <SelectTrigger className="w-[90px] bg-transparent border-none text-slate-200 focus:ring-0 focus:ring-offset-0 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default MonthYearSelector;