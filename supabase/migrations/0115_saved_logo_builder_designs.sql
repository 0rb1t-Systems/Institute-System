-- Named Page Builder designs (certificate / transcript / invoice).
-- Independent of the single live document_templates.config.logo_builder draft.

create table if not exists public.saved_logo_builder_designs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  document_type text not null check (document_type in ('certificate', 'transcript', 'invoice')),
  name text not null,
  design jsonb not null,
  class_id uuid references public.classes(id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_logo_builder_designs_institution
  on public.saved_logo_builder_designs (institution_id, document_type, created_at desc);

create index if not exists idx_saved_logo_builder_designs_class
  on public.saved_logo_builder_designs (institution_id, class_id);

comment on table public.saved_logo_builder_designs is
  'Named Page Builder designs per institution. Live activate still writes document_templates.config.logo_builder.';

alter table public.saved_logo_builder_designs enable row level security;

create or replace function public.assert_logo_builder_library_design(p_design jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_count int;
begin
  if p_design is null or jsonb_typeof(p_design) <> 'object' then
    raise exception 'INVALID_DESIGN';
  end if;
  if jsonb_typeof(p_design->'elements') <> 'array' then
    raise exception 'INVALID_DESIGN';
  end if;
  v_count := jsonb_array_length(p_design->'elements');
  if v_count < 1 or v_count > 220 then
    raise exception 'INVALID_DESIGN';
  end if;
  if octet_length(p_design::text) > 600000 then
    raise exception 'DESIGN_TOO_LARGE';
  end if;
end;
$$;

create or replace function public.saved_logo_builder_designs_guard()
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
  perform public.assert_logo_builder_library_design(new.design);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_logo_builder_designs_guard on public.saved_logo_builder_designs;
create trigger saved_logo_builder_designs_guard
  before insert or update on public.saved_logo_builder_designs
  for each row execute function public.saved_logo_builder_designs_guard();

drop policy if exists "saved_logo_builder_select" on public.saved_logo_builder_designs;
create policy "saved_logo_builder_select"
  on public.saved_logo_builder_designs for select
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
  );

drop policy if exists "saved_logo_builder_delete" on public.saved_logo_builder_designs;
create policy "saved_logo_builder_delete"
  on public.saved_logo_builder_designs for delete
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
  );

revoke all on table public.saved_logo_builder_designs from anon, public;
grant select, delete on table public.saved_logo_builder_designs to authenticated;
grant all on table public.saved_logo_builder_designs to service_role;

create or replace function public.publish_logo_builder_design(
  p_document_type text,
  p_design jsonb,
  p_name text default null,
  p_class_id uuid default null,
  p_saved_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_type text;
  v_doc public.document_templates%rowtype;
  v_upload jsonb;
  v_cw numeric;
  v_ch numeric;
begin
  v_inst := public.current_institution_id();
  if v_inst is null or not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_type := lower(trim(coalesce(p_document_type, '')));
  if v_type not in ('certificate', 'transcript', 'invoice') then
    raise exception 'INVALID_DOCUMENT_TYPE';
  end if;

  perform public.ensure_document_templates(v_inst);

  select * into v_doc
  from public.document_templates
  where institution_id = v_inst
    and document_type = v_type
  for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  v_cw := greatest(1, coalesce((p_design #>> '{canvas,width}')::numeric, 794));
  v_ch := greatest(1, coalesce((p_design #>> '{canvas,height}')::numeric, 1123));

  update public.document_templates
  set
    config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
      'logo_builder',
      jsonb_build_object(
        'version', 1,
        'canvas', coalesce(p_design->'canvas', jsonb_build_object('width', v_cw, 'height', v_ch)),
        'elements', coalesce(p_design->'elements', '[]'::jsonb),
        'updated_at', now(),
        'library_id', to_jsonb(p_saved_id),
        'library_name', to_jsonb(nullif(trim(coalesce(p_name, '')), '')),
        'class_id', to_jsonb(p_class_id)
      )
    ),
    layout_key = 'logo_builder',
    updated_at = now()
  where id = v_doc.id;
end;
$$;

create or replace function public.save_logo_builder_design(
  p_document_type text,
  p_name text,
  p_design jsonb,
  p_class_id uuid default null,
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
  v_name text;
  v_class uuid;
  v_class_name text;
  v_row public.saved_logo_builder_designs%rowtype;
  v_count int;
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

  perform public.assert_logo_builder_library_design(p_design);

  v_name := left(trim(coalesce(p_name, '')), 120);
  if v_name = '' then
    v_name := 'Page Builder design';
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

  select count(*) into v_count
  from public.saved_logo_builder_designs
  where institution_id = v_inst
    and document_type = v_type;
  if v_count >= 40 then
    raise exception 'BUILDER_LIBRARY_LIMIT';
  end if;

  insert into public.saved_logo_builder_designs (
    institution_id,
    document_type,
    name,
    design,
    class_id,
    meta,
    created_by
  ) values (
    v_inst,
    v_type,
    v_name,
    p_design,
    v_class,
    jsonb_build_object('className', to_jsonb(v_class_name)),
    auth.uid()
  )
  returning * into v_row;

  if coalesce(p_activate, true) then
    perform public.publish_logo_builder_design(v_type, p_design, v_name, v_class, v_row.id);
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'institution_id', v_row.institution_id,
    'document_type', v_row.document_type,
    'name', v_row.name,
    'design', v_row.design,
    'class_id', v_row.class_id,
    'class_name', v_class_name,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.update_logo_builder_design(
  p_id uuid,
  p_name text,
  p_design jsonb,
  p_class_id uuid default null,
  p_activate boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_name text;
  v_class uuid;
  v_class_name text;
  v_row public.saved_logo_builder_designs%rowtype;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_inst := public.current_institution_id();
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_row
  from public.saved_logo_builder_designs
  where id = p_id and institution_id = v_inst
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  perform public.assert_logo_builder_library_design(p_design);

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

  update public.saved_logo_builder_designs
  set
    name = v_name,
    design = p_design,
    class_id = v_class,
    meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('className', to_jsonb(v_class_name)),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  if coalesce(p_activate, true) then
    perform public.publish_logo_builder_design(
      v_row.document_type,
      p_design,
      v_name,
      v_class,
      v_row.id
    );
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'institution_id', v_row.institution_id,
    'document_type', v_row.document_type,
    'name', v_row.name,
    'design', v_row.design,
    'class_id', v_row.class_id,
    'class_name', v_class_name,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.assert_logo_builder_library_design(jsonb) from public, anon;
grant execute on function public.assert_logo_builder_library_design(jsonb) to authenticated, service_role;

revoke all on function public.publish_logo_builder_design(text, jsonb, text, uuid, uuid) from public, anon;
grant execute on function public.publish_logo_builder_design(text, jsonb, text, uuid, uuid) to authenticated, service_role;

revoke all on function public.save_logo_builder_design(text, text, jsonb, uuid, boolean) from public, anon;
grant execute on function public.save_logo_builder_design(text, text, jsonb, uuid, boolean) to authenticated, service_role;

revoke all on function public.update_logo_builder_design(uuid, text, jsonb, uuid, boolean) from public, anon;
grant execute on function public.update_logo_builder_design(uuid, text, jsonb, uuid, boolean) to authenticated, service_role;
