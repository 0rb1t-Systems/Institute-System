-- =====================================================================
--  0002_rls_helpers.sql
--  Helper functions — xeerarka RLS ayaa isticmaali doona kuwan.
--
--  Ujeeddo: naga soo qaad institution_id iyo role-ka isticmaalaha
--  galay (logged-in user), si xeerarka RLS ay u isticmaali karaan.
-- =====================================================================


-- ---------------------------------------------------------------------
-- current_institution_id()
-- Soo celi institution_id (tenant) ee isticmaalaha hadda galay.
-- ---------------------------------------------------------------------
create or replace function public.current_institution_id()
returns uuid
language sql
stable
security definer          -- fiiri sharraxaadda hoose (aad muhiim u ah)
set search_path = public
as $$
  select institution_id
  from public.profiles
  where id = auth.uid()
$$;


-- ---------------------------------------------------------------------
-- current_user_role()
-- Soo celi role-ka (admin/staff/instructor/student) ee isticmaalaha.
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;


-- ---------------------------------------------------------------------
-- is_admin() / is_staff() — jajab si xeerarku u akhris fudud yihiin
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin'
$$;

create or replace function public.is_admin_or_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'staff')
$$;
