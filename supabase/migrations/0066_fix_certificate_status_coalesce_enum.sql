-- Fix certificate insert crash: coalesce(old.status, '') casts '' to credential_status enum.
-- PostgreSQL evaluates both sides of OR here, so INSERT always hit the invalid enum cast.

create or replace function public.trg_require_settings_before_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enr_inst uuid;
  v_should_check boolean := false;
begin
  if new.status is distinct from 'issued'::public.credential_status then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_should_check := true;
  elsif tg_op = 'UPDATE' and old.status is distinct from 'issued'::public.credential_status then
    v_should_check := true;
  end if;

  if not v_should_check then
    return new;
  end if;

  if not public.institution_settings_complete(new.institution_id) then
    raise exception 'INSTITUTION_SETTINGS_INCOMPLETE';
  end if;

  if new.enrollment_id is null then
    raise exception 'CERTIFICATE_ENROLLMENT_REQUIRED';
  end if;

  select institution_id into v_enr_inst
  from public.enrollments
  where id = new.enrollment_id;

  if v_enr_inst is null then
    raise exception 'ENROLLMENT_NOT_FOUND';
  end if;

  if v_enr_inst is distinct from new.institution_id then
    raise exception 'FORBIDDEN';
  end if;

  if tg_op = 'INSERT' and public.enrollment_has_issued_certificate(new.enrollment_id) then
    raise exception 'CERTIFICATE_ALREADY_ISSUED';
  end if;

  -- Grades/exams recorded only — no class end-date or payment wait
  if not public.enrollment_grades_complete(new.enrollment_id) then
    raise exception 'GRADES_INCOMPLETE';
  end if;

  return new;
end;
$$;
