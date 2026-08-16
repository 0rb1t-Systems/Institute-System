-- Allow enrolled students to download assignment resource files (instructor attachments).
-- Previously only own-file / admin / staff / instructor could SELECT from private assignments bucket,
-- so createSignedUrl failed for students → "File unavailable".

drop policy if exists "assignments_select_tenant" on storage.objects;

create policy "assignments_select_tenant"
  on storage.objects for select
  using (
    bucket_id = 'assignments'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and (
      -- Own uploads (student submissions or instructor resources they uploaded)
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_admin_or_staff()
      or public.current_user_role() = 'instructor'
      -- Enrolled student: instructor resource linked on an assignment for their class
      or (
        public.current_user_role() = 'student'
        and exists (
          select 1
          from public.assignments a
          where a.institution_id = public.current_institution_id()
            and public.is_enrolled_in_class(a.class_id)
            and a.attachment_url is not null
            and length(trim(a.attachment_url)) > 0
            and (
              a.attachment_url = name
              or right(a.attachment_url, length(name) + 1) = '/' || name
              or position('/assignments/' || name in a.attachment_url) > 0
            )
        )
      )
    )
  );
