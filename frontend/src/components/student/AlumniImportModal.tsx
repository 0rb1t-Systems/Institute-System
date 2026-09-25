import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Download, GraduationCap, Loader2, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CERTIFICATE_TEMPLATE_LIBRARY } from '@/lib/certificateTemplates';
import {
  ALUMNI_TEMPLATES,
  MAX_ALUMNI_IMPORT_ROWS,
  downloadAlumniTemplate,
  mapAlumniHeaders,
  mapAndValidateRows,
  rowsFromWorkbook,
  runAlumniImport,
} from '@/lib/alumniImport';

export default function AlumniImportModal({ open, onClose, onSuccess }) {
  const { toast } = useToast();
  const [step, setStep] = useState('upload');
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [issueDocuments, setIssueDocuments] = useState(true);
  const [certificateTemplate, setCertificateTemplate] = useState('institution_default');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep('upload');
    setRawRows([]);
    setMapping({});
    setImporting(false);
    setIssueDocuments(true);
    setCertificateTemplate('institution_default');
    setSendWelcomeEmail(false);
    setParseErrors([]);
    setResult(null);
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum upload size is 5 MB.' });
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const json = rowsFromWorkbook(buf);
      if (!json.length) {
        toast({ variant: 'destructive', title: 'Empty file', description: 'No rows found on the Alumni sheet.' });
        return;
      }
      if (json.length > MAX_ALUMNI_IMPORT_ROWS) {
        toast({
          variant: 'destructive',
          title: 'Too many rows',
          description: `Maximum ${MAX_ALUMNI_IMPORT_ROWS} rows per import.`,
        });
        return;
      }
      const hdrs = Object.keys(json[0]);
      const map = mapAlumniHeaders(hdrs);
      const { rows, errors } = mapAndValidateRows(json, map);
      setRawRows(json);
      setMapping(map);
      setParseErrors(errors);
      if (!rows.length && errors.length) {
        toast({ variant: 'destructive', title: 'Invalid file', description: errors[0] });
        return;
      }
      setStep('preview');
    } catch (err) {
      notify.error(err, { context: 'AlumniImportModal - read', fallback: { title: 'Read failed', description: MESSAGES.DOMAIN.BULK_IMPORT_READ } });
    } finally {
      e.target.value = '';
    }
  };

  const validated = useMemo(() => mapAndValidateRows(rawRows, mapping), [rawRows, mapping]);
  const studentPreview = useMemo(() => {
    const map = new Map();
    for (const r of validated.rows) {
      const hit = map.get(r.email);
      if (!hit) {
        map.set(r.email, {
          full_name: r.full_name,
          email: r.email,
          program: `${r.program_type}: ${r.program_name} · ${r.class_name} (${r.start_month} → ${r.completed_month})`,
          courses: [`${r.course_name} ${r.mark}`],
        });
      } else {
        hit.courses.push(`${r.course_name} ${r.mark}`);
      }
    }
    return [...map.values()].slice(0, 8);
  }, [validated.rows]);
  const studentCount = new Set(validated.rows.map((r) => r.email)).size;

  const runImport = async () => {
    if (!validated.rows.length) {
      toast({ variant: 'destructive', title: 'Nothing to import', description: 'Fix the file columns and try again.' });
      return;
    }
    setImporting(true);
    try {
      const out = await runAlumniImport(validated.rows, {
        sendWelcomeEmail,
        issueDocuments,
        layoutKeyOverride: certificateTemplate !== 'institution_default' ? certificateTemplate : null,
      });
      setResult(out);
      setStep('done');
      if (out.studentsCreated + out.studentsReused > 0 && onSuccess) onSuccess();
      toast({
        title: 'Alumni import finished',
        description: `${out.studentsCreated} new, ${out.studentsReused} existing, ${out.gradesWritten} grades.`,
      });
    } catch (err) {
      notify.error(err, { context: 'AlumniImportModal - import', fallback: MESSAGES.SAVE_FAILED });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] text-[var(--ds-text-primary,#122018)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--ds-text-primary,#122018)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ds-primary-soft,#E8F5EF)] text-[var(--ds-primary,#1F8A5B)]">
              <GraduationCap className="h-5 w-5" />
            </span>
            Alumni Import
          </DialogTitle>
          <DialogDescription className="text-[var(--ds-text-secondary,#5B6B61)]">
            Download the matching template, fill it in, then upload. Any of the four files is accepted.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-1">
            <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
              Three dedicated templates — each has only the columns it needs. The full template combines all of them.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {ALUMNI_TEMPLATES.filter((t) => t.kind !== 'full').map((t) => (
                <div
                  key={t.kind}
                  className="flex min-w-0 flex-col gap-2 rounded-2xl border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-4 shadow-[var(--ds-shadow-soft,0_1px_2px_#1F8A5B14)]"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--ds-text-primary,#122018)]">{t.title}</p>
                    <p className="mt-0.5 text-xs font-medium text-[var(--ds-accent,#1F8A5B)]">{t.subtitle}</p>
                  </div>
                  <p className="flex-1 text-xs leading-relaxed text-[var(--ds-text-secondary,#5B6B61)]">{t.hint}</p>
                  <ul className="space-y-1 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] px-2.5 py-2 text-[11px] font-mono text-[var(--ds-text-secondary,#5B6B61)]">
                    {t.columns.map((c) => (
                      <li key={c.key} className="truncate" title={`${c.key} — ${c.mapsTo}`}>
                        {c.key}{c.required ? '' : ' (optional)'}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 w-full border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] text-[var(--ds-text-primary,#122018)] hover:bg-[var(--ds-primary-soft,#E8F5EF)] hover:text-[var(--ds-primary,#1F8A5B)]"
                    onClick={() => downloadAlumniTemplate(t.kind)}
                  >
                    <Download className="mr-2 h-4 w-4 shrink-0" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
            {ALUMNI_TEMPLATES.filter((t) => t.kind === 'full').map((t) => (
              <div
                key={t.kind}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--ds-text-primary,#122018)]">{t.title} template</p>
                  <p className="mt-0.5 text-xs text-[var(--ds-text-secondary,#5B6B61)]">{t.hint}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] text-[var(--ds-text-primary,#122018)] hover:bg-[var(--ds-primary-soft,#E8F5EF)] hover:text-[var(--ds-primary,#1F8A5B)]"
                  onClick={() => downloadAlumniTemplate('full')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download full
                </Button>
              </div>
            ))}
            <Label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--ds-border-strong,#C5D0C8)] bg-[var(--ds-surface-muted,#F7FAF8)] p-8 transition hover:border-[var(--ds-accent,#1F8A5B)] hover:bg-[var(--ds-primary-soft,#E8F5EF)]/40">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ds-surface,#fff)] text-[var(--ds-accent,#1F8A5B)] shadow-sm">
                <Upload className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium text-[var(--ds-text-primary,#122018)]">
                Upload any of these Excel templates
              </span>
              <span className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">CSV or Excel · max 5 MB</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
            </Label>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-1">
            <p className="text-sm text-[var(--ds-text-secondary,#5B6B61)]">
              {validated.rows.length} grade rows · {studentCount} students
              {parseErrors.length ? ` · ${parseErrors.length} row warnings` : ''}
            </p>
            {parseErrors.length > 0 && (
              <ul className="max-h-24 list-disc space-y-1 overflow-auto rounded-lg border border-[var(--ds-warning,#C2410C)]/20 bg-[var(--ds-warning-bg,#FFF7ED)] py-2 pl-5 pr-3 text-xs text-[var(--ds-warning,#C2410C)]">
                {parseErrors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            <div className="max-h-56 overflow-auto rounded-xl border border-[var(--ds-border,#DDE5DF)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                    <TableHead className="text-[var(--ds-text-secondary,#5B6B61)]">Name</TableHead>
                    <TableHead className="text-[var(--ds-text-secondary,#5B6B61)]">Email</TableHead>
                    <TableHead className="text-[var(--ds-text-secondary,#5B6B61)]">Program</TableHead>
                    <TableHead className="text-[var(--ds-text-secondary,#5B6B61)]">Courses + marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentPreview.map((r) => (
                    <TableRow key={r.email} className="border-[var(--ds-border,#DDE5DF)]">
                      <TableCell className="font-medium text-[var(--ds-text-primary,#122018)]">{r.full_name}</TableCell>
                      <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{r.email}</TableCell>
                      <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{r.program}</TableCell>
                      <TableCell className="text-[var(--ds-text-secondary,#5B6B61)]">{r.courses.join(' · ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <label className="flex items-start gap-2 text-sm text-[var(--ds-text-primary,#122018)]">
              <Checkbox checked={issueDocuments} onCheckedChange={(v) => setIssueDocuments(v === true)} />
              <span>Issue transcripts and certificates after grades are saved (requires complete institution document settings).</span>
            </label>
            {issueDocuments && (
              <div className="space-y-1.5 rounded-xl border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] p-3 pl-4">
                <Label className="text-sm text-[var(--ds-text-primary,#122018)]">Certificate template</Label>
                <Select value={certificateTemplate} onValueChange={setCertificateTemplate}>
                  <SelectTrigger className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] text-[var(--ds-text-primary,#122018)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institution_default">
                      Active template (from Certificate Management)
                    </SelectItem>
                    <SelectItem value="logo_builder">Certificate builder</SelectItem>
                    <SelectItem value="custom_upload">Uploaded template</SelectItem>
                    {CERTIFICATE_TEMPLATE_LIBRARY.map((tpl) => (
                      <SelectItem key={tpl.key} value={tpl.key}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                  Default is the design you activated in Institution Settings → Certificate Management.
                </p>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm text-[var(--ds-text-primary,#122018)]">
              <Checkbox checked={sendWelcomeEmail} onCheckedChange={(v) => setSendWelcomeEmail(v === true)} />
              <span>Send login emails to newly created students (off by default for alumni).</span>
            </label>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('upload')} disabled={importing}>
                Back
              </Button>
              <Button onClick={runImport} disabled={importing || !validated.rows.length}>
                {importing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
                  </>
                ) : (
                  `Import ${studentCount} alumni`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-3 py-1 text-sm">
            <div className="rounded-2xl border border-[var(--ds-success,#059669)]/20 bg-[var(--ds-success-bg,#ECFDF5)] p-4 space-y-2">
              <p className="font-medium text-[var(--ds-success,#059669)]">{result.studentsCreated} new students</p>
              <p className="text-[var(--ds-text-secondary,#5B6B61)]">{result.studentsReused} existing students reused</p>
              <p className="text-[var(--ds-text-secondary,#5B6B61)]">
                {result.gradesWritten} grades written · {result.classesTouched} alumni classes
              </p>
              {result.documents && (
                <div className="space-y-1 text-xs text-[var(--ds-text-secondary,#5B6B61)]">
                  <p>Transcripts: {result.documents.transcripts}</p>
                  <p>Certificates: {result.documents.certificates}</p>
                </div>
              )}
            </div>
            {result.errors?.length > 0 && (
              <ul className="list-disc space-y-1 rounded-lg border border-[var(--ds-warning,#C2410C)]/20 bg-[var(--ds-warning-bg,#FFF7ED)] py-2 pl-5 pr-3 text-[var(--ds-warning,#C2410C)]">
                {result.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
