import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import { Download, GraduationCap, Loader2, Upload } from 'lucide-react';
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
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep('upload');
    setRawRows([]);
    setMapping({});
    setImporting(false);
    setIssueDocuments(true);
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
      const out = await runAlumniImport(validated.rows, { sendWelcomeEmail, issueDocuments });
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
      <DialogContent className="sm:max-w-3xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-400" />
            Alumni Import
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Download the matching template, fill it in, then upload. Any of the four files is accepted.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-300">Three dedicated templates — each has only the columns it needs. The full template combines all of them.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {ALUMNI_TEMPLATES.filter((t) => t.kind !== 'full').map((t) => (
                <div key={t.kind} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 flex flex-col gap-2 min-w-0">
                  <p className="font-medium text-slate-100 text-sm">{t.title}</p>
                  <p className="text-xs text-indigo-300">{t.subtitle}</p>
                  <p className="text-xs text-slate-500 flex-1">{t.hint}</p>
                  <ul className="text-[11px] font-mono text-slate-400 space-y-0.5">
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
                    className="mt-1 w-full border-slate-700"
                    onClick={() => downloadAlumniTemplate(t.kind)}
                  >
                    <Download className="h-4 w-4 mr-2 shrink-0" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
            {ALUMNI_TEMPLATES.filter((t) => t.kind === 'full').map((t) => (
              <div key={t.kind} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-100 text-sm">{t.title} template</p>
                  <p className="text-xs text-slate-500">{t.hint}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-slate-700 shrink-0"
                  onClick={() => downloadAlumniTemplate('full')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download full
                </Button>
              </div>
            ))}
            <Label className="flex flex-col items-center justify-center gap-3 border border-dashed border-slate-700 rounded-lg p-8 cursor-pointer hover:bg-slate-800/50">
              <Upload className="h-8 w-8 text-slate-400" />
              <span className="text-sm text-slate-300">Upload any of these Excel templates</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
            </Label>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-400">
              {validated.rows.length} grade rows · {studentCount} students
              {parseErrors.length ? ` · ${parseErrors.length} row warnings` : ''}
            </p>
            {parseErrors.length > 0 && (
              <ul className="text-amber-400 text-xs list-disc pl-4 max-h-24 overflow-auto space-y-1">
                {parseErrors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            <div className="border border-slate-800 rounded-md overflow-auto max-h-56">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Courses + marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentPreview.map((r) => (
                    <TableRow key={r.email} className="border-slate-800">
                      <TableCell>{r.full_name}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.program}</TableCell>
                      <TableCell>{r.courses.join(' · ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <Checkbox checked={issueDocuments} onCheckedChange={(v) => setIssueDocuments(v === true)} />
              <span>Issue transcripts and certificates after grades are saved (requires complete institution document settings).</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <Checkbox checked={sendWelcomeEmail} onCheckedChange={(v) => setSendWelcomeEmail(v === true)} />
              <span>Send login emails to newly created students (off by default for alumni).</span>
            </label>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('upload')} disabled={importing} className="border-slate-700">Back</Button>
              <Button onClick={runImport} disabled={importing || !validated.rows.length} className="bg-indigo-600 hover:bg-indigo-700">
                {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing…</> : `Import ${studentCount} alumni`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-3 py-2 text-sm">
            <p className="text-green-400">{result.studentsCreated} new students</p>
            <p className="text-slate-300">{result.studentsReused} existing students reused</p>
            <p className="text-slate-300">{result.gradesWritten} grades written · {result.classesTouched} alumni classes</p>
            {result.documents && (
              <div className="text-slate-400 text-xs space-y-1">
                <p>Transcripts: {result.documents.transcripts}</p>
                <p>Certificates: {result.documents.certificates}</p>
              </div>
            )}
            {result.errors?.length > 0 && (
              <ul className="text-amber-400 list-disc pl-4 space-y-1">
                {result.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            <DialogFooter>
              <Button onClick={handleClose} className="bg-indigo-600 hover:bg-indigo-700">Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
