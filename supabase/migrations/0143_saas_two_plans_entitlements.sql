-- =============================================================================
-- 0143_saas_two_plans_entitlements.sql
-- Two-plan catalog (Starter $39 / Enterprise $59) + transcripts_certificates
-- entitlement enforced in RLS + write triggers (security-definer RPCs included).
-- =============================================================================

-- ---------------------------------------------------------------------
-- Catalog: entitlements column + price/feature updates
-- ---------------------------------------------------------------------
alter table public.platform_plans
  add column if not exists entitlements jsonb not null default '{}'::jsonb;

update public.platform_plans
set
  name = 'Starter',
  description = 'Unlimited students with finance, verifications, roles, and full reports.',
  price_monthly = 39,
  price_yearly = 390,
  max_students = null,
  features = '[
    "Unlimited Students",
    "finance management",
    "Student Verifications",
    "User Roles",
    "Full Reports"
  ]'::jsonb,
  entitlements = '{}'::jsonb,
  is_active = true,
  sort_order = 1,
  updated_at = now()
where slug = 'starter';

update public.platform_plans
set
  name = 'Enterprise',
  description = 'Everything in Starter, plus email support and transcripts & certificates.',
  price_monthly = 59,
  price_yearly = 590,
  max_students = null,
  features = '[
    "Unlimited Students",
    "finance management",
    "Student Verifications",
    "User Roles",
    "Email support",
    "Transcripts & Certificates",
    "Full Reports"
  ]'::jsonb,
  entitlements = '{"transcripts_certificates": true}'::jsonb,
  is_active = true,
  sort_order = 2,
  updated_at = now()
where slug = 'enterprise';

update public.platform_plans
set
  is_active = false,
  updated_at = now()
where slug = 'growth';

-- Move any Growth subscribers onto Enterprise (closest feature set)
update public.tenant_subscriptions s
set
  plan_id = e.id,
  updated_at = now()
from public.platform_plans g, public.platform_plans e
where g.slug = 'growth'
  and e.slug = 'enterprise'
  and s.plan_id = g.id;

-- ---------------------------------------------------------------------
-- Helper: tenant_has_entitlement
-- ---------------------------------------------------------------------
create or replace function public.tenant_has_entitlement(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or (
      p_key is not null
      and length(trim(p_key)) > 0
      and exists (
        select 1
        from public.tenant_subscriptions s
        join public.platform_plans p on p.id = s.plan_id
        where s.institution_id = public.current_institution_id()
          and s.status in ('trial', 'active')
          and (p.entitlements -> p_key) = 'true'::jsonb
      )
    );
$$;

revoke all on function public.tenant_has_entitlement(text) from public;
grant execute on function public.tenant_has_entitlement(text) to authenticated, service_role;

-- Any tenant member may read own subscription (needed for UI entitlement gates)
drop policy if exists "subs_select_tenant_admin" on public.tenant_subscriptions;
create policy "subs_select_tenant_member"
  on public.tenant_subscriptions for select
  using (
    institution_id = public.current_institution_id()
    and public.current_institution_id() is not null
  );

create or replace function public.require_transcripts_certificates_entitlement()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return;
  end if;
  -- service_role / background jobs (no JWT user)
  if auth.uid() is null then
    return;
  end if;
  if not public.tenant_has_entitlement('transcripts_certificates') then
    raise exception 'PLAN_ENTITLEMENT_REQUIRED: transcripts_certificates'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_transcripts_certificates_entitlement() from public;
grant execute on function public.require_transcripts_certificates_entitlement() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Write trigger: blocks inserts/updates/deletes even via security definer RPCs
-- ---------------------------------------------------------------------
create or replace function public.trg_require_transcripts_certificates_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_transcripts_certificates_entitlement();
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_entitlement_transcripts on public.transcripts;
create trigger trg_entitlement_transcripts
  before insert or update or delete on public.transcripts
  for each row execute function public.trg_require_transcripts_certificates_entitlement();

drop trigger if exists trg_entitlement_transcript_entries on public.transcript_entries;
create trigger trg_entitlement_transcript_entries
  before insert or update or delete on public.transcript_entries
  for each row execute function public.trg_require_transcripts_certificates_entitlement();

drop trigger if exists trg_entitlement_certificates on public.certificates;
create trigger trg_entitlement_certificates
  before insert or update or delete on public.certificates
  for each row execute function public.trg_require_transcripts_certificates_entitlement();

drop trigger if exists trg_entitlement_imported_cert_templates on public.imported_certificate_templates;
create trigger trg_entitlement_imported_cert_templates
  before insert or update or delete on public.imported_certificate_templates
  for each row execute function public.trg_require_transcripts_certificates_entitlement();

-- document_templates: only certificate / transcript rows
create or replace function public.trg_require_doc_tpl_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  v_type := coalesce(new.document_type, old.document_type);
  if v_type in ('certificate', 'transcript') then
    perform public.require_transcripts_certificates_entitlement();
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_entitlement_document_templates on public.document_templates;
create trigger trg_entitlement_document_templates
  before insert or update or delete on public.document_templates
  for each row execute function public.trg_require_doc_tpl_entitlement();

-- saved_logo_builder_designs: certificate / transcript only (if column exists)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'saved_logo_builder_designs'
      and column_name = 'document_type'
  ) then
    execute $fn$
      create or replace function public.trg_require_saved_logo_entitlement()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        v_type text;
      begin
        v_type := coalesce(new.document_type, old.document_type);
        if v_type in ('certificate', 'transcript') then
          perform public.require_transcripts_certificates_entitlement();
        end if;
        return coalesce(new, old);
      end;
      $body$;
    $fn$;

    execute 'drop trigger if exists trg_entitlement_saved_logo on public.saved_logo_builder_designs';
    execute $t$
      create trigger trg_entitlement_saved_logo
        before insert or update or delete on public.saved_logo_builder_designs
        for each row execute function public.trg_require_saved_logo_entitlement()
    $t$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- RLS: require entitlement for tenant reads/writes
-- (public verify_* RPCs stay security definer and unaffected)
-- ---------------------------------------------------------------------

-- transcripts
drop policy if exists tr_select on public.transcripts;
create policy tr_select on public.transcripts
  for select to public
  using (
    institution_id = public.current_institution_id()
    and public.tenant_has_entitlement('transcripts_certificates')
    and (
      public.is_admin_or_staff()
      or (
        student_id = (select auth.uid())
        and public.current_student_registration_fee_ok()
      )
    )
  );

drop policy if exists tr_insert on public.transcripts;
drop policy if exists "tr_insert" on public.transcripts;
create policy tr_insert on public.transcripts
  for insert to public
  with check (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

drop policy if exists tr_update on public.transcripts;
drop policy if exists "tr_update" on public.transcripts;
create policy tr_update on public.transcripts
  for update to public
  using (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  )
  with check (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

drop policy if exists tr_delete on public.transcripts;
drop policy if exists "tr_delete" on public.transcripts;
create policy tr_delete on public.transcripts
  for delete to public
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

-- transcript_entries
drop policy if exists te_select on public.transcript_entries;
create policy te_select on public.transcript_entries
  for select to public
  using (
    institution_id = public.current_institution_id()
    and public.tenant_has_entitlement('transcripts_certificates')
    and (
      public.is_admin_or_staff()
      or exists (
        select 1
        from public.transcripts t
        where t.id = transcript_entries.transcript_id
          and t.student_id = (select auth.uid())
          and public.current_student_registration_fee_ok()
      )
    )
  );

drop policy if exists te_insert on public.transcript_entries;
drop policy if exists "te_insert" on public.transcript_entries;
create policy te_insert on public.transcript_entries
  for insert to public
  with check (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

drop policy if exists te_update on public.transcript_entries;
drop policy if exists "te_update" on public.transcript_entries;
create policy te_update on public.transcript_entries
  for update to public
  using (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  )
  with check (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

drop policy if exists te_delete on public.transcript_entries;
drop policy if exists "te_delete" on public.transcript_entries;
create policy te_delete on public.transcript_entries
  for delete to public
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

-- certificates
drop policy if exists cert_select on public.certificates;
create policy cert_select on public.certificates
  for select to public
  using (
    institution_id = public.current_institution_id()
    and public.tenant_has_entitlement('transcripts_certificates')
    and (
      public.is_admin_or_staff()
      or (
        student_id = (select auth.uid())
        and public.current_student_registration_fee_ok()
      )
    )
  );

drop policy if exists cert_insert on public.certificates;
drop policy if exists "cert_insert" on public.certificates;
create policy cert_insert on public.certificates
  for insert to public
  with check (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

drop policy if exists cert_update on public.certificates;
drop policy if exists "cert_update" on public.certificates;
create policy cert_update on public.certificates
  for update to public
  using (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  )
  with check (
    institution_id = public.current_institution_id()
    and public.is_admin_or_staff()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

drop policy if exists cert_delete on public.certificates;
drop policy if exists "cert_delete" on public.certificates;
create policy cert_delete on public.certificates
  for delete to public
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

-- imported certificate templates
drop policy if exists "imported_cert_select" on public.imported_certificate_templates;
create policy "imported_cert_select"
  on public.imported_certificate_templates for select
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

drop policy if exists "imported_cert_delete" on public.imported_certificate_templates;
create policy "imported_cert_delete"
  on public.imported_certificate_templates for delete
  using (
    institution_id = public.current_institution_id()
    and public.is_admin()
    and public.tenant_has_entitlement('transcripts_certificates')
  );

-- document_templates: invoice unrestricted; certificate/transcript need entitlement
drop policy if exists "doc_tpl_select" on public.document_templates;
create policy "doc_tpl_select" on public.document_templates for select
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
  and (
    document_type = 'invoice'
    or public.tenant_has_entitlement('transcripts_certificates')
  )
);

drop policy if exists "doc_tpl_insert" on public.document_templates;
create policy "doc_tpl_insert" on public.document_templates for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin()
  and (
    document_type = 'invoice'
    or public.tenant_has_entitlement('transcripts_certificates')
  )
);

drop policy if exists "doc_tpl_update" on public.document_templates;
create policy "doc_tpl_update" on public.document_templates for update
using (
  institution_id = public.current_institution_id()
  and public.is_admin()
  and (
    document_type = 'invoice'
    or public.tenant_has_entitlement('transcripts_certificates')
  )
)
with check (
  institution_id = public.current_institution_id()
  and public.is_admin()
  and (
    document_type = 'invoice'
    or public.tenant_has_entitlement('transcripts_certificates')
  )
);

drop policy if exists "doc_tpl_delete" on public.document_templates;
create policy "doc_tpl_delete" on public.document_templates for delete
using (
  institution_id = public.current_institution_id()
  and public.is_admin()
  and (
    document_type = 'invoice'
    or public.tenant_has_entitlement('transcripts_certificates')
  )
);

-- saved_logo_builder_designs (if present)
do $$
begin
  if to_regclass('public.saved_logo_builder_designs') is not null then
    execute $p$
      drop policy if exists "saved_logo_builder_select" on public.saved_logo_builder_designs;
      create policy "saved_logo_builder_select"
        on public.saved_logo_builder_designs for select
        using (
          institution_id = public.current_institution_id()
          and public.is_admin()
          and (
            document_type = 'invoice'
            or public.tenant_has_entitlement('transcripts_certificates')
          )
        );

      drop policy if exists "saved_logo_builder_delete" on public.saved_logo_builder_designs;
      create policy "saved_logo_builder_delete"
        on public.saved_logo_builder_designs for delete
        using (
          institution_id = public.current_institution_id()
          and public.is_admin()
          and (
            document_type = 'invoice'
            or public.tenant_has_entitlement('transcripts_certificates')
          )
        );
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Seed helpers: only create cert/transcript templates when entitled
-- (avoids aborting invoice seed for Starter tenants)
-- ---------------------------------------------------------------------
create or replace function public.ensure_document_templates(p_institution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_can_docs boolean;
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

  -- Always seed invoice. Certificate/transcript: service_role, SA, or entitled plan.
  v_can_docs :=
    auth.uid() is null
    or public.is_super_admin()
    or public.tenant_has_entitlement('transcripts_certificates');

  if v_can_docs then
    insert into public.document_templates (institution_id, document_type, layout_key, config)
    values
      (p_institution_id, 'certificate', 'default', '{"show_logo":true,"show_stamp":true,"show_signature":true,"show_qr":true}'::jsonb),
      (p_institution_id, 'transcript', 'default', '{"show_logo":true,"show_stamp":true,"show_qr":true}'::jsonb)
    on conflict (institution_id, document_type) do nothing;
  end if;

  insert into public.document_templates (institution_id, document_type, layout_key, config)
  values
    (p_institution_id, 'invoice', 'default', '{"show_logo":true,"show_contact":true}'::jsonb)
  on conflict (institution_id, document_type) do nothing;
end;
$$;

revoke all on function public.ensure_document_templates(uuid) from public, anon;
grant execute on function public.ensure_document_templates(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- RPC: block template reads for cert/transcript without entitlement
-- ---------------------------------------------------------------------
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

  if p_document_type in ('certificate', 'transcript') then
    perform public.require_transcripts_certificates_entitlement();
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

-- ensure_student_transcript: same body as 0097 + early entitlement check
create or replace function public.ensure_student_transcript(
  p_class_id uuid,
  p_student_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_diploma uuid;
  v_student uuid;
  v_enrollment_id uuid;
  v_transcript_id uuid;
  v_snapshot jsonb;
  ent record;
  v_sem_name text;
  v_sem_sort integer;
  v_project text;
begin
  perform public.require_transcripts_certificates_entitlement();

  v_student := coalesce(p_student_id, auth.uid());
  if v_student is null then
    raise exception 'Not authenticated';
  end if;

  select institution_id, diploma_id into v_inst, v_diploma
  from public.classes
  where id = p_class_id;

  if v_inst is null or v_inst is distinct from public.current_institution_id() then
    raise exception 'Class not found in current institution';
  end if;

  -- Student may ensure their own; staff/admin/instructor may ensure any enrolled student.
  if not (
    v_student = auth.uid()
    or public.is_admin_or_staff()
    or public.is_class_instructor(p_class_id)
  ) then
    raise exception 'Not authorized to issue transcript';
  end if;

  select e.id into v_enrollment_id
  from public.enrollments e
  where e.class_id = p_class_id
    and e.student_id = v_student
    and e.institution_id = v_inst
  order by e.created_at desc nulls last
  limit 1;

  if v_enrollment_id is null then
    raise exception 'Student is not enrolled in this class';
  end if;

  -- Prefer a branding snapshot when settings are complete; otherwise still issue (QR works).
  begin
    v_snapshot := public.build_document_branding_snapshot(v_inst, 'transcript');
  exception when others then
    v_snapshot := '{}'::jsonb;
  end;

  select id into v_transcript_id
  from public.transcripts
  where enrollment_id = v_enrollment_id
    and status = 'issued'
  order by issued_at desc
  limit 1;

  if v_transcript_id is null then
    insert into public.transcripts (
      institution_id, student_id, enrollment_id, class_id, issued_by, status, template_snapshot
    ) values (
      v_inst, v_student, v_enrollment_id, p_class_id, auth.uid(), 'issued', coalesce(v_snapshot, '{}'::jsonb)
    )
    returning id into v_transcript_id;
  else
    update public.transcripts
    set template_snapshot = case
          when template_snapshot is null or template_snapshot = '{}'::jsonb
            then coalesce(v_snapshot, '{}'::jsonb)
          else template_snapshot
        end,
        class_id = coalesce(class_id, p_class_id)
    where id = v_transcript_id;
  end if;

  -- Sync gradebook lines onto the issued transcript (same as finalize, one student).
  for ent in
    select * from public.gradebook_entries
    where enrollment_id = v_enrollment_id and class_id = p_class_id
  loop
    v_sem_name := null;
    v_sem_sort := null;
    v_project := null;

    if v_diploma is not null then
      select ds.name, ds.sort_order
        into v_sem_name, v_sem_sort
      from public.diploma_courses dc
      join public.diploma_semesters ds on ds.id = dc.semester_id
      where dc.diploma_id = v_diploma
        and dc.course_id = ent.course_id
      limit 1;
    end if;

    if public.institution_allows_course_projects(v_inst) then
      select public.sanitize_course_project_text(er.course_project)
        into v_project
      from public.exam_results er
      join public.exams ex on ex.id = er.exam_id
      where er.student_id = v_student
        and er.institution_id = v_inst
        and ex.course_id = ent.course_id
        and er.course_project is not null
      order by er.graded_at desc nulls last
      limit 1;

      if v_project is null then
        select public.sanitize_course_project_text(c.course_project)
          into v_project
        from public.courses c
        where c.id = ent.course_id
          and c.institution_id = v_inst;
      end if;
    end if;

    insert into public.transcript_entries (
      institution_id, transcript_id, course_id, mark, grade, semester_name, semester_sort, course_project
    ) values (
      v_inst, v_transcript_id, ent.course_id, ent.final_mark, ent.letter_grade, v_sem_name, v_sem_sort, v_project
    )
    on conflict (transcript_id, course_id) do update
    set mark = excluded.mark,
        grade = excluded.grade,
        semester_name = excluded.semester_name,
        semester_sort = excluded.semester_sort,
        course_project = coalesce(excluded.course_project, public.transcript_entries.course_project);
  end loop;

  return v_transcript_id;
end;
$$;

comment on function public.ensure_student_transcript(uuid, uuid) is
  'Issue or refresh one student transcript (verification QR) without class-wide Sync to Transcripts.';

revoke all on function public.ensure_student_transcript(uuid, uuid) from public, anon;
grant execute on function public.ensure_student_transcript(uuid, uuid) to authenticated, service_role;
