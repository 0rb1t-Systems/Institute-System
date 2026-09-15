-- =============================================================================
-- 0105_restore_grades_safe_gradebook_sync.sql
-- Safe recovery: restore missing enrollments from exam_results, backfill
-- transcript class_id (without breaking uq_transcripts_enrollment_issued),
-- stop wiping auto gradebook when sync finds no match, fix DELETE sync to
-- resolve null course_id, then rebuild gradebook from existing marks.
-- Does NOT delete or overwrite exam_results scores.
-- =============================================================================

-- 1) Restore enrollments for students who have exam marks but lost class enrollment
insert into public.enrollments (institution_id, student_id, class_id)
select distinct e.institution_id, er.student_id, e.class_id
from public.exam_results er
join public.exams e on e.id = er.exam_id
where e.class_id is not null
  and er.student_id is not null
  and not exists (
    select 1
    from public.enrollments en
    where en.student_id = er.student_id
      and en.class_id = e.class_id
  )
on conflict (student_id, class_id) do nothing;

update public.exam_results er
set enrollment_id = en.id
from public.exams e, public.enrollments en
where er.exam_id = e.id
  and en.student_id = er.student_id
  and en.class_id = e.class_id
  and er.enrollment_id is null;

-- 2) Backfill transcript class_id (enrollment_id only when unique/safe)
with ranked as (
  select
    t.id as transcript_id,
    e.id as enrollment_id,
    e.class_id,
    count(ge.id) as overlap,
    row_number() over (
      partition by t.id
      order by count(ge.id) desc, e.enrolled_at desc nulls last
    ) as rn
  from public.transcripts t
  join public.enrollments e on e.student_id = t.student_id
  left join public.transcript_entries te on te.transcript_id = t.id
  left join public.gradebook_entries ge
    on ge.enrollment_id = e.id
   and ge.course_id = te.course_id
  where t.class_id is null
    and t.status = 'issued'
  group by t.id, e.id, e.class_id, e.enrolled_at
)
update public.transcripts t
set class_id = r.class_id
from ranked r
where t.id = r.transcript_id
  and r.rn = 1
  and r.class_id is not null;

update public.transcripts t
set class_id = e.class_id
from public.enrollments e
where t.enrollment_id = e.id
  and t.class_id is null;

update public.transcripts t
set enrollment_id = e.id
from public.enrollments e
where t.class_id = e.class_id
  and t.student_id = e.student_id
  and t.enrollment_id is null
  and t.status = 'issued'
  and not exists (
    select 1 from public.transcripts t2
    where t2.enrollment_id = e.id
      and t2.status = 'issued'
      and t2.id <> t.id
  );

-- 3) Safe gradebook sync: never DELETE auto rows when no matching exams/bonus.
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
    -- Keep existing auto gradebook row (do not wipe recorded finals).
    return;
  end if;

  if v_final is null then
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

comment on function public.resync_gradebook_for_student_course(uuid, uuid, uuid, uuid, uuid) is
  'Rebuild auto gradebook final from exams + assignment bonus. Never deletes existing auto rows when marks are temporarily unmatched.';

-- 4) DELETE path must resolve null exam.course_id like INSERT path
create or replace function public.trg_sync_gradebook_on_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_course_id uuid;
  v_inst uuid;
begin
  if tg_op = 'DELETE' then
    select class_id, course_id, institution_id
      into v_class_id, v_course_id, v_inst
    from public.exams where id = old.exam_id;
    v_course_id := public.resolve_gradebook_course_id(v_course_id, v_class_id);
    if v_course_id is not null then
      perform public.resync_gradebook_for_student_course(
        old.student_id, v_class_id, v_course_id, v_inst, old.enrollment_id
      );
    end if;
    return old;
  end if;

  perform public.sync_gradebook_for_result(new.id);
  return new;
end;
$$;

-- 5) Rebuild gradebook from every existing exam result (no re-grading needed)
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select distinct
      er.student_id,
      er.enrollment_id,
      ex.class_id,
      public.resolve_gradebook_course_id(ex.course_id, ex.class_id) as course_id,
      ex.institution_id
    from public.exam_results er
    join public.exams ex on ex.id = er.exam_id
    where er.final_score is not null or er.raw_score is not null
  loop
    if r.course_id is null or r.class_id is null then
      continue;
    end if;
    perform public.resync_gradebook_for_student_course(
      r.student_id, r.class_id, r.course_id, r.institution_id, r.enrollment_id
    );
    n := n + 1;
  end loop;
  raise notice 'gradebook resync pairs processed: %', n;
end;
$$;
