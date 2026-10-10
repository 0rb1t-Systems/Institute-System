-- =====================================================================
--  0138_full_class_earnings_reassign.sql
--  On class reassignment, move ALL settlements for that class to the new
--  instructor. Previous instructor keeps none of that class's earnings.
--  Pending withdrawals are cancelled so they cannot block the move.
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

  -- Unassigning: keep historical earnings with the previous instructor
  if p_to_instructor is null then
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
      or (p_from_instructor is null and instructor_id is distinct from p_to_instructor)
    );

  if v_class_total <= 0 then
    return;
  end if;

  -- Cancel unpaid withdrawal requests so they cannot keep/block class earnings
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
          '[Auto-rejected: class reassigned; all class earnings moved to the new instructor.]'
        ))
      where w.instructor_id = p_from_instructor
        and w.status::text = 'pending'
      returning w.id
    )
    select count(*)::int into v_rejected_pending from doomed;
  end if;

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
  'On class reassignment: move ALL settlements for that class to the new instructor and cancel pending withdrawals for the previous instructor.';

-- Heal any settlements still attributed to a previous instructor
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
    where c.instructor_id is not null
      and s.instructor_id is distinct from c.instructor_id
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
