import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import AnimatedPage from '@/components/AnimatedPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { ArrowLeft, MessageSquare, Star } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { likertToneClass } from '@/lib/ratingEvaluation';

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
    () => ratingResponses.filter((r) => r.evaluation_id === evaluationId),
    [ratingResponses, evaluationId]
  );

  const courseName = courses.find((c) => c.id === evaluation?.course_id)?.name;
  const className = classes.find((c) => c.id === evaluation?.class_id)?.name;

  const aggregates = useMemo(() => {
    return questions.map((q) => {
      if (q.type === 'text') {
        const texts = responses
          .map((r) => {
            const ans = (r.answers || []).find((a) => a.question_id === q.id);
            return ans?.value?.trim();
          })
          .filter(Boolean);
        return { question: q, kind: 'text' as const, texts };
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
      return { question: q, kind: 'choice' as const, counts, options, total: responses.length };
    });
  }, [questions, responses]);

  const selected = responses.find((r) => r.id === selectedId) || null;
  const selectedStudent = selected
    ? students.find((s) => s.id === selected.student_id)
    : null;

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

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/assignments')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <h1 className="text-2xl font-semibold text-slate-100">{evaluation.title}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {courseName ? (
              <>
                <span className="text-indigo-300">{courseName}</span>
                {className ? <span> · {className}</span> : null}
              </>
            ) : (
              className
            )}
            {' · '}
            {responses.length} response{responses.length === 1 ? '' : 's'}
          </p>
        </div>
        <Badge variant="outline" className="border-amber-700/40 text-amber-300">
          <Star className="mr-1 h-3 w-3" /> Rating Feedback
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-sm font-medium text-slate-300">Summary by question</h2>
          {aggregates.map((agg, idx) => (
            <Card key={agg.question.id} className="bg-slate-900/50 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-100">
                  {idx + 1}. {agg.question.text}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {agg.kind === 'text' ? (
                  agg.texts.length === 0 ? (
                    <p className="text-sm text-slate-500">No written answers yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {agg.texts.map((t, i) => (
                        <li
                          key={i}
                          className="text-sm text-slate-300 rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <div className="space-y-2">
                    {agg.options.map((opt) => {
                      const count = agg.counts[opt.value] || 0;
                      const pct = agg.total > 0 ? Math.round((count / agg.total) * 100) : 0;
                      return (
                        <div key={opt.value} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 ${likertToneClass(opt.tone)}`}
                            >
                              {opt.label}
                            </span>
                            <span>
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500/80 transition-[width]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {aggregates.length === 0 && (
            <p className="text-sm text-slate-500">No questions on this evaluation.</p>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-medium text-slate-300">Individual responses</h2>
          <div className="space-y-2 max-h-[40vh] lg:max-h-[70vh] overflow-y-auto pr-1">
            {responses.map((r) => {
              const student = students.find((s) => s.id === r.student_id);
              const active = selectedId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    active
                      ? 'border-indigo-600/60 bg-indigo-950/30'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-200 font-medium truncate">
                      {student?.name || 'Student'}
                    </span>
                    <MessageSquare className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatDateTime(r.submitted_at)}
                  </p>
                </button>
              );
            })}
            {responses.length === 0 && (
              <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-xl">
                No submissions yet.
              </p>
            )}
          </div>

          {selected && (
            <Card className="bg-slate-900/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {selectedStudent?.name || 'Student'} answers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.map((q, idx) => {
                  const ans = (selected.answers || []).find((a) => a.question_id === q.id);
                  const opt =
                    Array.isArray(q.options) &&
                    q.options.find((o) => o.value === ans?.value);
                  return (
                    <div key={q.id} className="text-sm">
                      <p className="text-slate-400">
                        {idx + 1}. {q.text}
                      </p>
                      <p className="text-slate-100 mt-1">
                        {opt?.label || ans?.value || (
                          <span className="text-slate-500">—</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
};

export default RatingFeedbackPage;
