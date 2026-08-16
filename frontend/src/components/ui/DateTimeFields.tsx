import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  isToday,
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn, parseLocalDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function pad(n: number | string): string {
  return String(n).padStart(2, '0');
}

function splitYmd(value?: string | null): { y: string; m: string; d: string } {
  if (!value) return { y: '', m: '', d: '' };
  const parsed = parseLocalDate(value);
  if (parsed) {
    return {
      y: String(parsed.getFullYear()),
      m: pad(parsed.getMonth() + 1),
      d: pad(parsed.getDate()),
    };
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: m[1], m: m[2], d: m[3] };
  return { y: '', m: '', d: '' };
}

function ymdToDate(ymd?: string | null): Date | null {
  if (!ymd) return null;
  const { y, m, d } = splitYmd(ymd);
  if (!y || !m || !d) return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseHm(value?: string | null): { hour24: number; minute: number } {
  const [h = '14', m = '00'] = String(value || '14:00').split(':');
  const hour24 = Math.min(23, Math.max(0, Number(h) || 0));
  const minute = Math.min(59, Math.max(0, Number(m) || 0));
  return { hour24, minute };
}

function to12h(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function to24h(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05, … 55
const PERIODS: Array<'AM' | 'PM'> = ['AM', 'PM'];

type CalendarPanelProps = {
  selected: Date | null;
  month: Date;
  onMonthChange: (d: Date) => void;
  onSelect: (d: Date) => void;
  minDate?: Date | null;
  onClear?: () => void;
};

function CalendarPanel({
  selected,
  month,
  onMonthChange,
  onSelect,
  minDate,
  onClear,
}: CalendarPanelProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const list: Date[] = [];
    let cur = start;
    while (cur <= end) {
      list.push(cur);
      cur = addDays(cur, 1);
    }
    return list;
  }, [month]);

  return (
    <div className="w-full max-w-[300px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm font-semibold text-slate-100">
          {format(month, 'MMMM yyyy')}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMonthChange(subMonths(month, 1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMonthChange(addMonths(month, 1));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="h-8 flex items-center justify-center text-[11px] font-medium text-slate-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const outside = !isSameMonth(day, month);
          const selectedDay = !!(selected && isSameDay(day, selected));
          const today = isToday(day);
          const disabled = minDate
            ? isBefore(day, new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()))
            : false;
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!disabled) onSelect(day);
              }}
              className={cn(
                'h-9 w-9 mx-auto flex items-center justify-center rounded-md text-sm transition-colors',
                outside && !selectedDay && 'text-slate-600',
                !outside && !selectedDay && 'text-slate-200 hover:bg-slate-800',
                today && !selectedDay && 'ring-1 ring-blue-500/50',
                selectedDay && 'bg-blue-600 text-white hover:bg-blue-500 font-semibold',
                disabled && 'opacity-30 cursor-not-allowed'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800 px-1">
        <button
          type="button"
          className="text-sm font-medium text-blue-400 hover:text-blue-300 px-1 py-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear?.();
          }}
        >
          Clear
        </button>
        <button
          type="button"
          className="text-sm font-medium text-blue-400 hover:text-blue-300 px-1 py-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const todayDate = new Date();
            onMonthChange(todayDate);
            onSelect(todayDate);
          }}
        >
          Today
        </button>
      </div>
    </div>
  );
}

type TimeColumnProps = {
  options: Array<string | number>;
  value: string | number;
  onChange: (v: string | number) => void;
  formatOption?: (v: string | number) => string;
};

function TimeColumn({
  options,
  value,
  onChange,
  formatOption = (v) => String(v).padStart(2, '0'),
}: TimeColumnProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [value]);

  return (
    <div className="h-[220px] w-14 overflow-y-auto overscroll-contain border-l border-slate-800 first:border-l-0">
      <div className="flex flex-col py-1 gap-0.5">
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={String(opt)}
              type="button"
              ref={active ? activeRef : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(opt);
              }}
              className={cn(
                'h-8 shrink-0 mx-1 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              {formatOption(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TriggerProps = {
  id?: string;
  disabled?: boolean;
  display: string;
  placeholder: string;
  open: boolean;
  onToggle: () => void;
};

function Trigger({ id, disabled, display, placeholder, open, onToggle }: TriggerProps) {
  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      aria-expanded={open}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 text-left text-sm',
        'hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40',
        open && 'border-blue-500/60 ring-2 ring-blue-500/30',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <span className={cn('font-mono tracking-wide', display ? 'text-slate-100' : 'text-slate-500')}>
        {display || placeholder}
      </span>
      <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0" />
    </button>
  );
}

type DatePickerFieldProps = {
  value?: string;
  onChange: (ymd: string) => void;
  disabled?: boolean;
  min?: string;
  className?: string;
  id?: string;
};

/** Inline calendar date picker. Value is YYYY-MM-DD. */
export function DatePickerField({
  value,
  onChange,
  disabled,
  min,
  className,
  id,
}: DatePickerFieldProps) {
  const selected = ymdToDate(value);
  const minDate = ymdToDate(min);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => selected || new Date());

  useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);

  const display = selected ? format(selected, 'yyyy-MM-dd') : '';

  return (
    <div className={cn('w-full', className)} data-datepicker>
      <Trigger
        id={id}
        disabled={disabled}
        display={display}
        placeholder="yyyy-mm-dd"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          className="mt-2 rounded-lg border border-slate-700 bg-slate-950 p-3 shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CalendarPanel
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            minDate={minDate}
            onClear={() => {
              onChange('');
              setOpen(false);
            }}
            onSelect={(d) => {
              onChange(toYmd(d));
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

type TimePickerFieldProps = {
  value?: string;
  onChange: (hm: string) => void;
  disabled?: boolean;
  className?: string;
};

/** Inline hour / minute / AM-PM picker. Value is HH:mm (24h). */
export function TimePickerField({ value = '', onChange, disabled, className }: TimePickerFieldProps) {
  const { hour24, minute } = parseHm(value);
  const snappedMinute = MINUTES.includes(minute)
    ? minute
    : MINUTES.reduce((best, m) => (Math.abs(m - minute) < Math.abs(best - minute) ? m : best), 0);
  const { hour12, period } = to12h(hour24);
  const [open, setOpen] = useState(false);

  const display = value ? `${pad(hour12)}:${pad(snappedMinute)} ${period}` : '';

  const emit = (h12: number, min: number, per: 'AM' | 'PM') => {
    onChange(`${pad(to24h(h12, per))}:${pad(min)}`);
  };

  return (
    <div className={cn('w-full', className)} data-datepicker>
      <Trigger
        disabled={disabled}
        display={display}
        placeholder="--:-- --"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          className="mt-2 rounded-lg border border-slate-700 bg-slate-950 p-2 shadow-lg"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center">
            <TimeColumn
              options={HOURS_12}
              value={hour12}
              onChange={(h) => emit(Number(h), snappedMinute, period)}
            />
            <TimeColumn
              options={MINUTES}
              value={snappedMinute}
              onChange={(m) => emit(hour12, Number(m), period)}
            />
            <TimeColumn
              options={PERIODS}
              value={period}
              onChange={(p) => emit(hour12, snappedMinute, p as 'AM' | 'PM')}
              formatOption={(v) => String(v)}
            />
          </div>
          <div className="flex justify-end pt-2 px-1">
            <Button type="button" size="sm" className="h-8 gap-1" onClick={() => setOpen(false)}>
              <Check className="h-3.5 w-3.5" /> Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type DateTimePickerFieldProps = {
  date?: string;
  time?: string;
  onChange: (next: { date: string; time: string }) => void;
  disabled?: boolean;
  min?: string;
  className?: string;
  id?: string;
};

/** Inline combined calendar + time picker. */
export function DateTimePickerField({
  date,
  time = '14:00',
  onChange,
  disabled,
  min,
  className,
  id,
}: DateTimePickerFieldProps) {
  const selected = ymdToDate(date);
  const minDate = ymdToDate(min);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => selected || new Date());
  const { hour24, minute } = parseHm(time);
  const snappedMinute = MINUTES.includes(minute)
    ? minute
    : MINUTES.reduce((best, m) => (Math.abs(m - minute) < Math.abs(best - minute) ? m : best), 0);
  const { hour12, period } = to12h(hour24);

  useEffect(() => {
    if (selected) setMonth(selected);
  }, [date]);

  const display = selected
    ? `${format(selected, 'yyyy-MM-dd')}, ${pad(hour12)}:${pad(snappedMinute)} ${period}`
    : '';

  const emitTime = (h12: number, minVal: number, per: 'AM' | 'PM', keepDate = date || '') => {
    const nextDate = keepDate || toYmd(new Date());
    onChange({
      date: nextDate,
      time: `${pad(to24h(h12, per))}:${pad(minVal)}`,
    });
  };

  return (
    <div className={cn('w-full', className)} data-datepicker>
      <Trigger
        id={id}
        disabled={disabled}
        display={display}
        placeholder="yyyy-mm-dd, --:-- --"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          className="mt-2 rounded-lg border border-slate-700 bg-slate-950 shadow-lg overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col sm:flex-row">
            <div className="p-3 sm:border-r border-slate-800">
              <CalendarPanel
                selected={selected}
                month={month}
                onMonthChange={setMonth}
                minDate={minDate}
                onClear={() => {
                  onChange({ date: '', time: time || '14:00' });
                }}
                onSelect={(d) => {
                  onChange({
                    date: toYmd(d),
                    time: time || '14:00',
                  });
                }}
              />
            </div>
            <div className="flex flex-col p-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1">Time</p>
              <div className="flex justify-center">
                <TimeColumn
                  options={HOURS_12}
                  value={hour12}
                  onChange={(h) => emitTime(Number(h), snappedMinute, period)}
                />
                <TimeColumn
                  options={MINUTES}
                  value={snappedMinute}
                  onChange={(m) => emitTime(hour12, Number(m), period)}
                />
                <TimeColumn
                  options={PERIODS}
                  value={period}
                  onChange={(p) => emitTime(hour12, snappedMinute, p as 'AM' | 'PM')}
                  formatOption={(v) => String(v)}
                />
              </div>
              <div className="flex justify-end pt-2 px-1">
                <Button type="button" size="sm" className="h-8 gap-1" onClick={() => setOpen(false)}>
                  <Check className="h-3.5 w-3.5" /> Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Split ISO / datetime-local into { date: YYYY-MM-DD, time: HH:mm }. */
export function splitDateTimeLocal(value?: string | null): { date: string; time: string } {
  if (!value) return { date: '', time: '14:00' };
  const raw = String(value);
  if (raw.includes('T')) {
    const [d, t = '14:00'] = raw.split('T');
    return { date: d.slice(0, 10), time: t.slice(0, 5) || '14:00' };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: raw, time: '14:00' };
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return { date: '', time: '14:00' };
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
  };
}

/** Combine YYYY-MM-DD + HH:mm → datetime-local string. */
export function combineDateAndTime(date: string, time: string): string {
  if (!date) return '';
  const t = time && time.includes(':') ? time.slice(0, 5) : '14:00';
  return `${date}T${t}`;
}
