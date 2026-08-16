-- =====================================================================
--  0027_default_instructor_commission_40.sql
--  Default instructor commission = 40% of each student payment
--  Backfill settlements for existing completed tuition payments
-- =====================================================================

-- New classes default to 40%
alter table public.classes
  alter column commission_rate set default 0.4000;

-- Existing classes with 0% → 40% (so instructor earnings / payout work)
update public.classes
set commission_rate = 0.4000
where coalesce(commission_rate, 0) = 0;

-- Backfill missing settlements for completed tuition payments
insert into public.instructor_settlements
  (institution_id, instructor_id, payment_id, class_id, rate, amount)
select
  p.institution_id,
  c.instructor_id,
  p.id,
  c.id,
  c.commission_rate,
  round(p.amount * c.commission_rate, 2)
from public.payments p
join public.enrollments e on e.id = p.enrollment_id
join public.classes c on c.id = e.class_id
where coalesce(p.is_registration_fee, false) = false
  and coalesce(p.status, 'completed') = 'completed'
  and c.instructor_id is not null
  and coalesce(c.commission_rate, 0) > 0
  and not exists (
    select 1 from public.instructor_settlements s where s.payment_id = p.id
  )
on conflict (payment_id) do nothing;

-- If settlement exists but was created at 0% / wrong rate, resync from class rate
update public.instructor_settlements s
set
  rate = c.commission_rate,
  amount = round(p.amount * c.commission_rate, 2),
  instructor_id = c.instructor_id,
  class_id = c.id
from public.payments p
join public.enrollments e on e.id = p.enrollment_id
join public.classes c on c.id = e.class_id
where s.payment_id = p.id
  and coalesce(p.is_registration_fee, false) = false
  and coalesce(p.status, 'completed') = 'completed'
  and c.instructor_id is not null
  and coalesce(c.commission_rate, 0) > 0
  and (s.rate is distinct from c.commission_rate or s.amount is distinct from round(p.amount * c.commission_rate, 2));
