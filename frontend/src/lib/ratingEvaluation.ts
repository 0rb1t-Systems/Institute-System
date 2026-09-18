/** Shared defaults for course / instructor Rating Evaluations. */

export const LIKERT_OPTIONS = [
  { label: 'Strongly Agree', value: 'strongly_agree', tone: 'positive' },
  { label: 'Agree', value: 'agree', tone: 'positive' },
  { label: 'Neutral', value: 'neutral', tone: 'neutral' },
  { label: 'Disagree', value: 'disagree', tone: 'negative' },
  { label: 'Strongly Disagree', value: 'strongly_disagree', tone: 'negative' },
] as const;

export const STARTER_RATING_QUESTIONS = [
  'The instructor explained the course topics clearly.',
  'The course content was well organized and easy to understand.',
  'The instructor provided enough practical examples and exercises.',
  'I gained useful knowledge and skills from this course.',
  'I would recommend this course to other students.',
] as const;

export type RatingQuestionDraft = {
  /** Client-only key while editing before save */
  key: string;
  text: string;
  type: 'likert' | 'mcq' | 'text';
  options: { label: string; value: string; tone?: string }[];
};

export function makeLikertQuestion(text: string, key?: string): RatingQuestionDraft {
  return {
    key: key || `q-${Math.random().toString(36).slice(2, 10)}`,
    text,
    type: 'likert',
    options: LIKERT_OPTIONS.map((o) => ({ ...o })),
  };
}

export function makeStarterQuestions(): RatingQuestionDraft[] {
  return STARTER_RATING_QUESTIONS.map((text, i) => makeLikertQuestion(text, `starter-${i}`));
}

/** Parse bulk paste: one question per non-empty line; strip leading numbers. */
export function parseBulkQuestions(raw: string): RatingQuestionDraft[] {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.)\-:\]]\s*/, '').trim())
    .filter(Boolean)
    .map((text) => makeLikertQuestion(text));
}

export function likertToneClass(tone?: string) {
  if (tone === 'positive') {
    return 'text-emerald-700 border-emerald-200 bg-emerald-50';
  }
  if (tone === 'negative') {
    return 'text-rose-700 border-rose-200 bg-rose-50';
  }
  return 'text-[var(--ds-text-secondary,#5B6B61)] border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)]';
}
