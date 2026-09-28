-- Platform (Super Admin) dashboard brand colors — primary / accent / tertiary.
-- Applied to the platform-shell only (not public landing, not tenant chrome).

insert into public.system_settings (key, value)
values (
  'platform_dashboard_brand',
  '{
    "primary": "#0F172A",
    "accent": "#EAB308",
    "tertiary": ""
  }'::jsonb
)
on conflict (key) do nothing;

comment on table public.system_settings is
  'Platform-wide settings. platform_dashboard_brand holds Super Admin dashboard colors.';
