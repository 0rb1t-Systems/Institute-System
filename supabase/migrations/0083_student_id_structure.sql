-- Institution-configured sequential student IDs (e.g. brce002, DI123, or 134855).

alter table public.profiles
  add column if not exists student_code text;

alter table public.institutions
  add column if not exists student_id_prefix text,
  add column if not exists student_id_start integer not null default 123,
  add column if not exists student_id_pad integer not null default 3,
  add column if not exists student_id_last integer not null default 0;

alter table public.institutions
  drop constraint if exists institutions_student_id_start_chk;
alter table public.institutions
  add constraint institutions_student_id_start_chk
  check (student_id_start >= 1 and student_id_start <= 999999999);

alter table public.institutions
  drop constraint if exists institutions_student_id_pad_chk;
alter table public.institutions
  add constraint institutions_student_id_pad_chk
  check (student_id_pad >= 1 and student_id_pad <= 9);

alter table public.institutions
  drop constraint if exists institutions_student_id_last_chk;
alter table public.institutions
  add constraint institutions_student_id_last_chk
  check (student_id_last >= 0 and student_id_last <= 999999999);

alter table public.institutions
  drop constraint if exists institutions_student_id_prefix_chk;
alter table public.institutions
  add constraint institutions_student_id_prefix_chk
  check (student_id_prefix is null or student_id_prefix ~ '^[A-Za-z]{0,12}$');

comment on column public.profiles.student_code is 'Official student ID for the tenant (login + documents).';
comment on column public.institutions.student_id_prefix is 'Letter prefix for student IDs. Empty = numbers only. Null = not configured yet.';
comment on column public.institutions.student_id_start is 'Floor serial for the next student ID.';
comment on column public.institutions.student_id_last is 'Highest serial already allocated. Only moves forward.';

update public.profiles
set student_code = upper(split_part(email, '@', 1))
where role = 'student'
  and nullif(trim(student_code), '') is null
  and nullif(trim(split_part(email, '@', 1)), '') is not null;

update public.profiles p
set student_code = p.student_code || substr(replace(p.id::text, '-', ''), 1, 4)
where p.id in (
  select id from (
    select id,
      row_number() over (
        partition by institution_id, lower(student_code)
        order by created_at, id
      ) as rn
    from public.profiles
    where student_code is not null
  ) d
  where d.rn > 1
);

create unique index if not exists uq_profiles_institution_student_code
  on public.profiles (institution_id, lower(student_code))
  where student_code is not null;

create or replace function public.institution_name_initials(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_clean text;
  v_word text;
  v_out text := '';
  v_first text := '';
begin
  v_clean := trim(regexp_replace(coalesce(p_name, ''), '[^A-Za-z]+', ' ', 'g'));
  if v_clean = '' then
    return 'ST';
  end if;
  foreach v_word in array regexp_split_to_array(v_clean, '\s+') loop
    if v_word <> '' then
      if v_first = '' then
        v_first := v_word;
      end if;
      v_out := v_out || upper(substr(v_word, 1, 1));
    end if;
  end loop;
  if length(v_out) < 2 then
    v_out := upper(substr(v_first, 1, least(2, length(v_first))));
  end if;
  if v_out is null or v_out = '' then
    return 'ST';
  end if;
  return substr(v_out, 1, 4);
end;
$$;

create or replace function public.format_student_code(p_prefix text, p_n integer, p_pad integer)
returns text
language sql
immutable
as $$
  select concat(
    coalesce(p_prefix, ''),
    lpad(p_n::text, greatest(coalesce(p_pad, 3), length(p_n::text)), '0')
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

  v_n := greatest(coalesce(v_last, 0), coalesce(v_start, 123) - 1);

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

create or replace function public.trg_profiles_assign_student_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'student' and nullif(trim(coalesce(new.student_code, '')), '') is null then
    new.student_code := (public.next_student_codes(new.institution_id, 1))[1];
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_assign_student_code on public.profiles;
create trigger trg_profiles_assign_student_code
before insert on public.profiles
for each row execute function public.trg_profiles_assign_student_code();

create or replace function public.resolve_login_email(p_identifier text, p_subdomain text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := lower(trim(coalesce(p_identifier, '')));
  v_slug text := lower(trim(coalesce(p_subdomain, '')));
  v_email text;
begin
  if v_raw = '' or length(v_raw) > 180 then
    return null;
  end if;

  if position('@' in v_raw) > 0 then
    select p.email into v_email
    from public.profiles p
    join public.institutions i on i.id = p.institution_id
    where lower(p.email) = v_raw
      and p.status = 'approved'
      and i.status is distinct from 'suspended'
      and (v_slug = '' or lower(i.subdomain) = v_slug)
    order by p.created_at desc
    limit 1;
    return v_email;
  end if;

  select p.email into v_email
  from public.profiles p
  join public.institutions i on i.id = p.institution_id
  where p.status = 'approved'
    and i.status is distinct from 'suspended'
    and (v_slug = '' or lower(i.subdomain) = v_slug)
    and (
      (p.student_code is not null and lower(p.student_code) = v_raw)
      or lower(split_part(p.email, '@', 1)) = v_raw
    )
  order by
    case when p.student_code is not null and lower(p.student_code) = v_raw then 0 else 1 end,
    p.created_at desc
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.next_student_codes(uuid, integer) from public, anon;
grant execute on function public.next_student_codes(uuid, integer) to authenticated, service_role;

revoke all on function public.resolve_login_email(text, text) from public;
grant execute on function public.resolve_login_email(text, text) to anon, authenticated, service_role;

revoke all on function public.institution_name_initials(text) from public, anon;
grant execute on function public.institution_name_initials(text) to authenticated, service_role;

revoke all on function public.format_student_code(text, integer, integer) from public, anon;
grant execute on function public.format_student_code(text, integer, integer) to authenticated, service_role;

create or replace function public.verify_student_identity(
  p_identifier text,
  p_subdomain text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := lower(trim(coalesce(p_identifier, '')));
  v_slug text := lower(trim(coalesce(p_subdomain, '')));
  v_row record;
  v_academic_status text;
begin
  if length(v_raw) < 3 then
    return jsonb_build_object('valid', false);
  end if;

  if position('@' in v_raw) > 0 then
    return jsonb_build_object('valid', false);
  end if;
  if v_raw ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('valid', false);
  end if;

  select
    p.full_name,
    p.status,
    p.avatar_url,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    i.subdomain as institution_subdomain,
    coalesce(p.student_code, upper(split_part(p.email, '@', 1))) as student_code,
    cl.name as class_name,
    cl.status as class_status,
    cl.end_month as class_end_month,
    cl.program_type,
    coalesce(
      case
        when cl.program_type = 'diploma' then d.name
        when cl.program_type = 'course' then c.name
        else null
      end,
      cl.name
    ) as program_name,
    exists (
      select 1
      from certificates cert
      where cert.student_id = p.id
        and cert.status = 'issued'
        and (cl.id is null or cert.class_id = cl.id)
    ) as has_issued_certificate
  into v_row
  from profiles p
  join institutions i on i.id = p.institution_id
  left join lateral (
    select e.class_id
    from enrollments e
    where e.student_id = p.id
    order by e.enrolled_at desc nulls last, e.id desc
    limit 1
  ) latest_enr on true
  left join classes cl on cl.id = latest_enr.class_id
  left join courses c on c.id = cl.course_id
  left join diplomas d on d.id = cl.diploma_id
  where p.role = 'student'
    and p.status = 'approved'
    and (v_slug = '' or lower(i.subdomain) = v_slug)
    and (
      (p.student_code is not null and lower(p.student_code) = v_raw)
      or lower(split_part(p.email, '@', 1)) = v_raw
    )
  order by
    case when p.student_code is not null and lower(p.student_code) = v_raw then 0 else 1 end,
    p.created_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  if v_row.has_issued_certificate then
    v_academic_status := 'Completed';
  elsif v_row.class_end_month is not null and v_row.class_end_month::date < current_date then
    v_academic_status := 'Completed';
  elsif v_row.class_status = 'inactive' then
    v_academic_status := 'Inactive';
  elsif v_row.class_name is not null then
    v_academic_status := 'Enrolled';
  else
    v_academic_status := 'Verified';
  end if;

  return jsonb_build_object(
    'valid', true,
    'student_name', v_row.full_name,
    'student_code', v_row.student_code,
    'avatar_url', v_row.avatar_url,
    'institution_name', v_row.institution_name,
    'institution_logo_url', v_row.institution_logo_url,
    'institution_subdomain', v_row.institution_subdomain,
    'theme_primary', v_row.theme_primary,
    'theme_accent', v_row.theme_accent,
    'class_name', v_row.class_name,
    'program_name', v_row.program_name,
    'program_type', v_row.program_type,
    'academic_status', v_academic_status,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.verify_student_identity(text, text) from public;
grant execute on function public.verify_student_identity(text, text) to anon, authenticated, service_role;
