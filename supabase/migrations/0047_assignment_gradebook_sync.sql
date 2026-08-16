-- =============================================================================
-- 0047_assignment_gradebook_sync.sql
-- Include graded assignments in gradebook weighted average (with exams).
-- Assignments: optional course_id + weight. Trigger on submission grade.
-- Also resolve null exam.course_id → class.course_id for MCQ sync.
-- =============================================================================

alter table public.assignments
  add column if not exists course_id uuid references public.courses(id) on delete set null;

alter table public.assignments
  add column if not exists weight numeric(5,2) not null default 100
    check (weight >= 0 and weight <= 100);

create index if not exists idx_assignments_course on public.assignments(course_id);

comment on column public.assignments.course_id is
  'Optional course this assignment contributes to in the gradebook. NULL → class.course_id.';
comment on column public.assignments.weight is
  'Gradebook weight (same scale as exams.weight). Only graded submissions contribute.';

-- Matches a row's course_id to the gradebook course, including NULL → class primary course.
create or replace function public.gradebook_course_matches(
  p_row_course_id uuid,
  p_class_id uuid,
  p_target_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_target_course_id is not null
    and (
      p_row_course_id = p_target_course_id
      or (
        p_row_course_id is null
        and exists (
          select 1 from public.classes c
          where c.id = p_class_id and c.course_id = p_target_course_id
        )
      )
    );
$$;

revoke all on function public.gradebook_course_matches(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.gradebook_course_matches(uuid, uuid, uuid) to service_role;

create or replace function public.resync_gradebook_for_student_course(
  p_student_id uuid,
  p_class_id uuid,
  p_course_id uuid,
  p_institution_id uuid,
  p_enrollment_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment_id uuid;
  v_total_weight numeric;
  v_weighted_sum numeric;
  v_final numeric;
begin
  if p_course_id is null then
    return;
  end if;

  v_enrollment_id := p_enrollment_id;
  if v_enrollment_id is null then
    select id into v_enrollment_id
    from public.enrollments
    where student_id = p_student_id and class_id = p_class_id
    limit 1;
  end if;
  if v_enrollment_id is null then
    return;
  end if;

  select
    coalesce(sum(c.w), 0),
    coalesce(sum(c.ws), 0)
  into v_total_weight, v_weighted_sum
  from (
    -- Exams: weight always counts; ungraded contribute 0 to numerator
    select
      ex.weight as w,
      case
        when er.id is not null and ex.final_marks > 0
          then (er.final_score / ex.final_marks) * 100 * ex.weight
        else 0
      end as ws
    from public.exams ex
    left join public.exam_results er
      on er.exam_id = ex.id and er.student_id = p_student_id
    where ex.class_id = p_class_id
      and ex.institution_id = p_institution_id
      and public.gradebook_course_matches(ex.course_id, p_class_id, p_course_id)

    union all

    -- Assignments: only graded submissions contribute weight + score
    select
      a.weight as w,
      case
        when a.total_marks > 0
          then (s.score / a.total_marks) * 100 * a.weight
        else 0
      end as ws
    from public.assignments a
    join public.assignment_submissions s
      on s.assignment_id = a.id
     and s.student_id = p_student_id
     and s.score is not null
    where a.class_id = p_class_id
      and a.institution_id = p_institution_id
      and public.gradebook_course_matches(a.course_id, p_class_id, p_course_id)
  ) c;

  if v_total_weight <= 0 then
    delete from public.gradebook_entries
    where enrollment_id = v_enrollment_id
      and course_id = p_course_id
      and source = 'auto';
    return;
  end if;

  v_final := round(v_weighted_sum / v_total_weight, 2);

  insert into public.gradebook_entries as ge (
    institution_id, enrollment_id, class_id, course_id, student_id,
    final_mark, letter_grade, source, synced_at
  ) values (
    p_institution_id, v_enrollment_id, p_class_id, p_course_id, p_student_id,
    v_final, public.letter_from_mark(v_final), 'auto', now()
  )
  on conflict (enrollment_id, course_id) do update
  set final_mark   = excluded.final_mark,
      letter_grade = excluded.letter_grade,
      source       = case when ge.source = 'manual' then ge.source else 'auto' end,
      synced_at    = now()
  where ge.source = 'auto';
end;
$$;

-- Resolve course for an exam/assignment row (explicit or class primary).
create or replace function public.resolve_gradebook_course_id(
  p_row_course_id uuid,
  p_class_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    p_row_course_id,
    (select c.course_id from public.classes c where c.id = p_class_id)
  );
$$;

revoke all on function public.resolve_gradebook_course_id(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_gradebook_course_id(uuid, uuid) to service_role;

create or replace function public.sync_gradebook_for_result(p_result_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_course uuid;
begin
  select er.student_id, er.enrollment_id, ex.class_id, ex.course_id, ex.institution_id as inst_id
    into r
  from public.exam_results er
  join public.exams ex on ex.id = er.exam_id
  where er.id = p_result_id;

  if not found then
    return;
  end if;

  v_course := public.resolve_gradebook_course_id(r.course_id, r.class_id);
  if v_course is null then
    return;
  end if;

  perform public.resync_gradebook_for_student_course(
    r.student_id, r.class_id, v_course, r.inst_id, r.enrollment_id
  );
end;
$$;

create or replace function public.sync_gradebook_for_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_course uuid;
  v_enrollment uuid;
begin
  select
    s.student_id,
    a.class_id,
    a.course_id,
    a.institution_id as inst_id
  into r
  from public.assignment_submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = p_submission_id;

  if not found then
    return;
  end if;

  v_course := public.resolve_gradebook_course_id(r.course_id, r.class_id);
  if v_course is null then
    return;
  end if;

  select e.id into v_enrollment
  from public.enrollments e
  where e.student_id = r.student_id and e.class_id = r.class_id
  limit 1;

  perform public.resync_gradebook_for_student_course(
    r.student_id, r.class_id, v_course, r.inst_id, v_enrollment
  );
end;
$$;

create or replace function public.trg_sync_gradebook_on_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_course_id uuid;
  v_inst uuid;
  v_enrollment uuid;
  v_target uuid;
begin
  if tg_op = 'DELETE' then
    select a.class_id, a.course_id, a.institution_id
      into v_class_id, v_course_id, v_inst
    from public.assignments a where a.id = old.assignment_id;

    v_target := public.resolve_gradebook_course_id(v_course_id, v_class_id);
    if v_target is not null then
      select e.id into v_enrollment
      from public.enrollments e
      where e.student_id = old.student_id and e.class_id = v_class_id
      limit 1;
      perform public.resync_gradebook_for_student_course(
        old.student_id, v_class_id, v_target, v_inst, v_enrollment
      );
    end if;
    return old;
  end if;

  -- Only resync when score is set/changed (or cleared)
  if tg_op = 'UPDATE'
     and new.score is not distinct from old.score
  then
    return new;
  end if;

  perform public.sync_gradebook_for_submission(new.id);
  return new;
end;
$$;

drop trigger if exists trg_assignment_submissions_gradebook on public.assignment_submissions;
create trigger trg_assignment_submissions_gradebook
after insert or update or delete on public.assignment_submissions
for each row execute function public.trg_sync_gradebook_on_submission();

-- When assignment weight/course changes, resync all graded students on that assignment
create or replace function public.trg_resync_gradebook_on_assignment_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_old_course uuid;
  v_new_course uuid;
begin
  if tg_op = 'UPDATE'
     and new.weight is not distinct from old.weight
     and new.course_id is not distinct from old.course_id
     and new.total_marks is not distinct from old.total_marks
     and new.class_id is not distinct from old.class_id
  then
    return new;
  end if;

  v_new_course := public.resolve_gradebook_course_id(new.course_id, new.class_id);
  v_old_course := public.resolve_gradebook_course_id(old.course_id, old.class_id);

  for r in
    select s.student_id, e.id as enrollment_id
    from public.assignment_submissions s
    left join public.enrollments e
      on e.student_id = s.student_id and e.class_id = new.class_id
    where s.assignment_id = new.id and s.score is not null
  loop
    if v_new_course is not null then
      perform public.resync_gradebook_for_student_course(
        r.student_id, new.class_id, v_new_course, new.institution_id, r.enrollment_id
      );
    end if;
    if v_old_course is not null and v_old_course is distinct from v_new_course then
      perform public.resync_gradebook_for_student_course(
        r.student_id, old.class_id, v_old_course, old.institution_id, r.enrollment_id
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_assignments_gradebook_meta on public.assignments;
create trigger trg_assignments_gradebook_meta
after update on public.assignments
for each row execute function public.trg_resync_gradebook_on_assignment_meta();

revoke all on function public.sync_gradebook_for_submission(uuid) from public, anon, authenticated;
revoke all on function public.trg_sync_gradebook_on_submission() from public, anon, authenticated;
revoke all on function public.trg_resync_gradebook_on_assignment_meta() from public, anon, authenticated;
grant execute on function public.sync_gradebook_for_submission(uuid) to service_role;
