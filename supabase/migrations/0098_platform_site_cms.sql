-- Platform Site CMS: marketing assets for the public platform site (Trusted by logos, gallery photos, login art).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-assets',
  'platform-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "platform_assets_select_public" on storage.objects;
create policy "platform_assets_select_public"
  on storage.objects for select
  using (bucket_id = 'platform-assets');

drop policy if exists "platform_assets_insert_super_admin" on storage.objects;
create policy "platform_assets_insert_super_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'platform-assets'
    and public.is_super_admin()
  );

drop policy if exists "platform_assets_update_super_admin" on storage.objects;
create policy "platform_assets_update_super_admin"
  on storage.objects for update
  using (bucket_id = 'platform-assets' and public.is_super_admin())
  with check (bucket_id = 'platform-assets' and public.is_super_admin());

drop policy if exists "platform_assets_delete_super_admin" on storage.objects;
create policy "platform_assets_delete_super_admin"
  on storage.objects for delete
  using (bucket_id = 'platform-assets' and public.is_super_admin());

insert into public.system_settings (key, value) values
  (
    'site_trusted',
    '[
      {"id":"hti","name":"Hargeisa Training Institute","logo_url":null},
      {"id":"ssa","name":"Somali Skills Academy","logo_url":null},
      {"id":"rsc","name":"RedSea Computer College","logo_url":null},
      {"id":"fti","name":"FutureTech Institute","logo_url":null},
      {"id":"btc","name":"Barwaaqo Training Center","logo_url":null},
      {"id":"cse","name":"CityStar Education","logo_url":null}
    ]'::jsonb
  ),
  (
    'site_photos',
    '{
      "workshop":"https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1600&q=80",
      "classroom":"https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1600&q=80",
      "students":"https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80",
      "operations":"https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80",
      "workshopAlt":"https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1600&q=80",
      "lecture":"https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=80",
      "about":"https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1600&q=80",
      "login":null
    }'::jsonb
  )
on conflict (key) do nothing;

create or replace function public.get_public_site_cms()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'trusted', coalesce(
      (select value from public.system_settings where key = 'site_trusted'),
      '[]'::jsonb
    ),
    'photos', coalesce(
      (select value from public.system_settings where key = 'site_photos'),
      '{}'::jsonb
    )
  );
$$;

revoke all on function public.get_public_site_cms() from public;
grant execute on function public.get_public_site_cms() to anon, authenticated;
