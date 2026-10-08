-- WaafiPay gateway environment on platform subscription payments.
-- Secrets stay in Deno env and/or platform_runtime_secrets (service_role only).

alter table public.platform_subscription_payments
  add column if not exists gateway_env text not null default 'sandbox'
  check (gateway_env in ('sandbox', 'live'));

comment on column public.platform_subscription_payments.gateway_env is
  'WaafiPay environment used for this charge: sandbox (test) or live.';

create index if not exists idx_platform_sub_pay_gateway_env
  on public.platform_subscription_payments (gateway_env, status, created_at desc);

-- Sandbox credentials as service-role fallbacks (Deno env overrides these).
-- Switch to live later: set WAAFIPAY_MODE=live + live secrets in Deno env.
insert into public.platform_runtime_secrets (key, value)
values
  ('WAAFIPAY_MODE', 'sandbox'),
  ('WAAFIPAY_BASE_URL', 'https://sandbox.waafipay.com/asm'),
  ('WAAFIPAY_MERCHANT_UID', 'M01'),
  ('WAAFIPAY_API_USER_ID', '1008348'),
  ('WAAFIPAY_API_KEY', 'API-8LylZYCuTdonYgjvwzQ2BCcUr5j')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
