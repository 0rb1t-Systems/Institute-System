import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import AnimatedPage from '@/components/AnimatedPage';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { likertToneClass } from '@/lib/ratingEvaluation';

const TONE_META: Record<string, { label: string; color: string }> = {
  positive: { label: 'Agree', color: '#22c55e' },
  neutral: { label: 'Neutral', color: '#6b7280' },
  negative: { label: 'Disagree', color: '#fb7185' },
};

function toneForValue(value?: string) {
  if (!value) return undefined;
  if (value.includes('agree') && !value.includes('disagree')) return 'positive';
  if (value.includes('disagree')) return 'negative';
  if (value === 'neutral') return 'neutral';
  return undefined;
}

function optionTone(opt: { value?: string; tone?: string }) {
  return opt.tone || toneForValue(opt.value);
}

type Slice = { key: string; label: string; count: number; pct: number; color: string };

function buildChoiceSlices(
  options: { label?: string; value: string; tone?: string }[],
  counts: Record<string, number>,
  answered: number
): Slice[] {
  const hasTones = options.some((o) => optionTone(o));

  if (hasTones) {
    const buckets: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
    options.forEach((opt) => {
      const tone = optionTone(opt) || 'neutral';
      buckets[tone] = (buckets[tone] || 0) + (counts[opt.value] || 0);
    });
    return (['positive', 'neutral', 'negative'] as const)
      .map((tone) => {
        const meta = TONE_META[tone];
        const count = buckets[tone] || 0;
        return {
          key: tone,
          label: meta.label,
          count,
          pct: answered > 0 ? Math.round((count / answered) * 100) : 0,
          color: meta.color,
        };
      })
      .filter((s) => s.count > 0);
  }

  const palette = ['#22c55e', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#6b7280'];
  return options
    .map((opt, i) => {
      const count = counts[opt.value] || 0;
      return {
        key: opt.value,
        label: opt.label || opt.value,
        count,
        pct: answered > 0 ? Math.round((count / answered) * 100) : 0,
        color: palette[i % palette.length],
      };
    })
    .filter((s) => s.count > 0);
}

function DonutChart({ slices, total }: { slices: Slice[]; total: number }) {
  const data =
    total > 0 && slices.length
      ? slices
      : [{ key: 'empty', label: 'Empty', count: 1, pct: 0, color: '#1e293b' }];

  return (
    <div className="relative h-[112px] w-[112px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={34}
            outerRadius={50}
            stroke="none"
            paddingAngle={total > 0 && slices.length > 1 ? 2 : 0}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-semibold tabular-nums leading-none text-white">
          {total}
        </span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400">
          Votes
        </span>
      </div>
    </div>
  );
}

const RatingFeedbackPage = () => {
  const { evaluationId } = useParams();
  const navigate = useNavigate();
  const {
    ratingEvaluations,
    ratingQuestions,
    ratingResponses,
    classes,
    courses,
    students,
  } = useData();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const evaluation = useMemo(
    () => ratingEvaluations.find((e) => e.id === evaluationId),
    [ratingEvaluations, evaluationId]
  );

  const questions = useMemo(
    () =>
      ratingQuestions
        .filter((q) => q.evaluation_id === evaluationId)
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
    [ratingQuestions, evaluationId]
  );

  const responses = useMemo(
    () =>
      [...ratingResponses.filter((r) => r.evaluation_id === evaluationId)].sort(
        (a, b) => Number(new Date(b.submitted_at)) - Number(new Date(a.submitted_at))
      ),
    [ratingResponses, evaluationId]
  );

  useEffect(() => {
    if (!responses.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) =>
      prev && responses.some((r) => r.id === prev) ? prev : null
    );
  }, [responses]);

  const courseName = courses.find((c) => c.id === evaluation?.course_id)?.name;
  const className = classes.find((c) => c.id === evaluation?.class_id)?.name;

  const aggregates = useMemo(() => {
    return questions.map((q, qIndex) => {
      if (q.type === 'text') {
        const texts = responses
          .map((r) => {
            const ans = (r.answers || []).find((a) => a.question_id === q.id);
            const value = ans?.value?.trim();
            return value || null;
          })
          .filter(Boolean) as string[];
        return { question: q, kind: 'text' as const, texts, qIndex };
      }

      const counts: Record<string, number> = {};
      const options = Array.isArray(q.options) ? q.options : [];
      options.forEach((o) => {
        counts[o.value] = 0;
      });
      responses.forEach((r) => {
        const ans = (r.answers || []).find((a) => a.question_id === q.id);
        if (ans?.value != null) {
          counts[ans.value] = (counts[ans.value] || 0) + 1;
        }
      });
      const answered = Object.values(counts).reduce((sum, n) => sum + n, 0);
      const slices = buildChoiceSlices(options, counts, answered);
      return { question: q, kind: 'choice' as const, answered, slices, qIndex };
    });
  }, [questions, responses]);

  const selected = responses.find((r) => r.id === selectedId) || null;
  const selectedStudent = selected
    ? students.find((s) => s.id === selected.student_id)
    : null;

  const responseHasComment = (r: (typeof responses)[number]) => {
    const textQs = questions.filter((q) => q.type === 'text');
    if (!textQs.length) return false;
    return textQs.some((q) => {
      const ans = (r.answers || []).find((a) => a.question_id === q.id);
      return Boolean(ans?.value?.trim());
    });
  };

  const resolveAnswerLabel = (q: (typeof questions)[number], value?: string) => {
    if (value == null || value === '') return null;
    const opt = Array.isArray(q.options) ? q.options.find((o) => o.value === value) : null;
    return opt?.label || value;
  };

  if (!evaluation) {
    return (
      <AnimatedPage>
        <div className="py-16 text-center text-slate-400">
          <p>Rating evaluation not found.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate('/assignments')}>
            Back to Assignments
          </Button>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Rating Feedback - Portal</title>
      </Helmet>

      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          className="mb-1 -ml-2 h-8 text-slate-400 hover:text-slate-100"
          onClick={() => navigate('/assignments')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">{evaluation.title}</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          {courseName ? (
            <>
              <span className="text-emerald-300/90">{courseName}</span>
              {className ? <span> · {className}</span> : null}
            </>
          ) : (
            className
          )}
          {' · '}
          {responses.length} response{responses.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Summary by question */}
        <section>
          <h2 className="mb-3 text-[13px] font-medium text-slate-300">Summary by question</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {aggregates.map((agg) => (
              <article
                key={agg.question.id}
                className="rounded-xl border border-slate-800/90 bg-[#12171f] p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]"
              >
                <p className="mb-4 text-[13px] leading-snug text-slate-100">
                  <span className="mr-1 text-slate-500">{agg.qIndex + 1}.</span>
                  {agg.question.text}
                </p>

                {agg.kind === 'choice' ? (
                  <div className="flex items-center gap-4">
                    <DonutChart slices={agg.slices} total={agg.answered} />
                    <ul className="min-w-0 flex-1 space-y-2">
                      {agg.slices.length ? (
                        agg.slices.map((slice) => (
                          <li key={slice.key} className="flex items-center gap-2 text-[12px]">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: slice.color }}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate text-slate-300">
                              {slice.label}
                            </span>
                            <span className="shrink-0 tabular-nums text-slate-400">
                              {slice.count} · {slice.pct}%
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="text-[12px] text-slate-500">No votes yet</li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agg.texts.length ? (
                      agg.texts.slice(0, 3).map((text, i) => (
                        <p
                          key={`${agg.question.id}-t-${i}`}
                          className="rounded-lg bg-slate-900/70 px-3 py-2 text-[12px] leading-relaxed text-slate-300"
                        >
                          “{text}”
                        </p>
                      ))
                    ) : (
                      <p className="text-[12px] text-slate-500">No written answers</p>
                    )}
                    {agg.texts.length > 3 ? (
                      <p className="text-[11px] text-slate-500">
                        +{agg.texts.length - 3} more
                      </p>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
            {aggregates.length === 0 && (
              <p className="col-span-full rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">
                No questions.
              </p>
            )}
          </div>
        </section>

        {/* Individual responses */}
        <section className="lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-3 text-[13px] font-medium text-slate-300">Individual responses</h2>
          <div className="space-y-2">
            {responses.map((r) => {
              const student = students.find((s) => s.id === r.student_id);
              const active = selectedId === r.id;
              const hasComment = responseHasComment(r);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId((prev) => (prev === r.id ? null : r.id))}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    active
                      ? 'border-emerald-500/35 bg-emerald-950/25'
                      : 'border-slate-800/90 bg-[#12171f] hover:border-slate-700 hover:bg-[#151b24]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-100">
                      {student?.name || 'Student'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatDateTime(r.submitted_at)}
                    </p>
                  </div>
                  <MessageSquare
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      hasComment ? 'text-slate-400' : 'text-slate-600'
                    }`}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </button>
              );
            })}

            {responses.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-800 py-8 text-center text-xs text-slate-500">
                No submissions yet.
              </p>
            )}
          </div>

          {selected ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-800/90 bg-[#12171f]">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-3.5 py-2.5">
                <span className="truncate text-[13px] font-medium text-slate-100">
                  {selectedStudent?.name || 'Student'}
                </span>
                <span className="shrink-0 text-[10px] text-slate-500">
                  {formatDateTime(selected.submitted_at)}
                </span>
              </div>
              <div className="divide-y divide-slate-800/60">
                {questions.map((q, idx) => {
                  const ans = (selected.answers || []).find((a) => a.question_id === q.id);
                  const label = resolveAnswerLabel(q, ans?.value);
                  const opt =
                    Array.isArray(q.options) &&
                    q.options.find((o) => o.value === ans?.value);
                  const tone = opt?.tone || toneForValue(ans?.value);
                  const isChoice =
                    Array.isArray(q.options) && q.options.length > 0 && q.type !== 'text';
                  return (
                    <div key={q.id} className="flex items-start gap-2 px-3.5 py-2">
                      <p className="min-w-0 flex-1 text-[11px] leading-snug text-slate-400">
                        <span className="mr-1 text-slate-600">{idx + 1}.</span>
                        {q.text}
                      </p>
                      {label ? (
                        isChoice ? (
                          <span
                            className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-medium ${likertToneClass(tone)}`}
                          >
                            {label}
                          </span>
                        ) : (
                          <span className="max-w-[45%] shrink-0 text-[11px] leading-snug text-slate-200">
                            {label}
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AnimatedPage>
  );
};

export default RatingFeedbackPage;
