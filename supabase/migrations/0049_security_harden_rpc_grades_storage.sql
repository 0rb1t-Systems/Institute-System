-- =====================================================================
--  0049_security_harden_rpc_grades_storage.sql
--  1) Revoke anon (and PUBLIC) EXECUTE on dangerous SECURITY DEFINER helpers
--  2) Students cannot set grading columns on assignment_submissions
--  3) Make assignments storage bucket private + tenant-scoped SELECT
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) RPC grants
-- ---------------------------------------------------------------------
-- Intentional public (keep anon): get_public_*, verify_*, submit_registration_inquiry
-- RLS helpers: authenticated only (not anon)
-- Trigger / financial helpers: service_role (+ postgres) only

do $$
declare
  r record;
  -- Helpers used inside RLS policies — authenticated may EXECUTE
  rls_helpers text[] := array[
    'current_institution_id',
    'current_user_role',
    'is_admin',
    'is_admin_or_staff',
    'is_super_admin',
    'is_class_instructor',
    'is_enrolled_in_class',
    'is_enrolled_in_session',
    'is_session_instructor',
    'is_my_student',
    'owns_enrollment',
    'is_assignment_instructor',
    'is_enrolled_in_assignment',
    'is_exam_instructor',
    'is_enrolled_in_exam'
  ];
  -- Triggers / settlement internals — never callable via PostgREST
  trigger_only text[] := array[
    'guard_profile_columns',
    'check_withdrawal_balance',
    'create_settlement_on_payment',
    'create_settlement_on_payment_from_row',
    'instructor_available_balance',
    'sync_class_fixed_fee_settlement',
    'trg_classes_sync_fixed_fee_settlement',
    'trg_institutions_ensure_templates',
    'trg_require_settings_before_certificate',
    'set_institution_from_assignment',
    'set_institution_from_class',
    'set_institution_from_exam',
    'sync_gradebook_for_result',
    'sync_gradebook_for_submission',
    'resync_gradebook_for_student_course',
    'trg_sync_gradebook_on_result',
    'trg_sync_gradebook_on_submission',
    'trg_resync_gradebook_on_assignment_meta',
    'sync_settlement_on_payment_update',
    'gradebook_course_matches',
    'resolve_gradebook_course_id'
  ];
  -- Intentionally public
  public_ok text[] := array[
    'get_public_institution',
    'get_public_classes',
    'verify_credential',
    'verify_student_identity',
    'submit_registration_inquiry'
  ];
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and (
        p.proname = any (rls_helpers)
        or p.proname = any (trigger_only)
        or p.proname = any (public_ok)
      )
  loop
    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.args);

    if r.proname = any (public_ok) then
      execute format(
        'grant execute on function public.%I(%s) to anon, authenticated, service_role',
        r.proname, r.args
      );
    elsif r.proname = any (rls_helpers) then
      execute format(
        'grant execute on function public.%I(%s) to authenticated, service_role',
        r.proname, r.args
      );
    else
      -- trigger_only
      execute format(
        'revoke all on function public.%I(%s) from authenticated',
        r.proname, r.args
      );
      execute format(
        'grant execute on function public.%I(%s) to service_role',
        r.proname, r.args
      );
    end if;
  end loop;
end $$;

-- Defense in depth: revoke PostgREST access (triggers still run as owner)
revoke all on function public.sync_class_fixed_fee_settlement(uuid) from public, anon, authenticated;
grant execute on function public.sync_class_fixed_fee_settlement(uuid) to service_role;

revoke all on function public.trg_classes_sync_fixed_fee_settlement() from public, anon, authenticated;
grant execute on function public.trg_classes_sync_fixed_fee_settlement() to service_role;

-- ---------------------------------------------------------------------
-- 2) Student grade column guard
-- ---------------------------------------------------------------------
create or replace function public.guard_assignment_submission_grades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public.current_user_role();

  -- Staff / instructor / admin may set grades
  if v_role in ('admin', 'staff', 'instructor', 'super_admin') then
    return new;
  end if;

  -- Students (and any other role): strip grading fields
  if tg_op = 'INSERT' then
    new.score := null;
    new.feedback := null;
    new.graded_by := null;
    new.graded_at := null;
    return new;
  end if;

  -- UPDATE: students may change content/file_url/submitted_at only
  if new.score is distinct from old.score
     or new.feedback is distinct from old.feedback
     or new.graded_by is distinct from old.graded_by
     or new.graded_at is distinct from old.graded_at
  then
    new.score := old.score;
    new.feedback := old.feedback;
    new.graded_by := old.graded_by;
    new.graded_at := old.graded_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_assignment_submission_grades on public.assignment_submissions;
create trigger trg_guard_assignment_submission_grades
before insert or update on public.assignment_submissions
for each row
execute function public.guard_assignment_submission_grades();

revoke all on function public.guard_assignment_submission_grades() from public, anon, authenticated;
grant execute on function public.guard_assignment_submission_grades() to service_role;

-- ---------------------------------------------------------------------
-- 3) Private assignments bucket
-- ---------------------------------------------------------------------
update storage.buckets
set public = false
where id = 'assignments';

drop policy if exists "assignments_select_public" on storage.objects;
drop policy if exists "assignments_select_tenant" on storage.objects;

-- Own file, or admin/staff/instructor in same institution
create policy "assignments_select_tenant"
  on storage.objects for select
  using (
    bucket_id = 'assignments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_admin_or_staff()
      or public.current_user_role() = 'instructor'
    )
  );
