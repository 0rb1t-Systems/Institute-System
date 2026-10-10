-- =====================================================================
--  0137_fix_instructor_reassign_transfer.sql
--  When a class is reassigned, unpaid earnings must move to the new
--  instructor. Pending withdrawal requests must not block the transfer
--  (they were never paid). Only approved/paid withdrawals keep a
--  matching settlement amount with the previous instructor.
--  Note: 0138 later changes this to move ALL class earnings.
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
  v_accrued numeric(12,2) := 0;
  v_paid numeric(12,2) := 0;
  v_pending numeric(12,2) := 0;
  v_other numeric(12,2) := 0;
  v_must_keep numeric(12,2) := 0;
  v_transfer_budget numeric(12,2) := 0;
  v_transferred numeric(12,2) := 0;
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

  if p_from_instructor is not null then
    -- Pending requests are unpaid — cancel them so they cannot block reassignment
    -- and cannot be approved after the earnings leave this instructor.
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
          '[Auto-rejected: class reassigned; unpaid request cancelled so earnings can move to the new instructor.]'
        ))
      where w.instructor_id = p_from_instructor
        and w.status::text = 'pending'
      returning w.id
    )
    select count(*)::int into v_rejected_pending from doomed;

    select
      coalesce((
        select sum(s.amount)
        from public.instructor_settlements s
        where s.instructor_id = p_from_instructor
      ), 0),
      coalesce((
        select sum(w.amount)
        from public.withdrawals w
        where w.instructor_id = p_from_instructor
          and w.status::text in ('approved', 'paid')
      ), 0),
      coalesce((
        select sum(w.amount)
        from public.withdrawals w
        where w.instructor_id = p_from_instructor
          and w.status::text = 'pending'
      ), 0)
    into v_accrued, v_paid, v_pending;

    v_other := greatest(0, v_accrued - v_class_total);
    -- Settlements that must remain to cover money already paid out
    v_must_keep := greatest(0, v_paid - v_other);
    v_transfer_budget := greatest(0, v_class_total - v_must_keep);

    if v_transfer_budget <= 0 then
      insert into public.instructor_payment_transfer_log (
        institution_id, class_id, settlement_id,
        from_instructor_id, to_instructor_id, amount,
        status, reason
      )
      select
        v_inst, p_class_id, s.id,
        s.instructor_id, p_to_instructor, s.amount,
        'skipped',
        'Previous instructor was already paid for these earnings; settlement left in place.'
      from public.instructor_settlements s
      where s.class_id = p_class_id
        and s.instructor_id = p_from_instructor;
      return;
    end if;
  else
    v_transfer_budget := v_class_total;
  end if;

  v_transferred := 0;

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
    -- Keep enough on the old instructor to cover approved/paid withdrawals
    if p_from_instructor is not null
       and (v_transferred + r.amount) > v_transfer_budget + 0.0001 then
      insert into public.instructor_payment_transfer_log (
        institution_id, class_id, settlement_id,
        from_instructor_id, to_instructor_id, amount,
        status, reason
      ) values (
        v_inst, p_class_id, r.id,
        r.instructor_id, p_to_instructor, r.amount,
        'skipped',
        'Kept with previous instructor to cover already-paid withdrawals.'
      );
      continue;
    end if;

    begin
      update public.instructor_settlements
      set instructor_id = p_to_instructor
      where id = r.id;

      v_transferred := v_transferred + r.amount;

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
            'Class instructor changed; unpaid earnings reassigned (pending withdrawal cancelled).'
          else
            'Class instructor changed; commission share reassigned.'
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
        'Class instructor changed; settlement reassignment failed.',
        left(sqlerrm, 500)
      );
    end;
  end loop;
end;
$$;

revoke all on function public.transfer_class_instructor_settlements(uuid, uuid, uuid) from public;
grant execute on function public.transfer_class_instructor_settlements(uuid, uuid, uuid) to authenticated;

comment on function public.transfer_class_instructor_settlements(uuid, uuid, uuid) is
  'On class reassignment: cancel pending withdrawals for the previous instructor, move unpaid settlements to the new instructor, and keep only what is needed to cover approved/paid withdrawals.';
