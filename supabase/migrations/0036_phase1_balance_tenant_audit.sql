-- =====================================================================
--  0036_phase1_balance_tenant_audit.sql
--  - Fix enrollment_balances (monthly discount × duration, split reg fee)
--  - Tenant-scoped audit log writer for admin/staff sensitive actions
-- =====================================================================

-- ---------------------------------------------------------------------
-- enrollment_balances — align with Finance SSOT
-- discount_amount is monthly ($/mo); net tuition = fee − discount × months
-- registration fees excluded from tuition_paid; exposed separately
-- ---------------------------------------------------------------------
drop view if exists public.enrollment_balances;

create view public.enrollment_balances
with (security_invoker = true)
as
select
  e.id as enrollment_id,
  e.institution_id,
  e.student_id,
  e.class_id,
  c.total_fee,
  coalesce(e.discount_amount, 0) as discount_amount,
  greatest(
    coalesce(
      nullif(regexp_replace(coalesce(c.duration, '1'), '[^0-9]', '', 'g'), '')::int,
      1
    ),
    1
  ) as duration_months,
  greatest(
    c.total_fee
      - coalesce(e.discount_amount, 0)
        * greatest(
            coalesce(
              nullif(regexp_replace(coalesce(c.duration, '1'), '[^0-9]', '', 'g'), '')::int,
              1
            ),
            1
          ),
    0
  ) as net_fee,
  coalesce(
    sum(p.amount) filter (
      where p.status = 'completed' and coalesce(p.is_registration_fee, false) = false
    ),
    0
  ) as tuition_paid,
  coalesce(
    sum(p.amount) filter (
      where p.status = 'completed' and coalesce(p.is_registration_fee, false) = true
    ),
    0
  ) as registration_paid,
  greatest(
    c.total_fee
      - coalesce(e.discount_amount, 0)
        * greatest(
            coalesce(
              nullif(regexp_replace(coalesce(c.duration, '1'), '[^0-9]', '', 'g'), '')::int,
              1
            ),
            1
          )
      - coalesce(
          sum(p.amount) filter (
            where p.status = 'completed' and coalesce(p.is_registration_fee, false) = false
          ),
          0
        ),
    0
  ) as tuition_balance,
  case
    when exists (
      select 1
      from public.payments pr
      where pr.enrollment_id = e.id
        and coalesce(pr.is_registration_fee, false) = true
        and pr.status = 'completed'
    )
    then 0::numeric
    else coalesce(i.registration_fee_amount, 0)
  end as registration_balance,
  greatest(
    c.total_fee
      - coalesce(e.discount_amount, 0)
        * greatest(
            coalesce(
              nullif(regexp_replace(coalesce(c.duration, '1'), '[^0-9]', '', 'g'), '')::int,
              1
            ),
            1
          )
      - coalesce(
          sum(p.amount) filter (
            where p.status = 'completed' and coalesce(p.is_registration_fee, false) = false
          ),
          0
        ),
    0
  )
  + case
      when exists (
        select 1
        from public.payments pr
        where pr.enrollment_id = e.id
          and coalesce(pr.is_registration_fee, false) = true
          and pr.status = 'completed'
      )
      then 0::numeric
      else coalesce(i.registration_fee_amount, 0)
    end as balance
from public.enrollments e
join public.classes c on c.id = e.class_id
join public.institutions i on i.id = e.institution_id
left join public.payments p on p.enrollment_id = e.id
group by
  e.id,
  e.institution_id,
  e.student_id,
  e.class_id,
  c.total_fee,
  c.duration,
  e.discount_amount,
  i.registration_fee_amount;

grant select on public.enrollment_balances to authenticated;

-- ---------------------------------------------------------------------
-- Tenant audit log (admin/staff of current institution)
-- ---------------------------------------------------------------------
create or replace function public.write_tenant_audit_log(
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
  v_inst uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if not (public.is_admin_or_staff() or public.is_super_admin()) then
    raise exception 'FORBIDDEN';
  end if;

  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'ACTION_REQUIRED';
  end if;

  v_inst := public.current_institution_id();

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    trim(p_action),
    nullif(trim(coalesce(p_entity_type, '')), ''),
    nullif(trim(coalesce(p_entity_id, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('institution_id', v_inst)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_tenant_audit_log(text, text, text, jsonb)
  from public, anon;
grant execute on function public.write_tenant_audit_log(text, text, text, jsonb)
  to authenticated;

-- Allow tenant admins/staff to read their own institution audit rows
drop policy if exists "audit_select_tenant_admin" on public.audit_logs;
create policy "audit_select_tenant_admin" on public.audit_logs
for select
using (
  public.is_admin_or_staff()
  and (metadata->>'institution_id')::uuid = public.current_institution_id()
);
