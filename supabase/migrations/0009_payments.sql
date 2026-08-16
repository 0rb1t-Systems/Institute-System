-- =====================================================================
--  0009_payments.sql
--  Finance Qeyb 1 — payments + balance view + RLS
-- =====================================================================

create type payment_method as enum ('cash', 'waafipay', 'bank', 'other');

-- ---------------------------------------------------------------------
-- payments — bixin kasta oo arday ku sameeyo diiwaangelintiisa
-- ---------------------------------------------------------------------
create table payments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  enrollment_id  uuid not null references enrollments(id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  method         payment_method not null default 'cash',
  note           text,
  recorded_by    uuid references profiles(id) on delete set null,  -- yaa diiwaangeliyay
  paid_at        timestamptz not null default now()
);
create index idx_payments_institution on payments(institution_id);
create index idx_payments_enrollment on payments(enrollment_id);

alter table payments enable row level security;


-- ---------------------------------------------------------------------
-- Helper: ardaygu ma leeyahay diiwaangelintan? (payment SELECT student)
-- ---------------------------------------------------------------------
create or replace function public.owns_enrollment(enr uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrollments
    where id = enr and student_id = auth.uid()
  )
$$;


-- ---------------------------------------------------------------------
-- VIEW: enrollment_balances — hadhaaga la xisaabiyay (lama kaydiyo)
-- security_invoker = true  =>  RLS tables-ka hoose ayaa la dabaqaa!
-- ---------------------------------------------------------------------
create view enrollment_balances
with (security_invoker = true)
as
select
  e.id              as enrollment_id,
  e.institution_id,
  e.student_id,
  e.class_id,
  c.total_fee,
  coalesce(sum(p.amount), 0)          as total_paid,
  c.total_fee - coalesce(sum(p.amount), 0) as balance
from enrollments e
join classes c   on c.id = e.class_id
left join payments p on p.enrollment_id = e.id
group by e.id, e.institution_id, e.student_id, e.class_id, c.total_fee;


-- ---------------------------------------------------------------------
-- RLS: payments
-- Matrix: Admin V/C/E/D · Staff V/C/E · Student Own:V
-- ---------------------------------------------------------------------
create policy "pay_select" on payments for select
using ( institution_id = public.current_institution_id()
        and ( public.is_admin_or_staff() or public.owns_enrollment(enrollment_id) ) );

create policy "pay_insert" on payments for insert
with check ( institution_id = public.current_institution_id()
             and public.is_admin_or_staff() );

create policy "pay_update" on payments for update
using      ( institution_id = public.current_institution_id() and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

-- DELETE: kaliya admin (staff ma laha D)
create policy "pay_delete" on payments for delete
using ( institution_id = public.current_institution_id() and public.is_admin() );
