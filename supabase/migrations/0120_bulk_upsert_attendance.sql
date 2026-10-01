-- =====================================================================
--  0120_bulk_upsert_attendance.sql
--  One round-trip Mark All Present / bulk attendance upsert.
--  Avoids N client round-trips (profile + session + per-chunk upsert+select)
--  and per-row RLS helper cost on large rosters.
-- =====================================================================

create or replace function public.bulk_upsert_attendance(
  p_class_id uuid,
  p_session_date date,
  p_records jsonb,
  p_topic text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_session_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;

  if p_class_id is null or p_session_date is null then
    raise exception 'INVALID_ARGS';
  end if;

  if p_records is null
     or jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) = 0 then
    raise exception 'INVALID_RECORDS';
  end if;

  select c.institution_id
  into v_inst
  from public.classes c
  where c.id = p_class_id;

  if v_inst is null then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  if not public.is_super_admin() then
    if v_inst is distinct from public.current_institution_id() then
      raise exception 'FORBIDDEN';
    end if;
    if not (public.is_admin_or_staff() or public.is_class_instructor(p_class_id)) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  insert into public.class_sessions (institution_id, class_id, session_date, topic)
  values (v_inst, p_class_id, p_session_date, nullif(btrim(coalesce(p_topic, '')), ''))
  on conflict (class_id, session_date) do nothing;

  select s.id
  into v_session_id
  from public.class_sessions s
  where s.class_id = p_class_id
    and s.session_date = p_session_date;

  if v_session_id is null then
    raise exception 'SESSION_CREATE_FAILED';
  end if;

  insert into public.attendance as a (
    institution_id,
    session_id,
    student_id,
    status,
    notes
  )
  select
    v_inst,
    v_session_id,
    (r->>'student_id')::uuid,
    case
      when (r->>'status') in ('present', 'absent', 'late', 'excused')
        then (r->>'status')::public.attendance_status
      else 'present'::public.attendance_status
    end,
    case
      when r ? 'notes' then nullif(r->>'notes', '')
      else null
    end
  from jsonb_array_elements(p_records) as r
  where nullif(r->>'student_id', '') is not null
  on conflict (session_id, student_id) do update
  set
    status = excluded.status,
    notes = excluded.notes,
    marked_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.bulk_upsert_attendance(uuid, date, jsonb, text)
  from public, anon;
grant execute on function public.bulk_upsert_attendance(uuid, date, jsonb, text)
  to authenticated, service_role;

comment on function public.bulk_upsert_attendance(uuid, date, jsonb, text) is
  'Staff/instructor: ensure class session for date and upsert many attendance rows in one call.';
