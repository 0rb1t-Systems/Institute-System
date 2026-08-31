-- Allow first-login passwords that match short student IDs (3+ chars).
-- Called only with the service role from create-user / approve-registration.

create or replace function public.set_auth_password_exact(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = auth, extensions, public
as $$
begin
  if p_user_id is null or length(trim(coalesce(p_password, ''))) < 3 then
    raise exception 'STUDENT_ID_TOO_SHORT';
  end if;
  update auth.users
  set
    encrypted_password = crypt(trim(p_password), gen_salt('bf')),
    updated_at = now()
  where id = p_user_id;
  if not found then
    raise exception 'STUDENT_PASSWORD_FAILED';
  end if;
end;
$$;

revoke all on function public.set_auth_password_exact(uuid, text) from public, anon, authenticated;
grant execute on function public.set_auth_password_exact(uuid, text) to service_role;
