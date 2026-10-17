-- Require phone on public registration inquiries (online forms).
create or replace function public.submit_registration_inquiry(
  p_subdomain text,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_university text default null,
  p_faculty text default null,
  p_year_of_study text default null,
  p_class_id uuid default null,
  p_affiliate_id uuid default null,
  p_notes text default null,
  p_preferred_course_id uuid default null,
  p_preferred_diploma_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inst institutions%rowtype;
  v_aff profiles%rowtype;
  v_class classes%rowtype;
  v_id uuid;
  v_email text;
  v_phone text;
  v_month date := date_trunc('month', current_date)::date;
  v_restriction jsonb;
  v_restricted boolean;
  v_programs jsonb;
  v_pref_course uuid := p_preferred_course_id;
  v_pref_diploma uuid := p_preferred_diploma_id;
  v_class_id uuid := p_class_id;
  v_allowed boolean := false;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then raise exception 'INVALID_SUBDOMAIN'; end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then raise exception 'INVALID_NAME'; end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^@]+@[^@]+\.[^@]+$' then raise exception 'INVALID_EMAIL'; end if;

  v_phone := nullif(trim(coalesce(p_phone, '')), '');
  if v_phone is null then raise exception 'PHONE_REQUIRED'; end if;

  if v_pref_course is not null and v_pref_diploma is not null then raise exception 'INVALID_PROGRAM'; end if;

  select * into v_inst from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain)) and coalesce(status, 'active') = 'active' limit 1;
  if not found then raise exception 'INSTITUTION_NOT_FOUND'; end if;

  if p_affiliate_id is not null then
    select * into v_aff from public.profiles
    where id = p_affiliate_id and institution_id = v_inst.id and role = 'affiliate' and status = 'approved' limit 1;
    if not found then raise exception 'INVALID_AFFILIATE'; end if;
  end if;

  v_restriction := public.registration_program_restriction(v_inst.id, p_affiliate_id);
  v_restricted := coalesce((v_restriction->>'restricted')::boolean, false);
  v_programs := coalesce(v_restriction->'programs', '[]'::jsonb);

  if v_pref_course is not null then
    if not exists (select 1 from public.courses co where co.id = v_pref_course and co.institution_id = v_inst.id) then
      raise exception 'INVALID_PROGRAM';
    end if;
    if v_restricted and not exists (
      select 1 from jsonb_array_elements(v_programs) p
      where p->>'program_type' = 'course' and (p->>'program_id')::uuid = v_pref_course
    ) then raise exception 'INVALID_PROGRAM'; end if;
    if v_class_id is null then
      select c.id into v_class_id from public.classes c
      where c.institution_id = v_inst.id and c.status = 'active' and c.program_type = 'course'
        and c.course_id = v_pref_course
        and (c.end_month is null or date_trunc('month', c.end_month)::date >= v_month)
      order by c.start_month desc nulls last, c.name limit 1;
    end if;
  end if;

  if v_pref_diploma is not null then
    if not exists (select 1 from public.diplomas d where d.id = v_pref_diploma and d.institution_id = v_inst.id) then
      raise exception 'INVALID_PROGRAM';
    end if;
    if v_restricted and not exists (
      select 1 from jsonb_array_elements(v_programs) p
      where p->>'program_type' = 'diploma' and (p->>'program_id')::uuid = v_pref_diploma
    ) then raise exception 'INVALID_PROGRAM'; end if;
    if v_class_id is null then
      select c.id into v_class_id from public.classes c
      where c.institution_id = v_inst.id and c.status = 'active' and c.program_type = 'diploma'
        and c.diploma_id = v_pref_diploma
        and (c.end_month is null or date_trunc('month', c.end_month)::date >= v_month)
      order by c.start_month desc nulls last, c.name limit 1;
    end if;
  end if;

  if v_class_id is not null then
    select * into v_class from public.classes
    where id = v_class_id and institution_id = v_inst.id and status = 'active'
      and (end_month is null or date_trunc('month', end_month)::date >= v_month) limit 1;
    if not found then raise exception 'INVALID_CLASS'; end if;
    if v_restricted then
      select exists (
        select 1 from jsonb_array_elements(v_programs) p
        where (p->>'program_type' = 'course' and v_class.program_type = 'course' and v_class.course_id = (p->>'program_id')::uuid)
           or (p->>'program_type' = 'diploma' and v_class.program_type = 'diploma' and v_class.diploma_id = (p->>'program_id')::uuid)
      ) into v_allowed;
      if not coalesce(v_allowed, false) then raise exception 'INVALID_CLASS'; end if;
    end if;
    if v_pref_course is null and v_pref_diploma is null then
      if v_class.program_type = 'course' then v_pref_course := v_class.course_id; else v_pref_diploma := v_class.diploma_id; end if;
    end if;
  end if;

  if exists (select 1 from public.profiles where institution_id = v_inst.id and lower(email) = v_email) then
    raise exception 'USER_ACCOUNT_EXISTS';
  end if;
  if exists (select 1 from public.registration_inquiries where institution_id = v_inst.id and lower(email) = v_email and status = 'pending') then
    raise exception 'DUPLICATE_INQUIRY';
  end if;
  if exists (select 1 from public.registration_inquiries where institution_id = v_inst.id and lower(email) = v_email and status = 'approved') then
    raise exception 'USER_ACCOUNT_EXISTS';
  end if;

  insert into public.registration_inquiries (
    institution_id, full_name, email, phone, university, faculty,
    year_of_study, class_id, affiliate_id, notes, preferred_course_id, preferred_diploma_id
  ) values (
    v_inst.id, trim(p_full_name), v_email,
    v_phone,
    nullif(trim(coalesce(p_university, '')), ''),
    nullif(trim(coalesce(p_faculty, '')), ''),
    nullif(trim(coalesce(p_year_of_study, '')), ''),
    v_class_id, p_affiliate_id, nullif(trim(coalesce(p_notes, '')), ''),
    v_pref_course, v_pref_diploma
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'pending', 'institution_name', v_inst.name);
end;
$function$;
