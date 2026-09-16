import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getPublicRatingEvaluation, submitPublicRatingResponse } from '@/lib/api';
import { notify, getUserMessage, MESSAGES } from '@/lib/notify';
import { likertToneClass } from '@/lib/ratingEvaluation';
import { AlertCircle, CheckCircle2, Loader2, Star } from 'lucide-react';

type PublicQuestion = {
  id: string;
  text: string;
  type: 'likert' | 'mcq' | 'text';
  options?: { label?: string; value: string; tone?: string }[];
  order_index?: number;
};

type PublicEval = {
  token: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  institution_name?: string;
  questions: PublicQuestion[];
};

const PublicRatingPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<PublicEval | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const questions = useMemo(
    () =>
      [...(evaluation?.questions || [])].sort(
        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
      ),
    [evaluation]
  );

  useEffect(() => {
    if (!token) {
      setError('This feedback link is invalid.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getPublicRatingEvaluation(token);
        if (cancelled) return;
        setEvaluation({
          token: data.token || token,
          title: data.title,
          description: data.description,
          due_date: data.due_date,
          institution_name: data.institution_name,
          questions: Array.isArray(data.questions) ? data.questions : [],
        });
      } catch (err) {
        if (cancelled) return;
        const msg = getUserMessage(err, {
          title: 'Unavailable',
          description: 'This feedback link is invalid or closed.',
        });
        setError(msg.description || msg.title);
        setEvaluation(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !evaluation) return;

    const missing = questions.filter((q) => !String(answers[q.id] || '').trim());
    if (missing.length > 0) {
      notify.validation('Please answer every question before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await submitPublicRatingResponse({
        token,
        answers: questions.map((q) => ({
          question_id: q.id,
          value: String(answers[q.id] || '').trim(),
        })),
      });
      setSuccess(true);
    } catch (err) {
      notify.error(err, {
        context: 'PublicRatingPage - submit',
        fallback: MESSAGES.SAVE_FAILED,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <Helmet>
          <title>Feedback unavailable</title>
        </Helmet>
        <Alert className="max-w-md border-slate-800 bg-slate-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Feedback unavailable</AlertTitle>
          <AlertDescription>{error || 'This link is invalid or closed.'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <Helmet>
          <title>Thank you — {evaluation.institution_name}</title>
        </Helmet>
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-100">Thank you</h1>
          <p className="text-sm text-slate-400">
            Your anonymous feedback was submitted to {evaluation.institution_name}. You can close this
            page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Helmet>
        <title>{evaluation.title} — Feedback</title>
      </Helmet>

      <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
        <div className="mb-8 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-400/90">
            {evaluation.institution_name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight flex items-start gap-2">
            <Star className="mt-1 h-5 w-5 shrink-0 text-amber-400" />
            <span>{evaluation.title}</span>
          </h1>
          {evaluation.description ? (
            <p className="text-sm text-slate-400 leading-relaxed">{evaluation.description}</p>
          ) : (
            <p className="text-sm text-slate-400">
              Please share your honest feedback. Responses are anonymous — no name required.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const options = Array.isArray(q.options) ? q.options : [];
              const isChoice = q.type !== 'text' && options.length > 0;
              return (
                <fieldset
                  key={q.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3"
                >
                  <legend className="px-1 text-sm font-medium text-slate-100">
                    <span className="text-slate-500 mr-1">{idx + 1}.</span>
                    {q.text}
                  </legend>

                  {isChoice ? (
                    <div className="space-y-2">
                      {options.map((opt) => {
                        const selected = answers[q.id] === opt.value;
                        return (
                          <label
                            key={opt.value}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                              selected
                                ? 'border-emerald-500/40 bg-emerald-950/30 text-slate-100'
                                : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              name={`q-${q.id}`}
                              value={opt.value}
                              checked={selected}
                              onChange={() => setAnswer(q.id, opt.value)}
                            />
                            <span
                              className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                                selected
                                  ? 'border-emerald-400 bg-emerald-400'
                                  : 'border-slate-500'
                              }`}
                              aria-hidden
                            />
                            <span className={opt.tone ? likertToneClass(opt.tone).split(' ')[0] : ''}>
                              {opt.label || opt.value}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <Textarea
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      rows={3}
                      placeholder="Write your answer…"
                      maxLength={2000}
                    />
                  )}
                </fieldset>
              );
            })}
          </div>

          <Button type="submit" className="w-full" disabled={submitting || questions.length === 0}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
              </>
            ) : (
              'Submit feedback'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PublicRatingPage;
