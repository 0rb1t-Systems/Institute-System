-- =============================================================================
-- 0046_student_mcq_exam_taking.sql
-- Online MCQ / student exam-taking:
--   - duration_minutes on exams
--   - get_exam_paper_for_student  (questions WITHOUT correct_answer)
--   - submit_exam_attempt         (server-side auto-grade + one attempt)
-- Students never get SELECT on exam_questions (answers stay server-side).
-- =============================================================================

alter table public.exams
  add column if not exists duration_minutes integer not null default 60
    check (duration_minutes > 0 and duration_minutes <= 600);

comment on column public.exams.duration_minutes is
  'Timed attempt window for MCQ exams (minutes). Client countdown is advisory; close_time is authoritative.';

-- ---------------------------------------------------------------------------
-- get_exam_paper_for_student
-- Returns exam meta + questions (no correct_answer) when the student may sit.
-- ---------------------------------------------------------------------------
create or replace function public.get_exam_paper_for_student(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.exams%rowtype;
  v_questions jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_exam
  from public.exams e
  where e.id = p_exam_id
    and e.institution_id = public.current_institution_id();

  if not found then
    raise exception 'Exam not found';
  end if;

  if v_exam.marking_type <> 'mcq' then
    raise exception 'This exam is not an online MCQ exam';
  end if;

  if not v_exam.is_active then
    raise exception 'Exam is not published';
  end if;

  if now() < v_exam.open_time then
    raise exception 'Exam has not opened yet';
  end if;

  if now() > v_exam.close_time then
    raise exception 'Exam window has closed';
  end if;

  if not public.is_enrolled_in_exam(p_exam_id) then
    raise exception 'You are not enrolled in this exam class';
  end if;

  if exists (
    select 1 from public.exam_results r
    where r.exam_id = p_exam_id and r.student_id = v_uid
  ) then
    raise exception 'You have already submitted this exam';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'options', q.options,
      'marks', q.marks,
      'order_index', q.order_index
    ) order by q.order_index, q.created_at
  ), '[]'::jsonb)
  into v_questions
  from public.exam_questions q
  where q.exam_id = p_exam_id;

  if jsonb_array_length(v_questions) = 0 then
    raise exception 'This exam has no questions yet';
  end if;

  return jsonb_build_object(
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'title', v_exam.title,
      'description', v_exam.description,
      'class_id', v_exam.class_id,
      'course_id', v_exam.course_id,
      'final_marks', v_exam.final_marks,
      'passing_score', v_exam.passing_score,
      'duration_minutes', v_exam.duration_minutes,
      'open_time', v_exam.open_time,
      'close_time', v_exam.close_time
    ),
    'questions', v_questions
  );
end;
$$;

revoke all on function public.get_exam_paper_for_student(uuid) from public, anon;
grant execute on function public.get_exam_paper_for_student(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- submit_exam_attempt
-- p_answers: [{ "question_id": uuid, "answer": text }, ...]
-- Auto-grades mcq / true_false; text answers stored with marks_awarded 0.
-- One attempt only (unique exam_id, student_id).
-- ---------------------------------------------------------------------------
create or replace function public.submit_exam_attempt(
  p_exam_id uuid,
  p_answers jsonb default '[]'::jsonb
)
returns public.exam_results
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.exams%rowtype;
  v_enrollment_id uuid;
  v_q record;
  v_given text;
  v_correct boolean;
  v_awarded numeric(8,2);
  v_raw numeric(8,2) := 0;
  v_detail jsonb := '[]'::jsonb;
  v_answer_map jsonb;
  v_row public.exam_results;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Answers must be a JSON array';
  end if;

  select * into v_exam
  from public.exams e
  where e.id = p_exam_id
    and e.institution_id = public.current_institution_id()
  for update;

  if not found then
    raise exception 'Exam not found';
  end if;

  if v_exam.marking_type <> 'mcq' then
    raise exception 'This exam is not an online MCQ exam';
  end if;

  if not v_exam.is_active then
    raise exception 'Exam is not published';
  end if;

  if now() < v_exam.open_time then
    raise exception 'Exam has not opened yet';
  end if;

  if now() > v_exam.close_time then
    raise exception 'Exam window has closed';
  end if;

  if not public.is_enrolled_in_exam(p_exam_id) then
    raise exception 'You are not enrolled in this exam class';
  end if;

  if exists (
    select 1 from public.exam_results r
    where r.exam_id = p_exam_id and r.student_id = v_uid
  ) then
    raise exception 'You have already submitted this exam';
  end if;

  select e.id into v_enrollment_id
  from public.enrollments e
  where e.class_id = v_exam.class_id
    and e.student_id = v_uid
  limit 1;

  -- Map question_id -> answer (last wins)
  select coalesce(jsonb_object_agg(a.qid, a.ans), '{}'::jsonb)
  into v_answer_map
  from (
    select
      (elem->>'question_id')::uuid as qid,
      nullif(trim(coalesce(elem->>'answer', '')), '') as ans
    from jsonb_array_elements(p_answers) elem
    where (elem->>'question_id') is not null
      and (elem->>'question_id') ~* '^[0-9a-f-]{36}$'
  ) a;

  for v_q in
    select * from public.exam_questions q
    where q.exam_id = p_exam_id
    order by q.order_index, q.created_at
  loop
    v_given := v_answer_map ->> v_q.id::text;
    v_correct := false;
    v_awarded := 0;

    if v_q.type in ('mcq', 'true_false') then
      if v_given is not null
         and v_q.correct_answer is not null
         and lower(trim(v_given)) = lower(trim(v_q.correct_answer))
      then
        v_correct := true;
        v_awarded := coalesce(v_q.marks, 0);
      end if;
      v_raw := v_raw + v_awarded;

      v_detail := v_detail || jsonb_build_array(jsonb_build_object(
        'question_id', v_q.id,
        'answer', v_given,
        'is_correct', v_correct,
        'marks_awarded', v_awarded,
        'marks', v_q.marks,
        'question_text', v_q.text,
        'question_type', v_q.type,
        'options', v_q.options,
        'correct_answer', v_q.correct_answer
      ));
    else
      -- Written answers: stored for later manual review; no auto marks
      v_detail := v_detail || jsonb_build_array(jsonb_build_object(
        'question_id', v_q.id,
        'answer', v_given,
        'is_correct', null,
        'marks_awarded', 0,
        'marks', v_q.marks,
        'question_text', v_q.text,
        'question_type', v_q.type,
        'options', v_q.options,
        'correct_answer', null,
        'needs_manual_review', true
      ));
    end if;
  end loop;

  insert into public.exam_results (
    institution_id,
    exam_id,
    student_id,
    enrollment_id,
    raw_score,
    final_score,
    answers,
    comments,
    graded_by,
    graded_at
  ) values (
    v_exam.institution_id,
    p_exam_id,
    v_uid,
    v_enrollment_id,
    v_raw,
    v_raw,
    v_detail,
    'Auto-graded MCQ submission',
    null,
    now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_exam_attempt(uuid, jsonb) from public, anon;
grant execute on function public.submit_exam_attempt(uuid, jsonb) to authenticated, service_role;
