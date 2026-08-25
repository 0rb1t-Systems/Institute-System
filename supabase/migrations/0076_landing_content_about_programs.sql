-- Custom About / Programs copy for tenant landing pages.
-- Stored as JSON; sanitized to plain text only (no HTML).

alter table public.institutions
  add column if not exists landing_content jsonb not null default '{}'::jsonb;

create or replace function public.sanitize_plain_text(p_value text, p_max int)
returns text
language plpgsql
immutable
as $$
declare
  v text := coalesce(p_value, '');
begin
  v := regexp_replace(v, '<[^>]*>', ' ', 'g');
  v := regexp_replace(v, '[[:cntrl:]]', '', 'g');
  v := regexp_replace(v, '\s+', ' ', 'g');
  v := trim(v);
  if char_length(v) > p_max then
    v := left(v, p_max);
  end if;
  return v;
end;
$$;

create or replace function public.sanitize_landing_content(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v jsonb := coalesce(p, '{}'::jsonb);
  v_highlights jsonb := '[]'::jsonb;
  v_programs jsonb := '[]'::jsonb;
  v_item jsonb;
  v_title text;
  v_desc text;
  i int;
begin
  if jsonb_typeof(v) is distinct from 'object' then
    v := '{}'::jsonb;
  end if;

  if jsonb_typeof(v->'about_highlights') = 'array' then
    for i in 0 .. least(jsonb_array_length(v->'about_highlights') - 1, 3) loop
      v_title := public.sanitize_plain_text(v->'about_highlights'->>i, 90);
      if v_title <> '' then
        v_highlights := v_highlights || jsonb_build_array(v_title);
      end if;
    end loop;
  end if;

  if jsonb_typeof(v->'programs') = 'array' then
    for i in 0 .. least(jsonb_array_length(v->'programs') - 1, 7) loop
      v_item := v->'programs'->i;
      if jsonb_typeof(v_item) is distinct from 'object' then
        continue;
      end if;
      v_title := public.sanitize_plain_text(v_item->>'title', 80);
      v_desc := public.sanitize_plain_text(v_item->>'description', 280);
      if v_title <> '' or v_desc <> '' then
        v_programs := v_programs || jsonb_build_array(
          jsonb_build_object('title', v_title, 'description', v_desc)
        );
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'about_title', public.sanitize_plain_text(v->>'about_title', 80),
    'about_body', public.sanitize_plain_text(v->>'about_body', 4000),
    'about_highlights', v_highlights,
    'programs_intro', public.sanitize_plain_text(v->>'programs_intro', 400),
    'programs', v_programs
  );
end;
$$;

create or replace function public.institutions_sanitize_landing_content()
returns trigger
language plpgsql
as $$
begin
  new.landing_content := public.sanitize_landing_content(new.landing_content);
  return new;
end;
$$;

drop trigger if exists trg_institutions_sanitize_landing_content on public.institutions;
create trigger trg_institutions_sanitize_landing_content
before insert or update of landing_content on public.institutions
for each row
execute function public.institutions_sanitize_landing_content();

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

revoke all on function public.sanitize_landing_content(jsonb) from public;
grant execute on function public.sanitize_landing_content(jsonb) to authenticated;
