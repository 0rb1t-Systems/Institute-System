-- =====================================================================
--  0024_phase1_hardening.sql
--  Phase 1 loop hardening: discounts, affiliate, notes, payment status,
--  withdrawal fields, settlement trigger guards, foundation RLS ENABLE
-- =====================================================================

-- ---------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------
alter table enrollments
  add column if not exists discount_amount numeric(12,2) not null default 0
  check (discount_amount >= 0);

alter table profiles
  add column if not exists affiliate_id uuid references profiles(id) on delete set null;

create index if not exists idx_profiles_affiliate on profiles(affiliate_id);

alter table attendance
  add column if not exists notes text;

alter table payments
  add column if not exists status text not null default 'completed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_status_check'
  ) then
    alter table payments
      add constraint payments_status_check
      check (status in ('pending', 'completed', 'failed'));
  end if;
end $$;

alter table withdrawals
  add column if not exists method text,
  add column if not exists payment_details text;

-- ---------------------------------------------------------------------
-- Balance view: completed payments only + discount
-- ---------------------------------------------------------------------
drop view if exists enrollment_balances;
create view enrollment_balances
with (security_invoker = true)
as
select
  e.id              as enrollment_id,
  e.institution_id,
  e.student_id,
  e.class_id,
  c.total_fee,
  coalesce(e.discount_amount, 0) as discount_amount,
  greatest(c.total_fee - coalesce(e.discount_amount, 0), 0) as net_fee,
  coalesce(sum(p.amount) filter (where p.status = 'completed'), 0) as total_paid,
  greatest(c.total_fee - coalesce(e.discount_amount, 0), 0)
    - coalesce(sum(p.amount) filter (where p.status = 'completed'), 0) as balance
from enrollments e
join classes c on c.id = e.class_id
left join payments p on p.enrollment_id = e.id
group by e.id, e.institution_id, e.student_id, e.class_id, c.total_fee, e.discount_amount;

-- ---------------------------------------------------------------------
-- Settlement trigger: skip registration fees & non-completed payments
-- ---------------------------------------------------------------------
create or replace function public.create_settlement_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id      uuid;
  v_instructor_id uuid;
  v_rate          numeric;
begin
  -- Only completed, non-registration-fee payments earn commission
  if coalesce(new.is_registration_fee, false) = true then
    return new;
  end if;
  if coalesce(new.status, 'completed') <> 'completed' then
    return new;
  end if;

  select c.id, c.instructor_id, coalesce(c.commission_rate, 0)
    into v_class_id, v_instructor_id, v_rate
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  where e.id = new.enrollment_id;

  if v_instructor_id is not null and v_rate > 0 then
    insert into public.instructor_settlements
      (institution_id, instructor_id, payment_id, class_id, rate, amount)
    values
      (new.institution_id, v_instructor_id, new.id, v_class_id, v_rate,
       round(new.amount * v_rate, 2))
    on conflict (payment_id) do update
      set rate = excluded.rate,
          amount = excluded.amount,
          instructor_id = excluded.instructor_id,
          class_id = excluded.class_id;
  end if;

  return new;
end;
$$;

-- When payment updates to completed / amount changes, resync settlement
create or replace function public.sync_settlement_on_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If no longer eligible, remove settlement
  if coalesce(new.is_registration_fee, false) = true
     or coalesce(new.status, 'completed') <> 'completed' then
    delete from public.instructor_settlements where payment_id = new.id;
    return new;
  end if;

  -- Re-run create logic (upsert)
  perform public.create_settlement_on_payment_from_row(new);
  return new;
end;
$$;

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
begin
  if coalesce(new.is_registration_fee, false) = true then
    return;
  end if;
  if coalesce(new.status, 'completed') <> 'completed' then
    return;
  end if;

  select c.id, c.instructor_id, coalesce(c.commission_rate, 0)
    into v_class_id, v_instructor_id, v_rate
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  where e.id = new.enrollment_id;

  if v_instructor_id is not null and v_rate > 0 then
    insert into public.instructor_settlements
      (institution_id, instructor_id, payment_id, class_id, rate, amount)
    values
      (new.institution_id, v_instructor_id, new.id, v_class_id, v_rate,
       round(new.amount * v_rate, 2))
    on conflict (payment_id) do update
      set rate = excluded.rate,
          amount = excluded.amount,
          instructor_id = excluded.instructor_id,
          class_id = excluded.class_id;
  else
    delete from public.instructor_settlements where payment_id = new.id;
  end if;
end;
$$;

drop trigger if exists trg_payment_settlement_update on payments;
create trigger trg_payment_settlement_update
after update of amount, status, is_registration_fee, enrollment_id on payments
for each row
execute function public.sync_settlement_on_payment_update();

-- Payment delete cascades via FK on settlements (on delete cascade) — already set

-- ---------------------------------------------------------------------
-- Foundation RLS ENABLE hygiene (idempotent)
-- ---------------------------------------------------------------------
alter table institutions enable row level security;
alter table profiles enable row level security;
alter table diplomas enable row level security;
alter table courses enable row level security;
alter table classes enable row level security;
alter table enrollments enable row level security;
