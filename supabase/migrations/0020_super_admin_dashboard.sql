-- =====================================================================
--  0020_super_admin_dashboard.sql
--  Platform dashboard: audit writes, plans, support, SA payment reads.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Audit writes for Super Admin (authenticated; never open to anon)
-- ---------------------------------------------------------------------
create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'ACTION_REQUIRED';
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    trim(p_action),
    nullif(trim(coalesce(p_entity_type, '')), ''),
    nullif(trim(coalesce(p_entity_id, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_log(text, text, text, jsonb) from public, anon;
grant execute on function public.write_audit_log(text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Super Admin can read payments for platform revenue (aggregated in UI)
-- ---------------------------------------------------------------------
drop policy if exists "pay_select_super_admin" on payments;
create policy "pay_select_super_admin"
  on payments for select
  using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- Platform plans & tenant subscriptions
-- ---------------------------------------------------------------------
create table if not exists platform_plans (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  price_monthly numeric(12,2) not null default 0 check (price_monthly >= 0),
  price_yearly  numeric(12,2) not null default 0 check (price_yearly >= 0),
  max_students  integer,
  features      jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists tenant_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  plan_id         uuid not null references platform_plans(id) on delete restrict,
  status          text not null default 'active'
                  check (status in ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  billing_cycle   text not null default 'monthly'
                  check (billing_cycle in ('monthly', 'yearly')),
  started_at      timestamptz not null default now(),
  ends_at         timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (institution_id)
);

create index if not exists idx_tenant_subs_plan on tenant_subscriptions (plan_id);
create index if not exists idx_tenant_subs_status on tenant_subscriptions (status);

alter table platform_plans enable row level security;
alter table tenant_subscriptions enable row level security;

drop policy if exists "plans_select_super_admin" on platform_plans;
create policy "plans_select_super_admin"
  on platform_plans for select using (public.is_super_admin());

drop policy if exists "plans_insert_super_admin" on platform_plans;
create policy "plans_insert_super_admin"
  on platform_plans for insert with check (public.is_super_admin());

drop policy if exists "plans_update_super_admin" on platform_plans;
create policy "plans_update_super_admin"
  on platform_plans for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "plans_delete_super_admin" on platform_plans;
create policy "plans_delete_super_admin"
  on platform_plans for delete using (public.is_super_admin());

drop policy if exists "subs_select_super_admin" on tenant_subscriptions;
create policy "subs_select_super_admin"
  on tenant_subscriptions for select using (public.is_super_admin());

drop policy if exists "subs_insert_super_admin" on tenant_subscriptions;
create policy "subs_insert_super_admin"
  on tenant_subscriptions for insert with check (public.is_super_admin());

drop policy if exists "subs_update_super_admin" on tenant_subscriptions;
create policy "subs_update_super_admin"
  on tenant_subscriptions for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "subs_delete_super_admin" on tenant_subscriptions;
create policy "subs_delete_super_admin"
  on tenant_subscriptions for delete using (public.is_super_admin());

insert into platform_plans (name, slug, description, price_monthly, price_yearly, max_students, features, sort_order)
values
  (
    'Starter',
    'starter',
    'For small training centers getting started.',
    49, 490, 100,
    '["Up to 100 students","Core LMS","Email support"]'::jsonb,
    1
  ),
  (
    'Growth',
    'growth',
    'For growing institutions with multiple instructors.',
    129, 1290, 500,
    '["Up to 500 students","Finance & attendance","Priority support"]'::jsonb,
    2
  ),
  (
    'Enterprise',
    'enterprise',
    'Unlimited scale with dedicated support.',
    299, 2990, null,
    '["Unlimited students","Custom branding","Dedicated support"]'::jsonb,
    3
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Platform support tickets (no student PII required)
-- ---------------------------------------------------------------------
create table if not exists support_tickets (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null,
  message          text not null,
  status           text not null default 'open'
                   check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority         text not null default 'normal'
                   check (priority in ('low', 'normal', 'high', 'urgent')),
  requester_name   text,
  requester_email  text,
  institution_id   uuid references institutions(id) on delete set null,
  resolution_notes text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null
);

create index if not exists idx_support_tickets_status on support_tickets (status);
create index if not exists idx_support_tickets_created on support_tickets (created_at desc);

alter table support_tickets enable row level security;

drop policy if exists "support_select_super_admin" on support_tickets;
create policy "support_select_super_admin"
  on support_tickets for select using (public.is_super_admin());

drop policy if exists "support_insert_super_admin" on support_tickets;
create policy "support_insert_super_admin"
  on support_tickets for insert with check (public.is_super_admin());

drop policy if exists "support_update_super_admin" on support_tickets;
create policy "support_update_super_admin"
  on support_tickets for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "support_delete_super_admin" on support_tickets;
create policy "support_delete_super_admin"
  on support_tickets for delete using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- Aggregated platform stats (students counted without exposing rows)
-- ---------------------------------------------------------------------
create or replace function public.get_platform_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select jsonb_build_object(
    'tenants_total', (select count(*)::int from institutions),
    'tenants_active', (select count(*)::int from institutions where status = 'active'),
    'tenants_suspended', (select count(*)::int from institutions where status = 'suspended'),
    'admins', (select count(*)::int from profiles where role = 'admin'),
    'staff', (select count(*)::int from profiles where role = 'staff'),
    'instructors', (select count(*)::int from profiles where role = 'instructor'),
    'students_total', (select count(*)::int from profiles where role = 'student'),
    'students_active', (
      select count(*)::int from profiles
      where role = 'student' and status = 'approved'
    ),
    'students_suspended', (
      select count(*)::int from profiles
      where role = 'student' and status = 'suspended'
    ),
    'platform_users', (
      select count(*)::int from profiles
      where role in ('admin', 'staff', 'instructor')
    ),
    'revenue_total', (select coalesce(sum(amount), 0) from payments),
    'payments_count', (select count(*)::int from payments),
    'open_tickets', (
      select count(*)::int from support_tickets where status in ('open', 'in_progress')
    ),
    'student_growth', (
      select coalesce(jsonb_agg(row_to_json(g)), '[]'::jsonb)
      from (
        select
          to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
          count(*)::int as count
        from profiles
        where role = 'student'
          and created_at >= (now() - interval '12 months')
        group by 1
        order by 1
      ) g
    ),
    'tenant_growth', (
      select coalesce(jsonb_agg(row_to_json(g)), '[]'::jsonb)
      from (
        select
          to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
          count(*)::int as count
        from institutions
        where created_at >= (now() - interval '12 months')
        group by 1
        order by 1
      ) g
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_platform_analytics() from public, anon;
grant execute on function public.get_platform_analytics() to authenticated;
