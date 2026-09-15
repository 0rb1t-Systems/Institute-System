-- Return all class enrollments (program/course) with Completed vs Ongoing status
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
  v_enrollments jsonb := '[]'::jsonb;
  v_academic_status text;
begin
  if length(v_raw) < 3 then
    return jsonb_build_object('valid', false);
  end if;

  if position('@' in v_raw) > 0 then
    return jsonb_build_object('valid', false);
  end if;
  if v_raw ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('valid', false);
  end if;

  select
    p.id as student_id,
    p.full_name,
    p.status,
    p.avatar_url,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    i.subdomain as institution_subdomain,
    coalesce(p.student_code, upper(split_part(p.email, '@', 1))) as student_code
  into v_row
  from profiles p
  join institutions i on i.id = p.institution_id
  where p.role = 'student'
    and p.status = 'approved'
    and (v_slug = '' or lower(i.subdomain) = v_slug)
    and (
      (p.student_code is not null and lower(p.student_code) = v_raw)
      or lower(split_part(p.email, '@', 1)) = v_raw
    )
  order by
    case when p.student_code is not null and lower(p.student_code) = v_raw then 0 else 1 end,
    p.created_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'class_name', x.class_name,
        'program_name', x.program_name,
        'program_type', x.program_type,
        'status', x.item_status,
        'courses', x.courses
      )
      order by x.enrolled_at desc nulls last, x.enrollment_id desc
    ),
    '[]'::jsonb
  )
  into v_enrollments
  from (
    select
      e.id as enrollment_id,
      e.enrolled_at,
      cl.name as class_name,
      cl.program_type::text as program_type,
      coalesce(
        case
          when cl.program_type = 'diploma' then d.name
          when cl.program_type = 'course' then c.name
          else null
        end,
        cl.name
      ) as program_name,
      case
        when exists (
          select 1
          from certificates cert
          where cert.student_id = v_row.student_id
            and cert.status = 'issued'
            and cert.class_id = cl.id
        ) then 'Completed'
        when cl.end_month is not null and cl.end_month::date < current_date then 'Completed'
        when cl.status = 'inactive' then 'Inactive'
        else 'Ongoing'
      end as item_status,
      case
        when cl.program_type = 'diploma' then coalesce((
          select jsonb_agg(co.name order by dc.sort_order nulls last, co.name)
          from diploma_courses dc
          join courses co on co.id = dc.course_id
          where dc.diploma_id = cl.diploma_id
        ), '[]'::jsonb)
        when cl.program_type = 'course' and c.name is not null then jsonb_build_array(c.name)
        else '[]'::jsonb
      end as courses
    from enrollments e
    join classes cl on cl.id = e.class_id
    left join courses c on c.id = cl.course_id
    left join diplomas d on d.id = cl.diploma_id
    where e.student_id = v_row.student_id
  ) x;

  if jsonb_array_length(v_enrollments) = 0 then
    v_academic_status := 'Verified';
  elsif exists (
    select 1
    from jsonb_array_elements(v_enrollments) en
    where en->>'status' = 'Ongoing'
  ) then
    v_academic_status := 'Ongoing';
  elsif exists (
    select 1
    from jsonb_array_elements(v_enrollments) en
    where en->>'status' = 'Completed'
  ) then
    v_academic_status := 'Completed';
  else
    v_academic_status := 'Inactive';
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
    'class_name', v_enrollments->0->>'class_name',
    'program_name', v_enrollments->0->>'program_name',
    'program_type', v_enrollments->0->>'program_type',
    'academic_status', v_academic_status,
    'enrollments', v_enrollments,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.verify_student_identity(text, text) from public;
grant execute on function public.verify_student_identity(text, text) to anon, authenticated, service_role;

comment on function public.verify_student_identity(text, text) is
  'Public student identity check. Returns all enrollments with Completed/Ongoing status. Code-only; optional tenant slug.';
