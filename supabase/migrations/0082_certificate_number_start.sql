-- Sequential certificate numbers per institution.
-- Admins set a start (e.g. 0001). Issued numbers never go backwards or repeat.

alter table public.institutions
  add column if not exists certificate_number_start integer not null default 1,
  add column if not exists certificate_number_pad integer not null default 4,
  add column if not exists certificate_number_last integer not null default 0;

alter table public.institutions
  drop constraint if exists institutions_certificate_number_start_chk;
alter table public.institutions
  add constraint institutions_certificate_number_start_chk
  check (certificate_number_start >= 1 and certificate_number_start <= 999999999);

alter table public.institutions
  drop constraint if exists institutions_certificate_number_pad_chk;
alter table public.institutions
  add constraint institutions_certificate_number_pad_chk
  check (certificate_number_pad >= 1 and certificate_number_pad <= 9);

alter table public.institutions
  drop constraint if exists institutions_certificate_number_last_chk;
alter table public.institutions
  add constraint institutions_certificate_number_last_chk
  check (certificate_number_last >= 0 and certificate_number_last <= 999999999);

comment on column public.institutions.certificate_number_start is
  'Floor for the next issued certificate serial (e.g. 1 displays as 0001).';
comment on column public.institutions.certificate_number_pad is
  'Zero-pad width for certificate serials.';
comment on column public.institutions.certificate_number_last is
  'Highest serial already allocated. Only moves forward.';

update public.institutions i
set certificate_number_last = greatest(
  i.certificate_number_last,
  coalesce((
    select max(substring(c.certificate_number from '(\d+)$')::bigint)::integer
    from public.certificates c
    where c.institution_id = i.id
      and c.certificate_number ~ '\d+$'
      and substring(c.certificate_number from '(\d+)$')::bigint <= 999999999
  ), 0)
);

create or replace function public.format_certificate_serial(p_n integer, p_pad integer)
returns text
language sql
immutable
as $$
  select lpad(
    p_n::text,
    greatest(coalesce(p_pad, 4), length(p_n::text)),
    '0'
  );
$$;

create or replace function public.allocate_certificate_numbers(p_count integer)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_start integer;
  v_pad integer;
  v_last integer;
  v_n integer;
  v_label text;
  v_out text[] := '{}';
  v_i integer;
  v_guard integer;
begin
  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'INVALID_CERTIFICATE_COUNT';
  end if;

  if not public.is_admin_or_staff() then
    raise exception 'FORBIDDEN';
  end if;

  v_inst := public.current_institution_id();
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  select certificate_number_start, certificate_number_pad, certificate_number_last
    into v_start, v_pad, v_last
  from public.institutions
  where id = v_inst
  for update;

  if not found then
    raise exception 'FORBIDDEN';
  end if;

  v_n := greatest(coalesce(v_last, 0), coalesce(v_start, 1) - 1);

  for v_i in 1..p_count loop
    v_guard := 0;
    loop
      v_n := v_n + 1;
      v_guard := v_guard + 1;
      if v_n > 999999999 or v_guard > 2000 then
        raise exception 'CERTIFICATE_NUMBER_EXHAUSTED';
      end if;
      v_label := public.format_certificate_serial(v_n, v_pad);
      exit when not exists (
        select 1
        from public.certificates c
        where c.institution_id = v_inst
          and (
            c.certificate_number = v_label
            or (
              c.certificate_number ~ '\d+$'
              and substring(c.certificate_number from '(\d+)$')::bigint = v_n
            )
          )
      );
    end loop;
    v_out := array_append(v_out, v_label);
  end loop;

  update public.institutions
  set certificate_number_last = v_n
  where id = v_inst;

  return v_out;
end;
$$;

revoke all on function public.allocate_certificate_numbers(integer) from public, anon;
grant execute on function public.allocate_certificate_numbers(integer) to authenticated, service_role;

revoke all on function public.format_certificate_serial(integer, integer) from public, anon;
grant execute on function public.format_certificate_serial(integer, integer) to authenticated, service_role;
