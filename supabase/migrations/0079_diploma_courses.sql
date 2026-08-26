-- Course reuse across diplomas: one course (one code) may belong to many programs.
-- Membership and per-diploma sort order live on diploma_courses.
-- courses.diploma_id is kept as a denormalized primary diploma for older readers.

create table if not exists public.diploma_courses (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  diploma_id     uuid not null references public.diplomas(id) on delete cascade,
  course_id      uuid not null references public.courses(id) on delete cascade,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (diploma_id, course_id)
);

create index if not exists idx_diploma_courses_institution on public.diploma_courses(institution_id);
create index if not exists idx_diploma_courses_diploma_sort on public.diploma_courses(diploma_id, sort_order);
create index if not exists idx_diploma_courses_course on public.diploma_courses(course_id);

comment on table public.diploma_courses is
  'Many-to-many: a course can be assigned to multiple diploma programs while keeping one course code.';

insert into public.diploma_courses (institution_id, diploma_id, course_id, sort_order)
select c.institution_id, c.diploma_id, c.id, c.sort_order
from public.courses c
where c.diploma_id is not null
on conflict (diploma_id, course_id) do nothing;

alter table public.diploma_courses enable row level security;

drop policy if exists "dc_select" on public.diploma_courses;
drop policy if exists "dc_insert" on public.diploma_courses;
drop policy if exists "dc_update" on public.diploma_courses;
drop policy if exists "dc_delete" on public.diploma_courses;

create policy "dc_select" on public.diploma_courses for select
using (institution_id = public.current_institution_id());

create policy "dc_insert" on public.diploma_courses for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

create policy "dc_update" on public.diploma_courses for update
using  (institution_id = public.current_institution_id() and public.is_admin_or_staff())
with check (institution_id = public.current_institution_id() and public.is_admin_or_staff());

create policy "dc_delete" on public.diploma_courses for delete
using (institution_id = public.current_institution_id() and public.is_admin_or_staff());

grant select, insert, update, delete on table public.diploma_courses to authenticated;
grant all on table public.diploma_courses to service_role;

-- Keep courses.diploma_id pointing at one assigned diploma (or null).
create or replace function public.sync_course_primary_diploma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course uuid;
  v_primary uuid;
begin
  v_course := coalesce(new.course_id, old.course_id);
  if v_course is null then
    return coalesce(new, old);
  end if;

  select dc.diploma_id into v_primary
  from public.diploma_courses dc
  where dc.course_id = v_course
  order by dc.sort_order asc, dc.created_at asc
  limit 1;

  update public.courses
  set diploma_id = v_primary
  where id = v_course
    and diploma_id is distinct from v_primary;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_diploma_courses_sync_primary on public.diploma_courses;
create trigger trg_diploma_courses_sync_primary
after insert or update or delete on public.diploma_courses
for each row
execute function public.sync_course_primary_diploma();

-- Reorder uses join-table sort_order (per diploma, not per course row).
create or replace function public.reorder_diploma_courses(
  p_diploma_id uuid,
  p_course_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid := public.current_institution_id();
  v_role text := public.current_user_role();
  v_id uuid;
  v_i int := 0;
  v_expected int;
  v_matched int := 0;
begin
  if v_inst is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if v_role is distinct from 'admin' and v_role is distinct from 'staff' then
    raise exception 'FORBIDDEN';
  end if;
  if p_diploma_id is null then
    raise exception 'INVALID_DIPLOMA';
  end if;
  if p_course_ids is null or cardinality(p_course_ids) = 0 then
    raise exception 'INVALID_COURSE_LIST';
  end if;

  if not exists (
    select 1 from public.diplomas d
    where d.id = p_diploma_id and d.institution_id = v_inst
  ) then
    raise exception 'DIPLOMA_NOT_FOUND';
  end if;

  select count(*)::int into v_expected
  from public.diploma_courses dc
  where dc.diploma_id = p_diploma_id
    and dc.institution_id = v_inst;

  if v_expected = 0 then
    raise exception 'NO_COURSES';
  end if;

  if cardinality(p_course_ids) <> v_expected then
    raise exception 'COURSE_LIST_MISMATCH';
  end if;

  select count(distinct dc.course_id)::int into v_matched
  from public.diploma_courses dc
  where dc.course_id = any (p_course_ids)
    and dc.diploma_id = p_diploma_id
    and dc.institution_id = v_inst;

  if v_matched <> v_expected then
    raise exception 'COURSE_LIST_MISMATCH';
  end if;

  foreach v_id in array p_course_ids
  loop
    v_i := v_i + 1;
    update public.diploma_courses
    set sort_order = v_i
    where course_id = v_id
      and diploma_id = p_diploma_id
      and institution_id = v_inst;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'diploma_id', p_diploma_id,
    'count', v_i
  );
end;
$$;

revoke all on function public.reorder_diploma_courses(uuid, uuid[]) from public;
grant execute on function public.reorder_diploma_courses(uuid, uuid[]) to authenticated, service_role;

comment on function public.reorder_diploma_courses(uuid, uuid[]) is
  'Sets diploma_courses.sort_order from the given ordered course id list.';

-- Certificate / grade completeness: diploma courses come from the join table.
create or replace function public.enrollment_required_course_ids(p_enrollment_id uuid)
returns table (course_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with enr as (
    select e.id, e.class_id, c.program_type, c.course_id as primary_course_id, c.diploma_id
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.id = p_enrollment_id
  )
  select distinct x.course_id
  from (
    select enr.primary_course_id as course_id
    from enr
    where enr.program_type = 'course'
      and enr.primary_course_id is not null

    union

    select dc.course_id
    from enr
    join public.diploma_courses dc on dc.diploma_id = enr.diploma_id
    where enr.program_type = 'diploma'
      and enr.diploma_id is not null

    union

    select co.id as course_id
    from enr
    join public.courses co on co.diploma_id = enr.diploma_id
    where enr.program_type = 'diploma'
      and enr.diploma_id is not null
      and not exists (
        select 1 from public.diploma_courses dc
        where dc.diploma_id = enr.diploma_id
      )

    union

    select cc.course_id
    from enr
    join public.class_courses cc on cc.class_id = enr.class_id
  ) x
  where x.course_id is not null
$$;
