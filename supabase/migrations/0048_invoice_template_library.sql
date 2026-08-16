-- =====================================================================
--  0048_invoice_template_library.sql
--  Active invoice layout selection (built-in library keys).
--  Does not alter certificate/transcript templates.
-- =====================================================================

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
    'statement','branded','bordered','default'
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

revoke all on function public.set_active_invoice_template(text) from public, anon;
grant execute on function public.set_active_invoice_template(text) to authenticated, service_role;

-- Normalize legacy invoice layout_key 'default' → 'classic'
update public.document_templates
set layout_key = 'classic', updated_at = now()
where document_type = 'invoice'
  and layout_key = 'default';
