-- =============================================================================
-- 0071_assignment_counts_toward_grade.sql
-- Split assignments into:
--   1) Gradebook (counts_toward_grade = true): bonus points on exam / gradebook
--   2) Practice / non-gradebook (false): graded for feedback only, no GPA impact
-- =============================================================================

alter table public.assignments
  add column if not exists counts_toward_grade boolean not null default true;

comment on column public.assignments.counts_toward_grade is
  'When true, graded scores are bonus points added to the course exam / gradebook. When false, assignment is practice-only and does not affect grade.';

create index if not exists idx_assignments_counts_toward_grade
  on public.assignments (class_id, counts_toward_grade)
  where counts_toward_grade = true;

-- Gradebook sync: only include gradebook assignments in bonus sum
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
  v_exam_score numeric := 0;
  v_exam_max numeric := 0;
  v_bonus numeric := 0;
  v_combined numeric;
  v_final numeric;
  v_has_exam boolean := false;
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
    coalesce(sum(er.final_score), 0),
    coalesce(sum(ex.final_marks), 0),
    count(*) > 0
  into v_exam_score, v_exam_max, v_has_exam
  from public.exams ex
  join public.exam_results er
    on er.exam_id = ex.id and er.student_id = p_student_id
  where ex.class_id = p_class_id
    and ex.institution_id = p_institution_id
    and public.gradebook_course_matches(ex.course_id, p_class_id, p_course_id);

  select coalesce(sum(s.score), 0)
  into v_bonus
  from public.assignments a
  join public.assignment_submissions s
    on s.assignment_id = a.id
   and s.student_id = p_student_id
   and s.score is not null
  where a.class_id = p_class_id
    and a.institution_id = p_institution_id
    and coalesce(a.counts_toward_grade, true) = true
    and public.gradebook_course_matches(a.course_id, p_class_id, p_course_id);

  if v_has_exam and v_exam_max > 0 then
    v_combined := least(v_exam_max, v_exam_score + v_bonus);
    v_final := round((v_combined / v_exam_max) * 100, 2);
  elsif v_bonus > 0 then
    select
      case
        when coalesce(sum(a.total_marks), 0) > 0
          then round((coalesce(sum(s.score), 0) / sum(a.total_marks)) * 100, 2)
        else null
      end
    into v_final
    from public.assignments a
    join public.assignment_submissions s
      on s.assignment_id = a.id
     and s.student_id = p_student_id
     and s.score is not null
    where a.class_id = p_class_id
      and a.institution_id = p_institution_id
      and coalesce(a.counts_toward_grade, true) = true
      and public.gradebook_course_matches(a.course_id, p_class_id, p_course_id);
  else
    delete from public.gradebook_entries
    where enrollment_id = v_enrollment_id
      and course_id = p_course_id
      and source = 'auto';
    return;
  end if;

  if v_final is null then
    delete from public.gradebook_entries
    where enrollment_id = v_enrollment_id
      and course_id = p_course_id
      and source = 'auto';
    return;
  end if;

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

-- Cap only applies to gradebook assignments; practice assignments skip room check
create or replace function public.trg_enforce_assignment_bonus_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.assignments%rowtype;
  v_course uuid;
  v_exam_score numeric := 0;
  v_exam_max numeric := 0;
  v_other_bonus numeric := 0;
  v_room numeric;
begin
  if new.score is null then
    return new;
  end if;

  if new.score < 0 then
    raise exception 'Assignment score cannot be negative';
  end if;

  select * into v_assignment from public.assignments where id = new.assignment_id;
  if not found then
    return new;
  end if;

  if new.score > v_assignment.total_marks then
    raise exception 'Assignment score (%) exceeds max marks (%)', new.score, v_assignment.total_marks;
  end if;

  -- Practice / non-gradebook: no exam bonus room enforcement
  if coalesce(v_assignment.counts_toward_grade, true) = false then
    return new;
  end if;

  v_course := public.resolve_gradebook_course_id(v_assignment.course_id, v_assignment.class_id);
  if v_course is null then
    return new;
  end if;

  select
    coalesce(sum(er.final_score), 0),
    coalesce(sum(ex.final_marks), 0)
  into v_exam_score, v_exam_max
  from public.exams ex
  join public.exam_results er
    on er.exam_id = ex.id and er.student_id = new.student_id
  where ex.class_id = v_assignment.class_id
    and ex.institution_id = v_assignment.institution_id
    and public.gradebook_course_matches(ex.course_id, v_assignment.class_id, v_course);

  if v_exam_max <= 0 then
    return new;
  end if;

  select coalesce(sum(s.score), 0)
  into v_other_bonus
  from public.assignments a
  join public.assignment_submissions s
    on s.assignment_id = a.id
   and s.student_id = new.student_id
   and s.score is not null
   and s.id is distinct from new.id
  where a.class_id = v_assignment.class_id
    and a.institution_id = v_assignment.institution_id
    and a.id is distinct from v_assignment.id
    and coalesce(a.counts_toward_grade, true) = true
    and public.gradebook_course_matches(a.course_id, v_assignment.class_id, v_course);

  v_room := greatest(0, v_exam_max - v_exam_score - v_other_bonus);
  if new.score > v_room then
    raise exception
      'Assignment bonus (%) would exceed exam total. Exam %/%, other bonuses %, room left %.',
      new.score, v_exam_score, v_exam_max, v_other_bonus, v_room;
  end if;

  return new;
end;
$$;

-- When counts_toward_grade / course / marks change, resync graded students
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
     and new.counts_toward_grade is not distinct from old.counts_toward_grade
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

comment on function public.resync_gradebook_for_student_course(uuid, uuid, uuid, uuid, uuid) is
  'Final = min(exam_max, exam_score + gradebook-assignment bonuses) as % of graded-exam max only.';
