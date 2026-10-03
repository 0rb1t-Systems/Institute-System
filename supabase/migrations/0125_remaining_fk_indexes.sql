-- =============================================================================
-- 0125_remaining_fk_indexes.sql
-- Cover remaining advisor FK gaps that touch frequent admin/online paths.
-- Safe: CREATE INDEX IF NOT EXISTS only.
-- =============================================================================

create index if not exists registration_inquiries_class_id_idx
  on public.registration_inquiries (class_id);

create index if not exists registration_inquiries_affiliate_id_idx
  on public.registration_inquiries (affiliate_id);

create index if not exists registration_inquiries_preferred_course_id_idx
  on public.registration_inquiries (preferred_course_id);

create index if not exists registration_inquiries_preferred_diploma_id_idx
  on public.registration_inquiries (preferred_diploma_id);

create index if not exists class_courses_course_id_idx
  on public.class_courses (course_id);

create index if not exists assignments_created_by_idx
  on public.assignments (created_by);

create index if not exists exams_created_by_idx
  on public.exams (created_by);

create index if not exists affiliate_settlements_class_id_idx
  on public.affiliate_settlements (class_id);

create index if not exists affiliate_settlements_student_id_idx
  on public.affiliate_settlements (student_id);

create index if not exists rating_evaluations_course_id_idx
  on public.rating_evaluations (course_id);

create index if not exists rating_evaluations_created_by_idx
  on public.rating_evaluations (created_by);

create index if not exists withdrawals_processed_by_idx
  on public.withdrawals (processed_by);

create index if not exists registration_program_scopes_affiliate_id_idx
  on public.registration_program_scopes (affiliate_id);
