-- =====================================================================
--  0026_assignment_files_storage.sql
--  Dedicated storage bucket for assignment resources & student submissions
--  (avatars bucket is image-only — cannot store PDF/TXT/DOC)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignments',
  'assignments',
  true,
  10485760, -- 10 MB
  array[
    'text/plain',
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {institution_id}/{user_id}/{filename}
drop policy if exists "assignments_select_public" on storage.objects;
create policy "assignments_select_public"
  on storage.objects for select
  using (bucket_id = 'assignments');

drop policy if exists "assignments_insert_tenant" on storage.objects;
create policy "assignments_insert_tenant"
  on storage.objects for insert
  with check (
    bucket_id = 'assignments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "assignments_update_tenant" on storage.objects;
create policy "assignments_update_tenant"
  on storage.objects for update
  using (
    bucket_id = 'assignments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_admin_or_staff()
    )
  )
  with check (
    bucket_id = 'assignments'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "assignments_delete_tenant" on storage.objects;
create policy "assignments_delete_tenant"
  on storage.objects for delete
  using (
    bucket_id = 'assignments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_admin_or_staff()
    )
  );
