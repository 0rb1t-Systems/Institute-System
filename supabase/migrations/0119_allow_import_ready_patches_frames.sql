-- Allow ready certificate patches / decorative frames on imported templates.
-- These use patchKey/decorKey (+ optional inline SVG data URIs) and are not
-- the uploaded PDF/DOCX paper background.

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
  v_is_ready_asset boolean;
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
  if octet_length(p_design::text) > 800000 then
    raise exception 'DESIGN_TOO_LARGE';
  end if;
  v_cw := greatest(1, coalesce((p_design #>> '{canvas,width}')::numeric, 794));
  v_ch := greatest(1, coalesce((p_design #>> '{canvas,height}')::numeric, 1123));
  for el in select value from jsonb_array_elements(p_design->'elements')
  loop
    v_text := coalesce(el->>'text', '');
    v_is_ready_asset :=
      coalesce(el->>'patchKey', '') <> ''
      or coalesce(el->>'decorKey', '') <> '';

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

    -- Full-bleed only forbidden for real upload paper, not ready frames/patches
    if not v_is_ready_asset
       and coalesce(el->>'type', '') = 'image'
       and v_w > v_cw * 0.85
       and v_h > v_ch * 0.85 then
      raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
    end if;

    v_src := coalesce(el->>'src', '');

    if v_is_ready_asset then
      -- Ready assets may use inline SVG; reject only ephemeral blob URLs
      if v_src like 'blob:%' then
        raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
      end if;
      if v_src like 'data:%' and v_src not like 'data:image/svg+xml%' then
        raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
      end if;
      if length(v_src) > 200000 then
        raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
      end if;
      continue;
    end if;

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
