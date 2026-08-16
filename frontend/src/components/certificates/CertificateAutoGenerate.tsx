import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Wand2, Loader2, CheckCircle, AlertCircle, Info, Search } from 'lucide-react';
import {
  autoGenerateCertificatesBatch,
  generateCertificatesForEnrollments,
  getClasses,
  getStudents,
  listCertificateEligibleEnrollments,
} from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { notify, MESSAGES } from '@/lib/notify';

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
  const [loadingMeta, setLoadingMeta] = useState(true);

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
      let data;
      if (mode === 'selected') {
        if (!selectedEnrollmentIds.length) {
          throw new Error('Select at least one eligible enrollment');
        }
        data = await generateCertificatesForEnrollments(selectedEnrollmentIds);
      } else {
        data = await autoGenerateCertificatesBatch({
          ...(selectedClass !== 'all' ? { classId: selectedClass } : {}),
          ...(selectedStudent ? { studentId: selectedStudent } : {}),
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
