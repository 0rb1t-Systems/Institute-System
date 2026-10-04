-- Prevent authenticated clients from writing custom-domain columns.
-- Only service_role (manage-custom-domain edge function) may change them.

create or replace function public.institutions_guard_custom_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and auth.role() is distinct from 'service_role' then
    new.custom_domain := old.custom_domain;
    new.custom_domain_www := old.custom_domain_www;
    new.custom_domain_status := old.custom_domain_status;
    new.custom_domain_verification_token := old.custom_domain_verification_token;
    new.custom_domain_verified_at := old.custom_domain_verified_at;
    new.custom_domain_error := old.custom_domain_error;
    new.custom_domain_last_check_at := old.custom_domain_last_check_at;
  end if;

  if tg_op = 'INSERT' and auth.role() is distinct from 'service_role' then
    new.custom_domain := null;
    new.custom_domain_www := true;
    new.custom_domain_status := 'none';
    new.custom_domain_verification_token := null;
    new.custom_domain_verified_at := null;
    new.custom_domain_error := null;
    new.custom_domain_last_check_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_institutions_guard_custom_domain on public.institutions;
create trigger trg_institutions_guard_custom_domain
  before insert or update on public.institutions
  for each row
  execute function public.institutions_guard_custom_domain();

revoke all on function public.institutions_guard_custom_domain() from public;
