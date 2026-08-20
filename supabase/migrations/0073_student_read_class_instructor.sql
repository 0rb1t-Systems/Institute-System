-- Allow enrolled students to read the profile of their class instructor
-- (needed for My Classes / portal to show a real instructor name).

create or replace function public.is_my_class_instructor(instructor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = auth.uid()
      and c.instructor_id = instructor
  );
$$;

revoke all on function public.is_my_class_instructor(uuid) from public;
grant execute on function public.is_my_class_instructor(uuid) to authenticated;

drop policy if exists "prof_select_own_class_instructor" on public.profiles;
create policy "prof_select_own_class_instructor"
on public.profiles for select
using (
  institution_id = public.current_institution_id()
  and public.current_user_role() = 'student'
  and public.is_my_class_instructor(id)
);
