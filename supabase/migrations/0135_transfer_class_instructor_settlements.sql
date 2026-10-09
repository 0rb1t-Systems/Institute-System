-- =====================================================================
--  0135_transfer_class_instructor_settlements.sql
--  When a class instructor changes, move commission settlements to the
--  new instructor (unless the previous instructor already withdrew more
--  than their remaining balance would allow). Log every attempt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Audit log (matches Classes → Transfer History UI)
-- ---------------------------------------------------------------------
create table if not exists public.instructor_payment_transfer_log (
  id                  uuid primary key default gen_random_uuid(),
  institution_id      uuid not null references public.institutions(id) on delete cascade,
  class_id            uuid not null references public.classes(id) on delete cascade,
  settlement_id       uuid references public.instructor_settlements(id) on delete set null,
  from_instructor_id  uuid references public.profiles(id) on delete set null,
  to_instructor_id    uuid references public.profiles(id) on delete set null,
  amount              numeric(12,2) not null default 0,
  status              text not null check (status in ('transferred', 'skipped', 'failed')),
  reason              text,
  error_message       text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_iptl_class on public.instructor_payment_transfer_log(class_id);
create index if not exists idx_iptl_institution on public.instructor_payment_transfer_log(institution_id);

alter table public.instructor_payment_transfer_log enable row level security;

drop policy if exists iptl_select on public.instructor_payment_transfer_log;
create policy iptl_select on public.instructor_payment_transfer_log
  for select to authenticated
  using (
    institution_id = public.current_institution_id()
    and (
      public.is_admin()
      or public.is_admin_or_staff()
      or from_instructor_id = (select auth.uid())
      or to_instructor_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- 2) Transfer helper
-- ---------------------------------------------------------------------
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
  v_total numeric(12,2) := 0;
  v_available numeric(12,2) := 0;
  r record;
begin
  if p_class_id is null then
    return;
  end if;

  -- Nothing to move when instructor did not change (including both null)
  if p_from_instructor is not distinct from p_to_instructor then
    return;
  end if;

  -- Unassigning instructor: keep historical earnings with the previous instructor
  if p_to_instructor is null then
    return;
  end if;

  select institution_id into v_inst
  from public.classes
  where id = p_class_id;

  if v_inst is null then
    return;
  end if;

  -- Rows still attributed to the previous instructor for this class
  select coalesce(sum(amount), 0) into v_total
  from public.instructor_settlements
  where class_id = p_class_id
    and (
      (p_from_instructor is not null and instructor_id = p_from_instructor)
      or (p_from_instructor is null and instructor_id is distinct from p_to_instructor)
    );

  if v_total <= 0 then
    return;
  end if;

  if p_from_instructor is not null then
    v_available := public.instructor_available_balance(p_from_instructor);
    if v_available < v_total then
      insert into public.instructor_payment_transfer_log (
        institution_id, class_id, settlement_id,
        from_instructor_id, to_instructor_id, amount,
        status, reason
      )
      select
        v_inst, p_class_id, s.id,
        s.instructor_id, p_to_instructor, s.amount,
        'skipped',
        'Previous instructor already withdrew earnings; settlement left in place.'
      from public.instructor_settlements s
      where s.class_id = p_class_id
        and s.instructor_id = p_from_instructor;
      return;
    end if;
  end if;

  for r in
    select s.id, s.instructor_id, s.amount
    from public.instructor_settlements s
    where s.class_id = p_class_id
      and (
        (p_from_instructor is not null and s.instructor_id = p_from_instructor)
        or (p_from_instructor is null and s.instructor_id is distinct from p_to_instructor)
      )
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
        'Class instructor changed; commission share reassigned.'
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

-- ---------------------------------------------------------------------
-- 3) Trigger: run on instructor_id change (before/with fixed-fee sync)
-- ---------------------------------------------------------------------
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
    perform public.transfer_class_instructor_settlements(
      new.id,
      old.instructor_id,
      new.instructor_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_classes_transfer_instructor_settlements on public.classes;
create trigger trg_classes_transfer_instructor_settlements
after update of instructor_id on public.classes
for each row
execute function public.trg_classes_transfer_instructor_settlements();

-- ---------------------------------------------------------------------
-- 4) One-time heal: settlements that still point at a previous instructor
--    while the class already has a different current instructor.
-- ---------------------------------------------------------------------
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
