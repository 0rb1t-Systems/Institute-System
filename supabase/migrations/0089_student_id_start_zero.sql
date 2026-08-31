-- Allow student IDs like HC0, HC1, HC2 (serial may start at 0; pad is not forced to 6).
-- last = -1 means none issued yet, so the first serial can be 0.

alter table public.institutions
  drop constraint if exists institutions_student_id_start_chk;
alter table public.institutions
  add constraint institutions_student_id_start_chk
  check (student_id_start >= 0 and student_id_start <= 999999999);

alter table public.institutions
  drop constraint if exists institutions_student_id_last_chk;
alter table public.institutions
  add constraint institutions_student_id_last_chk
  check (student_id_last >= -1 and student_id_last <= 999999999);

alter table public.institutions
  alter column student_id_last set default -1;

update public.institutions
set student_id_last = -1
where student_id_last = 0;

create or replace function public.format_student_code(p_prefix text, p_n integer, p_pad integer)
returns text
language sql
immutable
as $$
  select concat(
    coalesce(p_prefix, ''),
    lpad(greatest(p_n, 0)::text, greatest(coalesce(p_pad, 1), length(greatest(p_n, 0)::text)), '0')
  );
$$;

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
      exit when not exists (
        select 1
        from public.profiles p
        where p.institution_id = v_inst
          and p.student_code is not null
          and lower(p.student_code) = lower(v_label)
      );
    end loop;
    v_out := array_append(v_out, v_label);
  end loop;

  update public.institutions
  set student_id_last = v_n
  where id = v_inst;

  return v_out;
end;
$$;
