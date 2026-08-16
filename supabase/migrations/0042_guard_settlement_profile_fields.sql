-- =====================================================================
--  0042_guard_settlement_profile_fields.sql
--  Admin-only settlement_model / fixed_fee_amount on profiles.
--  Preserves super_admin rules from 0019.
-- =====================================================================

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
  ) and not (public.is_admin() or public.is_super_admin()) then
    raise exception 'Kaliya admin ayaa beddeli kara instructor settlement settings';
  end if;

  return new;
end;
$$;
