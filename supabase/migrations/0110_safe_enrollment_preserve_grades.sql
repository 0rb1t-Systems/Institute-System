-- =============================================================================
-- 0110_safe_enrollment_preserve_grades.sql
-- Protect student exam grades during enrollment transfer / unenroll.
--
-- NEVER deletes exam_results or enrollments rows.
-- - Soft status on enrollments (active/inactive)
-- - gradebook FK: CASCADE → RESTRICT (hard delete cannot wipe finals)
-- - On class transfer: copy marks to destination class exams + align gradebook
-- - Backfill mismatched gradebook class_id
-- =============================================================================

-- 1) Soft enrollment status (UI already expects status)
alter table public.enrollments
  add column if not exists status text not null default 'active';

alter table public.enrollments
  drop constraint if exists enrollments_status_check;

alter table public.enrollments
  add constraint enrollments_status_check
  check (status in ('active', 'inactive'));

comment on column public.enrollments.status is
  'active = on roster; inactive = soft-removed. Row and linked grades are kept.';

-- 2) Stop hard-delete of enrollments from wiping gradebook finals
alter table public.gradebook_entries
  drop constraint if exists gradebook_entries_enrollment_id_fkey;

alter table public.gradebook_entries
  add constraint gradebook_entries_enrollment_id_fkey
  foreign key (enrollment_id) references public.enrollments(id)
  on delete restrict;

-- 3) Ensure a manual exam container exists for (class, course) — never duplicates
create or replace function public.ensure_manual_exam_for_class_course(
  p_institution_id uuid,
  p_class_id uuid,
  p_course_id uuid,
  p_template_exam_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
  v_title text;
  v_final numeric := 100;
  v_pass numeric := 50;
begin
  if p_class_id is null or p_course_id is null or p_institution_id is null then
    return null;
  end if;

  select id into v_exam_id
  from public.exams
  where class_id = p_class_id
    and course_id = p_course_id
    and marking_type = 'manual'
  order by created_at asc, id asc
  limit 1;

  if v_exam_id is not null then
    return v_exam_id;
  end if;

  if p_template_exam_id is not null then
    select title, final_marks, passing_score
      into v_title, v_final, v_pass
    from public.exams
    where id = p_template_exam_id;
  end if;

  if v_title is null then
    select coalesce(c.name, 'Course') || ' - Final Grade'
      into v_title
    from public.courses c
    where c.id = p_course_id;
  end if;

  v_title := coalesce(v_title, 'Final Grade');
  v_final := coalesce(nullif(v_final, 0), 100);
  v_pass := coalesce(v_pass, 50);

  insert into public.exams (
    institution_id, class_id, course_id, title, description,
    marking_type, final_marks, attendance_marks, weight,
    passing_score, open_time, close_time, is_active
  ) values (
    p_institution_id, p_class_id, p_course_id, v_title,
    'Manual course grading container',
    'manual', v_final, 0, 100,
    v_pass, now(), now() + interval '1 year', true
  )
  returning id into v_exam_id;

  return v_exam_id;
exception
  when unique_violation then
    select id into v_exam_id
    from public.exams
    where class_id = p_class_id
      and course_id = p_course_id
      and marking_type = 'manual'
    order by created_at asc, id asc
    limit 1;
    return v_exam_id;
end;
$$;

comment on function public.ensure_manual_exam_for_class_course(uuid, uuid, uuid, uuid) is
  'Returns canonical manual exam for class+course; creates one if missing. Never deletes.';

-- 4) Copy exam marks from old class → new class (INSERT only; never DELETE results)
create or replace function public.copy_exam_results_to_class(
  p_student_id uuid,
  p_from_class_id uuid,
  p_to_class_id uuid,
  p_enrollment_id uuid,
  p_institution_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_dest_exam uuid;
begin
  if p_student_id is null
     or p_from_class_id is null
     or p_to_class_id is null
     or p_from_class_id = p_to_class_id then
    return;
  end if;

  for r in
    select
      er.id as result_id,
      er.exam_id as src_exam_id,
      ex.course_id,
      er.raw_score,
      er.final_score,
      er.answers,
      er.comments,
      er.course_project,
      er.graded_by,
      er.graded_at,
      er.institution_id
    from public.exam_results er
    join public.exams ex on ex.id = er.exam_id
    where er.student_id = p_student_id
      and ex.class_id = p_from_class_id
      and ex.course_id is not null
  loop
    v_dest_exam := public.ensure_manual_exam_for_class_course(
      coalesce(r.institution_id, p_institution_id),
      p_to_class_id,
      r.course_id,
      r.src_exam_id
    );
    if v_dest_exam is null then
      continue;
    end if;

    -- Only insert when destination has no row — never overwrite / never delete source
    insert into public.exam_results (
      institution_id, exam_id, student_id, enrollment_id,
      raw_score, final_score, answers, comments, course_project,
      graded_by, graded_at
    )
    select
      coalesce(r.institution_id, p_institution_id),
      v_dest_exam,
      p_student_id,
      p_enrollment_id,
      r.raw_score,
      r.final_score,
      coalesce(r.answers, '[]'::jsonb),
      r.comments,
      r.course_project,
      r.graded_by,
      coalesce(r.graded_at, now())
    where not exists (
      select 1
      from public.exam_results existing
      where existing.exam_id = v_dest_exam
        and existing.student_id = p_student_id
    );

    -- Link destination row to this enrollment if still null
    update public.exam_results
    set enrollment_id = coalesce(enrollment_id, p_enrollment_id)
    where exam_id = v_dest_exam
      and student_id = p_student_id
      and enrollment_id is null;

    perform public.resync_gradebook_for_student_course(
      p_student_id,
      p_to_class_id,
      r.course_id,
      coalesce(r.institution_id, p_institution_id),
      p_enrollment_id
    );
  end loop;
end;
$$;

comment on function public.copy_exam_results_to_class(uuid, uuid, uuid, uuid, uuid) is
  'Copies student exam_results from one class to another. Insert-only; never deletes source marks.';

-- 5) Trigger: when enrollment.class_id changes (transfer), preserve grades
create or replace function public.trg_enrollment_class_preserve_grades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.class_id is not distinct from new.class_id then
    return new;
  end if;

  -- Align existing gradebook rows to the new class (same enrollment_id — no delete)
  update public.gradebook_entries
  set class_id = new.class_id
  where enrollment_id = new.id
    and class_id is distinct from new.class_id;

  -- Copy exam marks into destination class containers (keep source rows)
  perform public.copy_exam_results_to_class(
    new.student_id,
    old.class_id,
    new.class_id,
    new.id,
    new.institution_id
  );

  return new;
end;
$$;

drop trigger if exists trg_enrollment_class_preserve_grades on public.enrollments;
create trigger trg_enrollment_class_preserve_grades
  after update of class_id on public.enrollments
  for each row
  execute function public.trg_enrollment_class_preserve_grades();

-- 6) Safe soft-unenroll helper (preferred over DELETE)
create or replace function public.deactivate_enrollment(p_enrollment_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.enrollments;
begin
  if p_enrollment_id is null then
    raise exception 'enrollment id required';
  end if;

  update public.enrollments
  set status = 'inactive'
  where id = p_enrollment_id
    and institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'enrollment not found or not permitted';
  end if;

  return v_row;
end;
$$;

revoke all on function public.deactivate_enrollment(uuid) from public;
grant execute on function public.deactivate_enrollment(uuid) to authenticated;

-- 7) Backfill: align gradebook class_id to enrollment (no deletes)
update public.gradebook_entries ge
set class_id = en.class_id
from public.enrollments en
where ge.enrollment_id = en.id
  and ge.class_id is distinct from en.class_id;

-- 8) Backfill: copy orphaned marks where enrollment class ≠ exam class (insert-only)
do $$
declare
  r record;
begin
  for r in
    select
      er.student_id,
      ex.class_id as exam_class,
      en.class_id as enrollment_class,
      en.id as enrollment_id,
      en.institution_id
    from public.exam_results er
    join public.exams ex on ex.id = er.exam_id
    join public.enrollments en on en.id = er.enrollment_id
    where en.class_id is distinct from ex.class_id
  loop
    perform public.copy_exam_results_to_class(
      r.student_id,
      r.exam_class,
      r.enrollment_class,
      r.enrollment_id,
      r.institution_id
    );
  end loop;
end $$;
