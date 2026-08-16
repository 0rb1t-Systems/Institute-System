-- Phase 1: Institution branding theme + logo storage
alter table institutions
  add column if not exists theme_primary text not null default '#002147',
  add column if not exists theme_accent text not null default '#D32F2F';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'institution-assets',
  'institution-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

drop policy if exists "inst_assets_select_public" on storage.objects;
create policy "inst_assets_select_public"
  on storage.objects for select
  using (bucket_id = 'institution-assets');

drop policy if exists "inst_assets_insert_admin" on storage.objects;
create policy "inst_assets_insert_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'institution-assets'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "inst_assets_update_admin" on storage.objects;
create policy "inst_assets_update_admin"
  on storage.objects for update
  using (
    bucket_id = 'institution-assets'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  )
  with check (
    bucket_id = 'institution-assets'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "inst_assets_delete_admin" on storage.objects;
create policy "inst_assets_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'institution-assets'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );
