-- =====================================================================
--  0059_document_builder_upload_parity.sql
--  Transcript + invoice: logo_builder / custom_upload parity with certificates.
-- =====================================================================

-- Active transcript layout: library keys + custom modes
create or replace function public.set_active_transcript_template(p_layout_key text)
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
    'classic','modern','academic','formal','minimal',
    'institutional','compact','bordered','default',
    'custom_upload','logo_builder'
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
    raise exception 'INVALID_TRANSCRIPT_LAYOUT';
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
        and t.document_type = 'transcript'
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
        and t.document_type = 'transcript'
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
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object('library', 'transcript', 'updated_via', 'set_active_transcript_template'),
    updated_at = now()
  where institution_id = v_inst
    and document_type = 'transcript'
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

-- Active invoice layout: library keys + custom modes
create or replace function public.set_active_invoice_template(p_layout_key text)
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
    'classic','modern','stripe','formal','minimal',
    'statement','branded','bordered','default',
    'custom_upload','logo_builder'
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
    raise exception 'INVALID_INVOICE_LAYOUT';
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
        and t.document_type = 'invoice'
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
        and t.document_type = 'invoice'
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
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'library', 'invoice',
      'updated_via', 'set_active_invoice_template',
      'show_logo', coalesce((config->>'show_logo')::boolean, true),
      'show_contact', coalesce((config->>'show_contact')::boolean, true)
    ),
    updated_at = now()
  where institution_id = v_inst
    and document_type = 'invoice'
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

-- Generic logo builder save for certificate | transcript | invoice
create or replace function public.save_document_logo_builder(
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
  if jsonb_array_length(v_elements) > 80 then
    raise exception 'DESIGN_TOO_LARGE';
  end if;

  v_design := jsonb_build_object(
    'version', 1,
    'canvas', coalesce(p_design->'canvas', jsonb_build_object('width', 794, 'height', 1123)),
    'elements', v_elements,
    'updated_at', now()
  );

  perform public.ensure_document_templates(v_inst);

  update public.document_templates
  set
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object('logo_builder', v_design),
    layout_key = case when p_activate then 'logo_builder' else layout_key end,
    updated_at = now()
  where institution_id = v_inst
    and document_type = v_type
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

-- Generic custom upload register for certificate | transcript | invoice
create or replace function public.save_document_custom_upload(
  p_document_type text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_preview_path text default null,
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
  v_path text;
  v_preview text;
  v_mime text;
  v_prefix text;
  v_meta jsonb;
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

  v_path := trim(coalesce(p_storage_path, ''));
  v_preview := nullif(trim(coalesce(p_preview_path, '')), '');
  v_mime := lower(trim(coalesce(p_mime_type, '')));
  v_prefix := v_inst::text || '/';

  if v_path = '' or position('..' in v_path) > 0 or left(v_path, length(v_prefix)) <> v_prefix then
    raise exception 'INVALID_STORAGE_PATH';
  end if;

  if v_preview is not null and (position('..' in v_preview) > 0 or left(v_preview, length(v_prefix)) <> v_prefix) then
    raise exception 'INVALID_STORAGE_PATH';
  end if;

  if v_mime not in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf') then
    raise exception 'INVALID_FILE_TYPE';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'certificate-templates'
      and o.name = v_path
  ) then
    raise exception 'UPLOAD_NOT_FOUND';
  end if;

  v_meta := jsonb_build_object(
    'storage_path', v_path,
    'preview_path', v_preview,
    'file_name', left(trim(coalesce(p_file_name, v_type || '-template')), 180),
    'mime_type', v_mime,
    'uploaded_at', now()
  );

  perform public.ensure_document_templates(v_inst);

  update public.document_templates
  set
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object('custom_upload', v_meta),
    layout_key = case when p_activate then 'custom_upload' else layout_key end,
    updated_at = now()
  where institution_id = v_inst
    and document_type = v_type
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

-- Keep certificate-specific RPCs as thin wrappers (backward compatible)
create or replace function public.save_certificate_logo_builder(p_design jsonb, p_activate boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.save_document_logo_builder('certificate', p_design, p_activate);
end;
$$;

create or replace function public.save_certificate_custom_upload(
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_preview_path text default null,
  p_activate boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.save_document_custom_upload(
    'certificate', p_storage_path, p_file_name, p_mime_type, p_preview_path, p_activate
  );
end;
$$;

revoke all on function public.save_document_logo_builder(text, jsonb, boolean) from public, anon;
grant execute on function public.save_document_logo_builder(text, jsonb, boolean) to authenticated, service_role;

revoke all on function public.save_document_custom_upload(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.save_document_custom_upload(text, text, text, text, text, boolean) to authenticated, service_role;

revoke all on function public.set_active_transcript_template(text) from public, anon;
grant execute on function public.set_active_transcript_template(text) to authenticated, service_role;

revoke all on function public.set_active_invoice_template(text) from public, anon;
grant execute on function public.set_active_invoice_template(text) to authenticated, service_role;

revoke all on function public.save_certificate_logo_builder(jsonb, boolean) from public, anon;
grant execute on function public.save_certificate_logo_builder(jsonb, boolean) to authenticated, service_role;

revoke all on function public.save_certificate_custom_upload(text, text, text, text, boolean) from public, anon;
grant execute on function public.save_certificate_custom_upload(text, text, text, text, boolean) to authenticated, service_role;
