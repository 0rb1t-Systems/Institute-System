-- Class link for imported certificate templates + update RPC.

alter table public.imported_certificate_templates
  add column if not exists class_id uuid references public.classes(id) on delete set null;

create index if not exists idx_imported_certificate_templates_class
  on public.imported_certificate_templates (institution_id, class_id);

comment on column public.imported_certificate_templates.class_id is
  'Optional class this imported template is named for (print / generate by class).';

drop function if exists public.save_imported_certificate_template(text, text, text, jsonb, jsonb, jsonb);
drop function if exists public.save_imported_certificate_template(text, text, text, jsonb, jsonb, jsonb, uuid);

create or replace function public.save_imported_certificate_template(
  p_name text,
  p_source_file_name text,
  p_source_kind text,
  p_design jsonb,
  p_analysis jsonb default '{}'::jsonb,
  p_warnings jsonb default '[]'::jsonb,
  p_class_id uuid default null
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
  v_class uuid;
  v_class_name text;
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

  v_class := null;
  v_class_name := null;
  if p_class_id is not null then
    select c.id, c.name into v_class, v_class_name
    from public.classes c
    where c.id = p_class_id
      and c.institution_id = v_inst;
    if v_class is null then
      raise exception 'CLASS_NOT_FOUND';
    end if;
  end if;

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
    'counts', coalesce(coalesce(p_analysis, '{}'::jsonb)->'counts', '{}'::jsonb),
    'classId', to_jsonb(v_class),
    'className', to_jsonb(v_class_name)
  );

  insert into public.imported_certificate_templates (
    institution_id,
    name,
    source_file_name,
    source_kind,
    design,
    analysis,
    warnings,
    created_by,
    class_id
  ) values (
    v_inst,
    v_name,
    left(trim(coalesce(p_source_file_name, '')), 180),
    v_kind,
    p_design,
    v_analysis,
    case when jsonb_typeof(p_warnings) = 'array' then p_warnings else '[]'::jsonb end,
    auth.uid(),
    v_class
  )
  returning * into v_row;

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
    'imported_name', v_name,
    'class_id', to_jsonb(v_class),
    'class_name', to_jsonb(v_class_name)
  );

  update public.document_templates
  set
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object('custom_upload', v_upload),
    layout_key = 'custom_upload',
    updated_at = now()
  where institution_id = v_inst
    and document_type = 'certificate';

  return jsonb_build_object(
    'id', v_row.id,
    'institution_id', v_row.institution_id,
    'name', v_row.name,
    'source_file_name', v_row.source_file_name,
    'source_kind', v_row.source_kind,
    'design', v_row.design,
    'warnings', v_row.warnings,
    'created_at', v_row.created_at,
    'class_id', v_row.class_id,
    'class_name', v_class_name
  );
end;
$$;

drop function if exists public.update_imported_certificate_template(uuid, text, jsonb, uuid, jsonb);

create or replace function public.update_imported_certificate_template(
  p_id uuid,
  p_name text,
  p_design jsonb,
  p_class_id uuid default null,
  p_warnings jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_row public.imported_certificate_templates%rowtype;
  v_name text;
  v_class uuid;
  v_class_name text;
  v_analysis jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_inst := public.current_institution_id();
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_row
  from public.imported_certificate_templates
  where id = p_id and institution_id = v_inst
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  perform public.assert_imported_certificate_design(p_design);

  v_name := left(trim(coalesce(p_name, v_row.name)), 120);
  if v_name = '' then
    v_name := v_row.name;
  end if;

  v_class := null;
  v_class_name := null;
  if p_class_id is not null then
    select c.id, c.name into v_class, v_class_name
    from public.classes c
    where c.id = p_class_id
      and c.institution_id = v_inst;
    if v_class is null then
      raise exception 'CLASS_NOT_FOUND';
    end if;
  end if;

  v_analysis := coalesce(v_row.analysis, '{}'::jsonb)
    || jsonb_build_object('classId', to_jsonb(v_class), 'className', to_jsonb(v_class_name));

  update public.imported_certificate_templates
  set
    name = v_name,
    design = p_design,
    class_id = v_class,
    analysis = v_analysis,
    warnings = case
      when p_warnings is not null and jsonb_typeof(p_warnings) = 'array' then p_warnings
      else warnings
    end,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'institution_id', v_row.institution_id,
    'name', v_row.name,
    'source_file_name', v_row.source_file_name,
    'source_kind', v_row.source_kind,
    'design', v_row.design,
    'warnings', v_row.warnings,
    'created_at', v_row.created_at,
    'class_id', v_row.class_id,
    'class_name', v_class_name
  );
end;
$$;

revoke all on function public.save_imported_certificate_template(text, text, text, jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.save_imported_certificate_template(text, text, text, jsonb, jsonb, jsonb, uuid) to authenticated, service_role;

revoke all on function public.update_imported_certificate_template(uuid, text, jsonb, uuid, jsonb) from public, anon;
grant execute on function public.update_imported_certificate_template(uuid, text, jsonb, uuid, jsonb) to authenticated, service_role;
