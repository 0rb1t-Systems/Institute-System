-- =====================================================================
--  0003_rls_foundation.sql
--  Xeerarka RLS — institutions + profiles
--
--  QAANUUN: xeer kastaa wuxuu ku bilaabmayaa institution_id check
--  (tenant isolation), kadibna doorka (role).
-- =====================================================================


-- =====================================================================
--  institutions
-- =====================================================================

-- SELECT: isticmaaluhu wuxuu arki karaa KELIYA xaruntiisa
create policy "inst_select_own"
on institutions for select
using ( id = public.current_institution_id() );

-- UPDATE: kaliya ADMIN ayaa bedeli kara xaruntiisa (branding/settings)
create policy "inst_update_admin"
on institutions for update
using      ( id = public.current_institution_id() and public.is_admin() )
with check ( id = public.current_institution_id() and public.is_admin() );

-- MAY: INSERT / DELETE xeer uma qorno.
-- Sababta: abuuritaanka xarun cusub (provisioning) waxaa sameeya
-- server-ka (Edge Function + service_role) oo RLS ka gudba.
-- Isticmaale caadi ah MA abuuri karo/tirtiri karo xarun.


-- =====================================================================
--  profiles
-- =====================================================================

-- SELECT (1): qof kastaa wuxuu arki karaa profile-KIISA
create policy "prof_select_own"
on profiles for select
using ( id = auth.uid() );

-- SELECT (2): admin/staff waxay arkaan dhammaan profiles xaruntooda
-- (Xeerarka SELECT waxaa lagu daraa OR — mid haddii run tahay waa la arkaa)
create policy "prof_select_staff"
on profiles for select
using ( institution_id = public.current_institution_id()
        and public.is_admin_or_staff() );

-- INSERT: admin/staff waxay abuuraan profiles xaruntooda gudaheed
create policy "prof_insert_staff"
on profiles for insert
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

-- UPDATE: admin/staff waxay bedelaan profiles xaruntooda
create policy "prof_update_staff"
on profiles for update
using      ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

-- DELETE: kaliya ADMIN (staff/instructor account management = Admin only)
create policy "prof_delete_admin"
on profiles for delete
using ( institution_id = public.current_institution_id()
        and public.is_admin() );

-- OGSOONOW: "self-service" (isticmaaluhu inuu profile-kiisa wax ka bedelo)
-- weli kuma darin. Sababta: haddii aan si fudud u ogolaanno, isticmaaluhu
-- wuxuu iska bedeli karaa role-kiisa oo 'admin' iska dhigi karaa (khatar!).
-- Waxaan ku dari doonaa TALLAABO DAMBE oo leh trigger ilaaliya columns-ka
-- role/institution_id. Kani waa casharka amaan ee "column protection".
