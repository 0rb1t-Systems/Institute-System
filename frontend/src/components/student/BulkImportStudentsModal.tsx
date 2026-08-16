import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { notify, getUserMessage, MESSAGES } from '@/lib/notify';
import { Loader2, Upload } from 'lucide-react';
import { registerManualStudent } from '@/lib/api';

const SYSTEM_FIELDS = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: false },
];

function suggestMapping(headers) {
  const map: any = {};
  for (const h of headers) {
    const n = String(h).trim().toLowerCase();
    if (['name', 'full_name', 'fullname', 'student name'].includes(n)) map[h] = 'name';
    else if (['email', 'e-mail', 'mail'].includes(n)) map[h] = 'email';
    else if (['phone', 'mobile', 'tel', 'telephone'].includes(n)) map[h] = 'phone';
    else map[h] = 'skip';
  }
  return map;
}

/**
 * Phase 1 bulk import: CSV/XLSX → column map → preview → create-user + EmailJS welcome.
 */
export default function BulkImportStudentsModal({ open, onClose, onSuccess, classes = [] }) {
  const { toast } = useToast();
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [classId, setClassId] = useState('none');
  const [step, setStep] = useState('upload'); // upload | map | preview | done
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState({ ok: 0, fail: 0, errors: [] });

  const reset = () => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setClassId('none');
    setStep('upload');
    setImporting(false);
    setResult({ ok: 0, fail: 0, errors: [] });
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

const MAX_IMPORT_ROWS = 500;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum upload size is 5 MB.' });
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!json.length) {
        toast({ variant: 'destructive', title: 'Empty file', description: 'No rows found.' });
        return;
      }
      if (json.length > MAX_IMPORT_ROWS) {
        toast({
          variant: 'destructive',
          title: 'Too many rows',
          description: `Maximum ${MAX_IMPORT_ROWS} rows per import. This file has ${json.length}.`,
        });
        return;
      }
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRows(json);
      setMapping(suggestMapping(hdrs));
      setStep('map');
    } catch (err) {
      notify.error(err, { context: 'BulkImportStudentsModal - read', fallback: { title: 'Read failed', description: MESSAGES.DOMAIN.BULK_IMPORT_READ } });
    }
  };

  const mappedPreview = useMemo(() => {
    return rows.slice(0, 8).map((row) => {
      const out = { name: '', email: '', phone: '' };
      for (const [src, dest] of Object.entries(mapping) as [string, any][]) {
        if (dest && dest !== 'skip') out[dest] = String(row[src] ?? '').trim();
      }
      return out;
    });
  }, [rows, mapping]);

  const mappingValid = SYSTEM_FIELDS.filter((f) => f.required).every((f) =>
    Object.values(mapping).includes(f.key)
  );

  const runImport = async () => {
    if (!mappingValid) {
      toast({ variant: 'destructive', title: 'Map required fields', description: 'Name and Email are required.' });
      return;
    }
    setImporting(true);
    let ok = 0;
    let fail = 0;
    const errors = [];
    const seenEmails = new Set();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const payload = { name: '', email: '', phone: '', class_id: classId };
      for (const [src, dest] of Object.entries(mapping) as [string, any][]) {
        if (dest && dest !== 'skip') payload[dest] = String(row[src] ?? '').trim();
      }
      if (!payload.name || !payload.email) {
        fail++;
        errors.push(`Row ${i + 2}: missing name/email`);
        continue;
      }
      const emailKey = payload.email.toLowerCase();
      if (seenEmails.has(emailKey)) {
        fail++;
        errors.push(`Row ${i + 2}: duplicate email in file (${payload.email})`);
        continue;
      }
      seenEmails.add(emailKey);
      try {
        await registerManualStudent(payload);
        ok++;
      } catch (err) {
        fail++;
        errors.push(`Row ${i + 2} (${payload.email}): ${getUserMessage(err, { context: 'BulkImportStudentsModal - row', log: false })}`);
      }
    }
    setResult({ ok, fail, errors: errors.slice(0, 10) });
    setStep('done');
    setImporting(false);
    if (ok > 0 && onSuccess) onSuccess();
    toast({
      title: 'Import finished',
      description: `${ok} created, ${fail} failed. Welcome emails sent via EmailJS when configured.`,
    });
  };

  const activeClasses = classes.filter((c) => c.is_active);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import students</DialogTitle>
          <DialogDescription className="text-slate-400">
            Upload CSV/XLSX, map columns, preview, then create accounts via Supabase (Phase 1).
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-2">
            <Label className="flex flex-col items-center justify-center gap-3 border border-dashed border-slate-700 rounded-lg p-8 cursor-pointer hover:bg-slate-800/50">
              <Upload className="h-8 w-8 text-slate-400" />
              <span className="text-sm text-slate-300">Choose CSV or Excel file</span>
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFile} />
            </Label>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Optional class enrollment</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="bg-slate-950 border-slate-700">
                  <SelectValue placeholder="No class" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-700 text-slate-100">
                  <SelectItem value="none">No class</SelectItem>
                  {activeClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <span className="text-sm text-slate-400 truncate">{h}</span>
                  <Select
                    value={mapping[h] || 'skip'}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}
                  >
                    <SelectTrigger className="bg-slate-950 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-700 text-slate-100">
                      <SelectItem value="skip">Skip</SelectItem>
                      {SYSTEM_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('upload')} className="border-slate-700">Back</Button>
              <Button onClick={() => setStep('preview')} disabled={!mappingValid} className="bg-indigo-600 hover:bg-indigo-700">
                Preview
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-400">{rows.length} rows · showing first {mappedPreview.length}</p>
            <div className="border border-slate-800 rounded-md overflow-auto max-h-64">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedPreview.map((r, i) => (
                    <TableRow key={i} className="border-slate-800">
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.phone}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('map')} disabled={importing} className="border-slate-700">Back</Button>
              <Button onClick={runImport} disabled={importing} className="bg-indigo-600 hover:bg-indigo-700">
                {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing…</> : `Import ${rows.length} students`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3 py-2 text-sm">
            <p className="text-green-400">{result.ok} created</p>
            <p className="text-amber-400">{result.fail} failed</p>
            {result.errors.length > 0 && (
              <ul className="text-slate-400 list-disc pl-4 space-y-1">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
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
