-- =============================================================================
-- 0152_refresh_document_branding_from_settings.sql
-- When Institution Settings change (email/phone/address/etc.), already-issued
-- transcripts/certificates kept a frozen template_snapshot.branding with the
-- old values. Refresh branding from institutions (SoT) while keeping the rest
-- of the snapshot (layout/template metadata).
-- =============================================================================

create or replace function public.refresh_institution_document_branding(
  p_institution_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_caller_inst uuid;
  v_role text;
  v_tr int := 0;
  v_cert int := 0;
  v_snap_tr jsonb;
  v_snap_cert jsonb;
  r record;
begin
  v_caller_inst := public.current_institution_id();
  select role into v_role from public.profiles where id = auth.uid();

  v_inst := coalesce(p_institution_id, v_caller_inst);
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  -- Tenant admin/staff may refresh own institution; service_role / super paths OK via null role checks.
  if auth.uid() is not null then
    if v_caller_inst is distinct from v_inst then
      raise exception 'FORBIDDEN';
    end if;
    if v_role is distinct from 'admin' and v_role is distinct from 'staff' then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  -- Transcripts: rewrite branding from current institution settings.
  for r in
    select id from public.transcripts where institution_id = v_inst
  loop
    begin
      v_snap_tr := public.build_document_branding_snapshot(v_inst, 'transcript');
    exception when others then
      v_snap_tr := null;
    end;

    if v_snap_tr is null then
      continue;
    end if;

    update public.transcripts
    set template_snapshot = case
          when template_snapshot is null or template_snapshot = '{}'::jsonb then v_snap_tr
          else jsonb_set(
            template_snapshot,
            '{branding}',
            coalesce(v_snap_tr->'branding', '{}'::jsonb),
            true
          )
        end
    where id = r.id;
    v_tr := v_tr + 1;
  end loop;

  -- Certificates: same branding refresh.
  for r in
    select id from public.certificates where institution_id = v_inst
  loop
    begin
      v_snap_cert := public.build_document_branding_snapshot(v_inst, 'certificate');
    exception when others then
      v_snap_cert := null;
    end;

    if v_snap_cert is null then
      continue;
    end if;

    update public.certificates
    set template_snapshot = case
          when template_snapshot is null or template_snapshot = '{}'::jsonb then v_snap_cert
          else jsonb_set(
            template_snapshot,
            '{branding}',
            coalesce(v_snap_cert->'branding', '{}'::jsonb),
            true
          )
        end
    where id = r.id;
    v_cert := v_cert + 1;
  end loop;

  return jsonb_build_object(
    'institution_id', v_inst,
    'transcripts_updated', v_tr,
    'certificates_updated', v_cert
  );
end;
$$;

comment on function public.refresh_institution_document_branding(uuid) is
  'Overwrite template_snapshot.branding on issued transcripts/certificates from live Institution Settings.';

revoke all on function public.refresh_institution_document_branding(uuid) from public, anon;
grant execute on function public.refresh_institution_document_branding(uuid) to authenticated, service_role;

-- One-time heal: refresh branding for every institution that has issued docs.
do $$
declare
  inst record;
  v_brand_tr jsonb;
  v_brand_cert jsonb;
  v_full_tr jsonb;
  v_full_cert jsonb;
begin
  for inst in
    select distinct institution_id as id
    from (
      select institution_id from public.transcripts
      union
      select institution_id from public.certificates
    ) s
    where institution_id is not null
  loop
    begin
      v_full_tr := public.build_document_branding_snapshot(inst.id, 'transcript');
      v_brand_tr := v_full_tr->'branding';
    exception when others then
      v_full_tr := null;
      v_brand_tr := null;
    end;

    begin
      v_full_cert := public.build_document_branding_snapshot(inst.id, 'certificate');
      v_brand_cert := v_full_cert->'branding';
    exception when others then
      v_full_cert := null;
      v_brand_cert := null;
    end;

    if v_brand_tr is not null then
      update public.transcripts t
      set template_snapshot = case
            when t.template_snapshot is null or t.template_snapshot = '{}'::jsonb
              then coalesce(v_full_tr, '{}'::jsonb)
            else jsonb_set(t.template_snapshot, '{branding}', v_brand_tr, true)
          end
      where t.institution_id = inst.id;
    end if;

    if v_brand_cert is not null then
      update public.certificates c
      set template_snapshot = case
            when c.template_snapshot is null or c.template_snapshot = '{}'::jsonb
              then coalesce(v_full_cert, '{}'::jsonb)
            else jsonb_set(c.template_snapshot, '{branding}', v_brand_cert, true)
          end
      where c.institution_id = inst.id;
    end if;
  end loop;
end;
$$;

-- ensure_student_transcript: always refresh branding on re-open, keep other snapshot keys.
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
          when v_snapshot is null or v_snapshot = '{}'::jsonb
            then template_snapshot
          else jsonb_set(
            template_snapshot,
            '{branding}',
            coalesce(v_snapshot->'branding', '{}'::jsonb),
            true
          )
        end,
        class_id = coalesce(class_id, p_class_id)
    where id = v_transcript_id;
  end if;

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

-- finalize_gradebook: same branding refresh on existing issued transcripts.
create or replace function public.finalize_gradebook(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_diploma uuid;
  v_transcript_id uuid;
  rec record;
  ent record;
  v_snapshot jsonb;
  v_sem_name text;
  v_sem_sort integer;
  v_project text;
begin
  if not (public.is_admin_or_staff() or public.is_class_instructor(p_class_id)) then
    raise exception 'Not authorized to finalize gradebook';
  end if;

  select institution_id, diploma_id into v_inst, v_diploma
  from public.classes
  where id = p_class_id;

  if v_inst is null or v_inst is distinct from public.current_institution_id() then
    raise exception 'Class not found in current institution';
  end if;

  perform public.require_transcripts_certificates_entitlement();

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
            else jsonb_set(
              template_snapshot,
              '{branding}',
              coalesce(v_snapshot->'branding', '{}'::jsonb),
              true
            )
          end
      where id = v_transcript_id;
    end if;

    for ent in
      select * from public.gradebook_entries
      where enrollment_id = rec.enrollment_id and class_id = p_class_id
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
        where er.student_id = rec.student_id
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
  end loop;

  return p_class_id;
end;
$$;
