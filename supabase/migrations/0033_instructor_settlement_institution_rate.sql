-- =====================================================================
--  0033_instructor_settlement_institution_rate.sql
--  Instructor commission from Institution Settings (default_instructor_commission_rate).
-- =====================================================================

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
  v_student_id    uuid;
  v_affiliate_id  uuid;
  v_aff_rate      numeric;
begin
  if coalesce(new.is_registration_fee, false) = true then
    return new;
  end if;
  if coalesce(new.status, 'completed') <> 'completed' then
    return new;
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
  end if;

  return new;
end;
$$;

update public.classes c
set commission_rate = i.default_instructor_commission_rate
from public.institutions i
where c.institution_id = i.id
  and c.commission_rate is distinct from i.default_instructor_commission_rate;
