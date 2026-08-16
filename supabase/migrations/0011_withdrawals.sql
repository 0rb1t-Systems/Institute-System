-- =====================================================================
--  0011_withdrawals.sql
--  Finance Qeyb 3 — withdrawals + balance guard trigger + balance view
-- =====================================================================

create type withdrawal_status as enum ('pending', 'approved', 'rejected', 'paid');

-- ---------------------------------------------------------------------
-- withdrawals — codsiga la-baxsashada ee instructor-ka
-- ---------------------------------------------------------------------
create table withdrawals (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  instructor_id  uuid not null references profiles(id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  status         withdrawal_status not null default 'pending',
  note           text,
  requested_at   timestamptz not null default now(),
  processed_at   timestamptz,
  processed_by   uuid references profiles(id) on delete set null
);
create index idx_withdrawals_institution on withdrawals(institution_id);
create index idx_withdrawals_instructor on withdrawals(instructor_id);

alter table withdrawals enable row level security;


-- ---------------------------------------------------------------------
-- Helper: balance-ka la heli karo (accrued - withdrawn)
--   withdrawn = kuwa aan la diidin (pending+approved+paid)
-- ---------------------------------------------------------------------
create or replace function public.instructor_available_balance(inst uuid)
returns numeric language sql stable security definer set search_path = public
as $$
  select
    coalesce((select sum(amount) from public.instructor_settlements
              where instructor_id = inst), 0)
  - coalesce((select sum(amount) from public.withdrawals
              where instructor_id = inst and status <> 'rejected'), 0)
$$;


-- ---------------------------------------------------------------------
-- TRIGGER (BEFORE INSERT): diid haddii codsigu ka badan yahay balance-ka
-- ---------------------------------------------------------------------
create or replace function public.check_withdrawal_balance()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.amount > public.instructor_available_balance(new.instructor_id) then
    raise exception 'Codsiga (%) waa ka badan yahay balance-ka la heli karo', new.amount;
  end if;
  return new;
end;
$$;

create trigger trg_check_withdrawal
before insert on withdrawals
for each row
execute function public.check_withdrawal_balance();


-- ---------------------------------------------------------------------
-- VIEW: instructor_balances (security_invoker => RLS la dabaqo)
-- ---------------------------------------------------------------------
create view instructor_balances
with (security_invoker = true)
as
select
  p.institution_id,
  p.id                                   as instructor_id,
  p.full_name,
  coalesce(acc.total, 0)                  as total_accrued,
  coalesce(wd.total, 0)                   as total_withdrawn,
  coalesce(acc.total, 0) - coalesce(wd.total, 0) as available_balance
from profiles p
left join ( select instructor_id, sum(amount) total
            from instructor_settlements group by instructor_id ) acc
       on acc.instructor_id = p.id
left join ( select instructor_id, sum(amount) total
            from withdrawals where status <> 'rejected' group by instructor_id ) wd
       on wd.instructor_id = p.id
where p.role = 'instructor';


-- ---------------------------------------------------------------------
-- RLS: withdrawals
--   SELECT: admin / instructor-own
--   INSERT: instructor-own (codso) ama admin
--   UPDATE/DELETE: admin kaliya (oggolaan/diid/bixi)
-- ---------------------------------------------------------------------
create policy "wd_select" on withdrawals for select
using ( institution_id = public.current_institution_id()
        and ( public.is_admin() or instructor_id = auth.uid() ) );

create policy "wd_insert" on withdrawals for insert
with check ( institution_id = public.current_institution_id()
             and ( public.is_admin()
                   or ( instructor_id = auth.uid()
                        and public.current_user_role() = 'instructor' ) ) );

create policy "wd_update" on withdrawals for update
using      ( institution_id = public.current_institution_id() and public.is_admin() )
with check ( institution_id = public.current_institution_id() and public.is_admin() );

create policy "wd_delete" on withdrawals for delete
using ( institution_id = public.current_institution_id() and public.is_admin() );
