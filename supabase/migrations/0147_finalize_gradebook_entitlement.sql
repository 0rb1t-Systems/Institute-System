-- =============================================================================
-- 0147_finalize_gradebook_entitlement.sql
-- Starter: gradebook scores work. Issuing transcripts via finalize_gradebook
-- requires Enterprise transcripts_certificates (matches plan card).
-- =============================================================================

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

  -- Enterprise entitlement required to issue/refresh transcripts.
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
            else template_snapshot
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

revoke all on function public.finalize_gradebook(uuid) from public, anon;
grant execute on function public.finalize_gradebook(uuid) to authenticated, service_role;

comment on function public.finalize_gradebook(uuid) is
  'Issue/refresh class transcripts from gradebook. Requires transcripts_certificates entitlement (Enterprise). Gradebook scores themselves do not require this.';
