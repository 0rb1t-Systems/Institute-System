import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import AnimatedPage from '@/components/AnimatedPage';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { ArrowLeft } from 'lucide-react';

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
    <div className="relative mx-auto h-36 w-36 shrink-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={44}
            outerRadius={64}
            stroke="none"
            paddingAngle={total > 0 && slices.length > 1 ? 3 : 0}
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
        <span className="text-xl font-semibold tabular-nums leading-none text-white">{total}</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
          Votes
        </span>
      </div>
    </div>
  );
}

const RatingFeedbackPage = () => {
  const { evaluationId } = useParams();
  const navigate = useNavigate();
  const { ratingEvaluations, ratingQuestions, ratingResponses, classes, courses } = useData();

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

      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 h-8 text-slate-400 hover:text-slate-100"
          onClick={() => navigate('/assignments')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{evaluation.title}</h1>
        <p className="mt-1 text-sm text-slate-400">
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

      <section>
        <h2 className="mb-5 text-sm font-medium text-slate-300">Summary by question</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {aggregates.map((agg) => (
            <article
              key={agg.question.id}
              className="flex min-w-0 flex-col rounded-2xl border border-slate-800 bg-[#12171f] p-6"
            >
              <p className="mb-6 text-[15px] font-medium leading-relaxed text-slate-100">
                <span className="mr-1.5 text-slate-500">{agg.qIndex + 1}.</span>
                {agg.question.text}
              </p>

              {agg.kind === 'choice' ? (
                <div className="mt-auto flex flex-col items-stretch gap-6 sm:flex-row sm:items-center">
                  <DonutChart slices={agg.slices} total={agg.answered} />
                  <ul className="min-w-0 flex-1 space-y-3">
                    {agg.slices.length ? (
                      agg.slices.map((slice) => (
                        <li
                          key={slice.key}
                          className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: slice.color }}
                            aria-hidden
                          />
                          <span className="truncate text-sm text-slate-300">{slice.label}</span>
                          <span className="whitespace-nowrap text-sm tabular-nums text-slate-400">
                            {slice.count} · {slice.pct}%
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-slate-500">No votes yet</li>
                    )}
                  </ul>
                </div>
              ) : (
                <div className="mt-auto space-y-2.5">
                  {agg.texts.length ? (
                    agg.texts.map((text, i) => (
                      <p
                        key={`${agg.question.id}-t-${i}`}
                        className="rounded-xl bg-slate-900/80 px-3.5 py-2.5 text-sm leading-relaxed text-slate-300"
                      >
                        “{text}”
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No written answers</p>
                  )}
                </div>
              )}
            </article>
          ))}

          {aggregates.length === 0 && (
            <p className="col-span-full rounded-2xl border border-dashed border-slate-800 py-14 text-center text-sm text-slate-500">
              No questions.
            </p>
          )}
        </div>
      </section>
    </AnimatedPage>
  );
};

export default RatingFeedbackPage;
