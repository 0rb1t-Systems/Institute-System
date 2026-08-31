-- Student IDs may be 3+ characters (HC0, HC12, HC0001). Serials are unique per
-- prefix: HC1 and HC01 are the same number and cannot both exist.
-- Allocation never goes backward (taken numbers are not reused).

create or replace function public.student_code_prefix(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[0-9]+$', ''));
$$;

create or replace function public.student_code_serial(p_code text)
returns bigint
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p_code, ''), '^[A-Za-z]*', ''), '')::bigint;
$$;

create or replace function public.student_code_is_taken(p_institution_id uuid, p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_prefix text;
  v_serial bigint;
begin
  if p_institution_id is null or v_code = '' then
    return false;
  end if;
  if exists (
    select 1 from public.profiles p
    where p.institution_id = p_institution_id
      and p.student_code is not null
      and lower(p.student_code) = lower(v_code)
  ) then
    return true;
  end if;
  if v_code !~ '^[A-Za-z]*[0-9]+$' then
    return false;
  end if;
  v_prefix := public.student_code_prefix(v_code);
  v_serial := public.student_code_serial(v_code);
  return exists (
    select 1 from public.profiles p
    where p.institution_id = p_institution_id
      and p.student_code is not null
      and p.student_code ~ '^[A-Za-z]*[0-9]+$'
      and public.student_code_prefix(p.student_code) = v_prefix
      and public.student_code_serial(p.student_code) = v_serial
  );
end;
$$;

create unique index if not exists uq_profiles_institution_student_serial
  on public.profiles (
    institution_id,
    (public.student_code_prefix(student_code)),
    (public.student_code_serial(student_code))
  )
  where student_code is not null
    and student_code ~ '^[A-Za-z]*[0-9]+$';

create or replace function public.next_student_codes(p_institution_id uuid, p_count integer)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid := p_institution_id;
  v_name text;
  v_prefix text;
  v_start integer;
  v_pad integer;
  v_last integer;
  v_n integer;
  v_label text;
  v_out text[] := '{}';
  v_i integer;
  v_guard integer;
begin
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;
  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'INVALID_STUDENT_ID_COUNT';
  end if;

  select name, student_id_prefix, student_id_start, student_id_pad, student_id_last
    into v_name, v_prefix, v_start, v_pad, v_last
  from public.institutions
  where id = v_inst
  for update;

  if not found then
    raise exception 'FORBIDDEN';
  end if;

  if v_prefix is null then
    v_prefix := public.institution_name_initials(v_name);
    v_start := coalesce(v_start, 123);
    v_pad := coalesce(v_pad, 3);
  end if;

  v_start := coalesce(v_start, 0);
  v_pad := greatest(coalesce(v_pad, 1), 1);
  v_last := coalesce(v_last, -1);
  -- Continue from the last issued serial. Never go backward (no reuse).
  v_n := greatest(v_last, v_start - 1);

  for v_i in 1..p_count loop
    v_guard := 0;
    loop
      v_n := v_n + 1;
      v_guard := v_guard + 1;
      if v_n > 999999999 or v_guard > 2000 then
        raise exception 'STUDENT_ID_EXHAUSTED';
      end if;
      v_label := public.format_student_code(v_prefix, v_n, v_pad);
      exit when not public.student_code_is_taken(v_inst, v_label);
    end loop;
    v_out := array_append(v_out, v_label);
  end loop;

  update public.institutions
  set student_id_last = v_n
  where id = v_inst;

  return v_out;
end;
$$;

revoke all on function public.student_code_is_taken(uuid, text) from public, anon;
grant execute on function public.student_code_is_taken(uuid, text) to authenticated, service_role;
revoke all on function public.student_code_prefix(text) from public, anon;
grant execute on function public.student_code_prefix(text) to authenticated, service_role;
revoke all on function public.student_code_serial(text) from public, anon;
grant execute on function public.student_code_serial(text) to authenticated, service_role;
