-- Diploma course sequence for transcripts/reports ordering
alter table public.courses
  add column if not exists sort_order integer not null default 0;

comment on column public.courses.sort_order is
  'Display order within a diploma (1-based preferred). Standalone courses use 0.';

-- Backfill existing diploma-linked courses by created_at
with ranked as (
  select
    id,
    row_number() over (
      partition by diploma_id
      order by created_at asc nulls last, name asc
    ) as rn
  from public.courses
  where diploma_id is not null
)
update public.courses c
set sort_order = ranked.rn
from ranked
where c.id = ranked.id;

create index if not exists idx_courses_diploma_sort
  on public.courses (diploma_id, sort_order)
  where diploma_id is not null;

-- Batch reorder courses belonging to one diploma (admin/staff, same tenant)
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
  from public.courses c
  where c.diploma_id = p_diploma_id
    and c.institution_id = v_inst;

  if v_expected = 0 then
    raise exception 'NO_COURSES';
  end if;

  if cardinality(p_course_ids) <> v_expected then
    raise exception 'COURSE_LIST_MISMATCH';
  end if;

  -- Ensure every id belongs to this diploma + tenant and list has no duplicates
  select count(distinct c.id)::int into v_matched
  from public.courses c
  where c.id = any (p_course_ids)
    and c.diploma_id = p_diploma_id
    and c.institution_id = v_inst;

  if v_matched <> v_expected then
    raise exception 'COURSE_LIST_MISMATCH';
  end if;

  foreach v_id in array p_course_ids
  loop
    v_i := v_i + 1;
    update public.courses
    set sort_order = v_i
    where id = v_id
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
  'Sets sort_order for diploma courses from the given ordered id list.';
