import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileDown, Search, Wallet, AlertCircle, Gauge, TrendingUp, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const COLORS = ['#1F8A5B', '#3FA876', '#6BBF94', '#A7D9C0', '#5B6B61', '#8A978E'];

const cardShell =
  'overflow-hidden rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)] transition-shadow hover:border-[var(--ds-border-strong,#C5D0C8)] hover:shadow-[0_8px_28px_#1F8A5B18]';

const iconBadge =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[var(--ds-accent,#1F8A5B)]/15 bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-accent,#1F8A5B)] shadow-[inset_0_1px_0_#ffffff80]';

const chartTooltipStyle = {
  backgroundColor: 'var(--ds-surface,#fff)',
  border: '1px solid var(--ds-border,#DDE5DF)',
  borderRadius: 12,
  boxShadow: '0 8px 24px #1F8A5B14',
};

/** Matches FinancePage payment kinds (no DB type column — inferred carefully). */
const PAYMENT_KIND = {
  registration: 'registration',
  tuition: 'tuition',
  other: 'other',
} as const;

const PAYMENT_KIND_LABEL = {
  registration: 'Registration',
  tuition: 'Tuition / Class Fee',
  other: 'Other',
};

const isCompletedPayment = (p) => {
  const s = p?.status;
  return s === 'completed' || s == null || s === undefined || s === '';
};

/**
 * Infer display kind from how FinancePage persists payments:
 * - is_registration_fee → Registration
 * - note is YYYY-MM (tuition month) → Tuition / Class Fee
 * - else → Other
 * Do NOT use client month_paid alone — mapPayment fabricates it from paid_at for misc payments.
 */
const inferPaymentKind = (p) => {
  if (p?.is_registration_fee === true) return PAYMENT_KIND.registration;
  const note = String(p?.notes ?? p?.note ?? '').trim();
  if (/^\d{4}-\d{2}/.test(note)) return PAYMENT_KIND.tuition;
  return PAYMENT_KIND.other;
};

/** Calendar month the cash was actually received (Collected bucket). */
const receivedMonth = (p, monthKeyFn) =>
  monthKeyFn(p?.payment_date) || monthKeyFn(p?.paid_at);

/** Tuition installment month covered by this payment (from note YYYY-MM). */
const coveredTuitionMonth = (p, monthKeyFn) => {
  if (inferPaymentKind(p) !== PAYMENT_KIND.tuition) return null;
  const note = String(p?.notes ?? p?.note ?? '').trim();
  return monthKeyFn(note);
};

const paymentKindLabel = (kind) => PAYMENT_KIND_LABEL[kind] || PAYMENT_KIND_LABEL.other;

const kindBadgeClass = (kind) => {
  if (kind === PAYMENT_KIND.registration) return 'bg-[var(--ds-warning-bg,#FFF7ED)] text-[var(--ds-warning,#C2410C)] border-[var(--ds-warning,#C2410C)]/30';
  if (kind === PAYMENT_KIND.tuition) return 'bg-[var(--ds-info-bg,#EFF6FF)] text-[var(--ds-info,#2563EB)] border-[var(--ds-info,#2563EB)]/30';
  return 'bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-secondary,#5B6B61)] border-[var(--ds-border,#DDE5DF)]';
};

const FinanceReport = () => {
    const { payments, students, enrollments, classes } = useData();
    
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    const [statusFilter, setStatusFilter] = useState('all'); 
    const [classFilter, setClassFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const month = selectedDate.slice(0, 7);
    const [yStr, mStr] = month.split('-');
    const monthLabel = new Date(Number(yStr), Number(mStr) - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const monthKey = (value) => {
        if (!value) return null;
        const s = String(value);
        return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : null;
    };

    const monthlyFeeFor = (cls, enrollment) => {
        const totalFee = Number(cls?.fee || 0);
        const duration = Math.max(1, Number(cls?.duration_months || 1));
        const monthly = totalFee / duration;
        const discount = Number(enrollment?.discount_amount || 0);
        return Math.max(0, monthly - discount);
    };

    const matchesClassFilter = (p) => {
        if (classFilter === 'all') return true;
        return p.class_id === classFilter;
    };

    // A. Collected = completed cash actually received in the reference calendar month
    //    (tuition + registration + other). Uses paid_at / payment_date — not fee-month note.
    const collectedPayments = useMemo(() => {
        return payments.filter((p) => {
            if (!isCompletedPayment(p)) return false;
            if (receivedMonth(p, monthKey) !== month) return false;
            if (!matchesClassFilter(p)) return false;
            return true;
        });
    }, [payments, month, classFilter]);

    // B. Tuition installments that cover this fee-month (for unpaid / payment-rate only)
    const tuitionPaidForMonth = useMemo(() => {
        return payments.filter((p) => {
            if (!isCompletedPayment(p)) return false;
            if (inferPaymentKind(p) !== PAYMENT_KIND.tuition) return false;
            if (coveredTuitionMonth(p, monthKey) !== month) return false;
            if (!matchesClassFilter(p)) return false;
            return true;
        });
    }, [payments, month, classFilter]);

    const collectedBreakdown = useMemo(() => {
        const base = { tuition: 0, registration: 0, other: 0, total: 0 };
        collectedPayments.forEach((p) => {
            const amount = Number(p.amount || 0);
            const kind = inferPaymentKind(p);
            base[kind] += amount;
            base.total += amount;
        });
        return base;
    }, [collectedPayments]);

    // C. Unpaid — active enrollments due this month with no tuition payment (unchanged logic)
    const unpaidStudents = useMemo(() => {
        let relevantEnrollments = enrollments.filter(e => e.status === 'active');

        if (classFilter !== 'all') {
            relevantEnrollments = relevantEnrollments.filter(e => e.class_id === classFilter);
        }

        const unpaidList = [];
        relevantEnrollments.forEach(enr => {
            const student = students.find(s => s.id === enr.student_id);
            const cls = classes.find(c => c.id === enr.class_id);
            if (!student || !cls) return;

            const start = monthKey(cls.start_date);
            const end = monthKey(cls.end_date);
            if (!start || !end || month < start || month > end) return;

            const hasPaid = tuitionPaidForMonth.some(p =>
                p.student_id === enr.student_id &&
                (p.class_id === enr.class_id || !p.class_id)
            );

            if (!hasPaid) {
                unpaidList.push({
                    student,
                    class: cls,
                    amount: monthlyFeeFor(cls, enr),
                    paymentKind: PAYMENT_KIND.tuition,
                });
            }
        });
        return unpaidList;
    }, [enrollments, tuitionPaidForMonth, students, classes, month, classFilter]);

    // D. Table rows: all collected payments + unpaid dues
    const displayData = useMemo(() => {
        let data = [];
        if (statusFilter === 'all' || statusFilter === 'paid') {
             data = [...data, ...collectedPayments.map(t => ({
               type: 'paid',
               data: t,
               paymentKind: inferPaymentKind(t),
             }))];
        }
        if (statusFilter === 'all' || statusFilter === 'unpaid') {
             data = [...data, ...unpaidStudents.map(u => ({
               type: 'unpaid',
               data: u,
               paymentKind: u.paymentKind || PAYMENT_KIND.tuition,
             }))];
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(item => {
                const s = item.type === 'paid' 
                    ? students.find(st => st.id === item.data.student_id) 
                    : item.data.student;
                return s?.name?.toLowerCase().includes(lower) || s?.student_code?.toLowerCase().includes(lower);
            });
        }

        // Newest paid first; unpaid after
        data.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'paid' ? -1 : 1;
            if (a.type === 'paid') {
                const da = String(a.data.payment_date || '');
                const db = String(b.data.payment_date || '');
                return db.localeCompare(da);
            }
            return String(a.data.student?.name || '').localeCompare(String(b.data.student?.name || ''));
        });

        return data;
    }, [collectedPayments, unpaidStudents, statusFilter, searchTerm, students]);

    // E. Charts — same cash-received month rule as Collected
    const trendData = useMemo(() => {
        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const mLabel = d.toLocaleDateString('en-US', { month: 'short' });
            
            const total = payments
                .filter(p => {
                    if (!isCompletedPayment(p)) return false;
                    if (receivedMonth(p, monthKey) !== mStr) return false;
                    if (classFilter !== 'all' && p.class_id !== classFilter) return false;
                    return true;
                })
                .reduce((sum: any, p: any) => sum + Number(p.amount || 0), 0);
            
            result.push({ name: mLabel, revenue: total });
        }
        return result;
    }, [payments, classFilter]);

    const methodData = useMemo(() => {
        const counts: any = {};
        collectedPayments.forEach(p => {
            const key = p.method || 'other';
            counts[key] = (counts[key] || 0) + Number(p.amount || 0);
        });
        return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
    }, [collectedPayments]);

    const paidEnrollmentCount = useMemo(() => {
        let relevantEnrollments = enrollments.filter(e => e.status === 'active');
        if (classFilter !== 'all') {
            relevantEnrollments = relevantEnrollments.filter(e => e.class_id === classFilter);
        }
        return relevantEnrollments.filter(enr => {
            const cls = classes.find(c => c.id === enr.class_id);
            if (!cls) return false;
            const start = monthKey(cls.start_date);
            const end = monthKey(cls.end_date);
            if (!start || !end || month < start || month > end) return false;
            return tuitionPaidForMonth.some(p =>
                p.student_id === enr.student_id &&
                (p.class_id === enr.class_id || !p.class_id)
            );
        }).length;
    }, [enrollments, classes, classFilter, month, tuitionPaidForMonth]);

    const generatePDF = () => {
        const doc = new jsPDF();
        doc.text(`Finance Status Report - ${monthLabel}`, 14, 20);
        doc.setFontSize(10);
        doc.text(
          `Collected: ${formatCurrency(collectedBreakdown.total)}  |  Tuition/Class: ${formatCurrency(collectedBreakdown.tuition)}  |  Registration: ${formatCurrency(collectedBreakdown.registration)}  |  Other: ${formatCurrency(collectedBreakdown.other)}`,
          14,
          28,
        );
        
        const tableRows = displayData.map(item => {
            if (item.type === 'paid') {
                const s = students.find(st => st.id === item.data.student_id);
                return [
                    formatDate(item.data.payment_date),
                    s?.name || 'Unknown',
                    paymentKindLabel(item.paymentKind),
                    'Paid',
                    item.data.method,
                    formatCurrency(item.data.amount)
                ];
            }
            return [
                '-',
                item.data.student.name,
                paymentKindLabel(item.paymentKind),
                'Unpaid',
                '-',
                formatCurrency(item.data.amount)
            ];
        });

        doc.autoTable({
            startY: 35,
            head: [['Date', 'Student', 'Type', 'Status', 'Method', 'Amount']],
            body: tableRows,
        });
        doc.save(`Finance_Status_${month}.pdf`);
    };

    const totalUnpaid = unpaidStudents.reduce((sum: any, u: any) => sum + Number(u.amount || 0), 0);
    const dueCount = paidEnrollmentCount + unpaidStudents.length;
    const paymentRate = dueCount > 0 ? Math.round((paidEnrollmentCount / dueCount) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-4 md:flex-row md:items-end md:gap-3">
                <div className="min-w-[9.5rem] shrink-0 space-y-2 md:w-[10.5rem]">
                    <Label>Reference Date</Label>
                    <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                    <Label>Class Filter</Label>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="All Classes" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
                            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="min-w-[7.5rem] shrink-0 space-y-2 md:w-[8.5rem]">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="min-w-0 flex-[1.4] space-y-2">
                    <Label>Search Student</Label>
                    <div className="relative min-w-0">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-[var(--ds-text-tertiary,#8A978E)]" />
                        <Input 
                            placeholder="Name or Code..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-8" 
                        />
                    </div>
                </div>
                <div className="shrink-0">
                     <Button onClick={generatePDF} variant="outline" className="w-full whitespace-nowrap md:w-auto">
                       <FileDown className="mr-2 h-4 w-4" /> PDF
                     </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-4">
                <Card className={`${cardShell} flex h-full flex-col`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
                        <CardTitle className="text-[12px] font-semibold leading-none text-[var(--ds-text-secondary,#5B6B61)]">
                            Collected ({monthLabel})
                        </CardTitle>
                        <div className={iconBadge} aria-hidden>
                            <Wallet className="h-[22px] w-[22px]" strokeWidth={1.6} />
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-3">
                        <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--ds-text-primary,#122018)]">
                            {formatCurrency(collectedBreakdown.total)}
                        </div>
                        <p className="mt-2 text-[12px] font-medium text-[var(--ds-text-tertiary,#8A978E)]">
                            Cash received this month
                        </p>
                        <div className="mt-auto space-y-1.5 border-t border-[var(--ds-border,#DDE5DF)] pt-3">
                            <div className="flex items-center justify-between gap-3 px-0.5 py-1 text-xs">
                                <span className="text-[var(--ds-text-secondary,#5B6B61)]">Tuition / Class Fee</span>
                                <span className="font-semibold tabular-nums text-[var(--ds-text-primary,#122018)]">{formatCurrency(collectedBreakdown.tuition)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 px-0.5 py-1 text-xs">
                                <span className="text-[var(--ds-text-secondary,#5B6B61)]">Registration</span>
                                <span className="font-semibold tabular-nums text-[var(--ds-text-primary,#122018)]">{formatCurrency(collectedBreakdown.registration)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 px-0.5 py-1 text-xs">
                                <span className="text-[var(--ds-text-secondary,#5B6B61)]">Other</span>
                                <span className="font-semibold tabular-nums text-[var(--ds-text-primary,#122018)]">{formatCurrency(collectedBreakdown.other)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`${cardShell} flex h-full flex-col`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
                        <CardTitle className="text-[12px] font-semibold leading-none text-[var(--ds-text-secondary,#5B6B61)]">
                            Unpaid Amount
                        </CardTitle>
                        <div className={iconBadge} aria-hidden>
                            <AlertCircle className="h-[22px] w-[22px]" strokeWidth={1.6} />
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-3">
                        <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--ds-text-primary,#122018)]">
                            {formatCurrency(totalUnpaid)}
                        </div>
                        <p className="mt-2 text-[12px] font-medium text-[var(--ds-text-tertiary,#8A978E)]">
                            Outstanding tuition balance
                        </p>
                        <div className="mt-auto border-t border-[var(--ds-border,#DDE5DF)] pt-3">
                            <p className="text-[12px] font-medium leading-snug text-[var(--ds-text-secondary,#5B6B61)]">
                                Needs follow-up this month
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`${cardShell} flex h-full flex-col`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
                        <CardTitle className="text-[12px] font-semibold leading-none text-[var(--ds-text-secondary,#5B6B61)]">
                            Payment Rate
                        </CardTitle>
                        <div className={iconBadge} aria-hidden>
                            <Gauge className="h-[22px] w-[22px]" strokeWidth={1.6} />
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-3">
                        <div className="text-[28px] font-bold leading-none tracking-tight text-[var(--ds-text-primary,#122018)]">
                            {paymentRate}%
                        </div>
                        <p className="mt-2 text-[12px] font-medium text-[var(--ds-text-tertiary,#8A978E)]">
                            Tuition collection progress
                        </p>
                        <div className="mt-auto space-y-2.5 border-t border-[var(--ds-border,#DDE5DF)] pt-3">
                            <div className="h-2 overflow-hidden rounded-full bg-[var(--ds-surface-muted,#F7FAF8)]">
                                <div
                                    className="h-full rounded-full bg-[var(--ds-accent,#1F8A5B)] transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(0, paymentRate))}%` }}
                                />
                            </div>
                            <p className="text-[12px] font-medium text-[var(--ds-text-secondary,#5B6B61)]">
                                {paidEnrollmentCount} paid · {dueCount} due this month
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className={cardShell}>
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
                        <div className="min-w-0 space-y-1">
                            <CardTitle className="text-[15px] font-semibold leading-none text-[var(--ds-text-primary,#122018)]">
                                Revenue Trend
                            </CardTitle>
                            <p className="text-[12px] text-[var(--ds-text-tertiary,#8A978E)]">Last 6 months</p>
                        </div>
                        <div className={iconBadge} aria-hidden>
                            <TrendingUp className="h-[22px] w-[22px]" strokeWidth={1.6} />
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px] px-3 pb-5 pt-4 sm:px-5">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-border,#DDE5DF)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--ds-text-tertiary,#8A978E)" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis stroke="var(--ds-text-tertiary,#8A978E)" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    formatter={(value: any) => formatCurrency(value)}
                                    contentStyle={chartTooltipStyle}
                                    cursor={{ fill: 'var(--ds-primary-soft,#ECFDF5)', opacity: 0.55 }}
                                />
                                <Bar dataKey="revenue" fill="var(--ds-accent,#1F8A5B)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className={cardShell}>
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 pb-0 pt-5">
                        <div className="min-w-0 space-y-1">
                            <CardTitle className="text-[15px] font-semibold leading-none text-[var(--ds-text-primary,#122018)]">
                                Payment Methods
                            </CardTitle>
                            <p className="text-[12px] text-[var(--ds-text-tertiary,#8A978E)]">How students paid</p>
                        </div>
                        <div className={iconBadge} aria-hidden>
                            <CreditCard className="h-[22px] w-[22px]" strokeWidth={1.6} />
                        </div>
                    </CardHeader>
                    <CardContent className="h-[300px] px-3 pb-5 pt-4 sm:px-5">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={methodData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={58}
                                    outerRadius={88}
                                    paddingAngle={3}
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    dataKey="value"
                                >
                                    {methodData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--ds-surface,#fff)" strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: any) => formatCurrency(value)}
                                    contentStyle={chartTooltipStyle}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card className={cardShell}>
                <CardHeader className="space-y-1 px-5 pb-0 pt-5">
                    <CardTitle className="text-[15px] font-semibold leading-none text-[var(--ds-text-primary,#122018)]">
                        Student Payment Status
                    </CardTitle>
                    <p className="text-[12px] text-[var(--ds-text-tertiary,#8A978E)]">Filtered list of paid and unpaid records</p>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-4">
                     <div className="overflow-hidden rounded-xl border border-[var(--ds-border,#DDE5DF)]">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Date</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Student Name</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Class</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Type</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Status</TableHead>
                                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Method</TableHead>
                                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayData.length > 0 ? (
                                    displayData.map((item) => {
                                        if (item.type === 'paid') {
                                            const s = students.find(st => st.id === item.data.student_id);
                                            const c = classes.find(cls => cls.id === item.data.class_id); 
                                            const enr = enrollments.find(e => e.student_id === item.data.student_id && e.status === 'active');
                                            const displayClass = c ? c.name : (enr ? classes.find(cl => cl.id === enr.class_id)?.name : '-');
                                            const kind = item.paymentKind;
                                            
                                            return (
                                                <TableRow key={`p-${item.data.id}`} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                                    <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{formatDate(item.data.payment_date)}</TableCell>
                  <TableCell className="font-medium text-[var(--ds-text-primary,#122018)]">{s?.name || 'Unknown'}</TableCell>
                                                    <TableCell className="text-[var(--ds-text-primary,#122018)]">{displayClass}</TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${kindBadgeClass(kind)}`}>
                                                            {paymentKindLabel(kind)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded text-xs font-bold">
                                                            PAID
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-[var(--ds-text-secondary,#5B6B61)] capitalize">{item.data.method || '-'}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatCurrency(item.data.amount)}</TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return (
                                            <TableRow key={`u-${item.data.student.id}-${item.data.class.id}`} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                                <TableCell className="text-[var(--ds-text-tertiary,#8A978E)]">-</TableCell>
                                                <TableCell className="font-medium text-[var(--ds-text-primary,#122018)]">{item.data.student.name}</TableCell>
                                                <TableCell className="text-[var(--ds-text-primary,#122018)]">{item.data.class.name}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${kindBadgeClass(item.paymentKind)}`}>
                                                        {paymentKindLabel(item.paymentKind)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-red-800 bg-red-50 border border-red-200 px-2 py-1 rounded text-xs font-bold">
                                                        UNPAID
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-[var(--ds-text-tertiary,#8A978E)]">-</TableCell>
                                                <TableCell className="text-right font-mono text-[var(--ds-text-secondary,#5B6B61)]">{formatCurrency(item.data.amount)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-4 text-[var(--ds-text-tertiary,#8A978E)]">No records found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default FinanceReport;
