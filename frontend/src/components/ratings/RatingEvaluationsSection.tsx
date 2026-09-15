import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { notify, MESSAGES } from '@/lib/notify';
import {
  Plus,
  Star,
  Calendar,
  Users,
  Trash2,
  Edit,
  ClipboardList,
  ListPlus,
  ClipboardPaste,
  Copy,
  Link as LinkIcon,
  RefreshCw,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { coursesForClass } from '@/lib/diplomaCourses';
import {
  DateTimePickerField,
  splitDateTimeLocal,
  combineDateAndTime,
} from '@/components/ui/DateTimeFields';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  LIKERT_OPTIONS,
  makeLikertQuestion,
  makeStarterQuestions,
  parseBulkQuestions,
  type RatingQuestionDraft,
} from '@/lib/ratingEvaluation';
import { getTenantBaseUrl } from '@/lib/institution';
import { rotateRatingPublicToken } from '@/lib/api';

type Props = {
  /** Parent Assignments page binds Create Rating to this opener. */
  createOpenerRef?: React.MutableRefObject<(() => void) | null>;
};

/** Rating evaluations list + create/edit dialog — lives on Assignments (not a separate nav page). */
export default function RatingEvaluationsSection({ createOpenerRef }: Props) {
  const { user, institution } = useAuth();
  const {
    classes,
    courses,
    classCourses,
    diplomaCourses = [],
    ratingEvaluations,
    ratingQuestions,
    ratingResponses,
    saveRatingEvaluation,
    deleteRatingEvaluationData,
    refreshData,
  } = useData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rotatingId, setRotatingId] = useState<string | null>(null);

  const publicLinkFor = (ev: { public_token?: string | null }) => {
    const token = String(ev?.public_token || '').trim();
    if (!token) return '';
    const base = institution ? getTenantBaseUrl(institution) : window.location.origin;
    return `${base}/rate/${token}`;
  };

  const copyPublicLink = async (ev: { id: string; public_token?: string | null; title?: string }) => {
    const link = publicLinkFor(ev);
    if (!link) {
      notify.validation('Public link is not ready yet. Refresh the page and try again.');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Link copied',
        description: 'Share this link so visitors can submit feedback without logging in.',
      });
    } catch {
      notify.error(new Error('Clipboard failed'), {
        context: 'RatingEvaluationsSection - copy link',
        fallback: { title: 'Copy failed', description: 'Could not copy the link. Select it manually.' },
      });
    }
  };

  const rotateLink = async (ev: { id: string }) => {
    setRotatingId(ev.id);
    try {
      await rotateRatingPublicToken(ev.id);
      if (typeof refreshData === 'function') await refreshData();
      toast({
        title: 'Link rotated',
        description: 'The old public link no longer works. Copy the new link to share.',
      });
    } catch (error) {
      notify.error(error, {
        context: 'RatingEvaluationsSection - rotate link',
        fallback: MESSAGES.SAVE_FAILED,
      });
    } finally {
      setRotatingId(null);
    }
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [questionMode, setQuestionMode] = useState<'builder' | 'bulk'>('builder');
  const [bulkText, setBulkText] = useState('');
  const [questions, setQuestions] = useState<RatingQuestionDraft[]>(makeStarterQuestions());
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    class_id: '',
    course_id: '',
    due_date: '',
    due_time: '23:59',
    is_active: true,
  });

  const availableClasses = useMemo(
    () => (user?.role === 'admin' || user?.role === 'staff' ? classes.filter((c) => c.is_active) : []),
    [classes, user]
  );

  const selectedClassCourses = useMemo(() => {
    const cls = classes.find((c) => c.id === formData.class_id);
    return coursesForClass(cls, courses, classCourses, diplomaCourses);
  }, [classes, courses, classCourses, diplomaCourses, formData.class_id]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === formData.class_id) || null,
    [classes, formData.class_id]
  );
  const isDiplomaClass = Boolean(selectedClass?.diploma_id) || selectedClassCourses.length > 1;

  const resetForm = () => {
    const defaultClassId = availableClasses[0]?.id || '';
    const cls = classes.find((c) => c.id === defaultClassId);
    const classCourseList = coursesForClass(cls, courses, classCourses, diplomaCourses);
    setEditing(null);
    setFormData({
      title: '',
      description: '',
      class_id: defaultClassId,
      course_id: classCourseList.length === 1 ? classCourseList[0].id : '',
      due_date: '',
      due_time: '23:59',
      is_active: true,
    });
    setQuestions(makeStarterQuestions());
    setBulkText('');
    setQuestionMode('builder');
  };

  const handleOpenDialog = (evaluation = null) => {
    if (evaluation) {
      setEditing(evaluation);
      const parts = splitDateTimeLocal(evaluation.due_date);
      setFormData({
        title: evaluation.title,
        description: evaluation.description || '',
        class_id: evaluation.class_id,
        course_id: evaluation.course_id || '',
        due_date: parts.date,
        due_time: parts.time || '23:59',
        is_active: evaluation.is_active !== false,
      });
      const existing = ratingQuestions
        .filter((q) => q.evaluation_id === evaluation.id)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((q) => ({
          key: q.id,
          text: q.text,
          type: (q.type || 'likert') as RatingQuestionDraft['type'],
          options:
            Array.isArray(q.options) && q.options.length > 0
              ? q.options
              : LIKERT_OPTIONS.map((o) => ({ ...o })),
        }));
      setQuestions(existing.length > 0 ? existing : makeStarterQuestions());
      setBulkText('');
      setQuestionMode('builder');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (!createOpenerRef) return;
    createOpenerRef.current = () => handleOpenDialog();
    return () => {
      createOpenerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind stable opener for parent button
  }, [createOpenerRef, availableClasses, classes, courses, classCourses, diplomaCourses, ratingQuestions]);

  const addQuestion = () => {
    setQuestions((prev) => [...prev, makeLikertQuestion('')]);
  };

  const updateQuestion = (key: string, patch: Partial<RatingQuestionDraft>) => {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  };

  const removeQuestion = (key: string) => {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
  };

  const applyBulkPaste = () => {
    const parsed = parseBulkQuestions(bulkText);
    if (parsed.length === 0) {
      notify.validation('Paste at least one question (one per line).');
      return;
    }
    setQuestions(parsed);
    setQuestionMode('builder');
    toast({ title: 'Questions loaded', description: `${parsed.length} question(s) ready to review.` });
  };

  const handleSave = async () => {
    if (!formData.title?.trim()) {
      notify.validation('Please enter a rating title.');
      return;
    }
    if (!formData.class_id) {
      notify.validation('Please select a class.');
      return;
    }
    if (selectedClassCourses.length > 1 && !formData.course_id) {
      notify.validation('Please select which course this rating belongs to.');
      return;
    }

    const cleaned = questions
      .map((q) => ({
        text: q.text.trim(),
        type: q.type,
        options:
          q.type === 'text'
            ? []
            : q.type === 'likert'
              ? LIKERT_OPTIONS.map((o) => ({ ...o }))
              : (q.options || []).filter((o) => o.label?.trim()),
      }))
      .filter((q) => q.text);

    if (cleaned.length === 0) {
      notify.validation('Add at least one question.');
      return;
    }

    const dueLocal =
      formData.due_date && formData.due_time
        ? combineDateAndTime(formData.due_date, formData.due_time)
        : null;

    setLoading(true);
    try {
      await saveRatingEvaluation({
        id: editing?.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        class_id: formData.class_id,
        course_id: formData.course_id || selectedClassCourses[0]?.id || null,
        due_date: dueLocal ? new Date(dueLocal).toISOString() : null,
        is_active: formData.is_active !== false,
        questions: cleaned,
      });
      setIsDialogOpen(false);
      toast({
        title: 'Success',
        description: editing ? MESSAGES.SUCCESS.RATING_UPDATED : MESSAGES.SUCCESS.RATING_CREATED,
      });
    } catch (error) {
      notify.error(error, { context: 'RatingEvaluationsSection - save', fallback: MESSAGES.SAVE_FAILED });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRatingEvaluationData(id);
      toast({ title: 'Success', description: MESSAGES.SUCCESS.RATING_DELETED });
    } catch (error) {
      notify.error(error, { context: 'RatingEvaluationsSection - delete', fallback: MESSAGES.DELETE_FAILED });
    }
  };

  const getStats = (evaluationId: string) => {
    const responses = ratingResponses.filter((r) => r.evaluation_id === evaluationId);
    const qCount = ratingQuestions.filter((q) => q.evaluation_id === evaluationId).length;
    return { responses: responses.length, questions: qCount };
  };

  return (
    <>
      {ratingEvaluations.length > 0 && (
        <div className="mt-10 space-y-4">
          <h2 className="text-lg font-medium text-slate-200 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            Rating Evaluations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {ratingEvaluations.map((ev) => {
              const stats = getStats(ev.id);
              const cls = classes.find((c) => c.id === ev.class_id);
              const courseName = courses.find((c) => c.id === ev.course_id)?.name;
              return (
                <Card key={ev.id} className="bg-slate-900/50 border-slate-800 flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-lg text-slate-100 line-clamp-1" title={ev.title}>
                          {ev.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {courseName ? (
                            <>
                              <span className="text-indigo-300">{courseName}</span>
                              {cls?.name ? <span> · {cls.name}</span> : null}
                            </>
                          ) : (
                            cls?.name || '—'
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            ev.is_active !== false
                              ? 'border-emerald-700/50 text-emerald-300 bg-emerald-950/30'
                              : 'border-slate-600 text-slate-400 bg-slate-800/50'
                          }`}
                        >
                          {ev.is_active !== false ? 'Open' : 'Closed'}
                        </span>
                        <div className="p-2 bg-slate-800 rounded-full">
                          <Star className="h-4 w-4 text-amber-400" />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    {ev.due_date && (
                      <div className="flex items-center text-sm text-slate-400 gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>Due: {formatDateTime(ev.due_date)}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm text-slate-400 gap-2">
                      <ClipboardList className="h-4 w-4" />
                      <span>
                        {stats.questions} question{stats.questions === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
                      <div className="text-xs text-slate-500">
                        Submitted:{' '}
                        <span className="text-slate-300 font-medium">{stats.responses}</span>
                      </div>
                    </div>
                    {ev.public_token && ev.is_active !== false ? (
                      <div className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                          Public feedback link (no login)
                        </p>
                        <div className="flex gap-1.5">
                          <Input
                            readOnly
                            value={publicLinkFor(ev)}
                            className="h-8 bg-slate-950 border-slate-700 text-[11px] font-mono text-slate-300"
                            onFocus={(e) => e.target.select()}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 shrink-0"
                            onClick={() => copyPublicLink(ev)}
                          >
                            <Copy className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">Copy</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0 border-slate-700"
                            disabled={rotatingId === ev.id}
                            title="Invalidate old link and create a new one"
                            onClick={() => rotateLink(ev)}
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${rotatingId === ev.id ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter className="pt-2 gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => navigate(`/assignments/ratings/${ev.id}/feedback`)}
                    >
                      <Users className="mr-2 h-4 w-4" /> View Feedback
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(ev)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-red-900/20 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Rating Evaluation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the evaluation, questions, and all student feedback.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => handleDelete(ev.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Rating Evaluation' : 'Create Rating'}</DialogTitle>
            <DialogDescription>
              Students rate the instructor and how well they understood the course.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 pr-1">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. End-of-course feedback"
              />
            </div>

            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={formData.class_id}
                onValueChange={(val) => {
                  const cls = classes.find((c) => c.id === val);
                  const classCourseList = coursesForClass(cls, courses, classCourses, diplomaCourses);
                  setFormData({
                    ...formData,
                    class_id: val,
                    course_id: classCourseList.length === 1 ? classCourseList[0].id : '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClassCourses.length > 0 && (
              <div className="space-y-2">
                <Label>{isDiplomaClass ? 'Diploma course' : 'Course'}</Label>
                <Select
                  value={formData.course_id || undefined}
                  onValueChange={(val) => setFormData({ ...formData, course_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={isDiplomaClass ? 'Select a course in this diploma' : 'Select course'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedClassCourses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.is_active ? 'open' : 'closed'}
                onValueChange={(val) => setFormData({ ...formData, is_active: val === 'open' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open for students</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due date (optional)</Label>
              <DateTimePickerField
                date={formData.due_date}
                time={formData.due_time}
                onChange={({ date, time }) =>
                  setFormData({ ...formData, due_date: date, due_time: time })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Short note for students before they start."
              />
            </div>

            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-base">Questions</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={questionMode === 'builder' ? 'secondary' : 'outline'}
                    onClick={() => setQuestionMode('builder')}
                  >
                    <ListPlus className="mr-1.5 h-3.5 w-3.5" /> One by one
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={questionMode === 'bulk' ? 'secondary' : 'outline'}
                    onClick={() => setQuestionMode('bulk')}
                  >
                    <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" /> Bulk paste
                  </Button>
                </div>
              </div>

              {questionMode === 'bulk' ? (
                <div className="space-y-2">
                  <Textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={8}
                    placeholder={`Paste one question per line, e.g.\n1. The instructor explained topics clearly.\n2. The course content was well organized.`}
                  />
                  <p className="text-[10px] text-slate-500">
                    Each line becomes a Likert question (Strongly Agree → Strongly Disagree).
                  </p>
                  <Button type="button" variant="secondary" onClick={applyBulkPaste}>
                    Load pasted questions
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div
                      key={q.key}
                      className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-slate-500 mt-2 w-5 shrink-0">{idx + 1}.</span>
                        <div className="flex-1 space-y-2">
                          <Input
                            value={q.text}
                            onChange={(e) => updateQuestion(q.key, { text: e.target.value })}
                            placeholder="Question text"
                          />
                          <Select
                            value={q.type}
                            onValueChange={(val: RatingQuestionDraft['type']) =>
                              updateQuestion(q.key, {
                                type: val,
                                options:
                                  val === 'likert'
                                    ? LIKERT_OPTIONS.map((o) => ({ ...o }))
                                    : val === 'mcq'
                                      ? [
                                          { label: 'Option A', value: 'a' },
                                          { label: 'Option B', value: 'b' },
                                        ]
                                      : [],
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="likert">Multiple choice (Agree scale)</SelectItem>
                              <SelectItem value="mcq">Multiple choice (custom)</SelectItem>
                              <SelectItem value="text">Open text answer</SelectItem>
                            </SelectContent>
                          </Select>
                          {q.type === 'mcq' && (
                            <Textarea
                              rows={3}
                              value={(q.options || []).map((o) => o.label).join('\n')}
                              onChange={(e) => {
                                const opts = e.target.value
                                  .split(/\r?\n/)
                                  .map((line) => line.trim())
                                  .filter(Boolean)
                                  .map((label, i) => ({
                                    label,
                                    value: `opt_${i}`,
                                  }));
                                updateQuestion(q.key, { options: opts });
                              }}
                              placeholder="One option per line"
                            />
                          )}
                          {q.type === 'likert' && (
                            <p className="text-[10px] text-slate-500">
                              Strongly Agree · Agree · Neutral · Disagree · Strongly Disagree
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 hover:text-red-400"
                          onClick={() => removeQuestion(q.key)}
                          disabled={questions.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add question
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuestions(makeStarterQuestions())}
                    >
                      Reset to starter 5
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : editing ? 'Save changes' : 'Create Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
