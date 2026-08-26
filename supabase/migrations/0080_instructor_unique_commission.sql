-- Unique per-instructor commission % (0–1). NULL = use institution default.
-- Not fixed fee. Overrides institution settings for that instructor only.

alter table public.profiles
  add column if not exists instructor_commission_rate numeric(5,4);

alter table public.profiles
  drop constraint if exists profiles_instructor_commission_rate_check;
alter table public.profiles
  add constraint profiles_instructor_commission_rate_check
  check (
    instructor_commission_rate is null
    or (instructor_commission_rate >= 0 and instructor_commission_rate <= 1)
  );

comment on column public.profiles.instructor_commission_rate is
  'Optional unique instructor commission (0–1). NULL follows institution default_instructor_commission_rate.';

create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institution_id is distinct from old.institution_id then
    raise exception 'institution_id lama beddeli karo';
  end if;

  if (new.role = 'super_admin') is distinct from (old.role = 'super_admin') then
    raise exception 'super_admin role lama beddeli karo';
  end if;

  if new.role is distinct from old.role
     and not (public.is_admin() or public.is_super_admin()) then
    raise exception 'Kaliya admin ama super_admin ayaa beddeli kara role';
  end if;

  if new.status is distinct from old.status
     and not (public.is_admin_or_staff() or public.is_super_admin()) then
    raise exception 'Kaliya admin/staff ama super_admin ayaa beddeli kara status';
  end if;

  if (
    new.settlement_model is distinct from old.settlement_model
    or new.fixed_fee_amount is distinct from old.fixed_fee_amount
    or new.instructor_commission_rate is distinct from old.instructor_commission_rate
  ) and not (public.is_admin() or public.is_super_admin()) then
    raise exception 'Kaliya admin ayaa beddeli kara instructor settlement settings';
  end if;

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
         coalesce(
           ip.instructor_commission_rate,
           i.default_instructor_commission_rate,
           c.commission_rate,
           0
         ),
         e.student_id
    into v_class_id, v_instructor_id, v_model, v_rate, v_student_id
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.institutions i on i.id = c.institution_id
  left join public.profiles ip on ip.id = c.instructor_id
  where e.id = new.enrollment_id;

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
