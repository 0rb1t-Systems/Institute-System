-- =====================================================================
--  0021_payment_registration_fee.sql
--  Persist $5 registration fee flag so Finance stats work correctly.
-- =====================================================================

alter table payments
  add column if not exists is_registration_fee boolean not null default false;

create index if not exists idx_payments_reg_fee
  on payments (institution_id, is_registration_fee)
  where is_registration_fee = true;

-- Backfill: $5 payments with no billing-month note are registration fees
update payments
set is_registration_fee = true
where amount = 5
  and is_registration_fee = false
  and (
    note is null
    or trim(note) = ''
    or lower(note) like '%regist%'
  );

-- Also backfill earliest $5 payment per enrollment when still unmarked
-- (covers legacy records that stored a stray note)
with ranked as (
  select
    id,
    row_number() over (
      partition by enrollment_id
      order by paid_at asc, id asc
    ) as rn
  from payments
  where amount = 5
    and is_registration_fee = false
)
update payments p
set is_registration_fee = true
from ranked r
where p.id = r.id
  and r.rn = 1
  and not exists (
    select 1 from payments x
    where x.enrollment_id = p.enrollment_id
      and x.is_registration_fee = true
  );
