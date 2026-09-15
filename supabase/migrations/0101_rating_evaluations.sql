-- =====================================================================
--  0101_rating_evaluations.sql
--  Course / instructor Rating Evaluation (separate from assignments)
-- =====================================================================

create table if not exists public.rating_evaluations (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_id       uuid not null references public.classes(id) on delete cascade,
  course_id      uuid references public.courses(id) on delete set null,
  title          text not null,
  description    text,
  due_date       timestamptz,
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_rating_evaluations_institution
  on public.rating_evaluations(institution_id);
create index if not exists idx_rating_evaluations_class
  on public.rating_evaluations(class_id);
create index if not exists idx_rating_evaluations_active
  on public.rating_evaluations(class_id, is_active);

comment on table public.rating_evaluations is
  'Course/instructor satisfaction surveys created by admin/staff; separate from graded assignments.';

create table if not exists public.rating_questions (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  evaluation_id  uuid not null references public.rating_evaluations(id) on delete cascade,
  text           text not null,
  type           text not null default 'likert'
                 check (type in ('likert', 'mcq', 'text')),
  options        jsonb not null default '[]'::jsonb,
  order_index    int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_rating_questions_evaluation
  on public.rating_questions(evaluation_id, order_index);
create index if not exists idx_rating_questions_institution
  on public.rating_questions(institution_id);

create table if not exists public.rating_responses (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  evaluation_id  uuid not null references public.rating_evaluations(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  answers        jsonb not null default '[]'::jsonb,
  submitted_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (evaluation_id, student_id)
);

create index if not exists idx_rating_responses_evaluation
  on public.rating_responses(evaluation_id);
create index if not exists idx_rating_responses_student
  on public.rating_responses(student_id);
create index if not exists idx_rating_responses_institution
  on public.rating_responses(institution_id);

-- Helpers
create or replace function public.is_enrolled_in_rating_evaluation(p_evaluation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rating_evaluations e
    where e.id = p_evaluation
      and public.is_enrolled_in_class(e.class_id)
  );
$$;

create or replace function public.set_institution_from_rating_evaluation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select institution_id into new.institution_id
  from public.rating_evaluations
  where id = new.evaluation_id;
  return new;
end;
$$;

drop trigger if exists trg_rating_questions_inst on public.rating_questions;
create trigger trg_rating_questions_inst
before insert on public.rating_questions
for each row
when (new.institution_id is null)
execute function public.set_institution_from_rating_evaluation();

drop trigger if exists trg_rating_responses_inst on public.rating_responses;
create trigger trg_rating_responses_inst
before insert on public.rating_responses
for each row
when (new.institution_id is null)
execute function public.set_institution_from_rating_evaluation();

alter table public.rating_evaluations enable row level security;
alter table public.rating_questions enable row level security;
alter table public.rating_responses enable row level security;

-- Evaluations: admin/staff manage; enrolled students see active ones
drop policy if exists "reval_select" on public.rating_evaluations;
create policy "reval_select" on public.rating_evaluations for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or (public.is_enrolled_in_class(class_id) and is_active = true)
  )
);

drop policy if exists "reval_insert" on public.rating_evaluations;
create policy "reval_insert" on public.rating_evaluations for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

drop policy if exists "reval_update" on public.rating_evaluations;
create policy "reval_update" on public.rating_evaluations for update
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
)
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

drop policy if exists "reval_delete" on public.rating_evaluations;
create policy "reval_delete" on public.rating_evaluations for delete
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

-- Questions: admin/staff manage; enrolled students read for active evaluations
drop policy if exists "rq_select" on public.rating_questions;
create policy "rq_select" on public.rating_questions for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_enrolled_in_rating_evaluation(evaluation_id)
  )
);

drop policy if exists "rq_insert" on public.rating_questions;
create policy "rq_insert" on public.rating_questions for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

drop policy if exists "rq_update" on public.rating_questions;
create policy "rq_update" on public.rating_questions for update
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
)
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

drop policy if exists "rq_delete" on public.rating_questions;
create policy "rq_delete" on public.rating_questions for delete
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

-- Responses: students insert own; admin/staff read all; students read own
drop policy if exists "rr_select" on public.rating_responses;
create policy "rr_select" on public.rating_responses for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or student_id = auth.uid()
  )
);

drop policy if exists "rr_insert" on public.rating_responses;
create policy "rr_insert" on public.rating_responses for insert
with check (
  institution_id = public.current_institution_id()
  and student_id = auth.uid()
  and public.is_enrolled_in_rating_evaluation(evaluation_id)
);

drop policy if exists "rr_update" on public.rating_responses;
create policy "rr_update" on public.rating_responses for update
using (
  institution_id = public.current_institution_id()
  and student_id = auth.uid()
)
with check (
  institution_id = public.current_institution_id()
  and student_id = auth.uid()
);

drop policy if exists "rr_delete" on public.rating_responses;
create policy "rr_delete" on public.rating_responses for delete
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

revoke all on function public.is_enrolled_in_rating_evaluation(uuid) from public;
grant execute on function public.is_enrolled_in_rating_evaluation(uuid) to authenticated, service_role;
