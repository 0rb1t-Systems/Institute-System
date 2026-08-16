-- Profile photos for students / instructors / staff / admins
alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {institution_id|platform}/{user_id}/avatar-*.ext
drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own_or_staff" on storage.objects;
create policy "avatars_insert_own_or_staff"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        public.is_admin_or_staff()
        and (storage.foldername(name))[1] = public.current_institution_id()::text
      )
      or (
        public.is_super_admin()
        and (storage.foldername(name))[1] = 'platform'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "avatars_update_own_or_staff" on storage.objects;
create policy "avatars_update_own_or_staff"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        public.is_admin_or_staff()
        and (storage.foldername(name))[1] = public.current_institution_id()::text
      )
      or (
        public.is_super_admin()
        and (storage.foldername(name))[1] = 'platform'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        public.is_admin_or_staff()
        and (storage.foldername(name))[1] = public.current_institution_id()::text
      )
      or (
        public.is_super_admin()
        and (storage.foldername(name))[1] = 'platform'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "avatars_delete_own_or_staff" on storage.objects;
create policy "avatars_delete_own_or_staff"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        public.is_admin_or_staff()
        and (storage.foldername(name))[1] = public.current_institution_id()::text
      )
      or (
        public.is_super_admin()
        and (storage.foldername(name))[1] = 'platform'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );
