import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DollarSign, CreditCard, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { computeStudentBalance } from '@/lib/finance';

const StudentFinancePage = () => {
    const { user, institution } = useAuth();
    const { payments, enrollments, classes } = useData();
    const studentId = user?.studentId;

    // Get Student Payments
    const myPayments = useMemo(() => {
        if (!studentId) return [];
        return payments
            .filter(p => p.student_id === studentId)
            .sort((a, b) => Number(new Date(b.payment_date)) - Number(new Date(a.payment_date)));
    }, [payments, studentId]);

    // Calculate Balance & Totals — same SSOT as Finance admin
    const financialSummary = useMemo(() => {
        if (!studentId) return { totalPaid: 0, balance: 0, lastPaymentDate: null };

        const activeEnrollment = enrollments.find(e => e.student_id === studentId && e.status === 'active');
        const activeClass = activeEnrollment ? classes.find(c => c.id === activeEnrollment.class_id) : null;
        const bal = computeStudentBalance({
            payments: myPayments,
            activeClass,
            enrollment: activeEnrollment,
            institution,
        });

        const lastPayment = myPayments[0];

        return {
            totalPaid: bal.totalPaid,
            balance: bal.balance,
            lastPaymentDate: lastPayment ? lastPayment.payment_date : null
        };
    }, [studentId, enrollments, classes, myPayments, institution]);

    return (
        <AnimatedPage>
            <Helmet><title>My Finance - Portal</title></Helmet>
            <PageHeader title="Financial Status" subtitle="View your payment history and outstanding balance." />

            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Total Paid</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500 flex items-center gap-2">
                            <DollarSign className="h-5 w-5" /> {formatCurrency(financialSummary.totalPaid)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Outstanding Balance</CardTitle></CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold flex items-center gap-2 ${financialSummary.balance > 0 ? 'text-red-500' : 'text-slate-200'}`}>
                            <CreditCard className="h-5 w-5" /> {formatCurrency(financialSummary.balance)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Last Payment</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-white flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-500" /> 
                            {financialSummary.lastPaymentDate ? formatDate(financialSummary.lastPaymentDate) : 'No payments'}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle>Payment History</CardTitle>
                    <CardDescription>List of all transactions recorded for your account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-transparent">
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {myPayments.length > 0 ? myPayments.map(payment => (
                                <TableRow key={payment.id} className="border-slate-800 hover:bg-slate-800/50">
                                    <TableCell className="text-slate-300">{formatDate(payment.payment_date)}</TableCell>
                                    <TableCell>
                                        <div className="font-medium text-slate-200">
                                            {payment.is_registration_fee ? "Registration Fee" : "Tuition Payment"}
                                        </div>
                                        {payment.month_paid && <div className="text-xs text-slate-500">For: {payment.month_paid}</div>}
                                    </TableCell>
                                    <TableCell className="text-slate-400">{payment.method}</TableCell>
                                    <TableCell className="font-mono font-medium text-white">{formatCurrency(payment.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        {payment.status === 'completed' ? (
                                            <Badge className="bg-green-900/30 text-green-400 border-green-900">Paid</Badge>
                                        ) : (
                                            <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-900">Pending</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                        No payment records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </AnimatedPage>
    );
};

export default StudentFinancePage;