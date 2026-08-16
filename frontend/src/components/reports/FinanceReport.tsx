import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileDown, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

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
  if (kind === PAYMENT_KIND.registration) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (kind === PAYMENT_KIND.tuition) return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
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
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800 items-stretch md:items-end">
                <div className="grid gap-2 w-full md:w-auto">
                    <Label className="text-white">Reference Date</Label>
                    <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-slate-950 border-slate-700 text-white w-full md:w-[160px]" />
                </div>
                 <div className="grid gap-2 w-full md:min-w-[200px] min-w-0">
                    <Label className="text-white">Class Filter</Label>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue placeholder="All Classes" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem>
                            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2 w-full md:min-w-[160px] min-w-0">
                    <Label className="text-white">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-slate-950 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2 flex-1">
                    <Label className="text-white">Search Student</Label>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                        <Input 
                            placeholder="Name or Code..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="pl-8 bg-slate-950 border-slate-700 text-white" 
                        />
                    </div>
                </div>
                <div className="flex items-end">
                     <Button onClick={generatePDF} variant="outline"><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Collected ({monthLabel})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="text-2xl font-bold text-blue-400 bg-blue-500/10 inline-block px-2 py-1 rounded">
                            {formatCurrency(collectedBreakdown.total)}
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Cash received this month (all completed payments)
                        </p>
                        <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-400">
                            <div className="flex justify-between gap-3">
                                <span>Tuition / Class Fee</span>
                                <span className="text-sky-300 font-medium">{formatCurrency(collectedBreakdown.tuition)}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span>Registration</span>
                                <span className="text-amber-300 font-medium">{formatCurrency(collectedBreakdown.registration)}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span>Other</span>
                                <span className="text-slate-300 font-medium">{formatCurrency(collectedBreakdown.other)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Unpaid Amount</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-400">{formatCurrency(totalUnpaid)}</div></CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Payment Rate</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-400">{paymentRate}%</div>
                        <p className="text-xs text-slate-500 mt-1">
                            {paidEnrollmentCount} paid / {dueCount} due this month (tuition)
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader><CardTitle>Revenue Trend (6 Months)</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                                <Bar dataKey="revenue" fill="#0066FF" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={methodData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {methodData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader><CardTitle>Student Payment Status</CardTitle></CardHeader>
                <CardContent>
                     <div className="rounded-md border border-slate-800 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-slate-800 hover:bg-transparent">
                                    <TableHead className="text-slate-400">Date</TableHead>
                                    <TableHead className="text-slate-400">Student Name</TableHead>
                                    <TableHead className="text-slate-400">Class</TableHead>
                                    <TableHead className="text-slate-400">Type</TableHead>
                                    <TableHead className="text-slate-400">Status</TableHead>
                                    <TableHead className="text-slate-400">Method</TableHead>
                                    <TableHead className="text-slate-400 text-right">Amount</TableHead>
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
                                                <TableRow key={`p-${item.data.id}`} className="border-slate-800">
                                                    <TableCell className="text-slate-400">{formatDate(item.data.payment_date)}</TableCell>
                                                    <TableCell className="font-medium text-white">{s?.name || 'Unknown'}</TableCell>
                                                    <TableCell className="text-slate-200">{displayClass}</TableCell>
                                                    <TableCell>
                                                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${kindBadgeClass(kind)}`}>
                                                            {paymentKindLabel(kind)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded text-xs font-bold">
                                                            PAID
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-slate-400 capitalize">{item.data.method || '-'}</TableCell>
                                                    <TableCell className="text-right font-mono text-white">{formatCurrency(item.data.amount)}</TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return (
                                            <TableRow key={`u-${item.data.student.id}-${item.data.class.id}`} className="border-slate-800">
                                                <TableCell className="text-slate-600">-</TableCell>
                                                <TableCell className="font-medium text-white">{item.data.student.name}</TableCell>
                                                <TableCell className="text-slate-200">{item.data.class.name}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${kindBadgeClass(item.paymentKind)}`}>
                                                        {paymentKindLabel(item.paymentKind)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-red-300 bg-red-500/15 border border-red-500/30 px-2 py-1 rounded text-xs font-bold">
                                                        UNPAID
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-slate-600">-</TableCell>
                                                <TableCell className="text-right font-mono text-slate-500">{formatCurrency(item.data.amount)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-4 text-slate-500">No records found.</TableCell>
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
