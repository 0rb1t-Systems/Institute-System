-- Diploma semesters (curriculum structure) + snapshot onto issued transcript lines.

create table if not exists public.diploma_semesters (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  diploma_id     uuid not null references public.diplomas(id) on delete cascade,
  name           text not null,
  sort_order     integer not null default 1,
  created_at     timestamptz not null default now()
);

create index if not exists idx_diploma_semesters_institution
  on public.diploma_semesters(institution_id);
create index if not exists idx_diploma_semesters_diploma_sort
  on public.diploma_semesters(diploma_id, sort_order);

comment on table public.diploma_semesters is
  'Semesters belong to a diploma program. Classes and students do not own semesters.';

alter table public.diploma_courses
  add column if not exists semester_id uuid references public.diploma_semesters(id) on delete set null;

create index if not exists idx_diploma_courses_semester
  on public.diploma_courses(semester_id);

alter table public.transcript_entries
  add column if not exists semester_name text,
  add column if not exists semester_sort integer;

comment on column public.transcript_entries.semester_name is
  'Snapshot of diploma semester name at issue time (transcript layout).';
comment on column public.transcript_entries.semester_sort is
  'Snapshot of diploma semester order at issue time.';

alter table public.diploma_semesters enable row level security;

drop policy if exists "dsem_select" on public.diploma_semesters;
drop policy if exists "dsem_insert" on public.diploma_semesters;
drop policy if exists "dsem_update" on public.diploma_semesters;
drop policy if exists "dsem_delete" on public.diploma_semesters;

create policy "dsem_select" on public.diploma_semesters for select
using (institution_id = public.current_institution_id());

create policy "dsem_insert" on public.diploma_semesters for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

create policy "dsem_update" on public.diploma_semesters for update
using  (institution_id = public.current_institution_id() and public.is_admin_or_staff())
with check (institution_id = public.current_institution_id() and public.is_admin_or_staff());

create policy "dsem_delete" on public.diploma_semesters for delete
using (institution_id = public.current_institution_id() and public.is_admin_or_staff());

grant select, insert, update, delete on table public.diploma_semesters to authenticated;
grant all on table public.diploma_semesters to service_role;

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
      if v_diploma is not null then
        select ds.name, ds.sort_order
          into v_sem_name, v_sem_sort
        from public.diploma_courses dc
        join public.diploma_semesters ds on ds.id = dc.semester_id
        where dc.diploma_id = v_diploma
          and dc.course_id = ent.course_id
        limit 1;
      end if;

      insert into public.transcript_entries (
        institution_id, transcript_id, course_id, mark, grade, semester_name, semester_sort
      ) values (
        v_inst, v_transcript_id, ent.course_id, ent.final_mark, ent.letter_grade, v_sem_name, v_sem_sort
      )
      on conflict (transcript_id, course_id) do update
      set mark = excluded.mark,
          grade = excluded.grade,
          semester_name = excluded.semester_name,
          semester_sort = excluded.semester_sort;
    end loop;
  end loop;

  return p_class_id;
end;
$$;
