-- =====================================================================
--  0015_instructor_sees_students.sql
--  Bug fix: instructor-ku waa inuu arko profiles-ka ardayda FASALADIISA
--  (attendance/grading awgeed). Hore, prof_select = own + admin/staff kaliya.
-- =====================================================================

-- Helper: ardaygan ma ku qoran yahay fasal uu macalinku dhigo?
create or replace function public.is_my_student(student uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = student and c.instructor_id = auth.uid()
  )
$$;

-- Xeer: instructor wuxuu arki karaa profiles-ka ardayda fasaladiisa
create policy "prof_select_instructor_students"
on profiles for select
using ( institution_id = public.current_institution_id()
        and public.is_my_student(id) );
