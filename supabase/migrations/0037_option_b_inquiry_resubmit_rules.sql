-- Option B rules:
-- - pending or approved inquiry / existing profile → cannot submit again
-- - rejected inquiry → may submit a new application (signup stays open)

create or replace function public.submit_registration_inquiry(
  p_subdomain text,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_university text default null,
  p_faculty text default null,
  p_year_of_study text default null,
  p_class_id uuid default null,
  p_affiliate_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst institutions%rowtype;
  v_aff profiles%rowtype;
  v_class classes%rowtype;
  v_id uuid;
  v_email text;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then
    raise exception 'INVALID_SUBDOMAIN';
  end if;
  if p_full_name is null or length(trim(p_full_name)) < 2 then
    raise exception 'INVALID_NAME';
  end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  select * into v_inst
  from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain))
    and coalesce(status, 'active') = 'active'
  limit 1;

  if not found then
    raise exception 'INSTITUTION_NOT_FOUND';
  end if;

  if p_class_id is not null then
    select * into v_class
    from public.classes
    where id = p_class_id
      and institution_id = v_inst.id
      and status = 'active'
    limit 1;
    if not found then
      raise exception 'INVALID_CLASS';
    end if;
  end if;

  if p_affiliate_id is not null then
    select * into v_aff
    from public.profiles
    where id = p_affiliate_id
      and institution_id = v_inst.id
      and role = 'affiliate'
      and status = 'approved'
    limit 1;
    if not found then
      raise exception 'INVALID_AFFILIATE';
    end if;
  end if;

  -- Already has a live student account → cannot register again
  if exists (
    select 1 from public.profiles
    where institution_id = v_inst.id
      and lower(email) = v_email
  ) then
    raise exception 'USER_ACCOUNT_EXISTS';
  end if;

  -- Pending application still under review
  if exists (
    select 1 from public.registration_inquiries
    where institution_id = v_inst.id
      and lower(email) = v_email
      and status = 'pending'
  ) then
    raise exception 'DUPLICATE_INQUIRY';
  end if;

  -- Already approved (account path) — reject silent re-apply even if profile edge-case missing
  if exists (
    select 1 from public.registration_inquiries
    where institution_id = v_inst.id
      and lower(email) = v_email
      and status = 'approved'
  ) then
    raise exception 'USER_ACCOUNT_EXISTS';
  end if;

  -- Rejected applications are intentionally allowed to re-apply (new pending row).

  insert into public.registration_inquiries (
    institution_id, full_name, email, phone, university, faculty,
    year_of_study, class_id, affiliate_id, notes
  ) values (
    v_inst.id,
    trim(p_full_name),
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_university, '')), ''),
    nullif(trim(coalesce(p_faculty, '')), ''),
    nullif(trim(coalesce(p_year_of_study, '')), ''),
    p_class_id,
    p_affiliate_id,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'status', 'pending',
    'institution_name', v_inst.name
  );
end;
$$;

revoke all on function public.submit_registration_inquiry(
  text, text, text, text, text, text, text, uuid, uuid, text
) from public;
grant execute on function public.submit_registration_inquiry(
  text, text, text, text, text, text, text, uuid, uuid, text
) to anon, authenticated;
