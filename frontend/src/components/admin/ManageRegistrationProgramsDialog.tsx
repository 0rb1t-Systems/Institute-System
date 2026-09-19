import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, GraduationCap, Search } from 'lucide-react';
import {
  getCourses,
  getDiplomas,
  getRegistrationFormPrograms,
  setRegistrationFormPrograms,
} from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';

const programKey = (type, id) => `${type}:${id}`;

/**
 * Admin/Staff: pick which courses & diplomas appear in the student
 * Preferred Program dropdown for Online Registration or an Affiliate referral link.
 */
const ManageRegistrationProgramsDialog = ({
  open,
  onOpenChange,
  affiliateId = null,
  title = undefined,
  description = undefined,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  affiliateId?: string | null
  title?: string
  description?: string
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [diplomas, setDiplomas] = useState([]);
  const [isRestricted, setIsRestricted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');

  const dialogTitle = title || (affiliateId ? 'Manage Affiliate Programs' : 'Manage Programs');
  const dialogDescription =
    description ||
    (affiliateId
      ? 'Choose which courses and diplomas students can pick on this affiliate referral form.'
      : 'Choose which courses and diplomas students can pick on the Online Registration form.');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setSearch('');
      try {
        const [courseRows, diplomaRows, config] = await Promise.all([
          getCourses(),
          getDiplomas(),
          getRegistrationFormPrograms(affiliateId || null),
        ]);
        if (cancelled) return;
        setCourses(courseRows || []);
        setDiplomas(diplomaRows || []);
        setIsRestricted(Boolean(config?.is_restricted));
        const next = new Set<string>();
        for (const p of config?.programs || []) {
          if (p?.program_type && p?.program_id) {
            next.add(programKey(p.program_type, p.program_id));
          }
        }
        setSelected(next);
      } catch (err) {
        notify.error(err, {
          context: 'ManageRegistrationProgramsDialog - load',
          fallback: MESSAGES.LOAD_FAILED,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, affiliateId]);

  const query = search.trim().toLowerCase();

  const diplomaList = useMemo(() => {
    const rows = [...diplomas].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || '')),
    );
    if (!query) return rows;
    return rows.filter((d) => String(d.name || '').toLowerCase().includes(query));
  }, [diplomas, query]);

  const courseList = useMemo(() => {
    const rows = [...courses].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || '')),
    );
    if (!query) return rows;
    return rows.filter((c) => {
      const name = String(c.name || '').toLowerCase();
      const code = String(c.code || '').toLowerCase();
      return name.includes(query) || code.includes(query);
    });
  }, [courses, query]);

  const selectedCount = selected.size;

  const toggle = (type, id) => {
    const key = programKey(type, id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const d of diplomaList) next.add(programKey('diploma', d.id));
      for (const c of courseList) next.add(programKey('course', c.id));
      return next;
    });
  };

  const clearAll = () => setSelected(new Set());

  const handleSave = async () => {
    setSaving(true);
    try {
      const programs = [];
      for (const key of selected) {
        const [program_type, program_id] = key.split(':');
        if (program_type && program_id) {
          programs.push({ program_type, program_id });
        }
      }
      await setRegistrationFormPrograms({
        isRestricted,
        programs,
        affiliateId: affiliateId || null,
      });
      toast({
        title: 'Programs saved',
        description: isRestricted
          ? `${programs.length} program(s) will appear on this registration form.`
          : 'All active classes will appear on this registration form.',
      });
      onOpenChange?.(false);
    } catch (err) {
      notify.error(err, {
        context: 'ManageRegistrationProgramsDialog - save',
        fallback: MESSAGES.SAVE_FAILED,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[var(--ds-text-secondary,#5B6B61)]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading programs…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)] px-3 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="restrict-programs">
                  Limit Preferred Class options
                </Label>
                <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                  When on, only checked programs appear in the student dropdown.
                </p>
              </div>
              <Switch
                id="restrict-programs"
                checked={isRestricted}
                onCheckedChange={setIsRestricted}
              />
            </div>

            {isRestricted ? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ds-text-tertiary,#8A978E)]" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search programs…"
                    className="pl-9"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[var(--ds-text-tertiary,#8A978E)]">{selectedCount} selected</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={selectAllVisible}>
                      Select all
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                      Clear
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[320px] rounded-md border border-[var(--ds-border,#DDE5DF)]">
                  <div className="p-3 space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--ds-text-primary,#122018)]">
                        <GraduationCap className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" />
                        Diplomas
                        <Badge variant="outline" className="text-[var(--ds-text-secondary,#5B6B61)]">
                          {diplomaList.length}
                        </Badge>
                      </div>
                      {diplomaList.length === 0 ? (
                        <p className="pl-6 text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                          {query ? 'No diplomas match your search.' : 'No diplomas in this institution.'}
                        </p>
                      ) : (
                        <ul className="space-y-2 pl-1">
                          {diplomaList.map((d) => {
                            const key = programKey('diploma', d.id);
                            const checked = selected.has(key);
                            return (
                              <li key={d.id} className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                <Checkbox
                                  id={`diploma-${d.id}`}
                                  checked={checked}
                                  onCheckedChange={() => toggle('diploma', d.id)}
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`diploma-${d.id}`}
                                  className="cursor-pointer text-sm font-normal leading-snug"
                                >
                                  {d.name}
                                </Label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--ds-text-primary,#122018)]">
                        <BookOpen className="h-4 w-4 text-[var(--ds-accent,#1F8A5B)]" />
                        Courses
                        <Badge variant="outline" className="text-[var(--ds-text-secondary,#5B6B61)]">
                          {courseList.length}
                        </Badge>
                      </div>
                      {courseList.length === 0 ? (
                        <p className="pl-6 text-xs text-[var(--ds-text-tertiary,#8A978E)]">
                          {query ? 'No courses match your search.' : 'No courses in this institution.'}
                        </p>
                      ) : (
                        <ul className="space-y-2 pl-1">
                          {courseList.map((c) => {
                            const key = programKey('course', c.id);
                            const checked = selected.has(key);
                            return (
                              <li key={c.id} className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-[var(--ds-surface-muted,#F7FAF8)]">
                                <Checkbox
                                  id={`course-${c.id}`}
                                  checked={checked}
                                  onCheckedChange={() => toggle('course', c.id)}
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`course-${c.id}`}
                                  className="cursor-pointer text-sm font-normal leading-snug"
                                >
                                  {c.name}
                                  {c.code ? (
                                    <span className="ml-2 font-mono text-xs text-[var(--ds-text-tertiary,#8A978E)]">{c.code}</span>
                                  ) : null}
                                </Label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--ds-border,#DDE5DF)] px-3 py-4 text-sm text-[var(--ds-text-secondary,#5B6B61)]">
                Restriction is off. Students see every active class for this institution.
                Turn it on, check the programs you want, then save.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageRegistrationProgramsDialog;
