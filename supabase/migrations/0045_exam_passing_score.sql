-- =====================================================================
--  0045_exam_passing_score.sql
--  Persist exam passing_score (%). App was showing UI field but never saving.
-- =====================================================================

alter table public.exams
  add column if not exists passing_score numeric(5,2) not null default 50
    check (passing_score >= 0 and passing_score <= 100);

comment on column public.exams.passing_score is
  'Minimum percentage (0–100) required to pass. App SSOT for pass/fail.';
