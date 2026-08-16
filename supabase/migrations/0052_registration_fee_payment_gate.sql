-- ---------------------------------------------------------------------
-- 0052_registration_fee_payment_gate.sql
-- Enforce: when institutions.registration_fee_amount > 0, non-registration
-- payments cannot be inserted until the student has a completed
-- registration-fee payment (any enrollment in the same institution).
-- ---------------------------------------------------------------------

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
  -- Registration fee rows themselves are always allowed.
  if coalesce(new.is_registration_fee, false) = true then
    return new;
  end if;

  select coalesce(i.registration_fee_amount, 0)
    into reg_fee
  from public.institutions i
  where i.id = new.institution_id;

  -- Fee amount 0 (or missing institution) = registration fee disabled.
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
  before insert on public.payments
  for each row
  execute function public.enforce_registration_fee_before_other_payments();

comment on function public.enforce_registration_fee_before_other_payments() is
  'Blocks insert of non-registration payments when the institution requires a registration fee and the student has not completed one.';
