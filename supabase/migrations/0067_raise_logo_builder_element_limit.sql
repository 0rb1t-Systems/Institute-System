-- Raise Page Builder element cap so Upload Own decompositions (text + images + residue) fit.
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
  if jsonb_array_length(v_elements) > 180 then
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
