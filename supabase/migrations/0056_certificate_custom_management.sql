-- =====================================================================
--  0056_certificate_custom_management.sql
--  Private certificate template uploads + logo-builder config support.
--  Extends existing document_templates; does not replace the library.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Private storage for institution-owned certificate templates
-- Path convention: {institution_id}/{uuid}.{ext}
-- NEVER public — signed/authenticated access only within tenant.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificate-templates',
  'certificate-templates',
  false,
  10485760, -- 10 MB
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

drop policy if exists "cert_tpl_select_tenant" on storage.objects;
create policy "cert_tpl_select_tenant"
  on storage.objects for select
  using (
    bucket_id = 'certificate-templates'
    and auth.uid() is not null
    and public.current_institution_id() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "cert_tpl_insert_admin" on storage.objects;
create policy "cert_tpl_insert_admin"
  on storage.objects for insert
  with check (
    bucket_id = 'certificate-templates'
    and public.is_admin()
    and public.current_institution_id() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "cert_tpl_update_admin" on storage.objects;
create policy "cert_tpl_update_admin"
  on storage.objects for update
  using (
    bucket_id = 'certificate-templates'
    and public.is_admin()
    and public.current_institution_id() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  )
  with check (
    bucket_id = 'certificate-templates'
    and public.is_admin()
    and public.current_institution_id() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "cert_tpl_delete_admin" on storage.objects;
create policy "cert_tpl_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'certificate-templates'
    and public.is_admin()
    and public.current_institution_id() is not null
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

-- ---------------------------------------------------------------------
-- Allow custom layout keys on active certificate template selection
-- ---------------------------------------------------------------------
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
    'luxury','academic','formal','contemporary','heritage','default',
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
    raise exception 'INVALID_CERTIFICATE_LAYOUT';
  end if;
  if v_key = 'default' then
    v_key := 'classic';
  end if;

  -- Require payload before activating custom modes
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
        and jsonb_typeof(t.config->'logo_builder'->'elements') = 'array'
        and jsonb_array_length(t.config->'logo_builder'->'elements') > 0
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

-- ---------------------------------------------------------------------
-- Save logo-builder design (server resolves institution_id)
-- ---------------------------------------------------------------------
create or replace function public.save_certificate_logo_builder(p_design jsonb, p_activate boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
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

revoke all on function public.save_certificate_logo_builder(jsonb, boolean) from public, anon;
grant execute on function public.save_certificate_logo_builder(jsonb, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Register uploaded certificate template (path must belong to caller tenant)
-- ---------------------------------------------------------------------
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
declare
  v_inst uuid;
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

  -- Confirm object exists in private bucket for this tenant
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
    'file_name', left(trim(coalesce(p_file_name, 'certificate-template')), 180),
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

revoke all on function public.save_certificate_custom_upload(text, text, text, text, boolean) from public, anon;
grant execute on function public.save_certificate_custom_upload(text, text, text, text, boolean) to authenticated, service_role;

comment on function public.save_certificate_logo_builder(jsonb, boolean) is
  'Persists logo/page builder JSON on document_templates.config for the caller institution only.';
comment on function public.save_certificate_custom_upload(text, text, text, text, boolean) is
  'Registers a private certificate-templates object for the caller institution only.';
