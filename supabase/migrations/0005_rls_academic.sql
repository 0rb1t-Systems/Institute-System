-- =====================================================================
--  0005_rls_academic.sql
--  Helper functions (membership) + xeerarka classes/enrollments
--
--  Casharka: xeerar isku tixraacaya laba table waxay abuuraan
--  recursion. Xalka = security definer functions oo RLS ka gudba.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Membership helpers (security definer => RLS ka gudba => wareeg ma jiro)
-- ---------------------------------------------------------------------
create or replace function public.is_class_instructor(cls uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.classes
    where id = cls and instructor_id = auth.uid()
  )
$$;

create or replace function public.is_enrolled_in_class(cls uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrollments
    where class_id = cls and student_id = auth.uid()
  )
$$;


-- =====================================================================
--  classes
-- =====================================================================

-- SELECT (3 xeer, OR): staff-all / instructor-own / student-enrolled
create policy "cls_select_staff" on classes for select
using ( institution_id = public.current_institution_id()
        and public.is_admin_or_staff() );

create policy "cls_select_instructor" on classes for select
using ( institution_id = public.current_institution_id()
        and instructor_id = auth.uid() );

create policy "cls_select_student" on classes for select
using ( institution_id = public.current_institution_id()
        and public.is_enrolled_in_class(id) );

-- C/U/D: admin ama staff (Class management = V/C/E/D labada)
create policy "cls_insert" on classes for insert
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

create policy "cls_update" on classes for update
using      ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

create policy "cls_delete" on classes for delete
using ( institution_id = public.current_institution_id()
        and public.is_admin_or_staff() );


-- =====================================================================
--  enrollments
-- =====================================================================

-- SELECT (3 xeer, OR): staff-all / student-own / instructor-their-class
create policy "enr_select_staff" on enrollments for select
using ( institution_id = public.current_institution_id()
        and public.is_admin_or_staff() );

create policy "enr_select_student" on enrollments for select
using ( institution_id = public.current_institution_id()
        and student_id = auth.uid() );

create policy "enr_select_instructor" on enrollments for select
using ( institution_id = public.current_institution_id()
        and public.is_class_instructor(class_id) );

-- INSERT/UPDATE: admin ama staff (Student-to-class assignment: Staff V/C/E)
create policy "enr_insert" on enrollments for insert
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

create policy "enr_update" on enrollments for update
using      ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

-- DELETE: kaliya ADMIN (staff ma laha D diiwaangelinta)
create policy "enr_delete" on enrollments for delete
using ( institution_id = public.current_institution_id()
        and public.is_admin() );
