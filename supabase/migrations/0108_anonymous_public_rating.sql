-- Public rating forms are anonymous: name/phone no longer required.
create or replace function public.submit_public_rating_response(
  p_token uuid,
  p_respondent_name text default null,
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

  -- Optional identity (kept for backwards compatibility; UI no longer collects it)
  v_name := nullif(trim(coalesce(p_respondent_name, '')), '');
  if v_name is not null and length(v_name) > 120 then
    raise exception 'INVALID_NAME';
  end if;

  v_phone := nullif(trim(coalesce(p_respondent_phone, '')), '');
  if v_phone is not null then
    if length(v_phone) < 7 or length(v_phone) > 32 then
      raise exception 'INVALID_PHONE';
    end if;
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

  -- Soft rate limit for anonymous / identified public submissions
  if v_phone is not null or v_name is not null then
    select count(*)::int into v_recent
    from public.rating_responses r
    where r.evaluation_id = v_eval.id
      and r.source = 'public'
      and r.submitted_at > now() - interval '10 minutes'
      and (
        (v_phone is not null and lower(coalesce(r.respondent_phone, '')) = lower(v_phone))
        or (v_name is not null and lower(coalesce(r.respondent_name, '')) = lower(v_name))
      );
    if v_recent >= 3 then
      raise exception 'RATE_LIMITED';
    end if;
  else
    select count(*)::int into v_recent
    from public.rating_responses r
    where r.evaluation_id = v_eval.id
      and r.source = 'public'
      and r.respondent_name is null
      and r.respondent_phone is null
      and r.submitted_at > now() - interval '2 minutes';
    if v_recent >= 12 then
      raise exception 'RATE_LIMITED';
    end if;
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

comment on function public.submit_public_rating_response(uuid, text, text, jsonb) is
  'Anonymous public rating submit via share token. Name/phone optional.';
