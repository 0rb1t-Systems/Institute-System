-- Platform subscription payments (WaafiPay) + public plan read + tenant own-sub read
-- Self-serve billing for institution admins; student Finance WaafiPay stays disabled.

-- ---------------------------------------------------------------------
-- platform_subscription_payments
-- ---------------------------------------------------------------------
create table if not exists public.platform_subscription_payments (
  id                    uuid primary key default gen_random_uuid(),
  institution_id        uuid not null references public.institutions(id) on delete cascade,
  plan_id               uuid not null references public.platform_plans(id) on delete restrict,
  amount                numeric(12,2) not null check (amount >= 0),
  currency              text not null default 'USD',
  billing_cycle         text not null check (billing_cycle in ('monthly', 'yearly')),
  payer_phone           text,
  reference_id          text not null,
  waafi_transaction_id  text,
  status                text not null default 'pending'
                        check (status in ('pending', 'completed', 'failed')),
  raw_response          jsonb,
  paid_at               timestamptz,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists uq_platform_sub_pay_reference
  on public.platform_subscription_payments (reference_id);

create index if not exists idx_platform_sub_pay_institution
  on public.platform_subscription_payments (institution_id);

create index if not exists idx_platform_sub_pay_status_paid
  on public.platform_subscription_payments (status, paid_at desc);

create index if not exists idx_platform_sub_pay_created
  on public.platform_subscription_payments (created_at desc);

alter table public.platform_subscription_payments enable row level security;

drop policy if exists "psp_select_super_admin" on public.platform_subscription_payments;
create policy "psp_select_super_admin"
  on public.platform_subscription_payments for select
  using (public.is_super_admin());

drop policy if exists "psp_select_tenant_admin" on public.platform_subscription_payments;
create policy "psp_select_tenant_admin"
  on public.platform_subscription_payments for select
  using (
    public.is_admin()
    and institution_id = public.current_institution_id()
  );

-- Writes only via service role (edge function). No insert/update/delete policies for clients.
grant select on public.platform_subscription_payments to authenticated;
grant all on public.platform_subscription_payments to service_role;

-- ---------------------------------------------------------------------
-- Public / authenticated read of active platform plans
-- NOTE: Do NOT leave is_super_admin() policies as TO PUBLIC — anon cannot
-- EXECUTE that function, and evaluating it fails the whole SELECT.
-- ---------------------------------------------------------------------
drop policy if exists "plans_select_super_admin" on public.platform_plans;
create policy "plans_select_super_admin"
  on public.platform_plans for select
  to authenticated
  using (public.is_super_admin());

drop policy if exists "plans_select_active_public" on public.platform_plans;
create policy "plans_select_active_public"
  on public.platform_plans for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "plans_insert_super_admin" on public.platform_plans;
create policy "plans_insert_super_admin"
  on public.platform_plans for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists "plans_update_super_admin" on public.platform_plans;
create policy "plans_update_super_admin"
  on public.platform_plans for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "plans_delete_super_admin" on public.platform_plans;
create policy "plans_delete_super_admin"
  on public.platform_plans for delete
  to authenticated
  using (public.is_super_admin());

grant select on public.platform_plans to anon, authenticated;

-- ---------------------------------------------------------------------
-- Institution admin can read own tenant subscription
-- ---------------------------------------------------------------------
drop policy if exists "subs_select_tenant_admin" on public.tenant_subscriptions;
create policy "subs_select_tenant_admin"
  on public.tenant_subscriptions for select
  using (
    public.is_admin()
    and institution_id = public.current_institution_id()
  );

grant select on public.tenant_subscriptions to authenticated;

-- ---------------------------------------------------------------------
-- Extend super-admin overview with platform subscription revenue KPIs
-- ---------------------------------------------------------------------
create or replace function public.get_super_admin_overview(p_period text default '30d')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period text := lower(trim(coalesce(p_period, '30d')));
  v_start timestamptz;
  v_end timestamptz := now();
  result jsonb;
  v_plat_rev numeric := 0;
  v_plat_count int := 0;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'FORBIDDEN';
  end if;

  if v_period = 'today' then
    v_start := date_trunc('day', now());
  elsif v_period = '7d' then
    v_start := now() - interval '7 days';
  elsif v_period = '90d' then
    v_start := now() - interval '90 days';
  elsif v_period = 'this_month' then
    v_start := date_trunc('month', now());
  elsif v_period = 'previous_month' then
    v_start := date_trunc('month', now()) - interval '1 month';
    v_end := date_trunc('month', now());
  else
    v_period := '30d';
    v_start := now() - interval '30 days';
  end if;

  select
    coalesce(sum(amount), 0)::numeric,
    count(*)::int
  into v_plat_rev, v_plat_count
  from public.platform_subscription_payments
  where status = 'completed'
    and coalesce(paid_at, created_at) >= v_start
    and coalesce(paid_at, created_at) < v_end;

  with
  inst as (
    select
      i.id,
      i.name,
      i.subdomain,
      i.status,
      i.created_at,
      i.settings_completed_at,
      i.email,
      i.logo_url
    from institutions i
  ),
  role_counts as (
    select
      p.institution_id,
      count(*) filter (where p.role = 'student')::int as students,
      count(*) filter (where p.role = 'staff')::int as staff,
      count(*) filter (where p.role = 'instructor')::int as instructors,
      count(*) filter (where p.role = 'affiliate')::int as affiliates,
      count(*) filter (
        where p.role = 'student'
          and p.created_at >= v_start
          and p.created_at < v_end
      )::int as students_period,
      max(p.created_at) as last_profile_at
    from profiles p
    where p.institution_id is not null
    group by p.institution_id
  ),
  course_counts as (
    select institution_id, count(*)::int as courses
    from courses
    group by institution_id
  ),
  class_counts as (
    select institution_id, count(*)::int as classes
    from classes
    group by institution_id
  ),
  cert_counts as (
    select
      institution_id,
      count(*)::int as certificates,
      count(*) filter (
        where coalesce(issued_at, created_at) >= v_start
          and coalesce(issued_at, created_at) < v_end
      )::int as certificates_period,
      max(coalesce(issued_at, created_at)) as last_cert_at
    from certificates
    group by institution_id
  ),
  reg_counts as (
    select
      institution_id,
      count(*)::int as registrations,
      count(*) filter (
        where created_at >= v_start and created_at < v_end
      )::int as registrations_period,
      max(created_at) as last_reg_at
    from registration_inquiries
    group by institution_id
  ),
  pay_counts as (
    select
      institution_id,
      count(*)::int as payments,
      count(*) filter (
        where paid_at >= v_start and paid_at < v_end
      )::int as payments_period,
      coalesce(sum(amount) filter (
        where paid_at >= v_start and paid_at < v_end
      ), 0)::numeric as payments_amount_period,
      max(paid_at) as last_payment_at
    from payments
    group by institution_id
  ),
  att_counts as (
    select
      a.institution_id,
      count(*) filter (
        where coalesce(a.marked_at, cs.session_date::timestamptz) >= v_start
          and coalesce(a.marked_at, cs.session_date::timestamptz) < v_end
      )::int as attendance_period,
      max(coalesce(a.marked_at, cs.session_date::timestamptz)) as last_attendance_at
    from attendance a
    left join class_sessions cs on cs.id = a.session_id
    group by a.institution_id
  ),
  enriched as (
    select
      i.id,
      i.name,
      i.subdomain,
      i.status,
      i.created_at,
      i.email,
      i.logo_url,
      (i.settings_completed_at is not null) as settings_completed,
      coalesce(r.students, 0) as students,
      coalesce(r.staff, 0) as staff,
      coalesce(r.instructors, 0) as instructors,
      coalesce(r.affiliates, 0) as affiliates,
      coalesce(r.students_period, 0) as students_period,
      coalesce(c.courses, 0) as courses,
      coalesce(cl.classes, 0) as classes,
      coalesce(ce.certificates, 0) as certificates,
      coalesce(ce.certificates_period, 0) as certificates_period,
      coalesce(rg.registrations, 0) as registrations,
      coalesce(rg.registrations_period, 0) as registrations_period,
      coalesce(py.payments, 0) as payments,
      coalesce(py.payments_period, 0) as payments_period,
      coalesce(py.payments_amount_period, 0) as payments_amount_period,
      coalesce(at.attendance_period, 0) as attendance_period,
      (
        coalesce(r.students_period, 0)
        + coalesce(ce.certificates_period, 0)
        + coalesce(rg.registrations_period, 0)
        + coalesce(py.payments_period, 0)
        + coalesce(at.attendance_period, 0)
      )::int as activity_score,
      greatest(
        r.last_profile_at,
        ce.last_cert_at,
        rg.last_reg_at,
        py.last_payment_at,
        at.last_attendance_at
      ) as last_activity_at
    from inst i
    left join role_counts r on r.institution_id = i.id
    left join course_counts c on c.institution_id = i.id
    left join class_counts cl on cl.institution_id = i.id
    left join cert_counts ce on ce.institution_id = i.id
    left join reg_counts rg on rg.institution_id = i.id
    left join pay_counts py on py.institution_id = i.id
    left join att_counts at on at.institution_id = i.id
  ),
  attention as (
    select jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'subdomain', e.subdomain,
        'reason', e.reason,
        'label', e.label
      )
      order by e.sort_order, e.name
    ) as items
    from (
      select
        id, name, subdomain,
        'suspended'::text as reason,
        'Suspended'::text as label,
        1 as sort_order
      from enriched
      where status = 'suspended'

      union all

      select
        id, name, subdomain,
        'incomplete_settings',
        'Incomplete settings',
        2
      from enriched
      where status = 'active' and not settings_completed

      union all

      select
        id, name, subdomain,
        'no_students',
        'No students',
        3
      from enriched
      where status = 'active'
        and students = 0
        and created_at < (now() - interval '7 days')

      union all

      select
        id, name, subdomain,
        'low_activity',
        'Low activity',
        4
      from enriched
      where status = 'active'
        and students > 0
        and activity_score = 0
    ) e
  )
  select jsonb_build_object(
    'period', v_period,
    'period_start', v_start,
    'period_end', v_end,
    'kpis', jsonb_build_object(
      'institutions_total', (select count(*)::int from enriched),
      'institutions_active', (select count(*)::int from enriched where status = 'active'),
      'institutions_suspended', (select count(*)::int from enriched where status = 'suspended'),
      'students_total', (select coalesce(sum(students), 0)::int from enriched),
      'courses_total', (select coalesce(sum(courses), 0)::int from enriched),
      'classes_total', (select coalesce(sum(classes), 0)::int from enriched),
      'staff_total', (select coalesce(sum(staff), 0)::int from enriched),
      'instructors_total', (select coalesce(sum(instructors), 0)::int from enriched),
      'affiliates_total', (select coalesce(sum(affiliates), 0)::int from enriched),
      'certificates_total', (select coalesce(sum(certificates), 0)::int from enriched),
      'certificates_period', (select coalesce(sum(certificates_period), 0)::int from enriched),
      'registrations_period', (select coalesce(sum(registrations_period), 0)::int from enriched),
      'payments_period', (select coalesce(sum(payments_period), 0)::int from enriched),
      'activity_period', (select coalesce(sum(activity_score), 0)::int from enriched),
      'students_period', (select coalesce(sum(students_period), 0)::int from enriched),
      'platform_subscription_revenue_period', v_plat_rev,
      'platform_subscription_payments_period', v_plat_count
    ),
    'institutions', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.name)
      from enriched e
    ), '[]'::jsonb),
    'attention', coalesce((select items from attention), '[]'::jsonb),
    'growth', jsonb_build_object(
      'students', coalesce((
        select jsonb_agg(row_to_json(g))
        from (
          select
            to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
            count(*)::int as count
          from profiles
          where role = 'student'
            and created_at >= (now() - interval '90 days')
          group by 1
          order by 1
        ) g
      ), '[]'::jsonb),
      'institutions', coalesce((
        select jsonb_agg(row_to_json(g))
        from (
          select
            to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
            count(*)::int as count
          from institutions
          where created_at >= (now() - interval '90 days')
          group by 1
          order by 1
        ) g
      ), '[]'::jsonb),
      'certificates', coalesce((
        select jsonb_agg(row_to_json(g))
        from (
          select
            to_char(date_trunc('month', coalesce(issued_at, created_at)), 'YYYY-MM') as month,
            count(*)::int as count
          from certificates
          where coalesce(issued_at, created_at) >= (now() - interval '90 days')
          group by 1
          order by 1
        ) g
      ), '[]'::jsonb),
      'registrations', coalesce((
        select jsonb_agg(row_to_json(g))
        from (
          select
            to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
            count(*)::int as count
          from registration_inquiries
          where created_at >= (now() - interval '90 days')
          group by 1
          order by 1
        ) g
      ), '[]'::jsonb)
    ),
    'communication', jsonb_build_object(
      'email_tracking', 'unavailable',
      'resend_usage_available', false,
      'emailjs_usage_available', false,
      'note', 'No email dispatch log exists yet. Resend and EmailJS sends are not persisted; usage cannot be ranked by institution from the database.'
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_super_admin_overview(text) from public, anon;
grant execute on function public.get_super_admin_overview(text) to authenticated;
