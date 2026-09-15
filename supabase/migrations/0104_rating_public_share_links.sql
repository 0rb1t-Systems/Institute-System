-- =====================================================================
--  0104_rating_public_share_links.sql
--  Secure public share links so visitors can submit rating feedback
--  without logging in (token-gated RPCs; no anon table access).
-- =====================================================================

-- Unguessable share token per evaluation
alter table public.rating_evaluations
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists idx_rating_evaluations_public_token
  on public.rating_evaluations(public_token);

-- Guest / public respondents (no student profile required)
alter table public.rating_responses
  alter column student_id drop not null;

alter table public.rating_responses
  add column if not exists respondent_name text,
  add column if not exists respondent_phone text,
  add column if not exists source text not null default 'student'
    check (source in ('student', 'public'));

comment on column public.rating_evaluations.public_token is
  'Opaque share token for public feedback links; never use evaluation id in public URLs.';
comment on column public.rating_responses.source is
  'student = logged-in enrolled student; public = token-link visitor.';

-- One public submission per phone per evaluation (when phone provided)
create unique index if not exists idx_rating_responses_public_phone
  on public.rating_responses (evaluation_id, lower(respondent_phone))
  where source = 'public'
    and respondent_phone is not null
    and length(trim(respondent_phone)) > 0;

-- Student uniqueness: UNIQUE allows multiple NULL student_id (public guests).
-- Keep / restore named constraint so PostgREST upsert onConflict works.
alter table public.rating_responses
  drop constraint if exists rating_responses_evaluation_id_student_id_key;

alter table public.rating_responses
  add constraint rating_responses_evaluation_id_student_id_key
  unique (evaluation_id, student_id);

-- ─── Public read (token only; active & not past due) ─────────────────────────
create or replace function public.get_public_rating_evaluation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.rating_evaluations%rowtype;
  v_inst_name text;
  v_questions jsonb;
begin
  if p_token is null then
    raise exception 'INVALID_TOKEN';
  end if;

  select * into v_eval
  from public.rating_evaluations
  where public_token = p_token
  limit 1;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  -- Open/Closed is controlled only by is_active (same as student portal).
  if v_eval.is_active is not true then
    raise exception 'CLOSED';
  end if;

  select name into v_inst_name
  from public.institutions
  where id = v_eval.institution_id
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'text', q.text,
      'type', q.type,
      'options', q.options,
      'order_index', q.order_index
    )
    order by q.order_index asc, q.created_at asc
  ), '[]'::jsonb)
  into v_questions
  from public.rating_questions q
  where q.evaluation_id = v_eval.id;

  return jsonb_build_object(
    'token', v_eval.public_token,
    'title', v_eval.title,
    'description', v_eval.description,
    'due_date', v_eval.due_date,
    'institution_name', coalesce(v_inst_name, 'Institution'),
    'questions', v_questions
  );
end;
$$;

revoke all on function public.get_public_rating_evaluation(uuid) from public;
grant execute on function public.get_public_rating_evaluation(uuid) to anon, authenticated, service_role;

-- ─── Public submit (token-gated; validates answers; anti-spam) ───────────────
create or replace function public.submit_public_rating_response(
  p_token uuid,
  p_respondent_name text,
  p_respondent_phone text default null,
  p_answers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eval public.rating_evaluations%rowtype;
  v_name text;
  v_phone text;
  v_answers jsonb;
  v_qid uuid;
  v_val text;
  v_q public.rating_questions%rowtype;
  v_expected int;
  v_got int := 0;
  v_id uuid;
  v_recent int;
begin
  if p_token is null then
    raise exception 'INVALID_TOKEN';
  end if;

  v_name := trim(coalesce(p_respondent_name, ''));
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'INVALID_NAME';
  end if;

  v_phone := nullif(trim(coalesce(p_respondent_phone, '')), '');
  if v_phone is not null then
    if length(v_phone) < 7 or length(v_phone) > 32 then
      raise exception 'INVALID_PHONE';
    end if;
    -- keep digits / + / spaces / dashes only
    if v_phone !~ '^\+?[0-9][0-9\s\-]{5,30}$' then
      raise exception 'INVALID_PHONE';
    end if;
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'INVALID_ANSWERS';
  end if;

  select * into v_eval
  from public.rating_evaluations
  where public_token = p_token
  limit 1;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_eval.is_active is not true then
    raise exception 'CLOSED';
  end if;

  -- Soft rate limit: max 8 public submissions from same phone OR same name
  -- in 10 minutes for this evaluation (abuse guard).
  select count(*)::int into v_recent
  from public.rating_responses r
  where r.evaluation_id = v_eval.id
    and r.source = 'public'
    and r.submitted_at > now() - interval '10 minutes'
    and (
      (v_phone is not null and lower(coalesce(r.respondent_phone, '')) = lower(v_phone))
      or lower(coalesce(r.respondent_name, '')) = lower(v_name)
    );
  if v_recent >= 3 then
    raise exception 'RATE_LIMITED';
  end if;

  select count(*)::int into v_expected
  from public.rating_questions
  where evaluation_id = v_eval.id;

  if v_expected < 1 then
    raise exception 'NO_QUESTIONS';
  end if;

  v_answers := '[]'::jsonb;

  for v_qid, v_val in
    select
      (elem->>'question_id')::uuid,
      trim(coalesce(elem->>'value', ''))
    from jsonb_array_elements(p_answers) as elem
  loop
    if v_qid is null then
      raise exception 'INVALID_ANSWERS';
    end if;
    if length(v_val) < 1 or length(v_val) > 2000 then
      raise exception 'INVALID_ANSWERS';
    end if;

    select * into v_q
    from public.rating_questions
    where id = v_qid
      and evaluation_id = v_eval.id
    limit 1;

    if not found then
      raise exception 'INVALID_ANSWERS';
    end if;

    -- Choice questions must match an option value
    if v_q.type in ('likert', 'mcq') then
      if not exists (
        select 1
        from jsonb_array_elements(coalesce(v_q.options, '[]'::jsonb)) opt
        where opt->>'value' = v_val
      ) then
        raise exception 'INVALID_ANSWERS';
      end if;
    end if;

    v_answers := v_answers || jsonb_build_array(
      jsonb_build_object('question_id', v_qid, 'value', v_val)
    );
    v_got := v_got + 1;
  end loop;

  if v_got <> v_expected then
    raise exception 'INCOMPLETE_ANSWERS';
  end if;

  -- Phone-based uniqueness: update existing public row when same phone
  if v_phone is not null then
    update public.rating_responses
    set
      respondent_name = v_name,
      answers = v_answers,
      submitted_at = now()
    where evaluation_id = v_eval.id
      and source = 'public'
      and lower(respondent_phone) = lower(v_phone)
    returning id into v_id;

    if v_id is not null then
      return jsonb_build_object('id', v_id, 'updated', true);
    end if;
  end if;

  insert into public.rating_responses (
    institution_id,
    evaluation_id,
    student_id,
    respondent_name,
    respondent_phone,
    source,
    answers,
    submitted_at
  ) values (
    v_eval.institution_id,
    v_eval.id,
    null,
    v_name,
    v_phone,
    'public',
    v_answers,
    now()
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'updated', false);
end;
$$;

revoke all on function public.submit_public_rating_response(uuid, text, text, jsonb) from public;
grant execute on function public.submit_public_rating_response(uuid, text, text, jsonb) to anon, authenticated, service_role;

-- Rotate token (admin/staff of same institution only)
create or replace function public.rotate_rating_public_token(p_evaluation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_inst uuid;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;
  if not public.is_admin_or_staff() then
    raise exception 'FORBIDDEN';
  end if;

  select institution_id into v_inst
  from public.rating_evaluations
  where id = p_evaluation_id;

  if v_inst is null or v_inst is distinct from public.current_institution_id() then
    raise exception 'NOT_FOUND';
  end if;

  update public.rating_evaluations
  set public_token = gen_random_uuid()
  where id = p_evaluation_id
  returning public_token into v_token;

  return v_token;
end;
$$;

revoke all on function public.rotate_rating_public_token(uuid) from public;
grant execute on function public.rotate_rating_public_token(uuid) to authenticated, service_role;
