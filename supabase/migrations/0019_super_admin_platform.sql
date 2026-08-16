-- =====================================================================
--  0019_super_admin_platform.sql
--  Platform System Owner (super_admin) — global role, no tenant.
--  Extends institutions for provisioning metadata + audit/settings.
-- =====================================================================

-- Institution contact + lifecycle (provisioning form fields)
alter table institutions
  add column if not exists email   text,
  add column if not exists phone   text,
  add column if not exists address text,
  add column if not exists status  text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'institutions_status_check'
  ) then
    alter table institutions
      add constraint institutions_status_check
      check (status in ('active', 'suspended'));
  end if;
end $$;

-- Platform operators have no tenant
alter table profiles alter column institution_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_super_admin_tenant_chk'
  ) then
    alter table profiles
      add constraint profiles_super_admin_tenant_chk
      check (
        (role = 'super_admin' and institution_id is null)
        or (role <> 'super_admin' and institution_id is not null)
      );
  end if;
end $$;

-- Unique email among profiles (case-insensitive) for provisioning checks
create unique index if not exists idx_profiles_email_lower
  on profiles (lower(email));

-- Helpers
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'super_admin'
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- Profile column guard — block elevating anyone to super_admin via client;
-- allow super_admin to manage tenant user role/status.
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institution_id is distinct from old.institution_id then
    raise exception 'institution_id lama beddeli karo';
  end if;

  if (new.role = 'super_admin') is distinct from (old.role = 'super_admin') then
    raise exception 'super_admin role lama beddeli karo';
  end if;

  if new.role is distinct from old.role
     and not (public.is_admin() or public.is_super_admin()) then
    raise exception 'Kaliya admin ama super_admin ayaa beddeli kara role';
  end if;

  if new.status is distinct from old.status
     and not (public.is_admin_or_staff() or public.is_super_admin()) then
    raise exception 'Kaliya admin/staff ama super_admin ayaa beddeli kara status';
  end if;

  return new;
end;
$$;

-- RLS — super_admin cross-tenant read/update (no INSERT institutions from client)
drop policy if exists "inst_select_super_admin" on institutions;
create policy "inst_select_super_admin"
  on institutions for select
  using (public.is_super_admin());

drop policy if exists "inst_update_super_admin" on institutions;
create policy "inst_update_super_admin"
  on institutions for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "prof_select_super_admin" on profiles;
create policy "prof_select_super_admin"
  on profiles for select
  using (public.is_super_admin());

drop policy if exists "prof_update_super_admin" on profiles;
create policy "prof_update_super_admin"
  on profiles for update
  using (public.is_super_admin() and role <> 'super_admin')
  with check (
    public.is_super_admin()
    and role <> 'super_admin'
    and institution_id is not null
  );

-- Audit logs (platform-only)
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_logs_created on audit_logs (created_at desc);
create index if not exists idx_audit_logs_actor on audit_logs (actor_id);

alter table audit_logs enable row level security;

drop policy if exists "audit_select_super_admin" on audit_logs;
create policy "audit_select_super_admin"
  on audit_logs for select
  using (public.is_super_admin());

-- System settings (platform-only)
create table if not exists system_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

alter table system_settings enable row level security;

drop policy if exists "settings_select_super_admin" on system_settings;
create policy "settings_select_super_admin"
  on system_settings for select
  using (public.is_super_admin());

drop policy if exists "settings_update_super_admin" on system_settings;
create policy "settings_update_super_admin"
  on system_settings for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into system_settings (key, value) values
  ('platform_name',    '"BRCE Training Platform"'::jsonb),
  ('support_email',    '"support@brce.com"'::jsonb),
  ('maintenance_mode', 'false'::jsonb)
on conflict (key) do nothing;

-- Expanded provisioning helper (revoked from clients — Edge Function / service_role only)
create or replace function public.provision_tenant_full(
  p_name         text,
  p_subdomain    text,
  p_email        text,
  p_phone        text,
  p_address      text,
  p_admin_uid    uuid,
  p_admin_email  text,
  p_admin_name   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_institution_id uuid;
  v_admin_email    text;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'INSTITUTION_NAME_REQUIRED';
  end if;
  if p_subdomain is null or length(trim(p_subdomain)) = 0 then
    raise exception 'INSTITUTION_SLUG_REQUIRED';
  end if;
  if p_admin_uid is null then
    raise exception 'ADMIN_UID_REQUIRED';
  end if;

  if exists (
    select 1 from institutions where lower(subdomain) = lower(trim(p_subdomain))
  ) then
    raise exception 'INSTITUTION_SLUG_IN_USE';
  end if;

  if exists (
    select 1 from profiles where lower(email) = lower(trim(p_admin_email))
  ) then
    raise exception 'ADMIN_EMAIL_EXISTS';
  end if;

  if exists (
    select 1 from profiles
    where id = p_admin_uid and role = 'super_admin'
  ) then
    raise exception 'SUPER_ADMIN_CANNOT_BE_TENANT';
  end if;

  select email into v_admin_email from auth.users where id = p_admin_uid;
  if v_admin_email is null then
    raise exception 'ADMIN_USER_MISSING';
  end if;

  insert into institutions (name, subdomain, email, phone, address, status)
  values (
    trim(p_name),
    lower(trim(p_subdomain)),
    nullif(trim(p_email), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_address), ''),
    'active'
  )
  returning id into v_institution_id;

  insert into profiles (id, institution_id, role, status, full_name, email)
  values (
    p_admin_uid,
    v_institution_id,
    'admin',
    'approved',
    trim(p_admin_name),
    lower(trim(coalesce(v_admin_email, p_admin_email)))
  );

  return v_institution_id;
end;
$$;

revoke execute on function public.provision_tenant_full(text, text, text, text, text, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.provision_tenant_full(text, text, text, text, text, uuid, text, text)
  to service_role;
