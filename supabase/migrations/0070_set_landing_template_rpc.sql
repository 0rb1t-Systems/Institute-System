-- Persist active landing template for the signed-in institution admin
create or replace function public.set_landing_template(
  p_template_id text,
  p_institution_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_inst uuid;
  v_tid text;
  v_row public.institutions%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select role, institution_id into v_role, v_inst
  from public.profiles
  where id = v_uid;

  if v_role is distinct from 'admin' or v_inst is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_institution_id is not null and p_institution_id is distinct from v_inst then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_tid := lower(trim(coalesce(p_template_id, '')));
  if v_tid not in (
    'classic', 'aurora', 'campus', 'horizon', 'crest',
    'nova', 'ledger', 'atelier'
  ) then
    raise exception 'INVALID_LANDING_TEMPLATE' using errcode = '22023';
  end if;

  update public.institutions
  set landing_template_id = v_tid
  where id = v_inst
  returning * into v_row;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'landing_template_id', v_row.landing_template_id,
    'theme_primary', v_row.theme_primary,
    'theme_accent', v_row.theme_accent,
    'hero_image_url', v_row.hero_image_url,
    'hero_headline', v_row.hero_headline,
    'footer_text', v_row.footer_text
  );
end;
$$;

revoke all on function public.set_landing_template(text, uuid) from public;
grant execute on function public.set_landing_template(text, uuid) to authenticated;
