import React, { useState, useMemo, useEffect, useCallback, startTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Award,
  FileCheck,
  Search,
  Eye,
  Download,
  Printer,
  Trash2,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { deleteCertificate, deleteCertificates, getCertificateById } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { notify, getUserMessage, MESSAGES } from '@/lib/notify';
import { formatDate } from '@/lib/utils';
import CertificateViewModal from '@/components/certificates/CertificateViewModal';
import CertificateAutoGenerate from '@/components/certificates/CertificateAutoGenerate';
import { downloadCertificatePDF, printCertificatePDF } from '@/lib/certificateGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { getVerificationUrl, resolveDocumentBranding } from '@/lib/institution';
import { normalizeCertificateLayoutKey } from '@/lib/certificateTemplates';

const PAGE_SIZE = 25;

const CertificateReport = () => {
  const { toast } = useToast();
  const { institution } = useAuth();
  const {
    students = [],
    classes = [],
    certificates: contextCertificates = [],
    enrollments = [],
    refreshKeys,
  } = useData();

  const [certificates, setCertificates] = useState(contextCertificates);
  const [loading, setLoading] = useState(contextCertificates.length === 0);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [printingClass, setPrintingClass] = useState(false);

  // Modal
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Keep local list in sync with DataContext (avoids a second full API round-trip).
  useEffect(() => {
    setCertificates(contextCertificates || []);
    if ((contextCertificates || []).length > 0) setLoading(false);
  }, [contextCertificates]);

  const fetchData = useCallback(async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    setError(null);
    try {
      await refreshKeys(['certificates']);
    } catch (err) {
      setError(getUserMessage(err, { context: 'CertificateReport - load', fallback: MESSAGES.LOAD_FAILED }));
      notify.error(err, { context: 'CertificateReport - load', fallback: MESSAGES.LOAD_FAILED });
    } finally {
      setLoading(false);
    }
  }, [refreshKeys]);

  // Soft pull once on mount if context is still empty (shares in-flight with DataContext).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if ((contextCertificates || []).length > 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await refreshKeys(['certificates']);
      } catch (err) {
        if (!cancelled) {
          setError(getUserMessage(err, { context: 'CertificateReport - load', fallback: MESSAGES.LOAD_FAILED }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const studentsInClass = useMemo(() => {
    if (selectedClass === 'all') return students;
    const ids = new Set(
      (enrollments || [])
        .filter((e) => e.class_id === selectedClass && e.status !== 'withdrawn')
        .map((e) => e.student_id),
    );
    return (students || []).filter((s) => ids.has(s.id));
  }, [students, enrollments, selectedClass]);

  const filteredCertificates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return certificates.filter((cert) => {
      const matchesSearch =
        !q ||
        cert.student?.name?.toLowerCase().includes(q) ||
        cert.certificate_number?.toLowerCase().includes(q) ||
        cert.serial_number?.toLowerCase().includes(q) ||
        cert.student?.student_code?.toLowerCase().includes(q);

      const matchesStudent = selectedStudent === 'all' || cert.student_id === selectedStudent;
      const matchesClass = selectedClass === 'all' || cert.class_id === selectedClass;
      const matchesStatus = selectedStatus === 'all' || cert.status === selectedStatus;

      return matchesSearch && matchesStudent && matchesClass && matchesStatus;
    });
  }, [certificates, searchTerm, selectedStudent, selectedClass, selectedStatus]);

  // Reset page / selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchTerm, selectedStudent, selectedClass, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredCertificates.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredCertificates.slice(start, start + PAGE_SIZE);
  }, [filteredCertificates, safePage]);

  const pageIds = useMemo(() => pageRows.map((c) => c.id), [pageRows]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleSelectAllPage = (checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) pageIds.forEach((id) => next.add(id));
      else pageIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const toggleSelectOne = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

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
      // Fetch full row only when exporting — list stays light without snapshots
      const full = (await getCertificateById(certificate.id)) || certificate;
      await downloadCertificatePDF(buildCertificatePdfPayload(full));
      toast({
        title: 'Download successful',
        description: 'Full certificate PDF downloaded',
      });
    } catch (err) {
      notify.error(err, {
        context: 'CertificateReport - download',
        fallback: { title: 'Download failed', description: MESSAGES.DOMAIN.CERTIFICATE_DOWNLOAD },
      });
    }
  };

  const handlePrint = async (certificate) => {
    try {
      const full = (await getCertificateById(certificate.id)) || certificate;
      await printCertificatePDF(buildCertificatePdfPayload(full));
      toast({
        title: 'Print ready',
        description: 'Full certificate page sent to print',
      });
    } catch (err) {
      notify.error(err, {
        context: 'CertificateReport - print',
        fallback: { title: 'Print failed', description: 'Could not prepare the full certificate for printing.' },
      });
    }
  };

  const removeLocalIds = (ids) => {
    const remove = new Set(ids);
    startTransition(() => {
      setCertificates((prev) => prev.filter((c) => !remove.has(c.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    });
  };

  const handleDeleteOne = async (certificateId) => {
    if (!confirm('Delete this certificate permanently? This cannot be undone.')) return;
    try {
      await deleteCertificate(certificateId);
      removeLocalIds([certificateId]);
      // Background sync — don't block the UI
      void refreshKeys(['certificates']);
      toast({ title: 'Deleted', description: 'Certificate removed.' });
    } catch (err) {
      notify.error(err, { context: 'CertificateReport - delete', fallback: MESSAGES.UPDATE_FAILED });
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (
      !confirm(
        `Delete ${ids.length} selected certificate${ids.length === 1 ? '' : 's'} permanently? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteCertificates(ids);
      removeLocalIds(ids);
      void refreshKeys(['certificates']);
      toast({
        title: 'Deleted',
        description: `${ids.length} certificate${ids.length === 1 ? '' : 's'} removed.`,
      });
    } catch (err) {
      notify.error(err, { context: 'CertificateReport - bulk delete', fallback: MESSAGES.UPDATE_FAILED });
    } finally {
      setDeleting(false);
    }
  };

  const handlePrintClass = async () => {
    if (selectedClass === 'all') {
      toast({
        title: 'Select a class',
        description: 'Choose one class in the filter, then print all of its certificates.',
        variant: 'destructive',
      });
      return;
    }
    const list = filteredCertificates.filter((c) => c.status !== 'revoked');
    if (!list.length) {
      toast({
        title: 'No certificates',
        description: 'No printable certificates for this class.',
        variant: 'destructive',
      });
      return;
    }
    setPrintingClass(true);
    try {
      // Yield between prints so the browser stays responsive
      for (let i = 0; i < list.length; i += 1) {
        const full = (await getCertificateById(list[i].id)) || list[i];
        await printCertificatePDF(buildCertificatePdfPayload(full));
        if (i < list.length - 1) {
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      const clsName = classes.find((c) => c.id === selectedClass)?.name || 'class';
      toast({
        title: 'Class print ready',
        description: `Sent ${list.length} certificate(s) for “${clsName}” to print.`,
      });
    } catch (err) {
      notify.error(err, {
        context: 'CertificateReport - print class',
        fallback: { title: 'Print failed', description: 'Could not print certificates for this class.' },
      });
    } finally {
      setPrintingClass(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'issued':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'generated':
        return 'bg-[var(--ds-info-bg,#EFF6FF)] text-[var(--ds-info,#2563EB)] border-[var(--ds-info,#2563EB)]/30';
      case 'revoked':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-secondary,#5B6B61)] border-[var(--ds-border,#DDE5DF)]';
    }
  };

  const isNewCertificate = (dateIssued) => {
    if (!dateIssued) return false;
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
          <p className="text-sm">
            {typeof error === 'string' ? error : getUserMessage(error, { context: 'CertificateReport' })}
          </p>
          <Button onClick={() => fetchData()} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-5">
      <CertificateAutoGenerate
        onGenerationComplete={() => {
          // Soft refresh only the certificates slice — no full-page reload
          void fetchData({ soft: true });
        }}
      />

      <Card className="overflow-hidden border-[var(--ds-border,#DDE5DF)] shadow-sm">
        <CardHeader className="border-b border-[var(--ds-border,#DDE5DF)] bg-gradient-to-br from-[var(--ds-surface,#fff)] to-[var(--ds-surface-muted,#F7FAF8)] pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)]">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-[var(--ds-text-primary,#122018)]">
                  Certificate Management
                </CardTitle>
                <CardDescription className="text-[var(--ds-text-secondary,#5B6B61)]">
                  View, manage, and track student certificates
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedCount > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={handleBulkDelete}
                  className="gap-1.5"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete selected ({selectedCount})
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={printingClass || selectedClass === 'all' || filteredCertificates.length === 0}
                onClick={handlePrintClass}
                title="Print all certificates for the selected class"
              >
                {printingClass ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                Print class
              </Button>
              <Button onClick={() => fetchData()} variant="ghost" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 md:grid-cols-4">
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
                {studentsInClass.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name} ({student.student_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedClass}
              onValueChange={(v) => {
                setSelectedClass(v);
                setSelectedStudent('all');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((cls) => (
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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
              <span className="ml-3 text-[var(--ds-text-secondary,#5B6B61)]">Loading certificates...</span>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="h-14 w-14 text-[var(--ds-text-tertiary,#8A978E)] mb-3" />
              <h3 className="text-lg font-semibold text-[var(--ds-text-primary,#122018)] mb-1">
                No Certificates Found
              </h3>
              <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)] max-w-md">
                {searchTerm || selectedStudent !== 'all' || selectedClass !== 'all' || selectedStatus !== 'all'
                  ? 'No certificates match your filters. Try adjusting your search.'
                  : 'No certificates have been generated yet. Use the generation tool above.'}
              </p>
            </div>
          ) : (
            <>
              <div className="border border-[var(--ds-border,#DDE5DF)] rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                          onCheckedChange={(v) => toggleSelectAllPage(v === true)}
                          aria-label="Select all on page"
                        />
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">
                        Student
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">
                        Program
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">
                        Certificate No.
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">
                        Serial No.
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">
                        Date Issued
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">
                        Status
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--ds-text-tertiary,#8A978E)]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((cert) => (
                      <TableRow
                        key={cert.id}
                        className="border-[var(--ds-border,#DDE5DF)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]"
                        data-state={selectedIds.has(cert.id) ? 'selected' : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(cert.id)}
                            onCheckedChange={(v) => toggleSelectOne(cert.id, v === true)}
                            aria-label={`Select ${cert.student?.name || 'certificate'}`}
                          />
                        </TableCell>
                        <TableCell className="text-[var(--ds-text-primary,#122018)]">
                          <div>
                            <div className="font-medium">{cert.student?.name}</div>
                            <div className="text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                              {cert.student?.student_code}
                            </div>
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
                            {formatDate(cert.date_issued || cert.issued_at)}
                            {isNewCertificate(cert.date_issued || cert.issued_at) && (
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
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleView(cert)}
                              className="h-8 w-8 p-0 text-[var(--ds-info,#2563EB)] hover:bg-[var(--ds-info,#2563EB)]/10"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownload(cert)}
                              className="h-8 w-8 p-0 text-[var(--ds-success,#059669)] hover:bg-[var(--ds-success,#059669)]/10"
                              title="Download full PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrint(cert)}
                              className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-500/10"
                              title="Print full certificate"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteOne(cert.id)}
                              className="h-8 w-8 p-0 text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger,#DC2626)]/10"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                <span>
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filteredCertificates.length)} of{' '}
                  {filteredCertificates.length}
                  {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CertificateViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        certificateId={selectedCertificate?.id}
        certificate={selectedCertificate}
      />
    </div>
  );
};

export default CertificateReport;
