-- When an imported certificate is saved, also publish it as the institution's
-- live certificate template (custom_upload.design + layout_key custom_upload).
-- Page Builder (logo_builder) is never modified.
-- Report Center / certificate generation then use this template for students.

create or replace function public.assert_imported_certificate_design(p_design jsonb)
returns void
language plpgsql
immutable
as $$
declare
  el jsonb;
  v_w numeric;
  v_h numeric;
  v_cw numeric;
  v_ch numeric;
  v_count int;
  v_src text;
  v_text text;
begin
  if p_design is null or jsonb_typeof(p_design) <> 'object' then
    raise exception 'INVALID_DESIGN';
  end if;
  if jsonb_typeof(p_design->'elements') <> 'array' then
    raise exception 'INVALID_DESIGN';
  end if;
  v_count := jsonb_array_length(p_design->'elements');
  if v_count < 1 or v_count > 180 then
    raise exception 'INVALID_DESIGN';
  end if;
  if octet_length(p_design::text) > 400000 then
    raise exception 'DESIGN_TOO_LARGE';
  end if;
  v_cw := greatest(1, coalesce((p_design #>> '{canvas,width}')::numeric, 794));
  v_ch := greatest(1, coalesce((p_design #>> '{canvas,height}')::numeric, 1123));
  for el in select value from jsonb_array_elements(p_design->'elements')
  loop
    v_text := coalesce(el->>'text', '');
    if v_text in ('__upload_paper__', 'background-art') then
      raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
    end if;
    v_w := case
      when coalesce(el->>'width', '') ~ '^[0-9]+(\.[0-9]+)?$' then (el->>'width')::numeric
      else 0
    end;
    v_h := case
      when coalesce(el->>'height', '') ~ '^[0-9]+(\.[0-9]+)?$' then (el->>'height')::numeric
      else 0
    end;
    if coalesce(el->>'type', '') = 'image' and v_w > v_cw * 0.85 and v_h > v_ch * 0.85 then
      raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
    end if;
    v_src := coalesce(el->>'src', '');
    -- Allow private storage paths and public https logos/seals. Reject ephemeral blob/data.
    if v_src like 'blob:%' or v_src like 'data:%' then
      raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
    end if;
    if length(v_src) > 2500 then
      raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
    end if;
  end loop;
exception
  when invalid_text_representation then
    raise exception 'INVALID_DESIGN';
end;
$$;

create or replace function public.save_imported_certificate_template(
  p_name text,
  p_source_file_name text,
  p_source_kind text,
  p_design jsonb,
  p_analysis jsonb default '{}'::jsonb,
  p_warnings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_row public.imported_certificate_templates%rowtype;
  v_doc public.document_templates%rowtype;
  v_name text;
  v_kind text;
  v_analysis jsonb;
  v_count int;
  v_upload jsonb;
  v_design jsonb;
  v_cw numeric;
  v_ch numeric;
  v_aspect numeric;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_inst := public.current_institution_id();
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  v_name := left(trim(coalesce(p_name, '')), 120);
  if v_name = '' then
    v_name := 'Imported certificate';
  end if;
  v_kind := lower(trim(coalesce(p_source_kind, '')));
  if v_kind not in ('pdf', 'docx') then
    raise exception 'UNSUPPORTED_TYPE';
  end if;

  perform public.assert_imported_certificate_design(p_design);

  select count(*) into v_count
  from public.imported_certificate_templates
  where institution_id = v_inst;
  if v_count >= 40 then
    raise exception 'IMPORT_LIMIT';
  end if;

  v_analysis := jsonb_build_object(
    'sourceKind', coalesce(coalesce(p_analysis, '{}'::jsonb)->>'sourceKind', v_kind),
    'scanned', case when coalesce(p_analysis, '{}'::jsonb)->>'scanned' = 'true' then true else false end,
    'pageCount', coalesce(nullif(coalesce(p_analysis, '{}'::jsonb)->>'pageCount', '')::int, 1),
    'page', coalesce(coalesce(p_analysis, '{}'::jsonb)->'page', '{}'::jsonb),
    'colors', coalesce(coalesce(p_analysis, '{}'::jsonb)->'colors', '{}'::jsonb),
    'counts', coalesce(coalesce(p_analysis, '{}'::jsonb)->'counts', '{}'::jsonb)
  );

  insert into public.imported_certificate_templates (
    institution_id,
    name,
    source_file_name,
    source_kind,
    design,
    analysis,
    warnings,
    created_by
  ) values (
    v_inst,
    v_name,
    left(trim(coalesce(p_source_file_name, '')), 180),
    v_kind,
    p_design,
    v_analysis,
    case when jsonb_typeof(p_warnings) = 'array' then p_warnings else '[]'::jsonb end,
    auth.uid()
  )
  returning * into v_row;

  -- Publish as live institution certificate (does not touch logo_builder).
  perform public.ensure_document_templates(v_inst);

  select * into v_doc
  from public.document_templates
  where institution_id = v_inst
    and document_type = 'certificate'
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  v_cw := greatest(1, coalesce((p_design #>> '{canvas,width}')::numeric, 794));
  v_ch := greatest(1, coalesce((p_design #>> '{canvas,height}')::numeric, 1123));
  v_aspect := round((v_cw / v_ch)::numeric, 6);

  v_upload := coalesce(v_doc.config->'custom_upload', '{}'::jsonb);
  if jsonb_typeof(v_upload) <> 'object' then
    v_upload := '{}'::jsonb;
  end if;

  if nullif(trim(coalesce(v_upload->>'storage_path', '')), '') is null then
    v_upload := v_upload || jsonb_build_object(
      'storage_path', v_inst::text || '/imported-template',
      'file_name', left(trim(coalesce(p_source_file_name, v_name)), 180),
      'mime_type', case when v_kind = 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' else 'application/pdf' end,
      'uploaded_at', now()
    );
  end if;

  v_design := jsonb_build_object(
    'version', 1,
    'canvas', coalesce(p_design->'canvas', jsonb_build_object('width', v_cw, 'height', v_ch)),
    'elements', coalesce(p_design->'elements', '[]'::jsonb),
    'updated_at', now()
  );

  v_upload := v_upload || jsonb_build_object(
    'design', v_design,
    'aspect_ratio', v_aspect,
    'source', 'certificate_import',
    'imported_template_id', v_row.id,
    'imported_name', v_name
  );

  update public.document_templates
  set
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object('custom_upload', v_upload),
    layout_key = 'custom_upload',
    updated_at = now()
  where institution_id = v_inst
    and document_type = 'certificate'
  returning * into v_doc;

  return jsonb_build_object(
    'id', v_row.id,
    'institution_id', v_row.institution_id,
    'name', v_row.name,
    'source_file_name', v_row.source_file_name,
    'source_kind', v_row.source_kind,
    'design', v_row.design,
    'warnings', v_row.warnings,
    'created_at', v_row.created_at,
    'published', true,
    'layout_key', v_doc.layout_key
  );
end;
$$;

comment on function public.save_imported_certificate_template(text, text, text, jsonb, jsonb, jsonb) is
  'Save an imported certificate template and activate it for student generation via custom_upload.design (Page Builder untouched).';
