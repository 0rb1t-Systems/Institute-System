-- =============================================================================
-- 0109_merge_duplicate_manual_exams.sql
-- Multiple "manual" exam containers were created for the same class+course
-- (race on Grade Course). Grades landed on different exams → look unsaved /
-- duplicate gradebook columns. Merge into one keeper per (class_id, course_id)
-- and prevent new duplicates with a unique index.
-- =============================================================================

-- 1) For each duplicate group, pick keeper = most results, then oldest created_at
with ranked as (
  select
    e.id,
    e.class_id,
    e.course_id,
    e.created_at,
    coalesce((select count(*)::int from public.exam_results r where r.exam_id = e.id), 0) as result_count,
    row_number() over (
      partition by e.class_id, e.course_id
      order by
        coalesce((select count(*)::int from public.exam_results r where r.exam_id = e.id), 0) desc,
        e.created_at asc,
        e.id asc
    ) as rn
  from public.exams e
  where e.marking_type = 'manual'
    and e.course_id is not null
),
keepers as (
  select id as keeper_id, class_id, course_id
  from ranked
  where rn = 1
),
dupes as (
  select r.id as dupe_id, k.keeper_id
  from ranked r
  join keepers k
    on k.class_id = r.class_id
   and k.course_id = r.course_id
  where r.rn > 1
)
-- Move results that do not already exist on the keeper
update public.exam_results er
set exam_id = d.keeper_id
from dupes d
where er.exam_id = d.dupe_id
  and not exists (
    select 1
    from public.exam_results existing
    where existing.exam_id = d.keeper_id
      and existing.student_id = er.student_id
  );

-- 2) Drop leftover results on dupes (student already has a row on keeper)
with ranked as (
  select
    e.id,
    e.class_id,
    e.course_id,
    row_number() over (
      partition by e.class_id, e.course_id
      order by
        coalesce((select count(*)::int from public.exam_results r where r.exam_id = e.id), 0) desc,
        e.created_at asc,
        e.id asc
    ) as rn
  from public.exams e
  where e.marking_type = 'manual'
    and e.course_id is not null
),
dupes as (
  select id as dupe_id
  from ranked
  where rn > 1
)
delete from public.exam_results er
using dupes d
where er.exam_id = d.dupe_id;

-- 3) Delete duplicate exam shells
with ranked as (
  select
    e.id,
    row_number() over (
      partition by e.class_id, e.course_id
      order by
        coalesce((select count(*)::int from public.exam_results r where r.exam_id = e.id), 0) desc,
        e.created_at asc,
        e.id asc
    ) as rn
  from public.exams e
  where e.marking_type = 'manual'
    and e.course_id is not null
)
delete from public.exams e
using ranked r
where e.id = r.id
  and r.rn > 1;

-- 4) Prevent future duplicates for manual course grading containers
create unique index if not exists uniq_exams_manual_class_course
  on public.exams (class_id, course_id)
  where marking_type = 'manual' and course_id is not null;
