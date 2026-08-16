-- =====================================================================
--  0008_rls_attendance.sql
--  Helpers (session-level) + xeerarka RLS ee class_sessions/attendance
-- =====================================================================


-- ---------------------------------------------------------------------
-- Helpers: attendance -> class_sessions -> classes traversal
-- ---------------------------------------------------------------------
create or replace function public.is_session_instructor(sess uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_sessions s
    join public.classes c on c.id = s.class_id
    where s.id = sess and c.instructor_id = auth.uid()
  )
$$;

create or replace function public.is_enrolled_in_session(sess uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.class_sessions s
    join public.enrollments e on e.class_id = s.class_id
    where s.id = sess and e.student_id = auth.uid()
  )
$$;


-- =====================================================================
--  class_sessions
--  SELECT: staff / instructor-own / student-enrolled
--  WRITE : staff ama instructor-own (DELETE = staff kaliya)
-- =====================================================================
create policy "sess_select" on class_sessions for select
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff()
        or public.is_class_instructor(class_id)
        or public.is_enrolled_in_class(class_id) )
);

create policy "sess_insert" on class_sessions for insert
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
);

create policy "sess_update" on class_sessions for update
using      ( institution_id = public.current_institution_id()
             and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) ) )
with check ( institution_id = public.current_institution_id()
             and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) ) );

create policy "sess_delete" on class_sessions for delete
using ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );


-- =====================================================================
--  attendance
--  SELECT: staff / instructor-their-session / student-OWN
--  WRITE : staff ama instructor-their-session (student MA bedeli karo!)
-- =====================================================================
create policy "att_select" on attendance for select
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff()
        or public.is_session_instructor(session_id)
        or student_id = auth.uid() )
);

create policy "att_insert" on attendance for insert
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_session_instructor(session_id) )
);

create policy "att_update" on attendance for update
using      ( institution_id = public.current_institution_id()
             and ( public.is_admin_or_staff() or public.is_session_instructor(session_id) ) )
with check ( institution_id = public.current_institution_id()
             and ( public.is_admin_or_staff() or public.is_session_instructor(session_id) ) );

create policy "att_delete" on attendance for delete
using ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );
