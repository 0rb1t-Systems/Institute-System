-- Optional third brand color extracted from the institution logo.

alter table public.institutions
  add column if not exists theme_tertiary text;

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
    'theme_accent', v_row.theme_accent,
    'theme_tertiary', v_row.theme_tertiary,
    'landing_template_id', coalesce(v_row.landing_template_id, 'classic'),
    'hero_image_url', v_row.hero_image_url,
    'hero_headline', v_row.hero_headline,
    'footer_text', v_row.footer_text,
    'landing_content', public.sanitize_landing_content(v_row.landing_content)
  );
end;
$$;

revoke all on function public.get_public_institution(text) from public;
grant execute on function public.get_public_institution(text) to anon, authenticated, service_role;
