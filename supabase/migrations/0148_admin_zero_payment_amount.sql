-- Allow admin correction of payment amounts down to $0 (void without deleting the row).
-- New payments still require amount > 0; UPDATE may set amount = 0.
-- Zeroed payments clear instructor/affiliate settlement rows.

alter table public.payments
  drop constraint if exists payments_amount_check;

alter table public.payments
  add constraint payments_amount_check check (amount >= 0);

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

  if new.amount is null or new.amount < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- New completed payments must be positive; admins may zero an existing row.
  if tg_op = 'INSERT' and new.amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  -- Zeroed payment: skip balance caps (nothing collected).
  if new.amount = 0 then
    return new;
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
  'BEFORE INSERT/UPDATE: completed payment cannot exceed remaining program tuition/registration, nor remaining monthly due when note is YYYY-MM. INSERT requires amount > 0; UPDATE may set amount = 0.';

create or replace function public.create_settlement_on_payment_from_row(new public.payments)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_instructor_id uuid;
  v_rate numeric;
  v_model text;
  v_student_id uuid;
  v_affiliate_id uuid;
  v_aff_rate numeric;
begin
  if coalesce(new.is_registration_fee, false) = true
     or coalesce(new.status, 'completed') <> 'completed'
     or coalesce(new.amount, 0) <= 0 then
    delete from public.instructor_settlements where payment_id = new.id;
    delete from public.affiliate_settlements where payment_id = new.id;
    return;
  end if;

  select c.id,
         c.instructor_id,
         coalesce(c.settlement_model, 'commission'),
         coalesce(
           ip.instructor_commission_rate,
           i.default_instructor_commission_rate,
           c.commission_rate,
           0
         ),
         e.student_id
    into v_class_id, v_instructor_id, v_model, v_rate, v_student_id
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.institutions i on i.id = c.institution_id
  left join public.profiles ip on ip.id = c.instructor_id
  where e.id = new.enrollment_id;

  if coalesce(v_model, 'commission') = 'fixed_fee' then
    delete from public.instructor_settlements
    where payment_id = new.id
      and settlement_type = 'commission';
  elsif v_instructor_id is not null and v_rate > 0 then
    insert into public.instructor_settlements
      (institution_id, instructor_id, payment_id, class_id, rate, amount, settlement_type)
    values
      (new.institution_id, v_instructor_id, new.id, v_class_id, v_rate,
       round(new.amount * v_rate, 2), 'commission')
    on conflict (payment_id) do update
      set rate = excluded.rate,
          amount = excluded.amount,
          instructor_id = excluded.instructor_id,
          class_id = excluded.class_id,
          settlement_type = 'commission';
  else
    delete from public.instructor_settlements where payment_id = new.id;
  end if;

  select p.affiliate_id, coalesce(i.affiliate_commission_rate, 0)
    into v_affiliate_id, v_aff_rate
  from public.profiles p
  join public.institutions i on i.id = p.institution_id
  where p.id = v_student_id
    and p.institution_id = new.institution_id;

  if v_affiliate_id is not null
     and v_aff_rate > 0
     and exists (
       select 1 from public.profiles a
       where a.id = v_affiliate_id
         and a.institution_id = new.institution_id
         and a.role = 'affiliate'
         and a.status = 'approved'
     )
  then
    insert into public.affiliate_settlements
      (institution_id, affiliate_id, payment_id, student_id, class_id, rate, amount)
    values
      (new.institution_id, v_affiliate_id, new.id, v_student_id, v_class_id, v_aff_rate,
       round(new.amount * v_aff_rate, 2))
    on conflict (payment_id) do update
      set rate = excluded.rate,
          amount = excluded.amount,
          affiliate_id = excluded.affiliate_id,
          student_id = excluded.student_id,
          class_id = excluded.class_id;
  else
    delete from public.affiliate_settlements where payment_id = new.id;
  end if;
end;
$$;
