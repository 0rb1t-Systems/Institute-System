-- =====================================================================
--  0087_certificate_library_landscape_layouts.sql
--  Allow additional built-in certificate library keys (landscape + framed).
-- =====================================================================

create or replace function public.set_active_certificate_template(p_layout_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_key text;
  v_row public.document_templates%rowtype;
  v_allowed text[] := array[
    'modern','classic','premium','elegant','minimal',
    'luxury','academic','formal','contemporary','heritage',
    'appreciation','ornate','medallion','horizon','laurel','regal',
    'default','custom_upload','logo_builder'
  ];
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  v_inst := public.current_institution_id();
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  v_key := lower(trim(coalesce(p_layout_key, '')));
  if v_key = '' or not (v_key = any (v_allowed)) then
    raise exception 'INVALID_CERTIFICATE_LAYOUT';
  end if;
  if v_key = 'default' then
    v_key := 'classic';
  end if;

  if v_key = 'custom_upload' then
    perform public.ensure_document_templates(v_inst);
    if not exists (
      select 1
      from public.document_templates t
      where t.institution_id = v_inst
        and t.document_type = 'certificate'
        and nullif(trim(coalesce(t.config->'custom_upload'->>'storage_path', '')), '') is not null
    ) then
      raise exception 'CUSTOM_UPLOAD_MISSING';
    end if;
  end if;

  if v_key = 'logo_builder' then
    perform public.ensure_document_templates(v_inst);
    if not exists (
      select 1
      from public.document_templates t
      where t.institution_id = v_inst
        and t.document_type = 'certificate'
        and t.config ? 'logo_builder'
        and jsonb_typeof(t.config->'logo_builder') = 'object'
    ) then
      raise exception 'LOGO_BUILDER_EMPTY';
    end if;
  end if;

  perform public.ensure_document_templates(v_inst);

  update public.document_templates
  set
    layout_key = v_key,
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object('library', 'certificate', 'updated_via', 'set_active_certificate_template'),
    updated_at = now()
  where institution_id = v_inst
    and document_type = 'certificate'
  returning * into v_row;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'institution_id', v_row.institution_id,
    'document_type', v_row.document_type,
    'layout_key', v_row.layout_key,
    'config', v_row.config,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.set_active_certificate_template(text) from public, anon;
grant execute on function public.set_active_certificate_template(text) to authenticated, service_role;
