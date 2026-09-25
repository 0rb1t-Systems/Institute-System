import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wand2, Loader2, CheckCircle, AlertCircle, Info, Search, Layout, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  autoGenerateCertificatesBatch,
  getClasses,
  getCertificateTemplateSignedUrl,
  getDocumentTemplate,
  getStudents,
  listCertificateEligibleEnrollments,
} from '@/lib/api';
import {
  customUploadHasGeneratedDesign,
  type LogoBuilderDesign,
} from '@/lib/certificateBuilder';
import {
  activateImportedCertificateTemplate,
  listImportedCertificateTemplates,
  type SavedCertificateImport,
} from '@/lib/certificateImport/api';
import { hydrateCertificateRenderData } from '@/lib/certificateGenerator';
import {
  CERTIFICATE_TEMPLATE_LIBRARY,
  getCertificateTemplateMeta,
  isLandscapeCertificateLayout,
  normalizeCertificateLayoutKey,
  type CertificateLayoutKey,
  type CertificateRenderData,
} from '@/lib/certificateTemplates';
import CertificateCanvas from '@/components/certificates/CertificateCanvas';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCertificateFooterText,
  getInstitutionAccent,
  getInstitutionDisplayName,
  getInstitutionPrimary,
  getSignatoryLeftTitle,
  getSignatoryRightTitle,
} from '@/lib/institution';
import { useToast } from '@/hooks/use-toast';
import { notify, MESSAGES } from '@/lib/notify';

const TEMPLATE_OPTION_LABELS: Record<string, string> = {
  institution_default: 'Institution default (from Settings)',
  logo_builder: 'Certificate builder',
  custom_upload: 'Uploaded / imported template (live)',
};

function importedTemplateValue(id: string) {
  return `imported:${id}`;
}

function parseImportedTemplateId(value: string): string | null {
  return value.startsWith('imported:') ? value.slice('imported:'.length) : null;
}

function previewLayoutLabel(key: string, imported: SavedCertificateImport[] = []) {
  if (key === 'institution_default') return TEMPLATE_OPTION_LABELS.institution_default;
  if (key === 'logo_builder') return TEMPLATE_OPTION_LABELS.logo_builder;
  if (key === 'custom_upload') return TEMPLATE_OPTION_LABELS.custom_upload;
  const importedId = parseImportedTemplateId(key);
  if (importedId) {
    const row = imported.find((t) => t.id === importedId);
    if (row) {
      return row.className ? `${row.name} · ${row.className}` : row.name;
    }
    return 'Saved upload template';
  }
  return getCertificateTemplateMeta(key).name;
}

function layoutKeyForTemplate(templateValue: string, institutionTemplate: any): CertificateLayoutKey {
  if (templateValue === 'institution_default') {
    return normalizeCertificateLayoutKey(institutionTemplate?.layout_key);
  }
  if (parseImportedTemplateId(templateValue)) return 'custom_upload';
  return normalizeCertificateLayoutKey(templateValue);
}

function buildPreviewData(
  layoutKey: CertificateLayoutKey,
  institution: any,
  institutionTemplate: any,
  customPreviewUrl: string | null,
  importedDesign?: LogoBuilderDesign | null,
): CertificateRenderData {
  const tplConfig = institutionTemplate?.config || {};
  const upload = tplConfig.custom_upload || {};
  const uploadDesign =
    importedDesign ||
    (layoutKey === 'custom_upload' && customUploadHasGeneratedDesign(upload)
      ? upload.design
      : null);
  return {
    layoutKey,
    institutionName: getInstitutionDisplayName(institution),
    primary: getInstitutionPrimary(institution),
    accent: getInstitutionAccent(institution),
    motto: String(institution?.motto || '').trim() || undefined,
    logoUrl: institution?.logo_url,
    sealUrl: institution?.seal_url,
    signatureUrl: institution?.signature_url,
    leftTitle: getSignatoryLeftTitle(institution),
    rightTitle: getSignatoryRightTitle(institution),
    footerText: getCertificateFooterText(institution) || undefined,
    studentName: 'Sample Student',
    studentId: 'STU-0001',
    programName: 'Sample Program',
    className: 'Sample Class',
    certificateNumber: 'CERT-PREVIEW',
    verifyCode: 'preview00000000',
    verificationUrl: 'https://example.com/verify-certificate/preview00000000',
    dateIssued: new Date().toISOString(),
    logoBuilderDesign:
      uploadDesign ||
      (layoutKey === 'logo_builder' ? tplConfig.logo_builder || null : null),
    customBackgroundUrl: uploadDesign ? null : customPreviewUrl,
    customAspectRatio:
      upload.aspect_ratio != null && Number(upload.aspect_ratio) > 0
        ? Number(upload.aspect_ratio)
        : upload.width && upload.height
          ? upload.width / upload.height
          : null,
    customFieldLayout: uploadDesign ? null : upload.field_layout || null,
    customPaperLayers: uploadDesign ? null : upload.paper_layers || null,
  };
}

function CertificateThumb({ data }: { data: CertificateRenderData }) {
  const landscape = isLandscapeCertificateLayout(data.layoutKey);
  const srcW = landscape ? 1123 : 794;
  const srcH = landscape ? 794 : 1123;
  const destW = landscape ? 320 : 188;
  const scale = destW / srcW;
  return (
    <div
      className="relative overflow-hidden rounded border border-[var(--ds-border,#DDE5DF)] bg-white shadow-sm"
      style={{ width: destW, height: srcH * scale }}
    >
      <div
        className="origin-top-left pointer-events-none"
        style={{ width: srcW, height: srcH, transform: `scale(${scale})` }}
      >
        <CertificateCanvas data={data} />
      </div>
    </div>
  );
}

function eligibilityReasons(row) {
  const reasons = [];
  if (row?.already_issued) reasons.push('already issued');
  if (!row?.grades_complete) reasons.push('grades incomplete');
  return reasons;
}

/**
 * Report Center → Certificates generation.
 * Eligible when grades/exams are complete (no class end-date or payment wait).
 */
const CertificateAutoGenerate = ({ onGenerationComplete }) => {
  const { institution } = useAuth();
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('all'); // all | selected
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [eligibilityRows, setEligibilityRows] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('institution_default');
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [hoveredTemplate, setHoveredTemplate] = useState('institution_default');
  const [institutionTemplate, setInstitutionTemplate] = useState(null);
  const [importedTemplates, setImportedTemplates] = useState<SavedCertificateImport[]>([]);
  const [customPreviewUrl, setCustomPreviewUrl] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const templateOptions = useMemo(() => {
    const base = [
      { value: 'institution_default', label: TEMPLATE_OPTION_LABELS.institution_default },
      { value: 'logo_builder', label: TEMPLATE_OPTION_LABELS.logo_builder },
      { value: 'custom_upload', label: TEMPLATE_OPTION_LABELS.custom_upload },
      ...CERTIFICATE_TEMPLATE_LIBRARY.map((tpl) => ({ value: tpl.key, label: tpl.name })),
    ];
    const imported = importedTemplates.map((row) => ({
      value: importedTemplateValue(row.id),
      label: row.className ? `${row.name} · ${row.className}` : row.name,
    }));
    return [...base.slice(0, 3), ...imported, ...base.slice(3)];
  }, [importedTemplates]);

  const hoveredImported = useMemo(() => {
    const id = parseImportedTemplateId(hoveredTemplate);
    return id ? importedTemplates.find((t) => t.id === id) || null : null;
  }, [hoveredTemplate, importedTemplates]);

  const hoveredLayoutKey: CertificateLayoutKey = useMemo(
    () => layoutKeyForTemplate(hoveredTemplate, institutionTemplate),
    [hoveredTemplate, institutionTemplate],
  );

  const hoverPreviewData = useMemo(
    () =>
      buildPreviewData(
        hoveredLayoutKey,
        institution,
        institutionTemplate,
        customPreviewUrl,
        hoveredImported?.design || null,
      ),
    [hoveredLayoutKey, institution, institutionTemplate, customPreviewUrl, hoveredImported],
  );
  const [hydratedPreviewData, setHydratedPreviewData] = useState<CertificateRenderData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHydratedPreviewData(hoverPreviewData);
    ;(async () => {
      try {
        const hydrated = await hydrateCertificateRenderData(hoverPreviewData);
        if (!cancelled) setHydratedPreviewData(hydrated);
      } catch {
        if (!cancelled) setHydratedPreviewData(hoverPreviewData);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hoverPreviewData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tpl, imported] = await Promise.all([
          getDocumentTemplate('certificate'),
          listImportedCertificateTemplates().catch(() => [] as SavedCertificateImport[]),
        ]);
        if (cancelled) return;
        setInstitutionTemplate(tpl || null);
        setImportedTemplates(imported || []);
      } catch {
        if (!cancelled) {
          setInstitutionTemplate(null);
          setImportedTemplates([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [institution?.id]);

  // When a class is chosen, prefer its linked uploaded template if one exists
  useEffect(() => {
    if (selectedClass === 'all' || !importedTemplates.length) return;
    const match = importedTemplates.find((t) => t.classId === selectedClass);
    if (match) {
      const value = importedTemplateValue(match.id);
      setSelectedTemplate(value);
      setHoveredTemplate(value);
    }
  }, [selectedClass, importedTemplates]);

  useEffect(() => {
    if (!templateMenuOpen) {
      setCustomPreviewUrl(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const upload = institutionTemplate?.config?.custom_upload;
      const layoutKey = hoveredLayoutKey;
      const needsUploadPreview =
        layoutKey === 'custom_upload' &&
        !hoveredImported &&
        (hoveredTemplate === 'custom_upload' ||
          (hoveredTemplate === 'institution_default' && institutionTemplate?.layout_key === 'custom_upload'));

      if (!needsUploadPreview || !upload?.storage_path || customUploadHasGeneratedDesign(upload)) {
        setCustomPreviewUrl(null);
        return;
      }

      try {
        const path = upload.preview_path || upload.storage_path;
        const url = await getCertificateTemplateSignedUrl(path);
        if (!cancelled) setCustomPreviewUrl(url);
      } catch {
        if (!cancelled) setCustomPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateMenuOpen, hoveredTemplate, hoveredLayoutKey, institutionTemplate, hoveredImported]);

  const handleTemplateMenuOpenChange = (open: boolean) => {
    setTemplateMenuOpen(open);
    if (open) setHoveredTemplate(selectedTemplate);
  };

  const handleSelectTemplate = (value: string) => {
    setSelectedTemplate(value);
    setHoveredTemplate(value);
    setTemplateMenuOpen(false);
  };

  const reloadEligibility = async () => {
    const rows = await listCertificateEligibleEnrollments({
      classId: selectedClass !== 'all' ? selectedClass : null,
      studentId: selectedStudent || null,
    });
    setEligibilityRows(rows || []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const [studentsData, classesData, rows] = await Promise.all([
          getStudents(),
          getClasses(),
          listCertificateEligibleEnrollments({
            classId: selectedClass !== 'all' ? selectedClass : null,
            studentId: selectedStudent || null,
          }),
        ]);
        if (cancelled) return;
        setStudents(studentsData || []);
        setClasses(classesData || []);
        setEligibilityRows(rows || []);
      } catch (err) {
        notify.error(err, { context: 'CertificateAutoGenerate - load', fallback: MESSAGES.LOAD_FAILED });
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClass, selectedStudent]);

  const classById = useMemo(
    () => Object.fromEntries((classes || []).map((c) => [c.id, c])),
    [classes],
  );
  const studentById = useMemo(
    () => Object.fromEntries((students || []).map((s) => [s.id, s])),
    [students],
  );

  const eligibleEnrollments = useMemo(() => {
    return (eligibilityRows || []).filter((row) => {
      if (row?.eligible !== true) return false;
      const student = studentById[row.student_id];
      const cls = classById[row.class_id];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${student?.name || ''} ${student?.student_code || ''} ${cls?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [eligibilityRows, search, studentById, classById]);

  const ineligibleCount = useMemo(
    () => (eligibilityRows || []).filter((r) => r?.eligible !== true).length,
    [eligibilityRows],
  );

  const toggleEnrollment = (id) => {
    setSelectedEnrollmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllVisible = () => {
    setSelectedEnrollmentIds(eligibleEnrollments.map((e) => e.enrollment_id));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setResult(null);
    setShowConfirmDialog(false);

    try {
      const importedId = parseImportedTemplateId(selectedTemplate);
      if (importedId) {
        const row = importedTemplates.find((t) => t.id === importedId);
        if (!row) throw new Error('Imported template not found');
        await activateImportedCertificateTemplate(row);
      }

      const layoutOverride =
        selectedTemplate === 'institution_default'
          ? null
          : importedId
            ? 'custom_upload'
            : selectedTemplate;
      let data;
      if (mode === 'selected') {
        if (!selectedEnrollmentIds.length) {
          throw new Error('Select at least one eligible enrollment');
        }
        data = await autoGenerateCertificatesBatch({
          enrollmentIds: selectedEnrollmentIds,
          layoutKeyOverride: layoutOverride,
        });
      } else {
        data = await autoGenerateCertificatesBatch({
          ...(selectedClass !== 'all' ? { classId: selectedClass } : {}),
          ...(selectedStudent ? { studentId: selectedStudent } : {}),
          layoutKeyOverride: layoutOverride,
        });
      }

      const payload = {
        success: true,
        total_created: data.generated || 0,
        total_skipped: data.skipped || 0,
        total_ineligible: data.ineligible || 0,
        total_processed: data.total_processed || 0,
      };
      setResult(payload);

      toast({
        title: 'Success',
        description:
          payload.total_created > 0
            ? MESSAGES.SUCCESS.CERTIFICATE_GENERATED
            : MESSAGES.SUCCESS.CERTIFICATE_NONE_ELIGIBLE,
        duration: 5000,
      });

      await reloadEligibility();
      setSelectedEnrollmentIds([]);

      if (onGenerationComplete) {
        onGenerationComplete(payload);
      }
    } catch (error) {
      const mapped = notify.error(error, {
        context: 'CertificateAutoGenerate',
        fallback: MESSAGES.UNEXPECTED,
      });
      setResult({
        success: false,
        error: mapped.description,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[var(--ds-primary,#1F8A5B)]" />
            Certificate Generation
          </CardTitle>
          <CardDescription>
            Generate certificates for enrollments with complete grades/exams (60+).
            No wait for class end date or payment clearance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-[var(--ds-info,#2563EB)]/20 bg-[var(--ds-info-bg,#EFF6FF)]">
            <Info className="h-4 w-4 text-[var(--ds-info,#2563EB)]" />
            <AlertDescription className="text-[var(--ds-text-secondary,#5B6B61)]">
              Certificates can be issued as soon as required grades are complete (60+ on gradebook courses)
              and a certificate has not already been issued. Activate a template under Institution Settings → Certificate Management first.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'all' ? 'default' : 'outline'}
              onClick={() => setMode('all')}
            >
              All eligible enrollments
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'selected' ? 'default' : 'outline'}
              onClick={() => setMode('selected')}
            >
              Select students
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            <Select
              value={selectedStudent || 'all'}
              onValueChange={(v) => setSelectedStudent(v === 'all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.student_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger>
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm text-[var(--ds-text-secondary,#5B6B61)]">
              <Layout className="h-3.5 w-3.5 text-[var(--ds-primary,#1F8A5B)]" />
              Certificate template
            </Label>
            <DropdownMenu open={templateMenuOpen} onOpenChange={handleTemplateMenuOpenChange}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] px-3 py-2 text-sm text-[var(--ds-text-primary,#122018)] ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="truncate">{previewLayoutLabel(selectedTemplate, importedTemplates)}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
                className="w-[min(36rem,calc(100vw-2rem))] border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-0 text-[var(--ds-text-primary,#122018)]"
              >
                <div className="grid sm:grid-cols-[13rem_1fr]">
                  <div className="max-h-72 overflow-y-auto border-b p-1 sm:border-b-0 sm:border-r border-[var(--ds-border,#DDE5DF)]">
                    {templateOptions.map((opt) => {
                      const selected = selectedTemplate === opt.value;
                      const hovered = hoveredTemplate === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onMouseEnter={() => setHoveredTemplate(opt.value)}
                          onClick={() => handleSelectTemplate(opt.value)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition',
                            hovered
                              ? 'bg-[var(--ds-surface-muted,#F7FAF8)] text-[var(--ds-text-primary,#122018)]'
                              : 'text-[var(--ds-text-secondary,#5B6B61)]',
                          )}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            {selected ? <Check className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" /> : null}
                          </span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bg-[var(--ds-surface-muted,#F7FAF8)] p-3">
                    <p className="mb-2 truncate text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                      {previewLayoutLabel(hoveredTemplate, importedTemplates)}
                    </p>
                    <div className="flex justify-center">
                      <CertificateThumb data={hydratedPreviewData || hoverPreviewData} />
                    </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedTemplate !== 'institution_default' && (
              <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                This template applies to this generation batch only.
              </p>
            )}
          </div>

          {mode === 'selected' && (
            <div className="space-y-3 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-tertiary,#8A978E)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student or class…"
                  className="pl-9"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                <span>
                  {loadingMeta
                    ? 'Loading enrollments…'
                    : `${eligibleEnrollments.length} eligible · ${ineligibleCount} not ready`}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={selectAllVisible}>
                  Select all visible
                </Button>
              </div>

              <div className="max-h-48 divide-y divide-[var(--ds-border,#DDE5DF)] overflow-y-auto rounded border border-[var(--ds-border,#DDE5DF)]">
                {eligibleEnrollments.length === 0 ? (
                  <p className="p-3 text-center text-sm text-[var(--ds-text-tertiary,#8A978E)]">
                    No eligible enrollments match your filters.
                  </p>
                ) : (
                  eligibleEnrollments.map((row) => {
                    const student = studentById[row.student_id];
                    const cls = classById[row.class_id];
                    const checked = selectedEnrollmentIds.includes(row.enrollment_id);
                    return (
                      <label
                        key={row.enrollment_id}
                        className="flex cursor-pointer items-center gap-3 p-2 text-sm text-[var(--ds-text-primary,#122018)] hover:bg-[var(--ds-surface,#fff)]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEnrollment(row.enrollment_id)}
                          className="rounded border-[var(--ds-border,#DDE5DF)]"
                        />
                        <span className="flex-1 truncate">
                          {student?.name || 'Student'} — {cls?.name || 'Class'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              {ineligibleCount > 0 && (
                <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                  {ineligibleCount} enrollment(s) are hidden because they fail eligibility
                  {eligibilityRows
                    .filter((r) => r?.eligible !== true)
                    .slice(0, 3)
                    .map((r) => {
                      const name = studentById[r.student_id]?.name || 'Student';
                      return ` (${name}: ${eligibilityReasons(r).join(', ')})`;
                    })
                    .join('')}
                  {ineligibleCount > 3 ? '…' : ''}.
                </p>
              )}
            </div>
          )}

          {mode === 'all' && (
            <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
              {loadingMeta
                ? 'Checking eligibility…'
                : `${eligibleEnrollments.length} eligible enrollment(s) ready · ${ineligibleCount} not ready`}
            </p>
          )}

          <Button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            disabled={generating || loadingMeta || (mode === 'selected' && !selectedEnrollmentIds.length) || (mode === 'all' && !eligibleEnrollments.length)}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate certificates
              </>
            )}
          </Button>

          {result && (
            <Alert
              className={
                result.success
                  ? 'border-[var(--ds-success,#059669)]/20 bg-[var(--ds-success-bg,#ECFDF5)]'
                  : 'border-[var(--ds-danger,#DC2626)]/20 bg-[var(--ds-danger-bg,#FEF2F2)]'
              }
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-[var(--ds-success,#059669)]" />
              ) : (
                <AlertCircle className="h-4 w-4 text-[var(--ds-danger,#DC2626)]" />
              )}
              <AlertDescription className="text-[var(--ds-text-primary,#122018)]">
                {result.success
                  ? `Created ${result.total_created}. Skipped ${result.total_skipped}${
                      result.total_ineligible
                        ? ` (${result.total_ineligible} ineligible)`
                        : ''
                    }.`
                  : result.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm certificate generation</DialogTitle>
            <DialogDescription>
              {mode === 'selected'
                ? `Issue certificates for ${selectedEnrollmentIds.length} selected enrollment(s)?`
                : `Issue certificates for all ${eligibleEnrollments.length} eligible enrollment(s)?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CertificateAutoGenerate;
