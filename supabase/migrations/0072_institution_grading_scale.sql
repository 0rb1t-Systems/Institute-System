-- =============================================================================
-- 0072_institution_grading_scale.sql
-- Per-institution configurable grading scale (Key to Grades).
-- Null / missing → default A–F / 4.0 scale (90/80/70/60).
-- =============================================================================

alter table public.institutions
  add column if not exists grading_scale jsonb default null;

comment on column public.institutions.grading_scale is
  'Custom Key-to-Grades JSON: { version, source, pass_mark, scale_max, bands[], classifications[], source_file_url }. Null = use platform default.';

-- Default letter grade (unchanged behavior for callers that only pass mark)
create or replace function public.letter_from_mark(m numeric)
returns text
language sql
immutable
as $$
  select case
    when m is null then null
    when m >= 90 then 'A'
    when m >= 80 then 'B'
    when m >= 70 then 'C'
    when m >= 60 then 'D'
    else 'F'
  end
$$;

-- Institution-aware letter grade from grading_scale.bands (highest min wins)
create or replace function public.letter_from_mark_for_institution(
  m numeric,
  p_institution_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scale jsonb;
  v_band jsonb;
  v_letter text;
  v_min numeric;
  v_best_min numeric := -1;
begin
  if m is null then
    return null;
  end if;

  if p_institution_id is not null then
    select grading_scale into v_scale
    from public.institutions
    where id = p_institution_id;
  end if;

  if v_scale is not null
     and jsonb_typeof(v_scale->'bands') = 'array'
     and jsonb_array_length(v_scale->'bands') > 0 then
    v_letter := null;
    v_best_min := -1;
    for v_band in
      select value from jsonb_array_elements(v_scale->'bands')
    loop
      v_min := nullif((v_band->>'min'), '')::numeric;
      if v_min is null then
        continue;
      end if;
      if m >= v_min and v_min > v_best_min then
        v_best_min := v_min;
        v_letter := nullif(trim(v_band->>'letter'), '');
      end if;
    end loop;

    if v_letter is not null then
      return v_letter;
    end if;
  end if;

  return public.letter_from_mark(m);
end;
$$;

revoke all on function public.letter_from_mark_for_institution(numeric, uuid)
  from public, anon;
grant execute on function public.letter_from_mark_for_institution(numeric, uuid)
  to authenticated, service_role;

-- Gradebook sync uses institution scale for letter_grade
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
    v_final, public.letter_from_mark_for_institution(v_final, p_institution_id), 'auto', now()
  )
  on conflict (enrollment_id, course_id) do update
  set final_mark   = excluded.final_mark,
      letter_grade = excluded.letter_grade,
      source       = case when ge.source = 'manual' then ge.source else 'auto' end,
      synced_at    = now()
  where ge.source = 'auto';
end;
$$;

-- Recompute all auto gradebook letters for an institution after scale change
create or replace function public.resync_institution_grade_letters(p_institution_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_inst uuid;
  r record;
  n integer := 0;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select role, institution_id into v_role, v_inst
  from public.profiles
  where id = v_uid;

  if v_role is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if v_role = 'super_admin' then
    null;
  elsif v_role = 'admin' and v_inst = p_institution_id then
    null;
  else
    raise exception 'FORBIDDEN';
  end if;

  for r in
    select student_id, class_id, course_id, enrollment_id, institution_id
    from public.gradebook_entries
    where institution_id = p_institution_id
      and source = 'auto'
  loop
    perform public.resync_gradebook_for_student_course(
      r.student_id, r.class_id, r.course_id, r.institution_id, r.enrollment_id
    );
    n := n + 1;
  end loop;

  return n;
end;
$$;

revoke all on function public.resync_institution_grade_letters(uuid)
  from public, anon;
grant execute on function public.resync_institution_grade_letters(uuid)
  to authenticated, service_role;
