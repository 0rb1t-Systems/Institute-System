-- Affiliate earnings: class visibility + withdrawable commission balance.
-- Affiliates may request payouts from affiliate_settlements, same flow as instructors.

alter table public.withdrawals
  alter column instructor_id drop not null;

alter table public.withdrawals
  add column if not exists affiliate_id uuid references public.profiles(id) on delete cascade;

create index if not exists idx_withdrawals_affiliate on public.withdrawals(affiliate_id);

alter table public.withdrawals
  drop constraint if exists withdrawals_payee_check;

alter table public.withdrawals
  add constraint withdrawals_payee_check
  check (
    (instructor_id is not null and affiliate_id is null)
    or (instructor_id is null and affiliate_id is not null)
  );

create or replace function public.affiliate_available_balance(aff uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select sum(amount) from public.affiliate_settlements
      where affiliate_id = aff
    ), 0)
    - coalesce((
      select sum(amount) from public.withdrawals
      where affiliate_id = aff and status::text <> 'rejected'
    ), 0)
$$;

revoke all on function public.affiliate_available_balance(uuid) from public, anon, authenticated;
grant execute on function public.affiliate_available_balance(uuid) to postgres, service_role, authenticated;

create or replace function public.is_affiliate_referred_class(cls uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.profiles p on p.id = e.student_id
    where e.class_id = cls
      and p.affiliate_id = auth.uid()
      and p.role = 'student'
  )
$$;

revoke all on function public.is_affiliate_referred_class(uuid) from public, anon;
grant execute on function public.is_affiliate_referred_class(uuid) to authenticated, postgres, service_role;

drop policy if exists "cls_select_affiliate" on public.classes;
create policy "cls_select_affiliate" on public.classes
for select
using (
  institution_id = public.current_institution_id()
  and public.current_user_role() = 'affiliate'
  and public.is_affiliate_referred_class(id)
);

create or replace function public.check_withdrawal_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available numeric(12,2);
  v_counts boolean;
  v_payee uuid;
  v_is_affiliate boolean;
begin
  v_counts := coalesce(new.status::text, 'pending') <> 'rejected';
  v_is_affiliate := new.affiliate_id is not null;
  v_payee := coalesce(new.affiliate_id, new.instructor_id);

  if tg_op = 'UPDATE' then
    if not v_counts then
      return new;
    end if;
    if (
      coalesce(old.status::text, 'pending') <> 'rejected'
      and new.amount <= old.amount
      and new.instructor_id is not distinct from old.instructor_id
      and new.affiliate_id is not distinct from old.affiliate_id
    ) then
      return new;
    end if;
  end if;

  if not v_counts then
    return new;
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  if v_payee is null then
    raise exception 'PAYEE_REQUIRED';
  end if;

  perform 1 from public.profiles where id = v_payee for update;
  if not found then
    raise exception 'PAYEE_NOT_FOUND';
  end if;

  if v_is_affiliate then
    v_available := public.affiliate_available_balance(new.affiliate_id);
  else
    v_available := public.instructor_available_balance(new.instructor_id);
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.status::text, 'pending') <> 'rejected'
     and old.instructor_id is not distinct from new.instructor_id
     and old.affiliate_id is not distinct from new.affiliate_id then
    v_available := v_available + coalesce(old.amount, 0);
  end if;

  if new.amount > v_available then
    raise exception 'WITHDRAWAL_EXCEEDS_BALANCE';
  end if;

  return new;
end;
$$;

drop policy if exists "wd_select" on public.withdrawals;
create policy "wd_select" on public.withdrawals for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin()
    or instructor_id = auth.uid()
    or affiliate_id = auth.uid()
  )
);

drop policy if exists "wd_insert" on public.withdrawals;
create policy "wd_insert" on public.withdrawals for insert
with check (
  institution_id = public.current_institution_id()
  and (
    public.is_admin()
    or (
      instructor_id = auth.uid()
      and affiliate_id is null
      and public.current_user_role() = 'instructor'
    )
    or (
      affiliate_id = auth.uid()
      and instructor_id is null
      and public.current_user_role() = 'affiliate'
    )
  )
);

comment on column public.withdrawals.affiliate_id is
  'Affiliate payee. Mutually exclusive with instructor_id.';
