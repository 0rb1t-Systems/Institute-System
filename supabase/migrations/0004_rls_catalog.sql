-- =====================================================================
--  0004_rls_catalog.sql
--  Xeerarka RLS — courses + diplomas
--
--  QAABKA GUUD (template) ee "tenant-scoped table":
--    SELECT  = qof kasta xarunta ku jira
--    C/U/D   = admin ama staff
--  Qaabkan ayaad ku dabaqi doontaa tables badan oo mustaqbalka.
-- =====================================================================


-- =====================================================================
--  diplomas
-- =====================================================================
create policy "dip_select"
on diplomas for select
using ( institution_id = public.current_institution_id() );

create policy "dip_insert"
on diplomas for insert
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

create policy "dip_update"
on diplomas for update
using      ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

create policy "dip_delete"
on diplomas for delete
using ( institution_id = public.current_institution_id()
        and public.is_admin_or_staff() );


-- =====================================================================
--  courses  (isla qaabkii diplomas)
-- =====================================================================
create policy "crs_select"
on courses for select
using ( institution_id = public.current_institution_id() );

create policy "crs_insert"
on courses for insert
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

create policy "crs_update"
on courses for update
using      ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

create policy "crs_delete"
on courses for delete
using ( institution_id = public.current_institution_id()
        and public.is_admin_or_staff() );
