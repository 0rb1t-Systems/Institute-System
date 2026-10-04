-- Custom domain (apex + www) for institutions.
-- Mutations go through manage-custom-domain edge function (service role).
-- Public RPCs never expose verification tokens.

alter table public.institutions
  add column if not exists custom_domain text,
  add column if not exists custom_domain_www boolean not null default true,
  add column if not exists custom_domain_status text not null default 'none',
  add column if not exists custom_domain_verification_token text,
  add column if not exists custom_domain_verified_at timestamptz,
  add column if not exists custom_domain_error text,
  add column if not exists custom_domain_last_check_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'institutions_custom_domain_status_check'
  ) then
    alter table public.institutions
      add constraint institutions_custom_domain_status_check
      check (custom_domain_status in ('none', 'pending', 'active', 'error'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'institutions_custom_domain_format_check'
  ) then
    alter table public.institutions
      add constraint institutions_custom_domain_format_check
      check (
        custom_domain is null
        or custom_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
      );
  end if;
end $$;

create unique index if not exists institutions_custom_domain_unique_idx
  on public.institutions (custom_domain)
  where custom_domain is not null;

comment on column public.institutions.custom_domain is
  'Normalized apex hostname (no www/protocol). Active when custom_domain_status = active.';

-- Shared public payload builder (includes custom_domain only when active).
create or replace function public.public_institution_json(v_row public.institutions)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
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
    'landing_content', public.sanitize_landing_content(v_row.landing_content),
    'social_whatsapp', v_row.social_whatsapp,
    'social_facebook', v_row.social_facebook,
    'social_tiktok', v_row.social_tiktok,
    'student_id_prefix', v_row.student_id_prefix,
    'student_id_start', v_row.student_id_start,
    'student_id_pad', v_row.student_id_pad,
    'custom_domain', case
      when v_row.custom_domain_status = 'active' then v_row.custom_domain
      else null
    end,
    'custom_domain_status', case
      when v_row.custom_domain_status = 'active' then 'active'
      else null
    end
  );
$$;

revoke all on function public.public_institution_json(public.institutions) from public;
grant execute on function public.public_institution_json(public.institutions) to anon, authenticated, service_role;

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

  return public.public_institution_json(v_row);
end;
$$;

revoke all on function public.get_public_institution(text) from public;
grant execute on function public.get_public_institution(text) to anon, authenticated, service_role;

-- Resolve institution by verified custom host (apex or www).
create or replace function public.get_public_institution_by_host(p_host text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host text;
  v_apex text;
  v_row institutions%rowtype;
begin
  v_host := lower(trim(coalesce(p_host, '')));
  -- strip port if present
  if position(':' in v_host) > 0 then
    v_host := split_part(v_host, ':', 1);
  end if;
  if v_host is null or length(v_host) < 3 then
    return null;
  end if;

  if v_host like 'www.%' then
    v_apex := substring(v_host from 5);
  else
    v_apex := v_host;
  end if;

  select * into v_row
  from public.institutions
  where custom_domain_status = 'active'
    and custom_domain is not null
    and (
      custom_domain = v_apex
      or custom_domain = v_host
      or (custom_domain_www = true and ('www.' || custom_domain) = v_host)
    )
    and coalesce(status, 'active') = 'active'
  limit 1;

  if not found then
    return null;
  end if;

  return public.public_institution_json(v_row);
end;
$$;

revoke all on function public.get_public_institution_by_host(text) from public;
grant execute on function public.get_public_institution_by_host(text) to anon, authenticated, service_role;
