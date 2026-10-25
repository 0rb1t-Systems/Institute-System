-- =====================================================================
--  0151_commission_follows_class_date_window.sql
--  Instructor + affiliate commissions only apply to payments whose
--  billing month falls inside the class start_month..end_month window.
--  Editing class dates (e.g. delayed start) drops commissions for months
--  before the new start and recreates for months still in range.
-- =====================================================================

create or replace function public.payment_billing_month(
  p_note text,
  p_paid_at timestamptz
)
returns date
language sql
immutable
as $$
  select case
    when p_note ~ '^\d{4}-\d{2}' then to_date(substr(p_note, 1, 7), 'YYYY-MM')
    when p_paid_at is not null then (date_trunc('month', p_paid_at AT TIME ZONE 'UTC'))::date
    else null
  end;
$$;

comment on function public.payment_billing_month(text, timestamptz) is
  'Billing month from payment note (YYYY-MM…) or paid_at fallback.';

create or replace function public.payment_in_class_date_window(
  p_note text,
  p_paid_at timestamptz,
  p_start_month date,
  p_end_month date
)
returns boolean
language sql
immutable
as $$
  select case
    when public.payment_billing_month(p_note, p_paid_at) is null then true
    when p_start_month is null and p_end_month is null then true
    when p_start_month is not null
         and public.payment_billing_month(p_note, p_paid_at)
             < date_trunc('month', p_start_month)::date
      then false
    when p_end_month is not null
         and public.payment_billing_month(p_note, p_paid_at)
             > date_trunc('month', p_end_month)::date
      then false
    else true
  end;
$$;

comment on function public.payment_in_class_date_window(text, timestamptz, date, date) is
  'True when payment billing month is within class start/end months (inclusive).';

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
  v_start date;
  v_end date;
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
         e.student_id,
         c.start_month,
         c.end_month
    into v_class_id, v_instructor_id, v_model, v_rate, v_student_id, v_start, v_end
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.institutions i on i.id = c.institution_id
  left join public.profiles ip on ip.id = c.instructor_id
  where e.id = new.enrollment_id;

  -- Delayed / shortened class: no instructor or affiliate commission outside window
  if not public.payment_in_class_date_window(new.note, new.paid_at, v_start, v_end) then
    delete from public.instructor_settlements where payment_id = new.id;
    delete from public.affiliate_settlements where payment_id = new.id;
    return;
  end if;

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

-- Allow resync even when instructor is null (still clears/rebuilds affiliate)
create or replace function public.resync_class_instructor_settlements(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments%rowtype;
  v_instructor uuid;
  v_model text;
begin
  if p_class_id is null then
    return;
  end if;

  select instructor_id, coalesce(settlement_model, 'commission')
    into v_instructor, v_model
  from public.classes
  where id = p_class_id;

  if not found then
    return;
  end if;

  if v_model = 'fixed_fee' then
    if v_instructor is not null then
      perform public.sync_class_fixed_fee_settlement(p_class_id);
    end if;
    -- Still refresh affiliate rows against the date window
    for v_pay in
      select p.*
      from public.payments p
      join public.enrollments e on e.id = p.enrollment_id
      where e.class_id = p_class_id
        and coalesce(p.status, 'completed') = 'completed'
        and coalesce(p.is_registration_fee, false) = false
        and coalesce(p.amount, 0) > 0
    loop
      perform public.create_settlement_on_payment_from_row(v_pay);
    end loop;
    return;
  end if;

  for v_pay in
    select p.*
    from public.payments p
    join public.enrollments e on e.id = p.enrollment_id
    where e.class_id = p_class_id
      and coalesce(p.status, 'completed') = 'completed'
      and coalesce(p.is_registration_fee, false) = false
      and coalesce(p.amount, 0) > 0
  loop
    perform public.create_settlement_on_payment_from_row(v_pay);
  end loop;
end;
$$;

-- When class dates change, rebuild commissions from the new window
create or replace function public.trg_classes_resync_instructor_settlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.commission_rate is distinct from old.commission_rate
       or new.settlement_model is distinct from old.settlement_model
       or new.instructor_fixed_fee is distinct from old.instructor_fixed_fee
       or new.start_month is distinct from old.start_month
       or new.end_month is distinct from old.end_month
     )
     and new.instructor_id is not distinct from old.instructor_id
  then
    perform public.resync_class_instructor_settlements(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_classes_resync_instructor_settlements on public.classes;
create trigger trg_classes_resync_instructor_settlements
after update of commission_rate, settlement_model, instructor_fixed_fee, start_month, end_month
on public.classes
for each row
execute function public.trg_classes_resync_instructor_settlements();

-- Apply window rules to existing settlements (all institutions)
do $$
declare
  r record;
begin
  for r in
    select distinct c.id
    from public.classes c
    where exists (
      select 1
      from public.enrollments e
      join public.payments p on p.enrollment_id = e.id
      where e.class_id = c.id
        and coalesce(p.status, 'completed') = 'completed'
        and coalesce(p.is_registration_fee, false) = false
        and coalesce(p.amount, 0) > 0
    )
  loop
    perform public.resync_class_instructor_settlements(r.id);
  end loop;
end;
$$;
