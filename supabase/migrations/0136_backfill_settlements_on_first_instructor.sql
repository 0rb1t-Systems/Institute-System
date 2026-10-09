-- =====================================================================
--  0136_backfill_settlements_on_first_instructor.sql
--  When a class goes from no instructor → assigned instructor, create
--  missing commission settlements for completed tuition payments so the
--  new instructor earns on payments that happened while unassigned.
-- =====================================================================

create or replace function public.backfill_class_instructor_settlements(p_class_id uuid)
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

  -- Fixed-fee classes are handled by sync_class_fixed_fee_settlement
  if v_model = 'fixed_fee' then
    perform public.sync_class_fixed_fee_settlement(p_class_id);
    return;
  end if;

  for v_pay in
    select p.*
    from public.payments p
    join public.enrollments e on e.id = p.enrollment_id
    where e.class_id = p_class_id
      and coalesce(p.status, 'completed') = 'completed'
      and coalesce(p.is_registration_fee, false) = false
      and not exists (
        select 1 from public.instructor_settlements s where s.payment_id = p.id
      )
  loop
    perform public.create_settlement_on_payment_from_row(v_pay);
  end loop;
end;
$$;

revoke all on function public.backfill_class_instructor_settlements(uuid) from public;
grant execute on function public.backfill_class_instructor_settlements(uuid) to authenticated;

create or replace function public.trg_classes_transfer_instructor_settlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.instructor_id is distinct from new.instructor_id
  then
    if old.instructor_id is null and new.instructor_id is not null then
      -- First assign: create earnings for past completed payments
      perform public.backfill_class_instructor_settlements(new.id);
    else
      perform public.transfer_class_instructor_settlements(
        new.id,
        old.instructor_id,
        new.instructor_id
      );
    end if;
  end if;
  return new;
end;
$$;
