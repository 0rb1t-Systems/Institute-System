-- =====================================================================
--  0012_profile_guard.sql
--  Ilaalinta columns (role/institution_id/status) + self-service ammaan
--
--  Khatarta: RLS ma xakameyn karo columns gaar ah. Isticmaaluhu wuxuu
--  is-bedeli karaa role='admin'. Trigger ayaa taas ka hortagaya.
-- =====================================================================

create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- institution_id: CIDNA ma beddeli karo (profile tenant kama guuri karo)
  if new.institution_id is distinct from old.institution_id then
    raise exception 'institution_id lama beddeli karo';
  end if;

  -- role: kaliya ADMIN
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Kaliya admin ayaa beddeli kara role';
  end if;

  -- status (approval): admin AMA staff
  if new.status is distinct from old.status and not public.is_admin_or_staff() then
    raise exception 'Kaliya admin/staff ayaa beddeli kara status';
  end if;

  return new;
end;
$$;

create trigger trg_guard_profile
before update on profiles
for each row
execute function public.guard_profile_columns();


-- Hadda oo ammaan la sameeyay, fur self-service:
-- isticmaaluhu wuxuu beddeli karaa profile-KIISA (magac/telefoon),
-- laakiin trigger-ku wuu joojinayaa role/institution_id/status.
create policy "prof_update_own" on profiles for update
using      ( id = auth.uid() )
with check ( id = auth.uid() );
