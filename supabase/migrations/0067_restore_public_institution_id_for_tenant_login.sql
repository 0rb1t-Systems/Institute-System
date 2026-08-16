-- ---------------------------------------------------------------------
-- Restore public institution id for tenant-scoped portal login gating.
-- Without id, requiredInstitutionId is never set and cross-tenant
-- sign-in on /?tenant=slug is silently allowed.
-- id is needed only for client-side auth comparison; no private fields.
-- ---------------------------------------------------------------------
create or replace function public.get_public_institution(p_subdomain text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row institutions%rowtype;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then
    return null;
  end if;

  select * into v_row
  from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain))
    and coalesce(status, 'active') = 'active'
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'subdomain', v_row.subdomain,
    'logo_url', v_row.logo_url,
    'description', v_row.description,
    'email', v_row.email,
    'phone', v_row.phone,
    'address', v_row.address,
    'website', v_row.website,
    'motto', v_row.motto,
    'theme_primary', v_row.theme_primary,
    'theme_accent', v_row.theme_accent
  );
end;
$$;

revoke all on function public.get_public_institution(text) from public;
grant execute on function public.get_public_institution(text) to anon, authenticated, service_role;
