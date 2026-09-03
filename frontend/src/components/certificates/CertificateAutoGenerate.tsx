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
  custom_upload: 'Uploaded template',
};

function previewLayoutLabel(key: string) {
  if (key === 'institution_default') return TEMPLATE_OPTION_LABELS.institution_default;
  if (key === 'logo_builder') return TEMPLATE_OPTION_LABELS.logo_builder;
  if (key === 'custom_upload') return TEMPLATE_OPTION_LABELS.custom_upload;
  return getCertificateTemplateMeta(key).name;
}

function layoutKeyForTemplate(templateValue: string, institutionTemplate: any): CertificateLayoutKey {
  if (templateValue === 'institution_default') {
    return normalizeCertificateLayoutKey(institutionTemplate?.layout_key);
  }
  return normalizeCertificateLayoutKey(templateValue);
}

function buildPreviewData(
  layoutKey: CertificateLayoutKey,
  institution: any,
  institutionTemplate: any,
  customPreviewUrl: string | null,
): CertificateRenderData {
  const tplConfig = institutionTemplate?.config || {};
  const upload = tplConfig.custom_upload || {};
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
    logoBuilderDesign: tplConfig.logo_builder || null,
    customBackgroundUrl: customPreviewUrl,
    customAspectRatio: upload.width && upload.height ? upload.width / upload.height : null,
    customFieldLayout: upload.field_layout || null,
    customPaperLayers: upload.paper_layers || null,
  };
}

const TEMPLATE_OPTIONS = [
  { value: 'institution_default', label: TEMPLATE_OPTION_LABELS.institution_default },
  { value: 'logo_builder', label: TEMPLATE_OPTION_LABELS.logo_builder },
  { value: 'custom_upload', label: TEMPLATE_OPTION_LABELS.custom_upload },
  ...CERTIFICATE_TEMPLATE_LIBRARY.map((tpl) => ({ value: tpl.key, label: tpl.name })),
];

function CertificateThumb({ data }: { data: CertificateRenderData }) {
  const landscape = isLandscapeCertificateLayout(data.layoutKey);
  const srcW = landscape ? 1123 : 794;
  const srcH = landscape ? 794 : 1123;
  const destW = landscape ? 320 : 188;
  const scale = destW / srcW;
  return (
    <div
      className="relative overflow-hidden rounded border border-slate-700 bg-white shadow-sm"
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
  const [customPreviewUrl, setCustomPreviewUrl] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const hoveredLayoutKey: CertificateLayoutKey = useMemo(
    () => layoutKeyForTemplate(hoveredTemplate, institutionTemplate),
    [hoveredTemplate, institutionTemplate],
  );

  const hoverPreviewData = useMemo(
    () => buildPreviewData(hoveredLayoutKey, institution, institutionTemplate, customPreviewUrl),
    [hoveredLayoutKey, institution, institutionTemplate, customPreviewUrl],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tpl = await getDocumentTemplate('certificate');
        if (cancelled) return;
        setInstitutionTemplate(tpl || null);
      } catch {
        if (!cancelled) setInstitutionTemplate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [institution?.id]);

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
        (hoveredTemplate === 'custom_upload' ||
          (hoveredTemplate === 'institution_default' && institutionTemplate?.layout_key === 'custom_upload'));

      if (!needsUploadPreview || !upload?.storage_path) {
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
  }, [templateMenuOpen, hoveredTemplate, hoveredLayoutKey, institutionTemplate]);

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
      const layoutOverride = selectedTemplate !== 'institution_default' ? selectedTemplate : null;
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
      <Card className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Wand2 className="h-5 w-5 text-blue-400" />
            Certificate Generation
          </CardTitle>
          <CardDescription className="text-slate-300">
            Generate certificates for enrollments with complete grades/exams (60+).
            No wait for class end date or payment clearance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-950/30 border-blue-800/50">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-slate-300">
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
              className={mode !== 'all' ? 'border-slate-700' : ''}
            >
              All eligible enrollments
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'selected' ? 'default' : 'outline'}
              onClick={() => setMode('selected')}
              className={mode !== 'selected' ? 'border-slate-700' : ''}
            >
              Select students
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            <Select
              value={selectedStudent || 'all'}
              onValueChange={(v) => setSelectedStudent(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
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
              <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
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
            <Label className="text-sm text-slate-300 flex items-center gap-1.5">
              <Layout className="h-3.5 w-3.5 text-purple-400" />
              Certificate template
            </Label>
            <DropdownMenu open={templateMenuOpen} onOpenChange={handleTemplateMenuOpenChange}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="truncate">{previewLayoutLabel(selectedTemplate)}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                sideOffset={6}
                collisionPadding={12}
                className="w-[min(36rem,calc(100vw-2rem))] p-0 bg-slate-950 border-slate-700 text-white"
              >
                <div className="grid sm:grid-cols-[13rem_1fr]">
                  <div className="max-h-72 overflow-y-auto p-1 border-b sm:border-b-0 sm:border-r border-slate-800">
                    {TEMPLATE_OPTIONS.map((opt) => {
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
                            hovered ? 'bg-slate-800 text-white' : 'text-slate-200',
                          )}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                            {selected ? <Check className="h-4 w-4 text-emerald-400" /> : null}
                          </span>
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="p-3 bg-slate-900/80">
                    <p className="text-xs text-slate-400 mb-2 truncate">
                      {previewLayoutLabel(hoveredTemplate)}
                    </p>
                    <div className="flex justify-center">
                      <CertificateThumb data={hoverPreviewData} />
                    </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedTemplate !== 'institution_default' && (
              <p className="text-xs text-purple-300/80">
                This template applies to this generation batch only.
              </p>
            )}
          </div>

          {mode === 'selected' && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student or class…"
                  className="pl-9 bg-slate-900 border-slate-700 text-white"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {loadingMeta
                    ? 'Loading enrollments…'
                    : `${eligibleEnrollments.length} eligible · ${ineligibleCount} not ready`}
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={selectAllVisible}>
                  Select all visible
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto rounded border border-slate-800 divide-y divide-slate-800">
                {eligibleEnrollments.length === 0 ? (
                  <p className="text-sm text-slate-500 p-3 text-center">
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
                        className="flex items-center gap-3 p-2 text-sm text-slate-200 cursor-pointer hover:bg-slate-900/80"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEnrollment(row.enrollment_id)}
                          className="rounded border-slate-600"
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
                <p className="text-xs text-slate-500">
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
            <p className="text-sm text-slate-400">
              {loadingMeta
                ? 'Checking eligibility…'
                : `${eligibleEnrollments.length} eligible enrollment(s) ready · ${ineligibleCount} not ready`}
            </p>
          )}

          <Button
            type="button"
            onClick={() => setShowConfirmDialog(true)}
            disabled={generating || loadingMeta || (mode === 'selected' && !selectedEnrollmentIds.length) || (mode === 'all' && !eligibleEnrollments.length)}
            className="w-full bg-blue-600 hover:bg-blue-700"
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
                  ? 'bg-emerald-950/30 border-emerald-800/50'
                  : 'bg-red-950/30 border-red-800/50'
              }
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
              <AlertDescription className="text-slate-200">
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
        <DialogContent className="bg-slate-950 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Confirm certificate generation</DialogTitle>
            <DialogDescription className="text-slate-400">
              {mode === 'selected'
                ? `Issue certificates for ${selectedEnrollmentIds.length} selected enrollment(s)?`
                : `Issue certificates for all ${eligibleEnrollments.length} eligible enrollment(s)?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-700">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CertificateAutoGenerate;
