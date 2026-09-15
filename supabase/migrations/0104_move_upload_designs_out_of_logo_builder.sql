-- Move Upload-origin designs out of logo_builder into custom_upload.design
-- so Page Builder no longer shows uploaded certificate clones.

-- 1) Ensure upload-origin logo_builder is also under custom_upload.design
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
  and exists (
    select 1
    from jsonb_array_elements(coalesce(config->'logo_builder'->'elements', '[]'::jsonb)) el
    where coalesce(el->>'text', '') in ('__upload_paper__', 'background-art')
  )
  and (
    not (config->'custom_upload' ? 'design')
    or jsonb_typeof(config->'custom_upload'->'design') <> 'object'
    or config->'custom_upload'->'design' = config->'logo_builder'
  );

-- 2) Clear logo_builder when it is an Upload-origin design
update public.document_templates
set
  config = config - 'logo_builder',
  layout_key = case
    when layout_key = 'logo_builder'
      and nullif(trim(coalesce(config->'custom_upload'->>'storage_path', '')), '') is not null
    then 'custom_upload'
    else layout_key
  end,
  updated_at = now()
where config ? 'logo_builder'
  and jsonb_typeof(config->'logo_builder') = 'object'
  and exists (
    select 1
    from jsonb_array_elements(coalesce(config->'logo_builder'->'elements', '[]'::jsonb)) el
    where coalesce(el->>'text', '') in ('__upload_paper__', 'background-art')
  );
