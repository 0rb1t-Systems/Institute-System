import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Tenant currency defaults — AuthContext syncs these from Institution Settings. */
let appCurrency = 'USD'
let appCurrencySymbol: string | null = '$'

export function setAppCurrency(currency?: string | null, symbol?: string | null) {
  const code = String(currency || 'USD').trim().toUpperCase()
  appCurrency = /^[A-Z]{3}$/.test(code) ? code : 'USD'
  const sym = String(symbol ?? '').trim()
  appCurrencySymbol = sym ? sym.slice(0, 8) : null
}

export function getAppCurrency(): { currency: string; symbol: string | null } {
  return { currency: appCurrency, symbol: appCurrencySymbol }
}

/**
 * Format money using Institution Settings currency when available.
 * Pass `currency` / `symbol` to override for a single call.
 */
export const formatCurrency = (
  amount: number | string,
  options?: { currency?: string | null; symbol?: string | null },
) => {
  const value = Number(amount)
  const safe = Number.isFinite(value) ? value : 0
  const currency = String(options?.currency || appCurrency || 'USD')
    .trim()
    .toUpperCase()
  const symbol =
    options?.symbol !== undefined
      ? String(options.symbol || '').trim() || null
      : appCurrencySymbol

  if (symbol) {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe)
    return `${symbol}${formatted}`
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
    }).format(safe)
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(safe)
  }
};

/** Parse date-only (YYYY-MM-DD) as local calendar date to avoid UTC day-shift. */
export const parseLocalDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  // YYYY-MM → use first day of that month (callers may adjust to month-end)
  const yearMonth = raw.match(/^(\d{4})-(\d{2})$/);
  if (yearMonth) {
    const y = Number(yearMonth[1]);
    const m = Number(yearMonth[2]) - 1;
    if (m < 0 || m > 11) return null;
    const local = new Date(y, m, 1);
    // Avoid JS Date(0–99) → 1900+year mapping
    local.setFullYear(y);
    return Number.isNaN(local.getTime()) ? null : local;
  }

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]) - 1;
    const d = Number(dateOnly[3]);
    if (m < 0 || m > 11 || d < 1 || d > 31) return null;
    const local = new Date(y, m, d);
    // Critical: new Date(2, 9, 1) becomes Oct 1, 1902 without setFullYear
    local.setFullYear(y);
    return Number.isNaN(local.getTime()) ? null : local;
  }

  // Timestamps: use the calendar day in local time (no offset hack)
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

/** True when a date is plausible for class / ID validity (avoids year 0002 → 1902 bugs). */
export const isPlausibleCalendarDate = (date?: Date | null, minYear = 2000, maxYear = 2100): boolean => {
  if (!date || Number.isNaN(date.getTime())) return false;
  const y = date.getFullYear();
  return y >= minYear && y <= maxYear;
};

/** Last calendar day of the month for the given date. */
export const endOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

/** Extract duration in months from number or text like "3 bilood" / "6 months". */
export const parseDurationMonths = (value?: string | number | null, fallback = 12): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (value == null || value === '') return fallback;
  const digits = parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isFinite(digits) && digits > 0 ? digits : fallback;
};

export const formatDate = (dateString?: string | Date | null) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseLocalDate(dateString);
    if (!date) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid Date';
  }
};

/** Date + time for assignment deadlines (local). */
export const formatDateTime = (dateString?: string | Date | null) => {
  if (!dateString) return 'N/A';
  try {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid Date';
  }
};

/** Convert ISO timestamp → value for <input type="datetime-local"> (local time, no UTC shift). */
export const toLocalDateTimeInputValue = (dateString?: string | Date | null) => {
  if (!dateString) return '';
  const date = dateString instanceof Date ? dateString : new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const addDays = (dateStr: string | Date, days: number) => {
    const result = new Date(dateStr);
    result.setDate(result.getDate() + days);
    return result;
};

export const getDaysRemaining = (targetDate: string | Date) => {
    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
};

export const getMonthsBetween = (startDateStr?: string, endDateStr?: string) => {
  if (!startDateStr || !endDateStr) return [];
  
  const startParts = startDateStr.split('-');
  const endParts = endDateStr.split('-');
  
  if (startParts.length < 2 || endParts.length < 2) return [];

  let startYear = parseInt(startParts[0]);
  let startMonth = parseInt(startParts[1]); 
  
  let endYear = parseInt(endParts[0]);
  let endMonth = parseInt(endParts[1]); 
  
  const months: string[] = [];
  
  let currentYear = startYear;
  let currentMonth = startMonth;
  
  let count = 0;
  const MAX_MONTHS = 100; 
  
  while (count < MAX_MONTHS) { 
      const monthStr = String(currentMonth).padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}`;
      months.push(dateStr);
      
      if (currentYear === endYear && currentMonth === endMonth) break;
      if (currentYear > endYear) break;

      currentMonth++;
      if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
      }
      
      count++;
  }
  
  return months;
};

export const isValidEmail = (email?: string) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
