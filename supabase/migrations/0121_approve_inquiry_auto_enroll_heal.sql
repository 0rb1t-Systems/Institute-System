-- =============================================================================
-- 0121_approve_inquiry_auto_enroll_heal.sql
-- When an online registration is approved, the student becomes a regular
-- enrolled student. Registration History (registration_inquiries row) is kept.
--
-- This migration heals already-approved inquiries that have a resolvable class
-- but are missing an active enrollment.
-- =============================================================================

-- 1) Backfill class_id from preferred course/diploma when missing
with month_bound as (
  select date_trunc('month', current_date)::date as v_month
),
resolved as (
  select
    ri.id as inquiry_id,
    coalesce(
      ri.class_id,
      (
        select c.id
        from public.classes c, month_bound m
        where c.institution_id = ri.institution_id
          and c.status = 'active'
          and c.program_type = 'course'
          and c.course_id = ri.preferred_course_id
          and (c.end_month is null or date_trunc('month', c.end_month)::date >= m.v_month)
        order by c.start_month desc nulls last, c.name
        limit 1
      ),
      (
        select c.id
        from public.classes c, month_bound m
        where c.institution_id = ri.institution_id
          and c.status = 'active'
          and c.program_type = 'diploma'
          and c.diploma_id = ri.preferred_diploma_id
          and (c.end_month is null or date_trunc('month', c.end_month)::date >= m.v_month)
        order by c.start_month desc nulls last, c.name
        limit 1
      )
    ) as class_id
  from public.registration_inquiries ri
  where ri.status = 'approved'
    and ri.class_id is null
    and (ri.preferred_course_id is not null or ri.preferred_diploma_id is not null)
)
update public.registration_inquiries ri
set
  class_id = r.class_id,
  updated_at = now()
from resolved r
where ri.id = r.inquiry_id
  and r.class_id is not null
  and ri.class_id is null;

-- 2) Insert missing enrollments for approved inquiries (profile matched by email)
insert into public.enrollments (
  institution_id,
  student_id,
  class_id,
  discount_amount,
  status
)
select
  ri.institution_id,
  p.id,
  ri.class_id,
  0,
  'active'
from public.registration_inquiries ri
join public.profiles p
  on p.institution_id = ri.institution_id
 and lower(p.email) = lower(ri.email)
 and p.role = 'student'
where ri.status = 'approved'
  and ri.class_id is not null
  and not exists (
    select 1
    from public.enrollments e
    where e.student_id = p.id
      and e.class_id = ri.class_id
  );

-- 3) Reactivate soft-removed enrollments for approved inquiries
update public.enrollments e
set status = 'active'
from public.registration_inquiries ri
join public.profiles p
  on p.institution_id = ri.institution_id
 and lower(p.email) = lower(ri.email)
 and p.role = 'student'
where ri.status = 'approved'
  and ri.class_id is not null
  and e.student_id = p.id
  and e.class_id = ri.class_id
  and e.status = 'inactive';
