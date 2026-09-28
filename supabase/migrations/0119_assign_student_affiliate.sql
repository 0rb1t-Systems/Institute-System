-- =====================================================================
--  0119_assign_student_affiliate.sql
--  Admin/staff can assign (or clear) a student's affiliate after registration.
--  Re-syncs affiliate settlements for that student's completed payments so
--  commission is calculated the same way as at registration time.
-- =====================================================================

create or replace function public.assign_student_affiliate(
  p_student_id uuid,
  p_affiliate_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.profiles;
  v_caller_inst uuid;
  v_pay public.payments;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;

  if not (public.is_admin_or_staff() or public.is_super_admin()) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_student
  from public.profiles
  where id = p_student_id
    and role = 'student'
  for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  if not public.is_super_admin() then
    v_caller_inst := public.current_institution_id();
    if v_caller_inst is null or v_caller_inst is distinct from v_student.institution_id then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  if p_affiliate_id is not null then
    if not exists (
      select 1
      from public.profiles a
      where a.id = p_affiliate_id
        and a.institution_id = v_student.institution_id
        and a.role = 'affiliate'
        and a.status = 'approved'
    ) then
      raise exception 'INVALID_AFFILIATE';
    end if;
  end if;

  update public.profiles
  set affiliate_id = p_affiliate_id
  where id = p_student_id
  returning * into v_student;

  -- Re-run settlement logic for every payment tied to this student
  -- (same path as payment insert/update triggers).
  for v_pay in
    select p.*
    from public.payments p
    join public.enrollments e on e.id = p.enrollment_id
    where e.student_id = p_student_id
      and p.institution_id = v_student.institution_id
  loop
    perform public.create_settlement_on_payment_from_row(v_pay);
  end loop;

  return v_student;
end;
$$;

revoke all on function public.assign_student_affiliate(uuid, uuid) from public, anon;
grant execute on function public.assign_student_affiliate(uuid, uuid) to authenticated, service_role;

comment on function public.assign_student_affiliate(uuid, uuid) is
  'Admin/staff: set or clear a student affiliate_id and resync affiliate settlements for existing payments.';
