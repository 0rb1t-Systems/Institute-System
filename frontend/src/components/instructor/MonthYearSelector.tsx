import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon } from 'lucide-react';

const MonthYearSelector = ({ selectedDate, onChange }) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

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
    newDate.setMonth(parseInt(val, 10));
    onChange(newDate);
  };

  const handleYearChange = (val) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(parseInt(val, 10));
    onChange(newDate);
  };

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-[var(--ds-radius-md,8px)] border border-slate-800 bg-slate-900/50 p-1.5 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)]"
      role="group"
      aria-label="Reporting period"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--ds-radius-sm,6px)] bg-slate-800 text-slate-400 [.tenant-shell_&]:bg-[var(--ds-surface-muted,#F7FAF8)] [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
        <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
      </div>

      <Select value={selectedDate.getMonth().toString()} onValueChange={handleMonthChange}>
        <SelectTrigger className="h-8 w-[120px] border-none bg-transparent text-slate-200 shadow-none focus:ring-0 focus:ring-offset-0 [.tenant-shell_&]:text-[13px] [.tenant-shell_&]:font-semibold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-slate-800 bg-slate-900 text-slate-200 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mx-0.5 h-4 w-px bg-slate-700 [.tenant-shell_&]:bg-[var(--ds-border,#DDE5DF)]" />

      <Select value={selectedDate.getFullYear().toString()} onValueChange={handleYearChange}>
        <SelectTrigger className="h-8 w-[84px] border-none bg-transparent text-slate-200 shadow-none focus:ring-0 focus:ring-offset-0 [.tenant-shell_&]:text-[13px] [.tenant-shell_&]:font-semibold [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-slate-800 bg-slate-900 text-slate-200 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
          {years.map((y) => (
            <SelectItem key={y} value={y.toString()}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default MonthYearSelector;
