-- =====================================================================
--  0039_phase3_document_branding.sql
--  Phase 3 remaining: institution branding fields, document_templates,
--  issuance gates, credential uniqueness, hardened public verify.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Institution branding (single source of truth — no duplicate settings table)
-- ---------------------------------------------------------------------
alter table public.institutions
  add column if not exists website text,
  add column if not exists motto text,
  add column if not exists signature_url text,
  add column if not exists certificate_footer_text text,
  add column if not exists transcript_footer_text text,
  add column if not exists invoice_footer_text text,
  add column if not exists settings_completed_at timestamptz;

comment on column public.institutions.seal_url is 'Optional institution stamp/seal image URL';
comment on column public.institutions.signature_url is 'Director/Registrar signature image URL';
comment on column public.institutions.settings_completed_at is 'Set when Institution Admin completes required branding settings';

-- Backfill: existing tenants with identity + contact are treated as complete
update public.institutions
set settings_completed_at = coalesce(settings_completed_at, created_at, now())
where settings_completed_at is null
  and nullif(trim(name), '') is not null
  and nullif(trim(coalesce(email, '')), '') is not null
  and nullif(trim(coalesce(phone, '')), '') is not null
  and nullif(trim(coalesce(address, '')), '') is not null;

-- ---------------------------------------------------------------------
-- Document templates: one row per (institution_id, document_type)
-- Branding stays on institutions; templates store layout/config only.
-- ---------------------------------------------------------------------
create table if not exists public.document_templates (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  document_type   text not null
    check (document_type in ('certificate', 'transcript', 'invoice')),
  layout_key      text not null default 'default',
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (institution_id, document_type)
);

create index if not exists idx_document_templates_institution
  on public.document_templates(institution_id);

alter table public.document_templates enable row level security;

drop policy if exists "doc_tpl_select" on public.document_templates;
create policy "doc_tpl_select" on public.document_templates for select
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

drop policy if exists "doc_tpl_insert" on public.document_templates;
create policy "doc_tpl_insert" on public.document_templates for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin()
);

drop policy if exists "doc_tpl_update" on public.document_templates;
create policy "doc_tpl_update" on public.document_templates for update
using (
  institution_id = public.current_institution_id()
  and public.is_admin()
)
with check (
  institution_id = public.current_institution_id()
  and public.is_admin()
);

drop policy if exists "doc_tpl_delete" on public.document_templates;
create policy "doc_tpl_delete" on public.document_templates for delete
using (
  institution_id = public.current_institution_id()
  and public.is_admin()
);

revoke all on table public.document_templates from anon, public;
grant select, insert, update, delete on table public.document_templates to authenticated;
grant all on table public.document_templates to service_role;

-- Ensure default templates for an institution (secure defaults)
create or replace function public.ensure_document_templates(p_institution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
begin
  if p_institution_id is null then
    return;
  end if;

  v_caller := public.current_institution_id();
  -- Allow service_role / triggers (no JWT institution) and same-tenant callers only
  if auth.uid() is not null and v_caller is not null and p_institution_id is distinct from v_caller then
    raise exception 'FORBIDDEN';
  end if;
  if auth.uid() is not null and v_caller is null then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'super_admin'
    ) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  insert into public.document_templates (institution_id, document_type, layout_key, config)
  values
    (p_institution_id, 'certificate', 'default', '{"show_logo":true,"show_stamp":true,"show_signature":true,"show_qr":true}'::jsonb),
    (p_institution_id, 'transcript', 'default', '{"show_logo":true,"show_stamp":true,"show_qr":true}'::jsonb),
    (p_institution_id, 'invoice', 'default', '{"show_logo":true,"show_contact":true}'::jsonb)
  on conflict (institution_id, document_type) do nothing;
end;
$$;

revoke all on function public.ensure_document_templates(uuid) from public, anon;
grant execute on function public.ensure_document_templates(uuid) to authenticated, service_role;

-- Seed templates for existing institutions
do $$
declare
  r record;
begin
  for r in select id from public.institutions loop
    perform public.ensure_document_templates(r.id);
  end loop;
end;
$$;

create or replace function public.trg_institutions_ensure_templates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_document_templates(new.id);
  return new;
end;
$$;

drop trigger if exists trg_institutions_ensure_templates on public.institutions;
create trigger trg_institutions_ensure_templates
after insert on public.institutions
for each row execute function public.trg_institutions_ensure_templates();

-- Resolve template for current tenant (server-side institution_id only)
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

  perform public.ensure_document_templates(v_inst);

  select * into v_row
  from public.document_templates
  where institution_id = v_inst
    and document_type = p_document_type
  limit 1;

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

-- ---------------------------------------------------------------------
-- Transcript official snapshot column (branding frozen at issue time)
-- ---------------------------------------------------------------------
alter table public.transcripts
  add column if not exists template_snapshot jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------
-- Prevent duplicate issued credentials per enrollment
-- ---------------------------------------------------------------------
create unique index if not exists uq_certificates_enrollment_issued
  on public.certificates (enrollment_id)
  where enrollment_id is not null and status = 'issued';

create unique index if not exists uq_transcripts_enrollment_issued
  on public.transcripts (enrollment_id)
  where enrollment_id is not null and status = 'issued';

-- ---------------------------------------------------------------------
-- Settings completeness + issuance gates
-- ---------------------------------------------------------------------
create or replace function public.institution_settings_complete(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.institutions i
    where i.id = p_institution_id
      and i.settings_completed_at is not null
      and nullif(trim(i.name), '') is not null
      and nullif(trim(coalesce(i.email, '')), '') is not null
      and nullif(trim(coalesce(i.phone, '')), '') is not null
      and nullif(trim(coalesce(i.address, '')), '') is not null
  );
$$;

revoke all on function public.institution_settings_complete(uuid) from public, anon;
grant execute on function public.institution_settings_complete(uuid) to authenticated, service_role;

create or replace function public.trg_require_settings_before_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'issued' then
    if not public.institution_settings_complete(new.institution_id) then
      raise exception 'INSTITUTION_SETTINGS_INCOMPLETE';
    end if;
  end if;
  if tg_op = 'UPDATE'
     and new.status = 'issued'
     and coalesce(old.status, '') is distinct from 'issued' then
    if not public.institution_settings_complete(new.institution_id) then
      raise exception 'INSTITUTION_SETTINGS_INCOMPLETE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_require_settings_before_certificate on public.certificates;
create trigger trg_require_settings_before_certificate
before insert or update on public.certificates
for each row execute function public.trg_require_settings_before_certificate();

-- Build branding snapshot from institutions (SoT) + template metadata
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
  v_caller uuid;
begin
  v_caller := public.current_institution_id();
  if v_caller is not null and p_institution_id is distinct from v_caller then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_inst from public.institutions where id = p_institution_id;
  if not found then
    return '{}'::jsonb;
  end if;

  -- Always resolve by explicit institution_id (never trust client).
  perform public.ensure_document_templates(p_institution_id);

  select jsonb_build_object(
    'id', t.id,
    'institution_id', t.institution_id,
    'document_type', t.document_type,
    'layout_key', t.layout_key,
    'config', t.config,
    'is_default', (t.layout_key = 'default')
  )
  into v_tpl
  from public.document_templates t
  where t.institution_id = p_institution_id
    and t.document_type = p_document_type
  limit 1;

  if v_tpl is null then
    v_tpl := jsonb_build_object(
      'document_type', p_document_type,
      'layout_key', 'default',
      'config', '{}'::jsonb,
      'is_default', true
    );
  end if;

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
      'invoice_footer_text', v_inst.invoice_footer_text
    ),
    'snapshotted_at', now()
  );
end;
$$;

revoke all on function public.build_document_branding_snapshot(uuid, text) from public, anon;
grant execute on function public.build_document_branding_snapshot(uuid, text) to authenticated, service_role;

-- Finalize gradebook: settings gate + branding snapshot + no duplicate issued transcripts
create or replace function public.finalize_gradebook(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_transcript_id uuid;
  rec record;
  ent record;
  v_snapshot jsonb;
begin
  if not (public.is_admin_or_staff() or public.is_class_instructor(p_class_id)) then
    raise exception 'Not authorized to finalize gradebook';
  end if;

  select institution_id into v_inst from public.classes where id = p_class_id;
  if v_inst is null or v_inst is distinct from public.current_institution_id() then
    raise exception 'Class not found in current institution';
  end if;

  if not public.institution_settings_complete(v_inst) then
    raise exception 'INSTITUTION_SETTINGS_INCOMPLETE';
  end if;

  v_snapshot := public.build_document_branding_snapshot(v_inst, 'transcript');

  for rec in
    select distinct e.id as enrollment_id, e.student_id
    from public.enrollments e
    where e.class_id = p_class_id and e.institution_id = v_inst
  loop
    select id into v_transcript_id
    from public.transcripts
    where enrollment_id = rec.enrollment_id and status = 'issued'
    order by issued_at desc
    limit 1;

    if v_transcript_id is null then
      insert into public.transcripts (
        institution_id, student_id, enrollment_id, class_id, issued_by, status, template_snapshot
      ) values (
        v_inst, rec.student_id, rec.enrollment_id, p_class_id, auth.uid(), 'issued', v_snapshot
      )
      returning id into v_transcript_id;
    else
      update public.transcripts
      set template_snapshot = case
            when template_snapshot is null or template_snapshot = '{}'::jsonb then v_snapshot
            else template_snapshot
          end
      where id = v_transcript_id;
    end if;

    for ent in
      select * from public.gradebook_entries
      where enrollment_id = rec.enrollment_id and class_id = p_class_id
    loop
      insert into public.transcript_entries (
        institution_id, transcript_id, course_id, mark, grade
      ) values (
        v_inst, v_transcript_id, ent.course_id, ent.final_mark, ent.letter_grade
      )
      on conflict (transcript_id, course_id) do update
      set mark = excluded.mark, grade = excluded.grade;
    end loop;
  end loop;

  return p_class_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Public institution branding: no internal id, no private assets/settings
-- ---------------------------------------------------------------------
create or replace function public.get_public_institution(p_subdomain text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row institutions%rowtype;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then
    return null;
  end if;

  select * into v_row
  from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain))
    and coalesce(status, 'active') = 'active'
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'name', v_row.name,
    'subdomain', v_row.subdomain,
    'logo_url', v_row.logo_url,
    'description', v_row.description,
    'email', v_row.email,
    'phone', v_row.phone,
    'address', v_row.address,
    'website', v_row.website,
    'motto', v_row.motto,
    'theme_primary', v_row.theme_primary,
    'theme_accent', v_row.theme_accent
  );
end;
$$;

revoke all on function public.get_public_institution(text) from public;
grant execute on function public.get_public_institution(text) to anon, authenticated, service_role;

-- Public verify: only issued credentials; approved public fields only
create or replace function public.verify_credential(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert record;
  v_tr record;
  v_code text;
begin
  v_code := trim(coalesce(p_code, ''));
  if length(v_code) < 8 then
    return jsonb_build_object('valid', false);
  end if;

  -- Prefer exact verification_code match (never accept row UUID as code)
  select
    c.certificate_number,
    c.verification_code,
    c.issued_at,
    c.status,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    p.full_name as student_name,
    cl.name as class_name
  into v_cert
  from public.certificates c
  join public.institutions i on i.id = c.institution_id
  join public.profiles p on p.id = c.student_id
  left join public.classes cl on cl.id = c.class_id
  where c.verification_code = v_code
    and c.status = 'issued'
  limit 1;

  if found then
    return jsonb_build_object(
      'type', 'certificate',
      'valid', true,
      'certificate_number', v_cert.certificate_number,
      'student_name', v_cert.student_name,
      'institution_name', v_cert.institution_name,
      'institution_logo_url', v_cert.institution_logo_url,
      'theme_primary', v_cert.theme_primary,
      'theme_accent', v_cert.theme_accent,
      'class_name', v_cert.class_name,
      'title', v_cert.class_name,
      'issued_at', v_cert.issued_at,
      'date', v_cert.issued_at,
      'verification_code', v_cert.verification_code
    );
  end if;

  select
    t.verification_code,
    t.issued_at,
    t.status,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    p.full_name as student_name,
    cl.name as class_name
  into v_tr
  from public.transcripts t
  join public.institutions i on i.id = t.institution_id
  join public.profiles p on p.id = t.student_id
  left join public.classes cl on cl.id = t.class_id
  where t.verification_code = v_code
    and t.status = 'issued'
  limit 1;

  if found then
    return jsonb_build_object(
      'type', 'transcript',
      'valid', true,
      'student_name', v_tr.student_name,
      'institution_name', v_tr.institution_name,
      'institution_logo_url', v_tr.institution_logo_url,
      'theme_primary', v_tr.theme_primary,
      'theme_accent', v_tr.theme_accent,
      'class_name', v_tr.class_name,
      'title', v_tr.class_name,
      'issued_at', v_tr.issued_at,
      'date', v_tr.issued_at,
      'verification_code', v_tr.verification_code
    );
  end if;

  return jsonb_build_object('valid', false);
end;
$$;

revoke all on function public.verify_credential(text) from public;
grant execute on function public.verify_credential(text) to anon, authenticated, service_role;

-- Mark settings complete when required fields present (called from admin update path via RPC optional;
-- frontend also sets settings_completed_at through trusted updateInstitution using server institution_id)
create or replace function public.mark_institution_settings_complete()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_row public.institutions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  v_inst := public.current_institution_id();
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_row from public.institutions where id = v_inst for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if nullif(trim(v_row.name), '') is null
     or nullif(trim(coalesce(v_row.email, '')), '') is null
     or nullif(trim(coalesce(v_row.phone, '')), '') is null
     or nullif(trim(coalesce(v_row.address, '')), '') is null then
    raise exception 'INSTITUTION_SETTINGS_INCOMPLETE';
  end if;

  update public.institutions
  set settings_completed_at = coalesce(settings_completed_at, now())
  where id = v_inst;

  perform public.ensure_document_templates(v_inst);

  return jsonb_build_object(
    'ok', true,
    'settings_completed_at', (select settings_completed_at from public.institutions where id = v_inst)
  );
end;
$$;

revoke all on function public.mark_institution_settings_complete() from public, anon;
grant execute on function public.mark_institution_settings_complete() to authenticated, service_role;
