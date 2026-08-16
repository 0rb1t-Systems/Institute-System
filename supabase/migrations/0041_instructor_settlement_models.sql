-- =====================================================================
--  0041_instructor_settlement_models.sql
--  Configurable instructor settlement: commission % OR fixed fee per class.
--  - profiles: instructor default settlement preference
--  - classes: settlement_model + instructor_fixed_fee (source of truth)
--  - Payment trigger creates commission settlements only for commission classes
--  - Fixed-fee classes get one class-level settlement (no payment_id)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Instructor default preference (used when assigning to a class)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists settlement_model text not null default 'commission',
  add column if not exists fixed_fee_amount numeric(12,2) not null default 0;

alter table public.profiles
  drop constraint if exists profiles_settlement_model_check;
alter table public.profiles
  add constraint profiles_settlement_model_check
  check (settlement_model in ('commission', 'fixed_fee'));

alter table public.profiles
  drop constraint if exists profiles_fixed_fee_amount_check;
alter table public.profiles
  add constraint profiles_fixed_fee_amount_check
  check (fixed_fee_amount >= 0);

-- ---------------------------------------------------------------------
-- 2) Class-level settlement config (drives earnings)
-- ---------------------------------------------------------------------
alter table public.classes
  add column if not exists settlement_model text not null default 'commission',
  add column if not exists instructor_fixed_fee numeric(12,2) not null default 0;

alter table public.classes
  drop constraint if exists classes_settlement_model_check;
alter table public.classes
  add constraint classes_settlement_model_check
  check (settlement_model in ('commission', 'fixed_fee'));

alter table public.classes
  drop constraint if exists classes_instructor_fixed_fee_check;
alter table public.classes
  add constraint classes_instructor_fixed_fee_check
  check (instructor_fixed_fee >= 0);

-- ---------------------------------------------------------------------
-- 3) Settlement rows: type + nullable payment_id for fixed-fee rows
-- ---------------------------------------------------------------------
alter table public.instructor_settlements
  add column if not exists settlement_type text not null default 'commission';

alter table public.instructor_settlements
  drop constraint if exists instructor_settlements_settlement_type_check;
alter table public.instructor_settlements
  add constraint instructor_settlements_settlement_type_check
  check (settlement_type in ('commission', 'fixed_fee'));

alter table public.instructor_settlements
  alter column payment_id drop not null;

-- One fixed-fee accrual per class
create unique index if not exists instructor_settlements_fixed_fee_class_uidx
  on public.instructor_settlements (class_id)
  where settlement_type = 'fixed_fee' and class_id is not null;

-- ---------------------------------------------------------------------
-- 4) Sync fixed-fee settlement when a class is saved
-- ---------------------------------------------------------------------
create or replace function public.sync_class_fixed_fee_settlement(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_instructor uuid;
  v_model text;
  v_fee numeric;
begin
  select institution_id, instructor_id, settlement_model, coalesce(instructor_fixed_fee, 0)
    into v_inst, v_instructor, v_model, v_fee
  from public.classes
  where id = p_class_id;

  if v_inst is null then
    return;
  end if;

  -- Always clear previous fixed-fee row for this class first
  delete from public.instructor_settlements
  where class_id = p_class_id
    and settlement_type = 'fixed_fee';

  if v_model = 'fixed_fee'
     and v_instructor is not null
     and v_fee > 0
  then
    insert into public.instructor_settlements (
      institution_id,
      instructor_id,
      payment_id,
      class_id,
      rate,
      amount,
      settlement_type
    ) values (
      v_inst,
      v_instructor,
      null,
      p_class_id,
      0,
      round(v_fee, 2),
      'fixed_fee'
    );
  end if;
end;
$$;

create or replace function public.trg_classes_sync_fixed_fee_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_class_fixed_fee_settlement(new.id);
  return new;
end;
$$;

drop trigger if exists trg_classes_sync_fixed_fee_settlement on public.classes;
create trigger trg_classes_sync_fixed_fee_settlement
after insert or update of instructor_id, settlement_model, instructor_fixed_fee
on public.classes
for each row
execute function public.trg_classes_sync_fixed_fee_settlement();

revoke all on function public.sync_class_fixed_fee_settlement(uuid) from public;
grant execute on function public.sync_class_fixed_fee_settlement(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Payment settlement: commission classes only
-- ---------------------------------------------------------------------
create or replace function public.create_settlement_on_payment_from_row(new public.payments)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id      uuid;
  v_instructor_id uuid;
  v_rate          numeric;
  v_model         text;
  v_student_id    uuid;
  v_affiliate_id  uuid;
  v_aff_rate      numeric;
begin
  if coalesce(new.is_registration_fee, false) = true then
    delete from public.instructor_settlements where payment_id = new.id;
    delete from public.affiliate_settlements where payment_id = new.id;
    return;
  end if;
  if coalesce(new.status, 'completed') <> 'completed' then
    delete from public.instructor_settlements where payment_id = new.id;
    delete from public.affiliate_settlements where payment_id = new.id;
    return;
  end if;

  select c.id,
         c.instructor_id,
         coalesce(c.settlement_model, 'commission'),
         coalesce(i.default_instructor_commission_rate, c.commission_rate, 0),
         e.student_id
    into v_class_id, v_instructor_id, v_model, v_rate, v_student_id
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.institutions i on i.id = c.institution_id
  where e.id = new.enrollment_id;

  -- Fixed-fee classes: earnings come from the class-level settlement, not payments
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

-- Keep INSERT trigger aligned with UPDATE path
create or replace function public.create_settlement_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_settlement_on_payment_from_row(new);
  return new;
end;
$$;

-- Backfill fixed-fee settlements for any existing fixed_fee classes (none yet — safe)
select public.sync_class_fixed_fee_settlement(c.id)
from public.classes c
where c.settlement_model = 'fixed_fee';
