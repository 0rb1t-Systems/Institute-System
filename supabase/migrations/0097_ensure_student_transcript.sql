-- Auto-issue a student's transcript (with verification QR) when they view it.
-- Does not require the class-wide "Sync to Transcripts" button.

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
