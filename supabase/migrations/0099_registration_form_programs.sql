-- Admin/staff choose which courses & diplomas appear in the public
-- Online Registration / Affiliate referral "Preferred Class" dropdown.
-- affiliate_id NULL = general Online Registration link;
-- affiliate_id set = that affiliate's referral link.
-- is_restricted = false (or no scope): all active classes (legacy).
-- is_restricted = true: only classes for checked programs.

create table if not exists public.registration_program_scopes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  affiliate_id uuid references public.profiles(id) on delete cascade,
  is_restricted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists registration_program_scopes_general_uq
  on public.registration_program_scopes (institution_id)
  where affiliate_id is null;

create unique index if not exists registration_program_scopes_affiliate_uq
  on public.registration_program_scopes (institution_id, affiliate_id)
  where affiliate_id is not null;

create index if not exists idx_registration_program_scopes_inst
  on public.registration_program_scopes (institution_id);

comment on table public.registration_program_scopes is
  'Per Online Registration / Affiliate referral link: whether Preferred Class is limited to selected programs.';

create table if not exists public.registration_allowed_programs (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.registration_program_scopes(id) on delete cascade,
  program_type text not null check (program_type in ('course', 'diploma')),
  program_id uuid not null,
  created_at timestamptz not null default now(),
  unique (scope_id, program_type, program_id)
);

create index if not exists idx_registration_allowed_programs_scope
  on public.registration_allowed_programs (scope_id);

comment on table public.registration_allowed_programs is
  'Checked courses/diplomas for a registration form scope; matching classes appear in the public dropdown.';

alter table public.registration_program_scopes enable row level security;
alter table public.registration_allowed_programs enable row level security;

drop policy if exists "rps_select" on public.registration_program_scopes;
drop policy if exists "rps_insert" on public.registration_program_scopes;
drop policy if exists "rps_update" on public.registration_program_scopes;
drop policy if exists "rps_delete" on public.registration_program_scopes;

create policy "rps_select" on public.registration_program_scopes for select
using (institution_id = public.current_institution_id() and public.is_admin_or_staff());

create policy "rps_insert" on public.registration_program_scopes for insert
with check (institution_id = public.current_institution_id() and public.is_admin_or_staff());

create policy "rps_update" on public.registration_program_scopes for update
using (institution_id = public.current_institution_id() and public.is_admin_or_staff())
with check (institution_id = public.current_institution_id() and public.is_admin_or_staff());

create policy "rps_delete" on public.registration_program_scopes for delete
using (institution_id = public.current_institution_id() and public.is_admin_or_staff());

drop policy if exists "rap_select" on public.registration_allowed_programs;
drop policy if exists "rap_insert" on public.registration_allowed_programs;
drop policy if exists "rap_update" on public.registration_allowed_programs;
drop policy if exists "rap_delete" on public.registration_allowed_programs;

create policy "rap_select" on public.registration_allowed_programs for select
using (
  exists (
    select 1 from public.registration_program_scopes s
    where s.id = scope_id
      and s.institution_id = public.current_institution_id()
      and public.is_admin_or_staff()
  )
);

create policy "rap_insert" on public.registration_allowed_programs for insert
with check (
  exists (
    select 1 from public.registration_program_scopes s
    where s.id = scope_id
      and s.institution_id = public.current_institution_id()
      and public.is_admin_or_staff()
  )
);

create policy "rap_update" on public.registration_allowed_programs for update
using (
  exists (
    select 1 from public.registration_program_scopes s
    where s.id = scope_id
      and s.institution_id = public.current_institution_id()
      and public.is_admin_or_staff()
  )
)
with check (
  exists (
    select 1 from public.registration_program_scopes s
    where s.id = scope_id
      and s.institution_id = public.current_institution_id()
      and public.is_admin_or_staff()
  )
);

create policy "rap_delete" on public.registration_allowed_programs for delete
using (
  exists (
    select 1 from public.registration_program_scopes s
    where s.id = scope_id
      and s.institution_id = public.current_institution_id()
      and public.is_admin_or_staff()
  )
);

grant select, insert, update, delete on table public.registration_program_scopes to authenticated;
grant select, insert, update, delete on table public.registration_allowed_programs to authenticated;
grant all on table public.registration_program_scopes to service_role;
grant all on table public.registration_allowed_programs to service_role;

-- Returns { "restricted": bool, "programs": [ {program_type, program_id}, ... ] }
-- Affiliate scope wins when restricted; else general Online Registration scope; else unrestricted.
create or replace function public.registration_program_restriction(
  p_institution_id uuid,
  p_affiliate_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_scope_id uuid;
  v_restricted boolean;
  v_programs jsonb;
begin
  if p_affiliate_id is not null then
    select s.id, s.is_restricted
      into v_scope_id, v_restricted
    from public.registration_program_scopes s
    where s.institution_id = p_institution_id
      and s.affiliate_id = p_affiliate_id
    limit 1;

    if v_scope_id is not null and coalesce(v_restricted, false) then
      select coalesce(jsonb_agg(jsonb_build_object(
        'program_type', p.program_type,
        'program_id', p.program_id
      )), '[]'::jsonb)
      into v_programs
      from public.registration_allowed_programs p
      where p.scope_id = v_scope_id;

      return jsonb_build_object('restricted', true, 'programs', v_programs);
    end if;
  end if;

  select s.id, s.is_restricted
    into v_scope_id, v_restricted
  from public.registration_program_scopes s
  where s.institution_id = p_institution_id
    and s.affiliate_id is null
  limit 1;

  if v_scope_id is not null and coalesce(v_restricted, false) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'program_type', p.program_type,
      'program_id', p.program_id
    )), '[]'::jsonb)
    into v_programs
    from public.registration_allowed_programs p
    where p.scope_id = v_scope_id;

    return jsonb_build_object('restricted', true, 'programs', v_programs);
  end if;

  return jsonb_build_object('restricted', false, 'programs', '[]'::jsonb);
end;
$$;

revoke all on function public.registration_program_restriction(uuid, uuid) from public;
grant execute on function public.registration_program_restriction(uuid, uuid) to anon, authenticated, service_role;

create or replace function public.class_matches_registration_programs(
  p_class public.classes,
  p_programs jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_programs, '[]'::jsonb)) item
    where (
      item->>'program_type' = 'course'
      and p_class.program_type = 'course'
      and p_class.course_id = (item->>'program_id')::uuid
    ) or (
      item->>'program_type' = 'diploma'
      and p_class.program_type = 'diploma'
      and p_class.diploma_id = (item->>'program_id')::uuid
    )
  );
$$;

revoke all on function public.class_matches_registration_programs(public.classes, jsonb) from public;
grant execute on function public.class_matches_registration_programs(public.classes, jsonb) to anon, authenticated, service_role;

create or replace function public.get_registration_form_programs(
  p_affiliate_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid := public.current_institution_id();
  v_scope public.registration_program_scopes%rowtype;
  v_programs jsonb;
begin
  if v_inst is null or not public.is_admin_or_staff() then
    raise exception 'FORBIDDEN';
  end if;

  if p_affiliate_id is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_affiliate_id
        and p.institution_id = v_inst
        and p.role = 'affiliate'
    ) then
      raise exception 'INVALID_AFFILIATE';
    end if;

    select * into v_scope
    from public.registration_program_scopes
    where institution_id = v_inst and affiliate_id = p_affiliate_id
    limit 1;
  else
    select * into v_scope
    from public.registration_program_scopes
    where institution_id = v_inst and affiliate_id is null
    limit 1;
  end if;

  if not found then
    return jsonb_build_object(
      'is_restricted', false,
      'programs', '[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'program_type', p.program_type,
    'program_id', p.program_id
  ) order by p.program_type, p.program_id), '[]'::jsonb)
  into v_programs
  from public.registration_allowed_programs p
  where p.scope_id = v_scope.id;

  return jsonb_build_object(
    'is_restricted', v_scope.is_restricted,
    'programs', v_programs
  );
end;
$$;

revoke all on function public.get_registration_form_programs(uuid) from public;
grant execute on function public.get_registration_form_programs(uuid) to authenticated, service_role;

create or replace function public.set_registration_form_programs(
  p_is_restricted boolean,
  p_programs jsonb default '[]'::jsonb,
  p_affiliate_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid := public.current_institution_id();
  v_scope_id uuid;
  v_item jsonb;
  v_type text;
  v_pid uuid;
begin
  if v_inst is null or not public.is_admin_or_staff() then
    raise exception 'FORBIDDEN';
  end if;

  if p_affiliate_id is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_affiliate_id
        and p.institution_id = v_inst
        and p.role = 'affiliate'
    ) then
      raise exception 'INVALID_AFFILIATE';
    end if;

    select id into v_scope_id
    from public.registration_program_scopes
    where institution_id = v_inst and affiliate_id = p_affiliate_id
    limit 1;

    if v_scope_id is null then
      insert into public.registration_program_scopes (institution_id, affiliate_id, is_restricted, updated_by)
      values (v_inst, p_affiliate_id, coalesce(p_is_restricted, false), auth.uid())
      returning id into v_scope_id;
    else
      update public.registration_program_scopes
      set is_restricted = coalesce(p_is_restricted, false),
          updated_by = auth.uid(),
          updated_at = now()
      where id = v_scope_id;
    end if;
  else
    select id into v_scope_id
    from public.registration_program_scopes
    where institution_id = v_inst and affiliate_id is null
    limit 1;

    if v_scope_id is null then
      insert into public.registration_program_scopes (institution_id, affiliate_id, is_restricted, updated_by)
      values (v_inst, null, coalesce(p_is_restricted, false), auth.uid())
      returning id into v_scope_id;
    else
      update public.registration_program_scopes
      set is_restricted = coalesce(p_is_restricted, false),
          updated_by = auth.uid(),
          updated_at = now()
      where id = v_scope_id;
    end if;
  end if;

  delete from public.registration_allowed_programs where scope_id = v_scope_id;

  if coalesce(p_is_restricted, false) and p_programs is not null and jsonb_typeof(p_programs) = 'array' then
    for v_item in select * from jsonb_array_elements(p_programs)
    loop
      v_type := lower(trim(coalesce(v_item->>'program_type', '')));
      begin
        v_pid := (v_item->>'program_id')::uuid;
      exception when others then
        continue;
      end;

      if v_type = 'course' then
        if not exists (
          select 1 from public.courses c
          where c.id = v_pid and c.institution_id = v_inst
        ) then
          continue;
        end if;
      elsif v_type = 'diploma' then
        if not exists (
          select 1 from public.diplomas d
          where d.id = v_pid and d.institution_id = v_inst
        ) then
          continue;
        end if;
      else
        continue;
      end if;

      insert into public.registration_allowed_programs (scope_id, program_type, program_id)
      values (v_scope_id, v_type, v_pid)
      on conflict (scope_id, program_type, program_id) do nothing;
    end loop;
  end if;

  return public.get_registration_form_programs(p_affiliate_id);
end;
$$;

revoke all on function public.set_registration_form_programs(boolean, jsonb, uuid) from public;
grant execute on function public.set_registration_form_programs(boolean, jsonb, uuid) to authenticated, service_role;

create or replace function public.get_public_classes(
  p_subdomain text,
  p_affiliate_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst_id uuid;
  v_rows jsonb;
  v_month date := date_trunc('month', current_date)::date;
  v_restriction jsonb;
  v_restricted boolean;
  v_programs jsonb;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then
    return '[]'::jsonb;
  end if;

  select id into v_inst_id
  from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain))
    and coalesce(status, 'active') = 'active'
  limit 1;

  if v_inst_id is null then
    return '[]'::jsonb;
  end if;

  v_restriction := public.registration_program_restriction(v_inst_id, p_affiliate_id);
  v_restricted := coalesce((v_restriction->>'restricted')::boolean, false);
  v_programs := coalesce(v_restriction->'programs', '[]'::jsonb);

  if v_restricted then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'program_type', c.program_type,
      'total_fee', c.total_fee,
      'start_month', c.start_month,
      'end_month', c.end_month
    ) order by c.name), '[]'::jsonb)
    into v_rows
    from public.classes c
    where c.institution_id = v_inst_id
      and c.status = 'active'
      and (
        c.end_month is null
        or date_trunc('month', c.end_month)::date >= v_month
      )
      and public.class_matches_registration_programs(c, v_programs);
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'program_type', c.program_type,
      'total_fee', c.total_fee,
      'start_month', c.start_month,
      'end_month', c.end_month
    ) order by c.name), '[]'::jsonb)
    into v_rows
    from public.classes c
    where c.institution_id = v_inst_id
      and c.status = 'active'
      and (
        c.end_month is null
        or date_trunc('month', c.end_month)::date >= v_month
      );
  end if;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

drop function if exists public.get_public_classes(text);

create or replace function public.get_public_classes(p_subdomain text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.get_public_classes(p_subdomain, null::uuid);
$$;

revoke all on function public.get_public_classes(text) from public;
revoke all on function public.get_public_classes(text, uuid) from public;
grant execute on function public.get_public_classes(text) to anon, authenticated, service_role;
grant execute on function public.get_public_classes(text, uuid) to anon, authenticated, service_role;

create or replace function public.submit_registration_inquiry(
  p_subdomain text,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_university text default null,
  p_faculty text default null,
  p_year_of_study text default null,
  p_class_id uuid default null,
  p_affiliate_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst institutions%rowtype;
  v_aff profiles%rowtype;
  v_class classes%rowtype;
  v_id uuid;
  v_email text;
  v_month date := date_trunc('month', current_date)::date;
  v_restriction jsonb;
  v_restricted boolean;
  v_programs jsonb;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then
    raise exception 'INVALID_SUBDOMAIN';
  end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'INVALID_NAME';
  end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  select * into v_inst
  from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain))
    and coalesce(status, 'active') = 'active'
  limit 1;

  if not found then
    raise exception 'INSTITUTION_NOT_FOUND';
  end if;

  if p_affiliate_id is not null then
    select * into v_aff
    from public.profiles
    where id = p_affiliate_id
      and institution_id = v_inst.id
      and role = 'affiliate'
      and status = 'approved'
    limit 1;
    if not found then
      raise exception 'INVALID_AFFILIATE';
    end if;
  end if;

  if p_class_id is not null then
    select * into v_class
    from public.classes
    where id = p_class_id
      and institution_id = v_inst.id
      and status = 'active'
      and (
        end_month is null
        or date_trunc('month', end_month)::date >= v_month
      )
    limit 1;
    if not found then
      raise exception 'INVALID_CLASS';
    end if;

    v_restriction := public.registration_program_restriction(v_inst.id, p_affiliate_id);
    v_restricted := coalesce((v_restriction->>'restricted')::boolean, false);
    v_programs := coalesce(v_restriction->'programs', '[]'::jsonb);

    if v_restricted and not public.class_matches_registration_programs(v_class, v_programs) then
      raise exception 'INVALID_CLASS';
    end if;
  end if;

  if exists (
    select 1 from public.profiles
    where institution_id = v_inst.id
      and lower(email) = v_email
  ) then
    raise exception 'USER_ACCOUNT_EXISTS';
  end if;

  if exists (
    select 1 from public.registration_inquiries
    where institution_id = v_inst.id
      and lower(email) = v_email
      and status = 'pending'
  ) then
    raise exception 'DUPLICATE_INQUIRY';
  end if;

  if exists (
    select 1 from public.registration_inquiries
    where institution_id = v_inst.id
      and lower(email) = v_email
      and status = 'approved'
  ) then
    raise exception 'USER_ACCOUNT_EXISTS';
  end if;

  insert into public.registration_inquiries (
    institution_id, full_name, email, phone, university, faculty,
    year_of_study, class_id, affiliate_id, notes
  ) values (
    v_inst.id,
    trim(p_full_name),
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_university, '')), ''),
    nullif(trim(coalesce(p_faculty, '')), ''),
    nullif(trim(coalesce(p_year_of_study, '')), ''),
    p_class_id,
    p_affiliate_id,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'status', 'pending',
    'institution_name', v_inst.name
  );
end;
$$;

revoke all on function public.submit_registration_inquiry(
  text, text, text, text, text, text, text, uuid, uuid, text
) from public;
grant execute on function public.submit_registration_inquiry(
  text, text, text, text, text, text, text, uuid, uuid, text
) to anon, authenticated, service_role;
