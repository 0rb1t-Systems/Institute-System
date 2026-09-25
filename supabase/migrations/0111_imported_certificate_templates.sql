-- Imported certificate templates.
-- Separate from document_templates.logo_builder (Certificate Page Builder)
-- and from document_templates.custom_upload (Upload Own).
-- The original PDF/DOCX is not stored. The design must be structured elements.

create table if not exists public.imported_certificate_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  source_file_name text,
  source_kind text not null check (source_kind in ('pdf', 'docx')),
  design jsonb not null,
  analysis jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_imported_certificate_templates_institution
  on public.imported_certificate_templates (institution_id, created_at desc);

comment on table public.imported_certificate_templates is
  'Institution-scoped certificate templates reconstructed from an uploaded reference. Not the Certificate Page Builder.';

alter table public.imported_certificate_templates enable row level security;

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
    if v_src like 'blob:%' or v_src like 'data:%' or length(v_src) > 2000 then
      raise exception 'IMPORT_BACKGROUND_FORBIDDEN';
    end if;
  end loop;
exception
  when invalid_text_representation then
    raise exception 'INVALID_DESIGN';
end;
$$;

create or replace function public.imported_certificate_templates_guard()
returns trigger
language plpgsql
as $$
begin
  if new.institution_id is distinct from public.current_institution_id() then
    raise exception 'FORBIDDEN';
  end if;
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  perform public.assert_imported_certificate_design(new.design);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists imported_certificate_templates_guard on public.imported_certificate_templates;
create trigger imported_certificate_templates_guard
  before insert or update on public.imported_certificate_templates
  for each row execute function public.imported_certificate_templates_guard();

drop policy if exists "imported_cert_select" on public.imported_certificate_templates;
create policy "imported_cert_select"
  on public.imported_certificate_templates for select
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
  );

drop policy if exists "imported_cert_delete" on public.imported_certificate_templates;
create policy "imported_cert_delete"
  on public.imported_certificate_templates for delete
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
  );

revoke all on table public.imported_certificate_templates from anon, public;
grant select, delete on table public.imported_certificate_templates to authenticated;
grant all on table public.imported_certificate_templates to service_role;

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
  v_name text;
  v_kind text;
  v_analysis jsonb;
  v_count int;
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

  return jsonb_build_object(
    'id', v_row.id,
    'institution_id', v_row.institution_id,
    'name', v_row.name,
    'source_file_name', v_row.source_file_name,
    'source_kind', v_row.source_kind,
    'design', v_row.design,
    'warnings', v_row.warnings,
    'created_at', v_row.created_at
  );
end;
$$;

revoke all on function public.save_imported_certificate_template(text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_imported_certificate_template(text, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;

revoke all on function public.assert_imported_certificate_design(jsonb) from public, anon;
grant execute on function public.assert_imported_certificate_design(jsonb) to authenticated, service_role;
