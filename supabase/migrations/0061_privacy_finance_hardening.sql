-- =====================================================================
--  0061_privacy_finance_hardening.sql
--  1) Harden public verify_student_identity (require tenant, code-only lookup,
--     reduced PII payload)
--  2) Block payment overpayment vs remaining tuition / registration fee
--  3) Serialize withdrawal balance checks (row lock) + guard UPDATE races
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Public identity verify — privacy hardening
-- ---------------------------------------------------------------------
create or replace function public.verify_student_identity(
  p_identifier text,
  p_subdomain text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := lower(trim(coalesce(p_identifier, '')));
  v_slug text := lower(trim(coalesce(p_subdomain, '')));
  v_code text;
  v_row record;
  v_academic_status text;
begin
  -- Tenant scope is mandatory for public lookups (no cross-tenant probe).
  if v_slug = '' or length(v_slug) < 2 then
    return jsonb_build_object('valid', false, 'error', 'SUBDOMAIN_REQUIRED');
  end if;

  if length(v_raw) < 3 or length(v_raw) > 64 then
    return jsonb_build_object('valid', false);
  end if;

  -- Public form / ID-card QR use student code only (email local-part).
  -- Do not allow full-email or UUID enumeration via this RPC.
  if v_raw ~ '[^a-z0-9._+-]' then
    return jsonb_build_object('valid', false);
  end if;
  if position('@' in v_raw) > 0 then
    return jsonb_build_object('valid', false);
  end if;

  v_code := v_raw;

  select
    p.full_name,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    i.subdomain as institution_subdomain,
    upper(split_part(p.email, '@', 1)) as student_code,
    cl.name as class_name,
    cl.status as class_status,
    cl.end_month as class_end_month,
    cl.program_type,
    coalesce(
      case
        when cl.program_type = 'diploma' then d.name
        when cl.program_type = 'course' then c.name
        else null
      end,
      cl.name
    ) as program_name,
    exists (
      select 1
      from certificates cert
      where cert.student_id = p.id
        and cert.status = 'issued'
        and (cl.id is null or cert.class_id = cl.id)
    ) as has_issued_certificate
  into v_row
  from profiles p
  join institutions i on i.id = p.institution_id
  left join lateral (
    select e.class_id
    from enrollments e
    where e.student_id = p.id
    order by e.enrolled_at desc nulls last, e.id desc
    limit 1
  ) latest_enr on true
  left join classes cl on cl.id = latest_enr.class_id
  left join courses c on c.id = cl.course_id
  left join diplomas d on d.id = cl.diploma_id
  where p.role = 'student'
    and p.status = 'approved'
    and coalesce(i.status, 'active') = 'active'
    and lower(i.subdomain) = v_slug
    and lower(split_part(p.email, '@', 1)) = v_code
  limit 1;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  if v_row.has_issued_certificate then
    v_academic_status := 'Completed';
  elsif v_row.class_end_month is not null and v_row.class_end_month::date < current_date then
    v_academic_status := 'Completed';
  elsif v_row.class_status = 'inactive' then
    v_academic_status := 'Inactive';
  elsif v_row.class_name is not null then
    v_academic_status := 'Enrolled';
  else
    v_academic_status := 'Verified';
  end if;

  -- Public payload: identity + institution branding + program status only.
  -- No avatar, no account status, no email, no UUID.
  return jsonb_build_object(
    'valid', true,
    'student_name', v_row.full_name,
    'student_code', v_row.student_code,
    'institution_name', v_row.institution_name,
    'institution_logo_url', v_row.institution_logo_url,
    'institution_subdomain', v_row.institution_subdomain,
    'theme_primary', v_row.theme_primary,
    'theme_accent', v_row.theme_accent,
    'class_name', v_row.class_name,
    'program_name', v_row.program_name,
    'program_type', v_row.program_type,
    'academic_status', v_academic_status
  );
end;
$$;

revoke all on function public.verify_student_identity(text, text) from public;
grant execute on function public.verify_student_identity(text, text) to anon, authenticated, service_role;

comment on function public.verify_student_identity(text, text) is
  'Public Official Academic Record lookup. Requires p_subdomain. Matches student code only; reduced PII.';

-- ---------------------------------------------------------------------
-- 2) Payment overcap — block completed payments beyond remaining balance
-- ---------------------------------------------------------------------
create or replace function public.enforce_payment_not_over_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments%rowtype;
  v_total_fee numeric(12,2);
  v_duration int;
  v_discount numeric(12,2);
  v_net numeric(12,2);
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_reg_fee numeric(12,2);
begin
  -- Only gate completed payments (pending/failed may be recorded freely).
  if new.status is distinct from 'completed' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Re-check only when completed exposure could increase / move.
    if not (
      old.status is distinct from 'completed'
      or old.amount is distinct from new.amount
      or coalesce(old.is_registration_fee, false) is distinct from coalesce(new.is_registration_fee, false)
      or old.enrollment_id is distinct from new.enrollment_id
    ) then
      return new;
    end if;
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Serialize concurrent payments for the same enrollment.
  select * into v_enrollment
  from public.enrollments
  where id = new.enrollment_id
  for update;

  if not found then
    raise exception 'ENROLLMENT_NOT_FOUND';
  end if;

  if coalesce(new.is_registration_fee, false) = true then
    select coalesce(i.registration_fee_amount, 0)
      into v_reg_fee
    from public.institutions i
    where i.id = v_enrollment.institution_id;

    if coalesce(v_reg_fee, 0) <= 0 then
      raise exception 'REGISTRATION_FEE_DISABLED';
    end if;

    select coalesce(sum(p.amount), 0)
      into v_paid
    from public.payments p
    where p.enrollment_id = new.enrollment_id
      and p.status = 'completed'
      and coalesce(p.is_registration_fee, false) = true
      and p.id is distinct from new.id;

    v_remaining := v_reg_fee - v_paid;
    if new.amount > v_remaining then
      raise exception 'PAYMENT_EXCEEDS_BALANCE';
    end if;

    return new;
  end if;

  select
    c.total_fee,
    greatest(
      coalesce(
        nullif(regexp_replace(coalesce(c.duration, '1'), '[^0-9]', '', 'g'), '')::int,
        1
      ),
      1
    )
  into v_total_fee, v_duration
  from public.classes c
  where c.id = v_enrollment.class_id;

  if not found then
    raise exception 'CLASS_NOT_FOUND';
  end if;

  v_discount := coalesce(v_enrollment.discount_amount, 0);
  v_net := greatest(coalesce(v_total_fee, 0) - (v_discount * v_duration), 0);

  select coalesce(sum(p.amount), 0)
    into v_paid
  from public.payments p
  where p.enrollment_id = new.enrollment_id
    and p.status = 'completed'
    and coalesce(p.is_registration_fee, false) = false
    and p.id is distinct from new.id;

  v_remaining := v_net - v_paid;
  if new.amount > v_remaining then
    raise exception 'PAYMENT_EXCEEDS_BALANCE';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payments_not_over_balance on public.payments;
create trigger trg_payments_not_over_balance
before insert or update on public.payments
for each row
execute function public.enforce_payment_not_over_balance();

revoke all on function public.enforce_payment_not_over_balance() from public, anon, authenticated;
grant execute on function public.enforce_payment_not_over_balance() to postgres, service_role;

comment on function public.enforce_payment_not_over_balance() is
  'BEFORE INSERT/UPDATE: completed payment amount cannot exceed remaining tuition or registration fee for the enrollment. Locks enrollment row.';

-- ---------------------------------------------------------------------
-- 3) Withdrawal race — lock instructor profile, also guard UPDATEs
-- ---------------------------------------------------------------------
create or replace function public.check_withdrawal_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available numeric(12,2);
  v_counts boolean;
begin
  -- Only reserve balance for non-rejected rows.
  v_counts := coalesce(new.status::text, 'pending') <> 'rejected';

  if tg_op = 'UPDATE' then
    -- Skip when this row still does not consume available balance,
    -- or when exposure did not increase.
    if not v_counts then
      return new;
    end if;
    if (
      coalesce(old.status::text, 'pending') <> 'rejected'
      and new.amount <= old.amount
      and new.instructor_id is not distinct from old.instructor_id
    ) then
      return new;
    end if;
  end if;

  if not v_counts then
    return new;
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Serialize concurrent withdrawal requests for this instructor.
  perform 1 from public.profiles where id = new.instructor_id for update;
  if not found then
    raise exception 'INSTRUCTOR_NOT_FOUND';
  end if;

  v_available := public.instructor_available_balance(new.instructor_id);

  -- On UPDATE of an already-counting row, available_balance already subtracts
  -- the old amount; add it back for the comparison headroom.
  if tg_op = 'UPDATE'
     and coalesce(old.status::text, 'pending') <> 'rejected'
     and old.instructor_id is not distinct from new.instructor_id then
    v_available := v_available + coalesce(old.amount, 0);
  end if;

  if new.amount > v_available then
    raise exception 'WITHDRAWAL_EXCEEDS_BALANCE';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_withdrawal on public.withdrawals;
create trigger trg_check_withdrawal
before insert or update on public.withdrawals
for each row
execute function public.check_withdrawal_balance();

comment on function public.check_withdrawal_balance() is
  'BEFORE INSERT/UPDATE: withdrawal cannot exceed available balance. Locks profiles row to prevent TOCTOU races.';
