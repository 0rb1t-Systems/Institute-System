-- Platform runtime secrets for edge functions (service_role only).
-- Lets every institution self-serve custom domains once Vercel creds are stored.
-- Prefer Deno env secrets when set; this table is the fallback.

create table if not exists public.platform_runtime_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

comment on table public.platform_runtime_secrets is
  'Service-role-only secrets for edge functions (e.g. VERCEL_TOKEN). Never expose to clients.';

alter table public.platform_runtime_secrets enable row level security;

-- No policies: PostgREST clients (anon/authenticated) cannot read/write.
-- service_role bypasses RLS.

revoke all on table public.platform_runtime_secrets from public;
revoke all on table public.platform_runtime_secrets from anon;
revoke all on table public.platform_runtime_secrets from authenticated;
grant select, insert, update, delete on table public.platform_runtime_secrets to service_role;

-- Non-secret project identifiers (safe defaults for institute-system on Vercel).
insert into public.platform_runtime_secrets (key, value)
values
  ('VERCEL_PROJECT_ID', 'prj_AkiKI9NoCmtHbPb5AmCLE2Mr9f5w'),
  ('VERCEL_TEAM_ID', 'team_oPNhVsDUu843Wnwmdo6FuFKw')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
