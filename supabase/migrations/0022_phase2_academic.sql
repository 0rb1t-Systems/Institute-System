-- =====================================================================
--  0022_phase2_academic.sql
--  Phase 2 — Academic Operations schema + gradebook sync triggers
-- =====================================================================

create type exam_marking_type as enum ('manual', 'mcq');
create type credential_status as enum ('draft', 'issued', 'revoked');
create type gradebook_source as enum ('auto', 'manual');

-- ---------------------------------------------------------------------
-- class_courses — multi-course links for diploma/extra courses on a class
-- ---------------------------------------------------------------------
create table class_courses (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  class_id       uuid not null references classes(id) on delete cascade,
  course_id      uuid not null references courses(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (class_id, course_id)
);
create index idx_class_courses_institution on class_courses(institution_id);
create index idx_class_courses_class on class_courses(class_id);

-- ---------------------------------------------------------------------
-- exams
-- ---------------------------------------------------------------------
create table exams (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references institutions(id) on delete cascade,
  class_id         uuid not null references classes(id) on delete cascade,
  course_id        uuid references courses(id) on delete set null,
  title            text not null,
  description      text,
  marking_type     exam_marking_type not null default 'manual',
  final_marks      numeric(8,2) not null default 100,
  attendance_marks numeric(8,2) not null default 0,
  weight           numeric(5,2) not null default 100
                   check (weight >= 0 and weight <= 100),
  open_time        timestamptz not null default now(),
  close_time       timestamptz not null default (now() + interval '1 year'),
  is_active        boolean not null default false,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index idx_exams_institution on exams(institution_id);
create index idx_exams_class on exams(class_id);
create index idx_exams_course on exams(course_id);

-- ---------------------------------------------------------------------
-- exam_questions
-- ---------------------------------------------------------------------
create table exam_questions (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  exam_id        uuid not null references exams(id) on delete cascade,
  text           text not null,
  type           text not null default 'mcq',
  options        jsonb not null default '[]'::jsonb,
  correct_answer text,
  marks          numeric(8,2) not null default 1,
  order_index    int not null default 0,
  created_at     timestamptz not null default now()
);
create index idx_exam_questions_exam on exam_questions(exam_id);
create index idx_exam_questions_institution on exam_questions(institution_id);

-- ---------------------------------------------------------------------
-- exam_results
-- ---------------------------------------------------------------------
create table exam_results (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  exam_id        uuid not null references exams(id) on delete cascade,
  student_id     uuid not null references profiles(id) on delete cascade,
  enrollment_id  uuid references enrollments(id) on delete set null,
  raw_score      numeric(8,2) not null default 0,
  final_score    numeric(8,2) not null default 0,
  answers        jsonb not null default '[]'::jsonb,
  comments       text,
  graded_by      uuid references profiles(id) on delete set null,
  graded_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (exam_id, student_id)
);
create index idx_exam_results_institution on exam_results(institution_id);
create index idx_exam_results_student on exam_results(student_id);
create index idx_exam_results_exam on exam_results(exam_id);

-- ---------------------------------------------------------------------
-- assignments
-- ---------------------------------------------------------------------
create table assignments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  class_id       uuid not null references classes(id) on delete cascade,
  title          text not null,
  description    text,
  due_date       timestamptz,
  total_marks    numeric(8,2) not null default 100,
  attachment_url text,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index idx_assignments_institution on assignments(institution_id);
create index idx_assignments_class on assignments(class_id);

-- ---------------------------------------------------------------------
-- assignment_submissions
-- ---------------------------------------------------------------------
create table assignment_submissions (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  assignment_id  uuid not null references assignments(id) on delete cascade,
  student_id     uuid not null references profiles(id) on delete cascade,
  content        text,
  file_url       text,
  submitted_at   timestamptz not null default now(),
  score          numeric(8,2),
  feedback       text,
  graded_by      uuid references profiles(id) on delete set null,
  graded_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index idx_assignment_submissions_institution on assignment_submissions(institution_id);
create index idx_assignment_submissions_student on assignment_submissions(student_id);
create index idx_assignment_submissions_assignment on assignment_submissions(assignment_id);

-- ---------------------------------------------------------------------
-- gradebook_entries — per-course finals synced from weighted exams
-- ---------------------------------------------------------------------
create table gradebook_entries (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  enrollment_id  uuid not null references enrollments(id) on delete cascade,
  class_id       uuid not null references classes(id) on delete cascade,
  course_id      uuid not null references courses(id) on delete cascade,
  student_id     uuid not null references profiles(id) on delete cascade,
  final_mark     numeric(8,2) not null default 0,
  letter_grade   text,
  source         gradebook_source not null default 'auto',
  synced_at      timestamptz not null default now(),
  unique (enrollment_id, course_id)
);
create index idx_gradebook_institution on gradebook_entries(institution_id);
create index idx_gradebook_class on gradebook_entries(class_id);
create index idx_gradebook_student on gradebook_entries(student_id);

-- ---------------------------------------------------------------------
-- transcripts + entries
-- ---------------------------------------------------------------------
create table transcripts (
  id                uuid primary key default gen_random_uuid(),
  institution_id    uuid not null references institutions(id) on delete cascade,
  student_id        uuid not null references profiles(id) on delete cascade,
  enrollment_id     uuid references enrollments(id) on delete set null,
  class_id          uuid references classes(id) on delete set null,
  verification_code text not null unique default encode(gen_random_bytes(16), 'hex'),
  status            credential_status not null default 'issued',
  issued_at         timestamptz not null default now(),
  issued_by         uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index idx_transcripts_institution on transcripts(institution_id);
create index idx_transcripts_student on transcripts(student_id);
create index idx_transcripts_code on transcripts(verification_code);

create table transcript_entries (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  transcript_id  uuid not null references transcripts(id) on delete cascade,
  course_id      uuid not null references courses(id) on delete cascade,
  mark           numeric(8,2) not null default 0,
  grade          text,
  exam_id        uuid references exams(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (transcript_id, course_id)
);
create index idx_transcript_entries_transcript on transcript_entries(transcript_id);

-- ---------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------
create table certificates (
  id                  uuid primary key default gen_random_uuid(),
  institution_id      uuid not null references institutions(id) on delete cascade,
  student_id          uuid not null references profiles(id) on delete cascade,
  enrollment_id       uuid references enrollments(id) on delete set null,
  class_id            uuid references classes(id) on delete set null,
  certificate_number  text not null,
  verification_code   text not null unique default encode(gen_random_bytes(16), 'hex'),
  status              credential_status not null default 'issued',
  issued_at           timestamptz not null default now(),
  issued_by           uuid references profiles(id) on delete set null,
  template_snapshot   jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (institution_id, certificate_number)
);
create index idx_certificates_institution on certificates(institution_id);
create index idx_certificates_student on certificates(student_id);
create index idx_certificates_code on certificates(verification_code);

-- =====================================================================
--  Helpers: letter grade + institution inheritance
-- =====================================================================

create or replace function public.letter_from_mark(m numeric)
returns text
language sql
immutable
as $$
  select case
    when m is null then null
    when m >= 90 then 'A'
    when m >= 80 then 'B'
    when m >= 70 then 'C'
    when m >= 60 then 'D'
    else 'F'
  end
$$;

create or replace function public.set_institution_from_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institution_id is null then
    select institution_id into new.institution_id
    from public.classes where id = new.class_id;
  end if;
  return new;
end;
$$;

create or replace function public.set_institution_from_exam()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institution_id is null then
    select institution_id into new.institution_id
    from public.exams where id = new.exam_id;
  end if;
  return new;
end;
$$;

create or replace function public.set_institution_from_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institution_id is null then
    select institution_id into new.institution_id
    from public.assignments where id = new.assignment_id;
  end if;
  return new;
end;
$$;

create trigger trg_class_courses_inst
before insert on class_courses
for each row execute function public.set_institution_from_class();

create trigger trg_exams_inst
before insert on exams
for each row execute function public.set_institution_from_class();

create trigger trg_assignments_inst
before insert on assignments
for each row execute function public.set_institution_from_class();

create trigger trg_exam_questions_inst
before insert on exam_questions
for each row execute function public.set_institution_from_exam();

create trigger trg_exam_results_inst
before insert on exam_results
for each row execute function public.set_institution_from_exam();

create trigger trg_assignment_submissions_inst
before insert on assignment_submissions
for each row execute function public.set_institution_from_assignment();

-- =====================================================================
--  Gradebook sync from weighted exam results
-- =====================================================================

create or replace function public.resync_gradebook_for_student_course(
  p_student_id uuid,
  p_class_id uuid,
  p_course_id uuid,
  p_institution_id uuid,
  p_enrollment_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment_id uuid;
  v_total_weight numeric;
  v_weighted_sum numeric;
  v_final numeric;
begin
  if p_course_id is null then
    return;
  end if;

  v_enrollment_id := p_enrollment_id;
  if v_enrollment_id is null then
    select id into v_enrollment_id
    from public.enrollments
    where student_id = p_student_id and class_id = p_class_id
    limit 1;
  end if;
  if v_enrollment_id is null then
    return;
  end if;

  select
    coalesce(sum(ex.weight), 0),
    coalesce(sum(
      case when er.id is not null and ex.final_marks > 0
        then (er.final_score / ex.final_marks) * 100 * ex.weight
        else 0
      end
    ), 0)
  into v_total_weight, v_weighted_sum
  from public.exams ex
  left join public.exam_results er
    on er.exam_id = ex.id and er.student_id = p_student_id
  where ex.class_id = p_class_id
    and ex.course_id = p_course_id
    and ex.institution_id = p_institution_id;

  if v_total_weight <= 0 then
    -- No exams left contributing — remove auto gradebook row
    delete from public.gradebook_entries
    where enrollment_id = v_enrollment_id
      and course_id = p_course_id
      and source = 'auto';
    return;
  end if;

  v_final := round(v_weighted_sum / v_total_weight, 2);

  insert into public.gradebook_entries as ge (
    institution_id, enrollment_id, class_id, course_id, student_id,
    final_mark, letter_grade, source, synced_at
  ) values (
    p_institution_id, v_enrollment_id, p_class_id, p_course_id, p_student_id,
    v_final, public.letter_from_mark(v_final), 'auto', now()
  )
  on conflict (enrollment_id, course_id) do update
  set final_mark   = excluded.final_mark,
      letter_grade = excluded.letter_grade,
      source       = case when ge.source = 'manual' then ge.source else 'auto' end,
      synced_at    = now()
  where ge.source = 'auto';
end;
$$;

create or replace function public.sync_gradebook_for_result(p_result_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select er.student_id, er.enrollment_id, ex.class_id, ex.course_id, ex.institution_id as inst_id
    into r
  from public.exam_results er
  join public.exams ex on ex.id = er.exam_id
  where er.id = p_result_id;

  if not found then
    return;
  end if;

  perform public.resync_gradebook_for_student_course(
    r.student_id, r.class_id, r.course_id, r.inst_id, r.enrollment_id
  );
end;
$$;

create or replace function public.trg_sync_gradebook_on_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_course_id uuid;
  v_inst uuid;
begin
  if tg_op = 'DELETE' then
    select class_id, course_id, institution_id
      into v_class_id, v_course_id, v_inst
    from public.exams where id = old.exam_id;
    perform public.resync_gradebook_for_student_course(
      old.student_id, v_class_id, v_course_id, v_inst, old.enrollment_id
    );
    return old;
  end if;

  perform public.sync_gradebook_for_result(new.id);
  return new;
end;
$$;

create trigger trg_exam_results_gradebook
after insert or update or delete on exam_results
for each row execute function public.trg_sync_gradebook_on_result();

-- =====================================================================
--  Finalize gradebook → transcript for a class
-- =====================================================================

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
begin
  if not (public.is_admin_or_staff() or public.is_class_instructor(p_class_id)) then
    raise exception 'Not authorized to finalize gradebook';
  end if;

  select institution_id into v_inst from public.classes where id = p_class_id;
  if v_inst is null or v_inst is distinct from public.current_institution_id() then
    raise exception 'Class not found in current institution';
  end if;

  -- One transcript per enrollment; upsert entries from gradebook
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
        institution_id, student_id, enrollment_id, class_id, issued_by, status
      ) values (
        v_inst, rec.student_id, rec.enrollment_id, p_class_id, auth.uid(), 'issued'
      )
      returning id into v_transcript_id;
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

alter table class_courses enable row level security;
alter table exams enable row level security;
alter table exam_questions enable row level security;
alter table exam_results enable row level security;
alter table assignments enable row level security;
alter table assignment_submissions enable row level security;
alter table gradebook_entries enable row level security;
alter table transcripts enable row level security;
alter table transcript_entries enable row level security;
alter table certificates enable row level security;
