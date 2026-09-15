-- Keep Page Builder (logo_builder) and Upload Own designs independent.
-- Upload editable clones live under config.custom_upload.design;
-- Page Builder keeps exclusive use of config.logo_builder.

-- Backfill only Upload-origin designs (have upload-paper marker) into custom_upload.design.
-- Do not copy plain Page Builder canvases onto leftover upload files.
update public.document_templates
set
  config = jsonb_set(
    coalesce(config, '{}'::jsonb),
    '{custom_upload,design}',
    config->'logo_builder',
    true
  ),
  updated_at = now()
where config ? 'logo_builder'
  and jsonb_typeof(config->'logo_builder') = 'object'
  and config ? 'custom_upload'
  and jsonb_typeof(config->'custom_upload') = 'object'
  and nullif(trim(coalesce(config->'custom_upload'->>'storage_path', '')), '') is not null
  and (
    not (config->'custom_upload' ? 'design')
    or jsonb_typeof(config->'custom_upload'->'design') <> 'object'
  )
  and exists (
    select 1
    from jsonb_array_elements(coalesce(config->'logo_builder'->'elements', '[]'::jsonb)) el
    where coalesce(el->>'text', '') in ('__upload_paper__', 'background-art')
  );

create or replace function public.save_document_upload_builder(
  p_document_type text,
  p_design jsonb,
  p_activate boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_type text;
  v_row public.document_templates%rowtype;
  v_design jsonb;
  v_elements jsonb;
  v_upload jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  v_inst := public.current_institution_id();
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  v_type := lower(trim(coalesce(p_document_type, '')));
  if v_type not in ('certificate', 'transcript', 'invoice') then
    raise exception 'INVALID_DOCUMENT_TYPE';
  end if;

  if p_design is null or jsonb_typeof(p_design) <> 'object' then
    raise exception 'INVALID_DESIGN';
  end if;

  v_elements := coalesce(p_design->'elements', '[]'::jsonb);
  if jsonb_typeof(v_elements) <> 'array' then
    raise exception 'INVALID_DESIGN';
  end if;
  if jsonb_array_length(v_elements) > 180 then
    raise exception 'DESIGN_TOO_LARGE';
  end if;

  perform public.ensure_document_templates(v_inst);

  select * into v_row
  from public.document_templates
  where institution_id = v_inst
    and document_type = v_type
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  v_upload := coalesce(v_row.config->'custom_upload', '{}'::jsonb);
  if jsonb_typeof(v_upload) <> 'object' then
    v_upload := '{}'::jsonb;
  end if;

  if nullif(trim(coalesce(v_upload->>'storage_path', '')), '') is null then
    raise exception 'CERT_TEMPLATE_NOT_FOUND';
  end if;

  v_design := jsonb_build_object(
    'version', 1,
    'canvas', coalesce(p_design->'canvas', jsonb_build_object('width', 794, 'height', 1123)),
    'elements', v_elements,
    'updated_at', now()
  );

  v_upload := v_upload || jsonb_build_object('design', v_design);

  update public.document_templates
  set
    -- Never touch logo_builder — Page Builder stays independent
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object('custom_upload', v_upload),
    layout_key = case when coalesce(p_activate, true) then 'custom_upload' else layout_key end,
    updated_at = now()
  where institution_id = v_inst
    and document_type = v_type
  returning * into v_row;

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

revoke all on function public.save_document_upload_builder(text, jsonb, boolean) from public, anon;
grant execute on function public.save_document_upload_builder(text, jsonb, boolean) to authenticated, service_role;

comment on function public.save_document_upload_builder(text, jsonb, boolean) is
  'Save Upload Own generated/editable design under custom_upload.design without modifying logo_builder.';
