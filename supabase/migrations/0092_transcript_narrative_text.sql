-- Transcript summary paragraph (shown on official library layouts).
-- Institution default + optional diploma override.

alter table public.institutions
  add column if not exists transcript_narrative_text text;

alter table public.diplomas
  add column if not exists transcript_narrative_text text;

comment on column public.institutions.transcript_narrative_text is
  'Optional paragraph shown below GPA on official transcript layouts. Null uses the built-in default.';

comment on column public.diplomas.transcript_narrative_text is
  'When set, overrides institution transcript narrative for this diploma. Empty string hides it.';

create or replace function public.build_document_branding_snapshot(
  p_institution_id uuid,
  p_document_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst public.institutions%rowtype;
  v_tpl jsonb;
begin
  select * into v_inst from public.institutions where id = p_institution_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  select to_jsonb(t) into v_tpl
  from public.document_templates t
  where t.institution_id = p_institution_id
    and t.document_type = p_document_type
  limit 1;

  return jsonb_build_object(
    'document_type', p_document_type,
    'template', v_tpl,
    'branding', jsonb_build_object(
      'institution_id', v_inst.id,
      'name', v_inst.name,
      'logo_url', v_inst.logo_url,
      'seal_url', v_inst.seal_url,
      'signature_url', v_inst.signature_url,
      'address', v_inst.address,
      'phone', v_inst.phone,
      'email', v_inst.email,
      'website', v_inst.website,
      'motto', v_inst.motto,
      'theme_primary', v_inst.theme_primary,
      'theme_accent', v_inst.theme_accent,
      'signatory_left_title', v_inst.signatory_left_title,
      'signatory_right_title', v_inst.signatory_right_title,
      'signatory_left_name', v_inst.signatory_left_name,
      'signatory_right_name', v_inst.signatory_right_name,
      'certificate_footer_text', v_inst.certificate_footer_text,
      'transcript_footer_text', v_inst.transcript_footer_text,
      'transcript_narrative_text', v_inst.transcript_narrative_text,
      'invoice_footer_text', v_inst.invoice_footer_text
    ),
    'snapshotted_at', now()
  );
end;
$$;
