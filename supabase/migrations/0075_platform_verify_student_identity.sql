-- Public student identity lookup: student code only (not email/UUID).
-- Empty p_subdomain searches every institution (platform landing Verify Identity).

create or replace function public.verify_student_identity(
  p_identifier text,
  p_subdomain text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := lower(trim(coalesce(p_identifier, '')));
  v_slug text := lower(trim(coalesce(p_subdomain, '')));
  v_row record;
  v_academic_status text;
begin
  if length(v_raw) < 3 then
    return jsonb_build_object('valid', false);
  end if;

  -- Reject emails and UUIDs on the public path.
  if position('@' in v_raw) > 0 then
    return jsonb_build_object('valid', false);
  end if;
  if v_raw ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('valid', false);
  end if;

  select
    p.full_name,
    p.status,
    p.avatar_url,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    i.subdomain as institution_subdomain,
    upper(split_part(p.email, '@', 1)) as student_code,
    cl.name as class_name,
    cl.status as class_status,
    cl.end_month as class_end_month,
    cl.program_type,
    coalesce(
      case
        when cl.program_type = 'diploma' then d.name
        when cl.program_type = 'course' then c.name
        else null
      end,
      cl.name
    ) as program_name,
    exists (
      select 1
      from certificates cert
      where cert.student_id = p.id
        and cert.status = 'issued'
        and (cl.id is null or cert.class_id = cl.id)
    ) as has_issued_certificate
  into v_row
  from profiles p
  join institutions i on i.id = p.institution_id
  left join lateral (
    select e.class_id
    from enrollments e
    where e.student_id = p.id
    order by e.enrolled_at desc nulls last, e.id desc
    limit 1
  ) latest_enr on true
  left join classes cl on cl.id = latest_enr.class_id
  left join courses c on c.id = cl.course_id
  left join diplomas d on d.id = cl.diploma_id
  where p.role = 'student'
    and p.status = 'approved'
    and (v_slug = '' or lower(i.subdomain) = v_slug)
    and lower(split_part(p.email, '@', 1)) = v_raw
  order by p.created_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  if v_row.has_issued_certificate then
    v_academic_status := 'Completed';
  elsif v_row.class_end_month is not null and v_row.class_end_month::date < current_date then
    v_academic_status := 'Completed';
  elsif v_row.class_status = 'inactive' then
    v_academic_status := 'Inactive';
  elsif v_row.class_name is not null then
    v_academic_status := 'Enrolled';
  else
    v_academic_status := 'Verified';
  end if;

  return jsonb_build_object(
    'valid', true,
    'student_name', v_row.full_name,
    'student_code', v_row.student_code,
    'avatar_url', v_row.avatar_url,
    'institution_name', v_row.institution_name,
    'institution_logo_url', v_row.institution_logo_url,
    'institution_subdomain', v_row.institution_subdomain,
    'theme_primary', v_row.theme_primary,
    'theme_accent', v_row.theme_accent,
    'class_name', v_row.class_name,
    'program_name', v_row.program_name,
    'program_type', v_row.program_type,
    'academic_status', v_academic_status,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.verify_student_identity(text, text) from public;
grant execute on function public.verify_student_identity(text, text) to anon, authenticated, service_role;

comment on function public.verify_student_identity(text, text) is
  'Public Official Academic Record lookup by student ID. Empty p_subdomain searches all institutions.';
