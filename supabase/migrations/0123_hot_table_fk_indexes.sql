-- =============================================================================
-- 0123_hot_table_fk_indexes.sql
-- Add covering indexes for unindexed FKs on hot academic / finance tables.
-- Safe: CREATE INDEX IF NOT EXISTS only — no data or policy changes.
-- =============================================================================

create index if not exists exam_results_enrollment_id_idx
  on public.exam_results (enrollment_id);

create index if not exists exam_results_graded_by_idx
  on public.exam_results (graded_by);

create index if not exists certificates_class_id_idx
  on public.certificates (class_id);

create index if not exists certificates_issued_by_idx
  on public.certificates (issued_by);

create index if not exists transcripts_class_id_idx
  on public.transcripts (class_id);

create index if not exists transcripts_issued_by_idx
  on public.transcripts (issued_by);

create index if not exists transcript_entries_exam_id_idx
  on public.transcript_entries (exam_id);

create index if not exists transcript_entries_institution_id_idx
  on public.transcript_entries (institution_id);

create index if not exists classes_course_id_idx
  on public.classes (course_id);

create index if not exists classes_diploma_id_idx
  on public.classes (diploma_id);

create index if not exists payments_recorded_by_idx
  on public.payments (recorded_by);

create index if not exists assignment_submissions_graded_by_idx
  on public.assignment_submissions (graded_by);

create index if not exists gradebook_entries_course_id_idx
  on public.gradebook_entries (course_id);

create index if not exists transcript_entries_course_id_idx
  on public.transcript_entries (course_id);
