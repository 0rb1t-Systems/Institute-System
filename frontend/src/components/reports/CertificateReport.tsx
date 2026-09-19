import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Award, FileCheck, Search, Eye, Download, Printer, XCircle, Loader2, AlertCircle, Wand2, RefreshCw } from 'lucide-react';
import { getAllCertificates, getStudents, getClasses, updateCertificateStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { notify, getUserMessage, MESSAGES } from '@/lib/notify';
import { formatDate } from '@/lib/utils';
import CertificateViewModal from '@/components/certificates/CertificateViewModal';
import CertificateAutoGenerate from '@/components/certificates/CertificateAutoGenerate';
import { downloadCertificatePDF, printCertificatePDF } from '@/lib/certificateGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { getVerificationUrl, resolveDocumentBranding } from '@/lib/institution';
import { normalizeCertificateLayoutKey } from '@/lib/certificateTemplates';

const CertificateReport = () => {
  const { toast } = useToast();
  const { institution } = useAuth();
  const [certificates, setCertificates] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [certsData, studentsData, classesData] = await Promise.all([
        getAllCertificates(),
        getStudents(),
        getClasses(),
      ]);

      const studentById = Object.fromEntries((studentsData || []).map((s) => [s.id, s]));
      setCertificates(
        (certsData || []).map((c) => ({
          ...c,
          student: studentById[c.student_id] || c.student,
          serial_number: c.certificate_number,
          date_issued: c.date_issued || c.issued_at || null,
        }))
      );
      setStudents(studentsData || []);
      setClasses(classesData || []);
    } catch (err) {
      setError(getUserMessage(err, { context: 'CertificateReport - load', fallback: MESSAGES.LOAD_FAILED }));
      notify.error(err, { context: 'CertificateReport - load', fallback: MESSAGES.LOAD_FAILED });
    } finally {
      setLoading(false);
    }
  };

  const filteredCertificates = useMemo(() => {
    return certificates.filter(cert => {
      const matchesSearch = searchTerm === '' || 
        cert.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.certificate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.student?.student_code?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStudent = selectedStudent === 'all' || cert.student_id === selectedStudent;
      const matchesClass = selectedClass === 'all' || cert.class_id === selectedClass;
      const matchesStatus = selectedStatus === 'all' || cert.status === selectedStatus;

      return matchesSearch && matchesStudent && matchesClass && matchesStatus;
    });
  }, [certificates, searchTerm, selectedStudent, selectedClass, selectedStatus]);

  const handleView = (certificate) => {
    setSelectedCertificate(certificate);
    setIsViewModalOpen(true);
  };

  const buildCertificatePdfPayload = (certificate) => {
    const brand = resolveDocumentBranding(institution, certificate.template_snapshot);
    const verifyCode = String(certificate.verification_code || '').trim();
    const verificationUrl = verifyCode
      ? getVerificationUrl(verifyCode, brand, 'certificate')
      : String(certificate.qr_data || '');
    const layoutKey = normalizeCertificateLayoutKey(
      certificate.template_snapshot?.template?.layout_key ||
        certificate.template_snapshot?.layout_key,
    );
    return {
      student: certificate.student,
      course: certificate.course,
      diploma: certificate.diploma,
      class: certificate.class,
      className: certificate.class?.name,
      certificateNumber: certificate.certificate_number,
      dateIssued: certificate.date_issued || certificate.issued_at,
      qrData: verificationUrl,
      verificationUrl,
      verifyCode,
      serialNumber: certificate.serial_number,
      institution: brand,
      template_snapshot: certificate.template_snapshot,
      layoutKey,
      verification_code: verifyCode,
    };
  };

  const handleDownload = async (certificate) => {
    try {
      await downloadCertificatePDF(buildCertificatePdfPayload(certificate));

      toast({
        title: "Download successful",
        description: "Full certificate PDF downloaded"
      });
    } catch (error) {
      notify.error(error, { context: 'CertificateReport - download', fallback: { title: 'Download failed', description: MESSAGES.DOMAIN.CERTIFICATE_DOWNLOAD } });
    }
  };

  const handlePrint = async (certificate) => {
    try {
      await printCertificatePDF(buildCertificatePdfPayload(certificate));
      toast({
        title: "Print ready",
        description: "Full certificate page sent to print"
      });
    } catch (error) {
      notify.error(error, {
        context: 'CertificateReport - print',
        fallback: { title: 'Print failed', description: 'Could not prepare the full certificate for printing.' },
      });
    }
  };

  const handleRevoke = async (certificateId) => {
    if (!confirm('Are you sure you want to revoke this certificate? This action cannot be undone.')) {
      return;
    }

    try {
      await updateCertificateStatus(certificateId, 'revoked');

      toast({
        title: "Success",
        description: MESSAGES.SUCCESS.UPDATED
      });
      fetchData();
    } catch (error) {
      notify.error(error, { context: 'CertificateReport - revoke', fallback: MESSAGES.UPDATE_FAILED });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'issued': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'generated': return 'bg-[var(--ds-info-bg,#EFF6FF)] text-[var(--ds-info,#2563EB)] border-[var(--ds-info,#2563EB)]/30';
      case 'revoked': return 'bg-red-50 text-red-800 border-red-200';
      default: return 'bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-secondary,#5B6B61)] border-[var(--ds-border,#DDE5DF)]';
    }
  };

  const isNewCertificate = (dateIssued) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(dateIssued) > sevenDaysAgo;
  };

  if (error) {
    return (
      <Alert variant="destructive" className="border-[var(--ds-danger,#DC2626)]/30">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-semibold mb-2">Failed to load certificates</p>
          <p className="text-sm">{typeof error === 'string' ? error : getUserMessage(error, { context: 'CertificateReport' })}</p>
          <Button onClick={fetchData} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto-Generate Section */}
      <CertificateAutoGenerate onGenerationComplete={fetchData} />

      {/* Certificates List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-[var(--ds-text-primary,#122018)]">
                <Award className="h-5 w-5 text-[var(--ds-warning,#C2410C)]" />
                Certificate Management
              </CardTitle>
              <CardDescription className="text-[var(--ds-text-secondary,#5B6B61)]">
                View, manage, and track student certificates
              </CardDescription>
            </div>
            <Button onClick={fetchData} variant="ghost" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ds-text-tertiary,#8A978E)]" />
              <Input
                placeholder="Search certificates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="All Students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name} ({student.student_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="generated">Generated</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
              <span className="ml-3 text-[var(--ds-text-secondary,#5B6B61)]">Loading certificates...</span>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="h-16 w-16 text-[var(--ds-text-tertiary,#8A978E)] mb-4" />
              <h3 className="text-xl font-semibold text-[var(--ds-text-primary,#122018)] mb-2">
                No Certificates Found
              </h3>
              <p className="text-[var(--ds-text-secondary,#5B6B61)] max-w-md mb-6">
                {searchTerm || selectedStudent !== 'all' || selectedClass !== 'all' || selectedStatus !== 'all'
                  ? 'No certificates match your filters. Try adjusting your search.'
                  : 'No certificates have been generated yet. Use the batch generation tool above to create certificates for all students.'}
              </p>
            </div>
          ) : (
            <div className="border border-[var(--ds-border,#DDE5DF)] rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Student</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Program</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Certificate No.</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Serial No.</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Date Issued</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Status</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCertificates.map(cert => (
                    <TableRow key={cert.id} className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                      <TableCell className="text-[var(--ds-text-primary,#122018)]">
                        <div>
                          <div className="font-medium">{cert.student?.name}</div>
                          <div className="text-xs text-[var(--ds-text-secondary,#5B6B61)]">{cert.student?.student_code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[var(--ds-text-primary,#122018)]">
                        {cert.diploma?.name || cert.course?.name || cert.class?.name || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                        {cert.certificate_number}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-[var(--ds-text-tertiary,#8A978E)]">
                        {cert.serial_number}
                      </TableCell>
                      <TableCell className="text-[var(--ds-text-primary,#122018)]">
                        <div className="flex items-center gap-2">
                          {formatDate(cert.date_issued)}
                          {isNewCertificate(cert.date_issued) && (
                            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(cert.status)}>
                          {cert.status?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleView(cert)}
                            className="h-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(cert)}
                            className="h-8 text-green-400 hover:text-green-300 hover:bg-green-400/10"
                            title="Download full PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrint(cert)}
                            className="h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                            title="Print full certificate"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          {cert.status !== 'revoked' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRevoke(cert.id)}
                              className="h-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CertificateViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        certificate={selectedCertificate}
      />
    </div>
  );
};

export default CertificateReport;