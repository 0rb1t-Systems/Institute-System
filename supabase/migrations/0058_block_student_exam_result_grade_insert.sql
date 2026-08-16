-- =====================================================================
--  0058_block_student_exam_result_grade_insert.sql
--  Students must not INSERT/UPDATE exam_results grades via PostgREST.
--  Manual grading = admin/staff/instructor only (MCQ submit RPC already dropped).
-- =====================================================================

drop policy if exists "er_insert" on public.exam_results;

create policy "er_insert" on public.exam_results for insert
with check (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_exam_instructor(exam_id)
  )
);

-- Defense in depth: strip grade fields if a non-grader somehow writes a row
-- (e.g. future policy regression). Staff/instructor/admin pass through.
create or replace function public.guard_exam_result_grades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public.current_user_role();

  if v_role in ('admin', 'staff', 'instructor', 'super_admin') then
    return new;
  end if;

  -- Non-graders: never allow setting scores / grader metadata
  if tg_op = 'INSERT' then
    raise exception 'FORBIDDEN_EXAM_GRADE_WRITE'
      using errcode = '42501',
            hint = 'Only admin, staff, or the exam instructor may create exam results.';
  end if;

  if new.raw_score is distinct from old.raw_score
     or new.final_score is distinct from old.final_score
     or new.answers is distinct from old.answers
     or new.comments is distinct from old.comments
     or new.graded_by is distinct from old.graded_by
     or new.graded_at is distinct from old.graded_at
  then
    raise exception 'FORBIDDEN_EXAM_GRADE_WRITE'
      using errcode = '42501',
            hint = 'Only admin, staff, or the exam instructor may update exam grades.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_exam_result_grades on public.exam_results;
create trigger trg_guard_exam_result_grades
before insert or update on public.exam_results
for each row
execute function public.guard_exam_result_grades();

revoke all on function public.guard_exam_result_grades() from public, anon, authenticated;
grant execute on function public.guard_exam_result_grades() to service_role;

comment on function public.guard_exam_result_grades() is
  'Blocks non-grader roles from writing exam_results grade columns.';
