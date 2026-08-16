-- Public student identity check (minimal fields; no broad anon SELECT on profiles)
create or replace function public.verify_student_identity(p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := lower(trim(coalesce(p_identifier, '')));
  v_row record;
begin
  if length(v_raw) < 3 then
    return jsonb_build_object('valid', false);
  end if;

  select
    p.full_name,
    p.status,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    upper(split_part(p.email, '@', 1)) as student_code,
    (
      select cl.name
      from enrollments e
      join classes cl on cl.id = e.class_id
      where e.student_id = p.id
      order by e.id desc
      limit 1
    ) as class_name
  into v_row
  from profiles p
  join institutions i on i.id = p.institution_id
  where p.role = 'student'
    and p.status = 'approved'
    and (
      lower(p.email) = v_raw
      or p.id::text = v_raw
      or lower(split_part(p.email, '@', 1)) = v_raw
    )
  limit 1;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  return jsonb_build_object(
    'valid', true,
    'student_name', v_row.full_name,
    'student_code', v_row.student_code,
    'institution_name', v_row.institution_name,
    'institution_logo_url', v_row.institution_logo_url,
    'class_name', v_row.class_name,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.verify_student_identity(text) from public;
grant execute on function public.verify_student_identity(text) to anon, authenticated, service_role;
