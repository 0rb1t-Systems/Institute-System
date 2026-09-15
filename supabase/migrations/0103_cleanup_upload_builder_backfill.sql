-- Drop non-upload custom_upload.design values accidentally backfilled from Page Builder.
update public.document_templates
set
  config = jsonb_set(
    config,
    '{custom_upload}',
    (config->'custom_upload') - 'design',
    true
  ),
  updated_at = now()
where config ? 'custom_upload'
  and jsonb_typeof(config->'custom_upload') = 'object'
  and config->'custom_upload' ? 'design'
  and jsonb_typeof(config->'custom_upload'->'design') = 'object'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(config->'custom_upload'->'design'->'elements', '[]'::jsonb)) el
    where coalesce(el->>'text', '') in ('__upload_paper__', 'background-art')
  );
