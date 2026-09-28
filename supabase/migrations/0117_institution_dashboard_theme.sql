-- Per-institution dashboard light/dark preference (Super Admin / institution admin).
-- Null = allow operator localStorage choice when platform policy is "institution".

alter table public.institutions
  add column if not exists dashboard_theme text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'institutions_dashboard_theme_check'
  ) then
    alter table public.institutions
      add constraint institutions_dashboard_theme_check
      check (dashboard_theme is null or dashboard_theme in ('light', 'dark'));
  end if;
end $$;

comment on column public.institutions.dashboard_theme is
  'Dashboard UI mode for this tenant: light | dark. Null = user choice when platform theme policy is institution.';
