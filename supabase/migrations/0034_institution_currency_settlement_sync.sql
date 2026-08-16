-- =====================================================================
--  0034_institution_currency_settlement_sync.sql
--  - Per-tenant currency + currency symbol on institutions
--  - Align payment UPDATE settlement path with institution rates + affiliates
-- =====================================================================

-- Currency settings (tenant-admin controlled from Institution Settings)
alter table public.institutions
  add column if not exists currency text not null default 'USD',
  add column if not exists currency_symbol text not null default '$';

alter table public.institutions
  drop constraint if exists institutions_currency_format;
alter table public.institutions
  add constraint institutions_currency_format
  check (currency ~ '^[A-Z]{3}$');

alter table public.institutions
  drop constraint if exists institutions_currency_symbol_len;
alter table public.institutions
  add constraint institutions_currency_symbol_len
  check (char_length(currency_symbol) >= 1 and char_length(currency_symbol) <= 8);

-- New tenants start with unset commissions / free registration until admin configures them
alter table public.institutions
  alter column registration_fee_amount set default 0,
  alter column default_instructor_commission_rate set default 0;

-- ---------------------------------------------------------------------
-- Settlement upsert used by UPDATE trigger — must match INSERT path (0033)
-- ---------------------------------------------------------------------
drop function if exists public.create_settlement_on_payment_from_row(public.payments);

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
         coalesce(i.default_instructor_commission_rate, c.commission_rate, 0),
         e.student_id
    into v_class_id, v_instructor_id, v_rate, v_student_id
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.institutions i on i.id = c.institution_id
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

create or replace function public.sync_settlement_on_payment_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_registration_fee, false) = true
     or coalesce(new.status, 'completed') <> 'completed' then
    delete from public.instructor_settlements where payment_id = new.id;
    delete from public.affiliate_settlements where payment_id = new.id;
    return new;
  end if;

  perform public.create_settlement_on_payment_from_row(new);
  return new;
end;
$$;
