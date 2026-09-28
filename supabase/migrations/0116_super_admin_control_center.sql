-- Super Admin control center: theme policy + institution overview aggregation.
-- Security: all RPCs check is_super_admin() except get_dashboard_theme_policy
-- (authenticated read of non-sensitive policy only).

-- ---------------------------------------------------------------------
-- Dashboard theme policy (platform-wide)
-- Values: "light" | "dark" | "institution"
-- ---------------------------------------------------------------------
insert into system_settings (key, value)
values ('dashboard_theme_policy', '"institution"'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_dashboard_theme_policy()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  select trim(both '"' from value::text)
  into v
  from system_settings
  where key = 'dashboard_theme_policy';

  if v is null or v not in ('light', 'dark', 'institution') then
    return 'institution';
  end if;
  return v;
end;
$$;

revoke all on function public.get_dashboard_theme_policy() from public, anon;
grant execute on function public.get_dashboard_theme_policy() to authenticated;

create or replace function public.set_dashboard_theme_policy(p_policy text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_policy, '')));
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'FORBIDDEN';
  end if;

  if v not in ('light', 'dark', 'institution') then
    raise exception 'INVALID_THEME_POLICY';
  end if;

  insert into system_settings (key, value, updated_at, updated_by)
  values (
    'dashboard_theme_policy',
    to_jsonb(v),
    now(),
    auth.uid()
  )
  on conflict (key) do update
  set
    value = excluded.value,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  return v;
end;
$$;

revoke all on function public.set_dashboard_theme_policy(text) from public, anon;
grant execute on function public.set_dashboard_theme_policy(text) to authenticated;

-- ---------------------------------------------------------------------
-- Super Admin overview (KPIs + per-institution metrics)
-- p_period: today | 7d | 30d | 90d | this_month | previous_month
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
    -- default 30d
    v_period := '30d';
    v_start := now() - interval '30 days';
  end if;

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
      'students_period', (select coalesce(sum(students_period), 0)::int from enriched)
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

-- Single-tenant detail for Super Admin detail page
create or replace function public.get_super_admin_tenant_metrics(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'FORBIDDEN';
  end if;

  if p_institution_id is null then
    raise exception 'INSTITUTION_REQUIRED';
  end if;

  select jsonb_build_object(
    'students', (select count(*)::int from profiles where institution_id = p_institution_id and role = 'student'),
    'staff', (select count(*)::int from profiles where institution_id = p_institution_id and role = 'staff'),
    'instructors', (select count(*)::int from profiles where institution_id = p_institution_id and role = 'instructor'),
    'affiliates', (select count(*)::int from profiles where institution_id = p_institution_id and role = 'affiliate'),
    'admins', (select count(*)::int from profiles where institution_id = p_institution_id and role = 'admin'),
    'courses', (select count(*)::int from courses where institution_id = p_institution_id),
    'classes', (select count(*)::int from classes where institution_id = p_institution_id),
    'enrollments', (select count(*)::int from enrollments where institution_id = p_institution_id),
    'certificates', (select count(*)::int from certificates where institution_id = p_institution_id),
    'registrations', (select count(*)::int from registration_inquiries where institution_id = p_institution_id),
    'payments', (select count(*)::int from payments where institution_id = p_institution_id),
    'payments_total', (select coalesce(sum(amount), 0) from payments where institution_id = p_institution_id),
    'attendance_marks', (select count(*)::int from attendance where institution_id = p_institution_id)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_super_admin_tenant_metrics(uuid) from public, anon;
grant execute on function public.get_super_admin_tenant_metrics(uuid) to authenticated;
