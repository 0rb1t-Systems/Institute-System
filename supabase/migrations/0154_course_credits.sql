-- Credit hours per course (used on BRCE registration transcripts / GPA).
-- TranscriptView already reads course.credits and falls back to 3 when missing.

alter table public.courses
  add column if not exists credits numeric(4, 1) not null default 3;

comment on column public.courses.credits is
  'Credit hours for this course; shown on transcripts and used in GPA quality points.';

alter table public.courses
  drop constraint if exists courses_credits_positive;

alter table public.courses
  add constraint courses_credits_positive check (credits > 0);
