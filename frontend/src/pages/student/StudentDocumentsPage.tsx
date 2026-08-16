import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, FileText, CreditCard, Eye, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

/**
 * Student certificates & documents — view issued certificates and transcript (PRD Phase 2).
 * Physical document orders are handled by admin/staff via certificate issuance.
 */
const StudentDocumentsPage = () => {
    const { user } = useAuth();
    const { certificates, classes, loading } = useData();

    const studentId = user?.studentId || user?.id;

    const myCertificates = useMemo(() => {
        if (!studentId) return [];
        return certificates
            .filter((c) => c.student_id === studentId)
            .sort((a, b) => Number(new Date(b.issued_at || b.created_at)) - Number(new Date(a.issued_at || a.created_at)));
    }, [certificates, studentId]);

    if (!studentId) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <AnimatedPage>
            <Helmet><title>Certificates - Portal</title></Helmet>
            <PageHeader
                title="My Certificates"
                subtitle="View and download your issued certificates and transcript."
            />

            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-400">Issued Certificates</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-400">{myCertificates.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900/50 border-slate-800 md:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-400">Quick Links</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        <Button asChild variant="outline" className="border-slate-700">
                            <Link to="/portal/transcript">
                                <FileText className="h-4 w-4 mr-2" /> View Transcript
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="border-slate-700">
                            <Link to="/portal/id-card">
                                <CreditCard className="h-4 w-4 mr-2" /> Student ID Card
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Award className="h-5 w-5 text-yellow-500" /> Issued Certificates
                    </CardTitle>
                    <CardDescription>
                        Certificates issued by your institution. Contact admin for physical copies.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-slate-400">Loading...</div>
                    ) : myCertificates.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-slate-800 hover:bg-transparent">
                                    <TableHead>Certificate #</TableHead>
                                    <TableHead>Class</TableHead>
                                    <TableHead>Issued</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {myCertificates.map((cert) => {
                                    const cls = classes.find((c) => c.id === cert.class_id);
                                    return (
                                        <TableRow key={cert.id} className="border-slate-800 hover:bg-slate-800/50">
                                            <TableCell className="font-mono text-slate-300">
                                                {cert.certificate_number}
                                            </TableCell>
                                            <TableCell className="text-slate-300">
                                                {cls?.name || '—'}
                                            </TableCell>
                                            <TableCell className="text-slate-400">
                                                {formatDate(cert.issued_at || cert.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        cert.status === 'issued'
                                                            ? 'border-green-500/30 text-green-400'
                                                            : 'border-slate-600 text-slate-400'
                                                    }
                                                >
                                                    {cert.status || 'issued'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild size="sm" variant="ghost" className="text-indigo-400">
                                                    <Link to={`/portal/certificate/${cert.id}`}>
                                                        <Eye className="h-4 w-4 mr-1" /> View
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                            <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>No certificates issued yet.</p>
                            <p className="text-sm mt-1">Complete your classes and exams to receive certificates.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </AnimatedPage>
    );
};

export default StudentDocumentsPage;
