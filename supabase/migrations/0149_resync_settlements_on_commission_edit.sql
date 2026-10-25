-- =====================================================================
--  0149_resync_settlements_on_commission_edit.sql
--  When instructor unique commission / class commission / settlement model
--  changes, recalculate ALL existing tuition settlements for that class
--  (including past payments). Same after class instructor reassignment.
-- =====================================================================

create or replace function public.resync_class_instructor_settlements(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments%rowtype;
  v_instructor uuid;
  v_model text;
begin
  if p_class_id is null then
    return;
  end if;

  select instructor_id, coalesce(settlement_model, 'commission')
    into v_instructor, v_model
  from public.classes
  where id = p_class_id;

  if v_instructor is null then
    return;
  end if;

  if v_model = 'fixed_fee' then
    perform public.sync_class_fixed_fee_settlement(p_class_id);
    return;
  end if;

  -- Re-run settlement for every completed tuition payment so rate/amount
  -- match the instructor's current unique rate (or institution/class fallback).
  for v_pay in
    select p.*
    from public.payments p
    join public.enrollments e on e.id = p.enrollment_id
    where e.class_id = p_class_id
      and coalesce(p.status, 'completed') = 'completed'
      and coalesce(p.is_registration_fee, false) = false
      and coalesce(p.amount, 0) > 0
  loop
    perform public.create_settlement_on_payment_from_row(v_pay);
  end loop;
end;
$$;

comment on function public.resync_class_instructor_settlements(uuid) is
  'Recalculate instructor settlements for all completed tuition payments in a class using the current commission rate.';

revoke all on function public.resync_class_instructor_settlements(uuid) from public;
grant execute on function public.resync_class_instructor_settlements(uuid) to authenticated;

create or replace function public.resync_instructor_settlements_for_profile(p_instructor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_instructor_id is null then
    return;
  end if;

  for r in
    select c.id
    from public.classes c
    where c.instructor_id = p_instructor_id
  loop
    perform public.resync_class_instructor_settlements(r.id);
  end loop;
end;
$$;

comment on function public.resync_instructor_settlements_for_profile(uuid) is
  'Recalculate settlements on every class currently taught by this instructor.';

revoke all on function public.resync_instructor_settlements_for_profile(uuid) from public;
grant execute on function public.resync_instructor_settlements_for_profile(uuid) to authenticated;

-- When admin edits unique commission / settlement model on an instructor
create or replace function public.trg_profiles_resync_instructor_settlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.role = 'instructor'
     and (
       new.instructor_commission_rate is distinct from old.instructor_commission_rate
       or new.settlement_model is distinct from old.settlement_model
       or new.fixed_fee_amount is distinct from old.fixed_fee_amount
     )
  then
    perform public.resync_instructor_settlements_for_profile(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_resync_instructor_settlements on public.profiles;
create trigger trg_profiles_resync_instructor_settlements
after update of instructor_commission_rate, settlement_model, fixed_fee_amount
on public.profiles
for each row
execute function public.trg_profiles_resync_instructor_settlements();

-- When class commission_rate / model changes (incl. institution default sync)
create or replace function public.trg_classes_resync_instructor_settlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.commission_rate is distinct from old.commission_rate
       or new.settlement_model is distinct from old.settlement_model
       or new.instructor_fixed_fee is distinct from old.instructor_fixed_fee
     )
     -- instructor reassignment has its own path (transfer + resync below)
     and new.instructor_id is not distinct from old.instructor_id
  then
    perform public.resync_class_instructor_settlements(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_classes_resync_instructor_settlements on public.classes;
create trigger trg_classes_resync_instructor_settlements
after update of commission_rate, settlement_model, instructor_fixed_fee
on public.classes
for each row
execute function public.trg_classes_resync_instructor_settlements();

-- After reassignment transfer, recalculate at the NEW instructor's rate
create or replace function public.trg_classes_transfer_instructor_settlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if tg_op = 'UPDATE'
     and old.instructor_id is distinct from new.instructor_id
  then
    if new.instructor_id is null then
      perform public.transfer_class_instructor_settlements(
        new.id,
        old.instructor_id,
        null
      );
    elsif old.instructor_id is null then
      for r in
        select distinct s.instructor_id as from_instructor_id
        from public.instructor_settlements s
        where s.class_id = new.id
          and s.instructor_id is distinct from new.instructor_id
      loop
        perform public.transfer_class_instructor_settlements(
          new.id,
          r.from_instructor_id,
          new.instructor_id
        );
      end loop;
      perform public.backfill_class_instructor_settlements(new.id);
      perform public.resync_class_instructor_settlements(new.id);
    else
      perform public.transfer_class_instructor_settlements(
        new.id,
        old.instructor_id,
        new.instructor_id
      );
      -- Past payments keep ownership with new instructor, but amounts must
      -- match the new instructor's current commission (not the previous rate).
      perform public.resync_class_instructor_settlements(new.id);
    end if;
  end if;
  return new;
end;
$$;

-- One-time heal: BRCE PD IN SR&PM BATCH 3 (Abshir unique 30%)
select public.resync_class_instructor_settlements('d171067d-d5e0-4872-ae95-5a057f5de8d1');
