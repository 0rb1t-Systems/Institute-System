-- Prepaid plan purchases: pay first, claim when creating institution
alter table public.platform_subscription_payments
  alter column institution_id drop not null;

alter table public.platform_subscription_payments
  add column if not exists claim_token uuid unique,
  add column if not exists claimed_at timestamptz;

create index if not exists idx_platform_sub_pay_claim_token
  on public.platform_subscription_payments (claim_token)
  where claim_token is not null and claimed_at is null;

create or replace function public.peek_plan_purchase(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_token is null then
    return null;
  end if;

  select
    p.id,
    p.plan_id,
    p.amount,
    p.currency,
    p.billing_cycle,
    p.status,
    p.claimed_at,
    p.institution_id,
    pl.name as plan_name,
    pl.slug as plan_slug
  into r
  from public.platform_subscription_payments p
  join public.platform_plans pl on pl.id = p.plan_id
  where p.claim_token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  if r.status is distinct from 'completed' then
    return jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_COMPLETED');
  end if;

  if r.claimed_at is not null or r.institution_id is not null then
    return jsonb_build_object('ok', false, 'error', 'PURCHASE_ALREADY_USED');
  end if;

  return jsonb_build_object(
    'ok', true,
    'payment_id', r.id,
    'plan_id', r.plan_id,
    'plan_name', r.plan_name,
    'plan_slug', r.plan_slug,
    'amount', r.amount,
    'currency', r.currency,
    'billing_cycle', r.billing_cycle
  );
end;
$$;

revoke all on function public.peek_plan_purchase(uuid) from public;
grant execute on function public.peek_plan_purchase(uuid) to anon, authenticated;
