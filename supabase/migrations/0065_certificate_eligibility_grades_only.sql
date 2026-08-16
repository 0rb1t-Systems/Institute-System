-- Certificate eligibility: grades only (no class end-date / payment gate).
-- Admin/staff may issue when exams/grades are recorded and complete.

create or replace function public.check_enrollment_certificate_eligibility(p_enrollment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_enr public.enrollments%rowtype;
  v_caller_inst uuid := public.current_institution_id();
  v_class_finished boolean;
  v_grades_complete boolean;
  v_fully_paid boolean;
  v_already boolean;
  v_reasons text[] := array[]::text[];
  v_eligible boolean;
begin
  if p_enrollment_id is null then
    return jsonb_build_object(
      'eligible', false,
      'reasons', jsonb_build_array('ENROLLMENT_REQUIRED')
    );
  end if;

  select * into v_enr from public.enrollments where id = p_enrollment_id;
  if not found then
    return jsonb_build_object(
      'eligible', false,
      'reasons', jsonb_build_array('ENROLLMENT_NOT_FOUND')
    );
  end if;

  if v_caller_inst is not null
     and v_enr.institution_id is distinct from v_caller_inst
     and not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if not (
    public.is_admin_or_staff()
    or public.is_super_admin()
    or public.is_class_instructor(v_enr.class_id)
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Informational only — no longer gates eligibility
  v_class_finished := public.enrollment_class_is_finished(p_enrollment_id);
  v_fully_paid := public.enrollment_is_fully_paid(p_enrollment_id);
  v_grades_complete := public.enrollment_grades_complete(p_enrollment_id);
  v_already := public.enrollment_has_issued_certificate(p_enrollment_id);

  if v_already then
    v_reasons := array_append(v_reasons, 'CERTIFICATE_ALREADY_ISSUED');
  end if;
  if not v_grades_complete then
    v_reasons := array_append(v_reasons, 'GRADES_INCOMPLETE');
  end if;

  v_eligible := (not v_already) and v_grades_complete;

  return jsonb_build_object(
    'eligible', v_eligible,
    'enrollment_id', p_enrollment_id,
    'student_id', v_enr.student_id,
    'class_id', v_enr.class_id,
    'class_finished', v_class_finished,
    'grades_complete', v_grades_complete,
    'fully_paid', v_fully_paid,
    'already_issued', v_already,
    'reasons', to_jsonb(v_reasons)
  );
end;
$$;

revoke all on function public.check_enrollment_certificate_eligibility(uuid) from public, anon;
grant execute on function public.check_enrollment_certificate_eligibility(uuid) to authenticated, service_role;

create or replace function public.list_certificate_eligible_enrollments(
  p_class_id uuid default null,
  p_student_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inst uuid := public.current_institution_id();
  v_rows jsonb;
begin
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;

  if not (public.is_admin_or_staff() or public.is_super_admin()) then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.enrolled_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      e.id as enrollment_id,
      e.student_id,
      e.class_id,
      e.enrolled_at,
      public.enrollment_class_is_finished(e.id) as class_finished,
      public.enrollment_grades_complete(e.id) as grades_complete,
      public.enrollment_is_fully_paid(e.id) as fully_paid,
      public.enrollment_has_issued_certificate(e.id) as already_issued,
      (
        (not public.enrollment_has_issued_certificate(e.id))
        and public.enrollment_grades_complete(e.id)
      ) as eligible
    from public.enrollments e
    where e.institution_id = v_inst
      and (p_class_id is null or e.class_id = p_class_id)
      and (p_student_id is null or e.student_id = p_student_id)
  ) x;

  return v_rows;
end;
$$;

revoke all on function public.list_certificate_eligible_enrollments(uuid, uuid) from public, anon;
grant execute on function public.list_certificate_eligible_enrollments(uuid, uuid) to authenticated, service_role;

create or replace function public.trg_require_settings_before_certificate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enr_inst uuid;
begin
  if new.status = 'issued'
     and (tg_op = 'INSERT' or coalesce(old.status, '') is distinct from 'issued') then
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
  end if;

  return new;
end;
$$;
