-- =====================================================================
--  0013_provisioning.sql
--  provision_tenant() — abuur xarun cusub + admin-keeda (habka saxda ah)
--
--  AMAAN: function-kani RLS ka gudbaa & tenants abuuraa. Marka waa
--  inaan ka celinaa (revoke) isticmaalayaasha caadiga. Kaliya server
--  (SQL Editor / Edge Function service_role) ayaa waci kara.
-- =====================================================================

create or replace function public.provision_tenant(
  p_name        text,
  p_subdomain   text,
  p_admin_email text,
  p_admin_name  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_institution_id uuid;
  v_admin_uid      uuid;
  v_admin_email    text;
begin
  -- 1) Hel admin user-ka (case-insensitive — Supabase emails-ka wuu hoos u dhigaa)
  select id, email into v_admin_uid, v_admin_email
  from auth.users
  where lower(email) = lower(p_admin_email);

  if v_admin_uid is null then
    raise exception 'User email (%) lama helin. Marka hore dashboard ku abuur (Authentication).', p_admin_email;
  end if;

  -- 2) Abuur xarunta
  insert into institutions (name, subdomain)
  values (p_name, p_subdomain)
  returning id into v_institution_id;

  -- 3) Isku xir admin profile-ka (email-ka dhabta ah ee auth.users)
  insert into profiles (id, institution_id, role, status, full_name, email)
  values (v_admin_uid, v_institution_id, 'admin', 'approved', p_admin_name, v_admin_email);

  return v_institution_id;
end;
$$;

-- 🔒 XIR: cidna ha wacin marka laga reebo server-ka
revoke execute on function public.provision_tenant(text, text, text, text)
  from public, anon, authenticated;
