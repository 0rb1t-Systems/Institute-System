-- =====================================================================
--  0010_settlements.sql
--  Finance Qeyb 2 — commission_rate + instructor_settlements + TRIGGER
-- =====================================================================

-- 1) Boqolkiiba commission ee fasal kasta (0.1000 = 10%)
alter table classes
  add column commission_rate numeric(5,4) not null default 0;


-- 2) instructor_settlements — diiwaan commission ah bixin kasta
create table instructor_settlements (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  instructor_id  uuid not null references profiles(id) on delete cascade,
  payment_id     uuid not null references payments(id) on delete cascade,
  class_id       uuid references classes(id) on delete set null,
  rate           numeric(5,4) not null,
  amount         numeric(12,2) not null,
  created_at     timestamptz not null default now(),
  unique (payment_id)              -- hal bixin = hal settlement (celcelis ma jiro)
);
create index idx_settlements_institution on instructor_settlements(institution_id);
create index idx_settlements_instructor on instructor_settlements(instructor_id);

alter table instructor_settlements enable row level security;


-- 3) TRIGGER FUNCTION — mar kasta oo bixin la diiwaangeliyo, samee commission
--    security definer: si uu u galo settlements iyadoon RLS hor istaagin
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
  -- payment -> enrollment -> class -> instructor + rate
  select c.id, c.instructor_id, coalesce(c.commission_rate, 0)
    into v_class_id, v_instructor_id, v_rate
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  where e.id = new.enrollment_id;

  -- Samee settlement KALIYA haddii instructor jiro & rate > 0
  if v_instructor_id is not null and v_rate > 0 then
    insert into public.instructor_settlements
      (institution_id, instructor_id, payment_id, class_id, rate, amount)
    values
      (new.institution_id, v_instructor_id, new.id, v_class_id, v_rate,
       round(new.amount * v_rate, 2));
  end if;

  return new;
end;
$$;

-- Ku xir trigger-ka payments (AFTER INSERT = ka dib marka bixinta la sameeyo)
create trigger trg_payment_settlement
after insert on payments
for each row
execute function public.create_settlement_on_payment();


-- 4) RLS: instructor_settlements
--    Matrix: Admin V/C/E/D · Staff — (WAXBA!) · Instructor Own:V
create policy "settle_select" on instructor_settlements for select
using ( institution_id = public.current_institution_id()
        and ( public.is_admin() or instructor_id = auth.uid() ) );

create policy "settle_insert" on instructor_settlements for insert
with check ( institution_id = public.current_institution_id() and public.is_admin() );

create policy "settle_update" on instructor_settlements for update
using      ( institution_id = public.current_institution_id() and public.is_admin() )
with check ( institution_id = public.current_institution_id() and public.is_admin() );

create policy "settle_delete" on instructor_settlements for delete
using ( institution_id = public.current_institution_id() and public.is_admin() );
