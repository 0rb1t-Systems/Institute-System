-- =====================================================================
--  0139_clear_earnings_on_unassign.sql
--  When a class instructor is removed (unassigned) or replaced, the
--  previous instructor must stop seeing that class's earnings.
--  Unassign: clear class settlements from the previous instructor.
--  Reassign / assign-after-unassign: move leftovers to the new instructor,
--  then backfill any missing commission rows.
-- =====================================================================

create or replace function public.transfer_class_instructor_settlements(
  p_class_id uuid,
  p_from_instructor uuid,
  p_to_instructor uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_class_total numeric(12,2) := 0;
  v_rejected_pending int := 0;
  r record;
begin
  if p_class_id is null then
    return;
  end if;

  if p_from_instructor is not distinct from p_to_instructor then
    return;
  end if;

  select institution_id into v_inst
  from public.classes
  where id = p_class_id;

  if v_inst is null then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_class_total
  from public.instructor_settlements
  where class_id = p_class_id
    and (
      (p_from_instructor is not null and instructor_id = p_from_instructor)
      or (
        p_from_instructor is null
        and (
          p_to_instructor is null
          or instructor_id is distinct from p_to_instructor
        )
      )
    );

  if v_class_total <= 0 then
    return;
  end if;

  -- Cancel unpaid withdrawal requests for the previous instructor
  if p_from_instructor is not null then
    with doomed as (
      update public.withdrawals w
      set
        status = 'rejected',
        processed_at = now(),
        note = trim(both from concat(
          coalesce(nullif(trim(w.note), ''), ''),
          case
            when coalesce(nullif(trim(w.note), ''), '') = '' then ''
            else E'\n'
          end,
          '[Auto-rejected: class instructor changed; class earnings removed from previous instructor.]'
        ))
      where w.instructor_id = p_from_instructor
        and w.status::text = 'pending'
      returning w.id
    )
    select count(*)::int into v_rejected_pending from doomed;
  end if;

  -- Unassign: remove earnings from previous instructor entirely
  if p_to_instructor is null then
    for r in
      select s.id, s.instructor_id, s.amount
      from public.instructor_settlements s
      where s.class_id = p_class_id
        and (
          (p_from_instructor is not null and s.instructor_id = p_from_instructor)
          or (p_from_instructor is null)
        )
    loop
      begin
        insert into public.instructor_payment_transfer_log (
          institution_id, class_id, settlement_id,
          from_instructor_id, to_instructor_id, amount,
          status, reason
        ) values (
          v_inst, p_class_id, r.id,
          r.instructor_id, null, r.amount,
          'transferred',
          'Class unassigned; earnings cleared from previous instructor.'
        );

        delete from public.instructor_settlements where id = r.id;
      exception when others then
        insert into public.instructor_payment_transfer_log (
          institution_id, class_id, settlement_id,
          from_instructor_id, to_instructor_id, amount,
          status, reason, error_message
        ) values (
          v_inst, p_class_id, r.id,
          r.instructor_id, null, r.amount,
          'failed',
          'Class unassigned; failed to clear earnings.',
          left(sqlerrm, 500)
        );
      end;
    end loop;
    return;
  end if;

  -- Reassign / move leftovers to the new instructor
  for r in
    select s.id, s.instructor_id, s.amount
    from public.instructor_settlements s
    where s.class_id = p_class_id
      and (
        (p_from_instructor is not null and s.instructor_id = p_from_instructor)
        or (p_from_instructor is null and s.instructor_id is distinct from p_to_instructor)
      )
    order by s.created_at desc nulls last, s.id desc
  loop
    begin
      update public.instructor_settlements
      set instructor_id = p_to_instructor
      where id = r.id;

      insert into public.instructor_payment_transfer_log (
        institution_id, class_id, settlement_id,
        from_instructor_id, to_instructor_id, amount,
        status, reason
      ) values (
        v_inst, p_class_id, r.id,
        r.instructor_id, p_to_instructor, r.amount,
        'transferred',
        case
          when v_rejected_pending > 0 then
            'Class reassigned; all class earnings moved (pending withdrawal cancelled).'
          else
            'Class reassigned; all class earnings moved to the new instructor.'
        end
      );
    exception when others then
      insert into public.instructor_payment_transfer_log (
        institution_id, class_id, settlement_id,
        from_instructor_id, to_instructor_id, amount,
        status, reason, error_message
      ) values (
        v_inst, p_class_id, r.id,
        r.instructor_id, p_to_instructor, r.amount,
        'failed',
        'Class reassigned; settlement move failed.',
        left(sqlerrm, 500)
      );
    end;
  end loop;
end;
$$;

revoke all on function public.transfer_class_instructor_settlements(uuid, uuid, uuid) from public;
grant execute on function public.transfer_class_instructor_settlements(uuid, uuid, uuid) to authenticated;

comment on function public.transfer_class_instructor_settlements(uuid, uuid, uuid) is
  'On class instructor change: move all class earnings to the new instructor, or clear them when unassigned so the previous instructor no longer sees them.';

-- Trigger: unassign clears; assign-after-unassign moves leftovers then backfills
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
      -- Unassign: strip earnings from previous instructor
      perform public.transfer_class_instructor_settlements(
        new.id,
        old.instructor_id,
        null
      );
    elsif old.instructor_id is null then
      -- Assign after unassign: move any leftover rows still on someone else,
      -- then create missing commission rows for completed payments.
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
    else
      -- Direct reassignment A → B
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

-- Heal current orphan: previous instructors still holding earnings for
-- classes they no longer teach (including unassigned classes).
do $$
declare
  r record;
begin
  for r in
    select
      c.id as class_id,
      s.instructor_id as from_instructor_id,
      c.instructor_id as to_instructor_id
    from public.classes c
    join public.instructor_settlements s on s.class_id = c.id
    where s.instructor_id is distinct from c.instructor_id
    group by c.id, s.instructor_id, c.instructor_id
  loop
    perform public.transfer_class_instructor_settlements(
      r.class_id,
      r.from_instructor_id,
      r.to_instructor_id
    );
  end loop;
end;
$$;
