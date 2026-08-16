import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, XCircle, ArrowRightLeft } from 'lucide-react';
import { getInstructorPaymentTransferLog } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const InstructorPaymentTransferLog = ({ classId }) => {
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (classId) {
            loadTransfers();
        }
    }, [classId]);

    const loadTransfers = async () => {
        setLoading(true);
        try {
            const data = await getInstructorPaymentTransferLog(classId);
            setTransfers(data || []);
        } catch (error) {
            console.error('Failed to load transfer log:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'transferred':
                return <Badge className="bg-green-900/50 text-green-400 border-green-700"><CheckCircle2 className="h-3 w-3 mr-1" /> Transferred</Badge>;
            case 'skipped':
                return <Badge className="bg-yellow-900/50 text-yellow-400 border-yellow-700"><AlertCircle className="h-3 w-3 mr-1" /> Skipped</Badge>;
            case 'failed':
                return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (transfers.length === 0) {
        return (
            <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-8 text-center">
                    <ArrowRightLeft className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-400">No instructor transfers recorded for this class.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-blue-400" />
                    Instructor Payment Transfer History
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="border border-slate-800 rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-slate-800/50">
                                <TableHead className="text-slate-400">Date</TableHead>
                                <TableHead className="text-slate-400">From Instructor</TableHead>
                                <TableHead className="text-slate-400">To Instructor</TableHead>
                                <TableHead className="text-slate-400">Amount</TableHead>
                                <TableHead className="text-slate-400">Status</TableHead>
                                <TableHead className="text-slate-400">Reason</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transfers.map((transfer) => (
                                <TableRow key={transfer.id} className="border-slate-800 hover:bg-slate-800/30">
                                    <TableCell className="text-sm text-slate-300">
                                        {formatDate(transfer.created_at)}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {transfer.from_instructor?.name || <span className="text-slate-500 italic">None</span>}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium text-slate-100">
                                        {transfer.to_instructor?.name || 'Unknown'}
                                    </TableCell>
                                    <TableCell className="text-sm font-mono text-green-400">
                                        {formatCurrency(transfer.amount)}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(transfer.status)}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-400 max-w-xs">
                                        {transfer.reason || '-'}
                                        {transfer.error_message && (
                                            <div className="text-red-400 mt-1">Error: {transfer.error_message}</div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

export default InstructorPaymentTransferLog;