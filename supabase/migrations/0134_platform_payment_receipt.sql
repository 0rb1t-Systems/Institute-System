-- Platform payment receipts: payer name + invoice number + public receipt lookup

alter table public.platform_subscription_payments
  add column if not exists payer_name text,
  add column if not exists invoice_number text,
  add column if not exists receipt_token uuid;

update public.platform_subscription_payments
set receipt_token = coalesce(receipt_token, claim_token, gen_random_uuid())
where receipt_token is null;

alter table public.platform_subscription_payments
  alter column receipt_token set default gen_random_uuid();

alter table public.platform_subscription_payments
  alter column receipt_token set not null;

create unique index if not exists uq_platform_sub_pay_receipt_token
  on public.platform_subscription_payments (receipt_token);

create unique index if not exists uq_platform_sub_pay_invoice_number
  on public.platform_subscription_payments (invoice_number)
  where invoice_number is not null;

-- Backfill invoice numbers for completed rows missing one
update public.platform_subscription_payments p
set invoice_number = 'TF-' || to_char(coalesce(p.paid_at, p.created_at), 'YYYYMMDD') || '-' || upper(substr(replace(p.id::text, '-', ''), 1, 8))
where p.invoice_number is null
  and p.status = 'completed';

create or replace function public.get_platform_payment_receipt(p_token uuid)
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
    p.invoice_number,
    p.payer_name,
    p.payer_phone,
    p.amount,
    p.currency,
    p.billing_cycle,
    p.status,
    p.reference_id,
    p.waafi_transaction_id,
    p.gateway_env,
    p.paid_at,
    p.created_at,
    p.claim_token,
    p.claimed_at,
    p.institution_id,
    pl.name as plan_name,
    pl.slug as plan_slug
  into r
  from public.platform_subscription_payments p
  join public.platform_plans pl on pl.id = p.plan_id
  where p.receipt_token = p_token
     or p.claim_token = p_token
  limit 1;

  if not found then
    return null;
  end if;

  if r.status is distinct from 'completed' then
    return jsonb_build_object('ok', false, 'error', 'PAYMENT_NOT_COMPLETED');
  end if;

  return jsonb_build_object(
    'ok', true,
    'payment_id', r.id,
    'invoice_number', r.invoice_number,
    'payer_name', r.payer_name,
    'payer_phone', r.payer_phone,
    'amount', r.amount,
    'currency', r.currency,
    'billing_cycle', r.billing_cycle,
    'status', r.status,
    'reference_id', r.reference_id,
    'waafi_transaction_id', r.waafi_transaction_id,
    'paid_at', r.paid_at,
    'created_at', r.created_at,
    'plan_name', r.plan_name,
    'plan_slug', r.plan_slug,
    'claim_token', r.claim_token,
    'claimed_at', r.claimed_at,
    'institution_id', r.institution_id,
    'can_create_institution', (
      r.claim_token is not null
      and r.claimed_at is null
      and r.institution_id is null
    )
  );
end;
$$;

revoke all on function public.get_platform_payment_receipt(uuid) from public;
grant execute on function public.get_platform_payment_receipt(uuid) to anon, authenticated;

-- Keep peek in sync with payer/invoice fields
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
    p.invoice_number,
    p.payer_name,
    p.payer_phone,
    p.receipt_token,
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
    'billing_cycle', r.billing_cycle,
    'invoice_number', r.invoice_number,
    'payer_name', r.payer_name,
    'payer_phone', r.payer_phone,
    'receipt_token', r.receipt_token
  );
end;
$$;
