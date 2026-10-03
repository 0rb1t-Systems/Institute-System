-- =============================================================================
-- 0124_get_document_template_skip_ensure.sql
-- Performance: only call ensure_document_templates when the row is missing.
-- Institutions already seeded at create-time; avoid INSERT ON CONFLICT on every read.
-- Behavior unchanged for new/empty tenants.
-- =============================================================================

create or replace function public.get_document_template(p_document_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_row public.document_templates%rowtype;
begin
  v_inst := public.current_institution_id();
  if v_inst is null then
    return null;
  end if;
  if p_document_type is null or p_document_type not in ('certificate', 'transcript', 'invoice') then
    raise exception 'INVALID_DOCUMENT_TYPE';
  end if;

  select * into v_row
  from public.document_templates
  where institution_id = v_inst
    and document_type = p_document_type
  limit 1;

  if not found then
    perform public.ensure_document_templates(v_inst);
    select * into v_row
    from public.document_templates
    where institution_id = v_inst
      and document_type = p_document_type
    limit 1;
  end if;

  if not found then
    return jsonb_build_object(
      'document_type', p_document_type,
      'layout_key', 'default',
      'config', '{}'::jsonb,
      'is_default', true
    );
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'institution_id', v_row.institution_id,
    'document_type', v_row.document_type,
    'layout_key', v_row.layout_key,
    'config', v_row.config,
    'updated_at', v_row.updated_at,
    'is_default', (v_row.layout_key = 'default')
  );
end;
$$;

revoke all on function public.get_document_template(text) from public, anon;
grant execute on function public.get_document_template(text) to authenticated, service_role;
