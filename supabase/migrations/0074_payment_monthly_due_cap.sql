-- Cap completed tuition payments so a billing month (note YYYY-MM…) cannot
-- exceed the enrollment monthly due (class total_fee / duration − monthly discount).

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
  v_month text;
  v_monthly numeric(12,2);
  v_month_paid numeric(12,2);
  v_month_remaining numeric(12,2);
begin
  if new.status is distinct from 'completed' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not (
      old.status is distinct from 'completed'
      or old.amount is distinct from new.amount
      or coalesce(old.is_registration_fee, false) is distinct from coalesce(new.is_registration_fee, false)
      or old.enrollment_id is distinct from new.enrollment_id
      or coalesce(old.note, '') is distinct from coalesce(new.note, '')
    ) then
      return new;
    end if;
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

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

  -- Per billing-month cap when note starts with YYYY-MM
  v_month := left(trim(coalesce(new.note, '')), 7);
  if v_month ~ '^\d{4}-\d{2}$' then
    v_monthly := greatest(
      round((coalesce(v_total_fee, 0) / v_duration) - v_discount, 2),
      0
    );

    select coalesce(sum(p.amount), 0)
      into v_month_paid
    from public.payments p
    where p.enrollment_id = new.enrollment_id
      and p.status = 'completed'
      and coalesce(p.is_registration_fee, false) = false
      and p.id is distinct from new.id
      and left(trim(coalesce(p.note, '')), 7) = v_month;

    v_month_remaining := v_monthly - v_month_paid;
    if new.amount > v_month_remaining then
      raise exception 'PAYMENT_EXCEEDS_MONTHLY_DUE';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_payment_not_over_balance() is
  'BEFORE INSERT/UPDATE: completed payment cannot exceed remaining program tuition/registration, nor remaining monthly due when note is YYYY-MM.';
