import React, { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const RevenueReport = () => {
    const { payments, students, classes } = useData();
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    // --- Data Processing ---
    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            const d = p.payment_date.split('T')[0];
            return d >= startDate && d <= endDate;
        }).sort((a, b) => Number(new Date(a.payment_date)) - Number(new Date(b.payment_date)));
    }, [payments, startDate, endDate]);

    const chartData = useMemo(() => {
        const grouped: any = {};
        // Initialize days in range could be too many, so let's group by day that has data
        filteredPayments.forEach(p => {
            const date = p.payment_date.split('T')[0];
            if (!grouped[date]) grouped[date] = 0;
            grouped[date] += p.amount;
        });
        
        return Object.entries(grouped)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => Number(new Date(a.date)) - Number(new Date(b.date)));
    }, [filteredPayments]);

    const totalRevenue = filteredPayments.reduce((acc: any, curr: any) => acc + curr.amount, 0);

    const generatePDF = () => {
        const doc = new jsPDF();
        doc.text(`Revenue Report`, 14, 20);
        doc.text(`Period: ${startDate} to ${endDate}`, 14, 28);
        doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 14, 36);

        const tableRows = filteredPayments.map(p => {
            const s = students.find(st => st.id === p.student_id);
            const c = classes.find(cls => cls.id === p.class_id);
            return [
                formatDate(p.payment_date),
                s?.name || 'Unknown',
                c?.name || '-',
                p.method,
                p.month_paid || '-',
                formatCurrency(p.amount)
            ];
        });

        doc.autoTable({
            startY: 45,
            head: [['Date', 'Student', 'Class', 'Method', 'Month Paid', 'Amount']],
            body: tableRows,
        });
        doc.save(`Revenue_Report_${startDate}_${endDate}.pdf`);
    };

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800 items-end">
                <div className="grid gap-2">
                    <Label className="text-white">Start Date</Label>
                    <Input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                        className="bg-slate-950 border-slate-700 text-white" 
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="text-white">End Date</Label>
                    <Input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                        className="bg-slate-950 border-slate-700 text-white" 
                    />
                </div>
                <div className="flex-1"></div>
                <div className="flex items-center gap-4">
                     <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-green-500">{formatCurrency(totalRevenue)}</p>
                     </div>
                     <Button onClick={generatePDF} variant="outline"><FileDown className="mr-2 h-4 w-4" /> Export PDF</Button>
                </div>
            </div>

            {/* Chart */}
            <Card>
                <CardHeader><CardTitle>Revenue Over Time</CardTitle></CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value: any) => formatCurrency(value)} />
                            <Area type="monotone" dataKey="amount" stroke="#10B981" fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
                <CardContent>
                     <div className="rounded-md border max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Class</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Month Paid</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayments.length > 0 ? (
                                    filteredPayments.map((p) => {
                                        const s = students.find(st => st.id === p.student_id);
                                        const c = classes.find(cls => cls.id === p.class_id);
                                        return (
                                            <TableRow key={p.id}>
                                                <TableCell>{formatDate(p.payment_date)}</TableCell>
                                                <TableCell className="font-medium">{s?.name || 'Unknown'}</TableCell>
                                                <TableCell>{c?.name || '-'}</TableCell>
                                                <TableCell>{p.method}</TableCell>
                                                <TableCell>{p.month_paid || '-'}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(p.amount)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No transactions in this range.</TableCell>
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

export default RevenueReport;