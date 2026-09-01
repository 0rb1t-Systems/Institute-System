-- Course project titles on transcripts.
-- Write is limited to admin/staff of two named tenants (by institution id).
-- Other tenants, students, and instructors cannot persist this field.

alter table public.courses
  add column if not exists course_project text;

alter table public.exam_results
  add column if not exists course_project text;

alter table public.transcript_entries
  add column if not exists course_project text;

comment on column public.courses.course_project is
  'Optional catalog project title shown under the course on transcripts.';
comment on column public.exam_results.course_project is
  'Optional per-student course project title entered when grading.';
comment on column public.transcript_entries.course_project is
  'Snapshot of course project title at transcript issue/sync.';

create or replace function public.sanitize_course_project_text(p_raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    left(trim(regexp_replace(coalesce(p_raw, ''), '[[:cntrl:]]+', ' ', 'g')), 200),
    ''
  );
$$;

revoke all on function public.sanitize_course_project_text(text) from public, anon;
grant execute on function public.sanitize_course_project_text(text) to authenticated, service_role;

-- Hard allow-list: official BRCE + Hankaal College (not name/subdomain spoofable).
create or replace function public.institution_allows_course_projects(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_institution_id in (
    '08c465d2-4f40-4e63-941a-2cfdd4b61a82'::uuid,
    '9273fbc4-fc18-439c-b016-71edd844c485'::uuid
  );
$$;

revoke all on function public.institution_allows_course_projects(uuid) from public, anon, authenticated;
grant execute on function public.institution_allows_course_projects(uuid) to service_role;

create or replace function public.guard_course_project_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.course_project := public.sanitize_course_project_text(new.course_project);

  if new.course_project is null then
    return new;
  end if;

  if not public.institution_allows_course_projects(new.institution_id) then
    new.course_project := null;
    return new;
  end if;

  if tg_table_name = 'transcript_entries' then
    return new;
  end if;

  if public.current_user_role() not in ('admin', 'staff', 'super_admin') then
    if tg_op = 'UPDATE' then
      new.course_project := old.course_project;
    else
      new.course_project := null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_course_project_write() from public, anon, authenticated;
grant execute on function public.guard_course_project_write() to service_role;

drop trigger if exists trg_guard_course_project_courses on public.courses;
create trigger trg_guard_course_project_courses
before insert or update on public.courses
for each row
execute function public.guard_course_project_write();

drop trigger if exists trg_guard_course_project_exam_results on public.exam_results;
create trigger trg_guard_course_project_exam_results
before insert or update on public.exam_results
for each row
execute function public.guard_course_project_write();

drop trigger if exists trg_guard_course_project_transcript_entries on public.transcript_entries;
create trigger trg_guard_course_project_transcript_entries
before insert or update on public.transcript_entries
for each row
execute function public.guard_course_project_write();

create or replace function public.guard_exam_result_grades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := public.current_user_role();

  if v_role in ('admin', 'staff', 'instructor', 'super_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'FORBIDDEN_EXAM_GRADE_WRITE'
      using errcode = '42501',
            hint = 'Only admin, staff, or the exam instructor may create exam results.';
  end if;

  if new.raw_score is distinct from old.raw_score
     or new.final_score is distinct from old.final_score
     or new.answers is distinct from old.answers
     or new.comments is distinct from old.comments
     or new.graded_by is distinct from old.graded_by
     or new.graded_at is distinct from old.graded_at
     or new.course_project is distinct from old.course_project
  then
    raise exception 'FORBIDDEN_EXAM_GRADE_WRITE'
      using errcode = '42501',
            hint = 'Only admin, staff, or the exam instructor may update exam grades.';
  end if;

  return new;
end;
$$;

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
