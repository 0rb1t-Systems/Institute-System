-- Public instructor / staff ID-card verification (INST-XXXXXX / STF-XXXXXX)
create or replace function public.verify_staff_identity(
  p_identifier text,
  p_subdomain text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := upper(trim(coalesce(p_identifier, '')));
  v_slug text := lower(trim(coalesce(p_subdomain, '')));
  v_prefix text;
  v_suffix text;
  v_roles public.user_role[];
  v_row record;
  v_assignments jsonb := '[]'::jsonb;
  v_valid_until date;
  v_employee_code text;
begin
  if length(v_raw) < 8 then
    return jsonb_build_object('valid', false);
  end if;

  if position('@' in v_raw) > 0 then
    return jsonb_build_object('valid', false);
  end if;

  if v_raw ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$' then
    return jsonb_build_object('valid', false);
  end if;

  if v_raw !~ '^(INST|STF|EMP)-[0-9A-F]{6,12}$' then
    return jsonb_build_object('valid', false);
  end if;

  v_prefix := split_part(v_raw, '-', 1);
  v_suffix := split_part(v_raw, '-', 2);

  v_roles := case
    when v_prefix = 'INST' then array['instructor'::public.user_role]
    when v_prefix = 'STF' then array['staff'::public.user_role, 'admin'::public.user_role]
    else array[
      'instructor'::public.user_role,
      'staff'::public.user_role,
      'admin'::public.user_role
    ]
  end;

  select
    p.id as profile_id,
    p.full_name,
    p.role::text as role,
    p.status,
    p.avatar_url,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    i.subdomain as institution_subdomain
  into v_row
  from public.profiles p
  join public.institutions i on i.id = p.institution_id
  where p.role = any (v_roles)
    and p.status = 'approved'
    and (v_slug = '' or lower(i.subdomain) = v_slug)
    and upper(left(p.id::text, length(v_suffix))) = v_suffix
  order by p.created_at desc nulls last
  limit 1;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  v_employee_code := v_prefix || '-' || upper(left(v_row.profile_id::text, 6));

  if v_row.role = 'instructor' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'class_name', x.class_name,
          'program_name', x.program_name,
          'program_type', x.program_type,
          'status', x.item_status
        )
        order by x.end_month desc nulls last, x.class_name
      ),
      '[]'::jsonb
    )
    into v_assignments
    from (
      select
        cl.name as class_name,
        cl.end_month,
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
          when cl.end_month is not null and cl.end_month::date < current_date then 'Completed'
          when cl.status = 'inactive' then 'Inactive'
          else 'Active'
        end as item_status
      from public.classes cl
      left join public.courses c on c.id = cl.course_id
      left join public.diplomas d on d.id = cl.diploma_id
      where cl.instructor_id = v_row.profile_id
    ) x;

    select max(cl.end_month)::date
    into v_valid_until
    from public.classes cl
    where cl.instructor_id = v_row.profile_id;
  end if;

  return jsonb_build_object(
    'valid', true,
    'kind', 'staff',
    'role', v_row.role,
    'employee_code', v_employee_code,
    'full_name', v_row.full_name,
    'avatar_url', v_row.avatar_url,
    'department', case
      when v_row.role = 'instructor' then 'Faculty Member'
      when v_row.role = 'admin' then 'Administration'
      else 'Administration'
    end,
    'institution_name', v_row.institution_name,
    'institution_logo_url', v_row.institution_logo_url,
    'institution_subdomain', v_row.institution_subdomain,
    'theme_primary', v_row.theme_primary,
    'theme_accent', v_row.theme_accent,
    'assignments', v_assignments,
    'valid_until', v_valid_until,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.verify_staff_identity(text, text) from public;
grant execute on function public.verify_staff_identity(text, text) to anon, authenticated, service_role;

comment on function public.verify_staff_identity(text, text) is
  'Public instructor/staff ID check for INST-/STF- employee codes. Optional tenant slug.';
