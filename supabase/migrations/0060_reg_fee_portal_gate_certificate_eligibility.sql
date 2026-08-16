-- =====================================================================
-- 0060_reg_fee_portal_gate_certificate_eligibility.sql
-- 1) Backend registration-fee portal gate (helpers + student RLS)
-- 2) Certificate eligibility: class finished + grades complete + fully paid
--    (DB trigger + RPCs; unique issued-cert index already prevents duplicates)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Registration fee cleared? (any enrollment in the student's institution)
-- ---------------------------------------------------------------------
create or replace function public.student_has_cleared_registration_fee(p_student_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_fee numeric;
begin
  if p_student_id is null then
    return false;
  end if;

  select institution_id into v_inst
  from public.profiles
  where id = p_student_id;

  if v_inst is null then
    return false;
  end if;

  select coalesce(registration_fee_amount, 0) into v_fee
  from public.institutions
  where id = v_inst;

  -- Fee amount 0 / missing = registration fee disabled
  if coalesce(v_fee, 0) <= 0 then
    return true;
  end if;

  return exists (
    select 1
    from public.payments p
    join public.enrollments e on e.id = p.enrollment_id
    where e.student_id = p_student_id
      and e.institution_id = v_inst
      and coalesce(p.is_registration_fee, false) = true
      and p.status = 'completed'
  );
end;
$$;

revoke all on function public.student_has_cleared_registration_fee(uuid) from public, anon;
grant execute on function public.student_has_cleared_registration_fee(uuid) to authenticated, service_role;

comment on function public.student_has_cleared_registration_fee(uuid) is
  'True when institution registration_fee_amount is 0/disabled, or the student has a completed registration-fee payment.';

-- Non-students always OK; students must clear reg fee (when required).
create or replace function public.current_student_registration_fee_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_user_role() is distinct from 'student'::public.user_role then true
    else public.student_has_cleared_registration_fee(auth.uid())
  end
$$;

revoke all on function public.current_student_registration_fee_ok() from public, anon;
grant execute on function public.current_student_registration_fee_ok() to authenticated, service_role;

-- Gate academic "enrolled" helpers used by many student policies
create or replace function public.is_enrolled_in_class(cls uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments
    where class_id = cls
      and student_id = auth.uid()
  )
  and public.current_student_registration_fee_ok()
$$;

create or replace function public.is_enrolled_in_session(sess uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_sessions s
    join public.enrollments e on e.class_id = s.class_id
    where s.id = sess
      and e.student_id = auth.uid()
  )
  and public.current_student_registration_fee_ok()
$$;

-- Harden student-own SELECT/UPDATE policies that used bare student_id = auth.uid()
drop policy if exists "er_select" on public.exam_results;
create policy "er_select" on public.exam_results for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_exam_instructor(exam_id)
    or (student_id = auth.uid() and public.current_student_registration_fee_ok())
  )
);

drop policy if exists "asub_select" on public.assignment_submissions;
create policy "asub_select" on public.assignment_submissions for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_assignment_instructor(assignment_id)
    or (student_id = auth.uid() and public.current_student_registration_fee_ok())
  )
);

drop policy if exists "asub_update" on public.assignment_submissions;
create policy "asub_update" on public.assignment_submissions for update
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_assignment_instructor(assignment_id)
    or (student_id = auth.uid() and public.current_student_registration_fee_ok())
  )
)
with check (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_assignment_instructor(assignment_id)
    or (student_id = auth.uid() and public.current_student_registration_fee_ok())
  )
);

drop policy if exists "gb_select" on public.gradebook_entries;
create policy "gb_select" on public.gradebook_entries for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_class_instructor(class_id)
    or (student_id = auth.uid() and public.current_student_registration_fee_ok())
  )
);

drop policy if exists "tr_select" on public.transcripts;
create policy "tr_select" on public.transcripts for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or (student_id = auth.uid() and public.current_student_registration_fee_ok())
  )
);

drop policy if exists "te_select" on public.transcript_entries;
create policy "te_select" on public.transcript_entries for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or exists (
      select 1
      from public.transcripts t
      where t.id = transcript_id
        and t.student_id = auth.uid()
        and public.current_student_registration_fee_ok()
    )
  )
);

drop policy if exists "cert_select" on public.certificates;
create policy "cert_select" on public.certificates for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or (student_id = auth.uid() and public.current_student_registration_fee_ok())
  )
);

drop policy if exists "att_select" on public.attendance;
create policy "att_select" on public.attendance for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_session_instructor(session_id)
    or (student_id = auth.uid() and public.current_student_registration_fee_ok())
  )
);

-- Enrollments + payments stay readable so AuthContext / staff fee recording still work.

-- Also enforce registration-fee-before-other-payments on UPDATE (INSERT already gated in 0052)
create or replace function public.enforce_registration_fee_before_other_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reg_fee numeric;
  student_uuid uuid;
  already_paid boolean;
begin
  if coalesce(new.is_registration_fee, false) = true then
    return new;
  end if;

  select coalesce(i.registration_fee_amount, 0)
    into reg_fee
  from public.institutions i
  where i.id = new.institution_id;

  if coalesce(reg_fee, 0) <= 0 then
    return new;
  end if;

  select e.student_id
    into student_uuid
  from public.enrollments e
  where e.id = new.enrollment_id;

  if student_uuid is null then
    raise exception 'REGISTRATION_FEE_REQUIRED'
      using errcode = 'P0001',
            hint = 'Enrollment student could not be resolved for registration fee check.';
  end if;

  select exists (
    select 1
    from public.payments p
    join public.enrollments e on e.id = p.enrollment_id
    where e.student_id = student_uuid
      and e.institution_id = new.institution_id
      and coalesce(p.is_registration_fee, false) = true
      and p.status = 'completed'
  ) into already_paid;

  if not already_paid then
    raise exception 'REGISTRATION_FEE_REQUIRED'
      using errcode = 'P0001',
            hint = 'Record a completed registration fee payment before other fees.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payments_registration_fee_gate on public.payments;
create trigger trg_payments_registration_fee_gate
  before insert or update on public.payments
  for each row
  execute function public.enforce_registration_fee_before_other_payments();

-- ---------------------------------------------------------------------
-- Certificate eligibility helpers
-- ---------------------------------------------------------------------
create or replace function public.enrollment_required_course_ids(p_enrollment_id uuid)
returns table (course_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with enr as (
    select e.id, e.class_id, c.program_type, c.course_id as primary_course_id, c.diploma_id
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.id = p_enrollment_id
  )
  select distinct x.course_id
  from (
    select enr.primary_course_id as course_id
    from enr
    where enr.program_type = 'course'
      and enr.primary_course_id is not null

    union

    select co.id as course_id
    from enr
    join public.courses co on co.diploma_id = enr.diploma_id
    where enr.program_type = 'diploma'
      and enr.diploma_id is not null

    union

    select cc.course_id
    from enr
    join public.class_courses cc on cc.class_id = enr.class_id
  ) x
  where x.course_id is not null
$$;

revoke all on function public.enrollment_required_course_ids(uuid) from public, anon;
grant execute on function public.enrollment_required_course_ids(uuid) to authenticated, service_role;

create or replace function public.enrollment_class_is_finished(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.id = p_enrollment_id
      and (
        c.status = 'inactive'
        or (c.end_month is not null and c.end_month::date < current_date)
      )
  )
$$;

revoke all on function public.enrollment_class_is_finished(uuid) from public, anon;
grant execute on function public.enrollment_class_is_finished(uuid) to authenticated, service_role;

create or replace function public.enrollment_grades_complete(p_enrollment_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_required int;
  v_passed int;
begin
  select count(*) into v_required
  from public.enrollment_required_course_ids(p_enrollment_id);

  if coalesce(v_required, 0) = 0 then
    return false;
  end if;

  select count(*) into v_passed
  from public.enrollment_required_course_ids(p_enrollment_id) req
  join public.gradebook_entries g
    on g.enrollment_id = p_enrollment_id
   and g.course_id = req.course_id
  where coalesce(g.final_mark, 0) >= 60;

  return v_passed >= v_required;
end;
$$;

revoke all on function public.enrollment_grades_complete(uuid) from public, anon;
grant execute on function public.enrollment_grades_complete(uuid) to authenticated, service_role;

create or replace function public.enrollment_is_fully_paid(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        greatest(
          c.total_fee
            - coalesce(e.discount_amount, 0)
              * greatest(
                  coalesce(
                    nullif(regexp_replace(coalesce(c.duration, '1'), '[^0-9]', '', 'g'), '')::int,
                    1
                  ),
                  1
                )
            - coalesce((
                select sum(p.amount)
                from public.payments p
                where p.enrollment_id = e.id
                  and p.status = 'completed'
                  and coalesce(p.is_registration_fee, false) = false
              ), 0),
          0
        )
        + case
            when coalesce(i.registration_fee_amount, 0) <= 0 then 0::numeric
            when exists (
              select 1
              from public.payments pr
              join public.enrollments e2 on e2.id = pr.enrollment_id
              where e2.student_id = e.student_id
                and e2.institution_id = e.institution_id
                and coalesce(pr.is_registration_fee, false) = true
                and pr.status = 'completed'
            ) then 0::numeric
            else coalesce(i.registration_fee_amount, 0)
          end
      from public.enrollments e
      join public.classes c on c.id = e.class_id
      join public.institutions i on i.id = e.institution_id
      where e.id = p_enrollment_id
    ),
    1
  ) <= 0
$$;

revoke all on function public.enrollment_is_fully_paid(uuid) from public, anon;
grant execute on function public.enrollment_is_fully_paid(uuid) to authenticated, service_role;

create or replace function public.enrollment_has_issued_certificate(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.certificates c on c.institution_id = e.institution_id
    where e.id = p_enrollment_id
      and c.status = 'issued'
      and (
        c.enrollment_id = e.id
        or (c.student_id = e.student_id and c.class_id = e.class_id)
      )
  )
$$;

revoke all on function public.enrollment_has_issued_certificate(uuid) from public, anon;
grant execute on function public.enrollment_has_issued_certificate(uuid) to authenticated, service_role;

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

  v_class_finished := public.enrollment_class_is_finished(p_enrollment_id);
  v_grades_complete := public.enrollment_grades_complete(p_enrollment_id);
  v_fully_paid := public.enrollment_is_fully_paid(p_enrollment_id);
  v_already := public.enrollment_has_issued_certificate(p_enrollment_id);

  if v_already then
    v_reasons := array_append(v_reasons, 'CERTIFICATE_ALREADY_ISSUED');
  end if;
  if not v_class_finished then
    v_reasons := array_append(v_reasons, 'CLASS_NOT_FINISHED');
  end if;
  if not v_grades_complete then
    v_reasons := array_append(v_reasons, 'GRADES_INCOMPLETE');
  end if;
  if not v_fully_paid then
    v_reasons := array_append(v_reasons, 'BALANCE_OUTSTANDING');
  end if;

  v_eligible := (not v_already) and v_class_finished and v_grades_complete and v_fully_paid;

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
        and public.enrollment_class_is_finished(e.id)
        and public.enrollment_grades_complete(e.id)
        and public.enrollment_is_fully_paid(e.id)
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

-- Block issuing certificates that fail eligibility (settings gate kept)
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

    -- Duplicate issued cert for this enrollment/student+class
    if tg_op = 'INSERT' and public.enrollment_has_issued_certificate(new.enrollment_id) then
      raise exception 'CERTIFICATE_ALREADY_ISSUED';
    end if;

    if not public.enrollment_class_is_finished(new.enrollment_id) then
      raise exception 'CLASS_NOT_FINISHED';
    end if;

    if not public.enrollment_grades_complete(new.enrollment_id) then
      raise exception 'GRADES_INCOMPLETE';
    end if;

    if not public.enrollment_is_fully_paid(new.enrollment_id) then
      raise exception 'BALANCE_OUTSTANDING';
    end if;
  end if;

  return new;
end;
$$;
