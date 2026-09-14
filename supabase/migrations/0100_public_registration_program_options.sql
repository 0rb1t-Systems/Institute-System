-- Preferred Program options for public Online Registration / Affiliate forms.
-- When Manage Programs restriction is on, students see checked courses/diplomas.
-- Also stores preferred_course_id / preferred_diploma_id on registration_inquiries.

alter table public.registration_inquiries
  add column if not exists preferred_course_id uuid references public.courses(id) on delete set null,
  add column if not exists preferred_diploma_id uuid references public.diplomas(id) on delete set null;

alter table public.registration_inquiries
  drop constraint if exists registration_inquiries_preferred_program_chk;

alter table public.registration_inquiries
  add constraint registration_inquiries_preferred_program_chk
  check (
    preferred_course_id is null
    or preferred_diploma_id is null
  );

-- Ensure a single get_public_classes signature (avoids PostgREST ambiguity).
drop function if exists public.get_public_classes(text);

create or replace function public.get_public_classes(
  p_subdomain text,
  p_affiliate_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst_id uuid;
  v_rows jsonb;
  v_month date := date_trunc('month', current_date)::date;
  v_restriction jsonb;
  v_restricted boolean;
  v_programs jsonb;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then
    return '[]'::jsonb;
  end if;

  select id into v_inst_id
  from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain))
    and coalesce(status, 'active') = 'active'
  limit 1;

  if v_inst_id is null then
    return '[]'::jsonb;
  end if;

  v_restriction := public.registration_program_restriction(v_inst_id, p_affiliate_id);
  v_restricted := coalesce((v_restriction->>'restricted')::boolean, false);
  v_programs := coalesce(v_restriction->'programs', '[]'::jsonb);

  if v_restricted then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'program_type', c.program_type,
      'total_fee', c.total_fee,
      'start_month', c.start_month,
      'end_month', c.end_month
    ) order by c.name), '[]'::jsonb)
    into v_rows
    from public.classes c
    where c.institution_id = v_inst_id
      and c.status = 'active'
      and (
        c.end_month is null
        or date_trunc('month', c.end_month)::date >= v_month
      )
      and public.class_matches_registration_programs(c, v_programs);
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'program_type', c.program_type,
      'total_fee', c.total_fee,
      'start_month', c.start_month,
      'end_month', c.end_month
    ) order by c.name), '[]'::jsonb)
    into v_rows
    from public.classes c
    where c.institution_id = v_inst_id
      and c.status = 'active'
      and (
        c.end_month is null
        or date_trunc('month', c.end_month)::date >= v_month
      );
  end if;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.get_public_classes(text, uuid) from public;
grant execute on function public.get_public_classes(text, uuid) to anon, authenticated, service_role;

create or replace function public.get_public_registration_options(
  p_subdomain text,
  p_affiliate_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst_id uuid;
  v_month date := date_trunc('month', current_date)::date;
  v_restriction jsonb;
  v_restricted boolean;
  v_programs jsonb;
  v_rows jsonb;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then
    return '[]'::jsonb;
  end if;

  select id into v_inst_id
  from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain))
    and coalesce(status, 'active') = 'active'
  limit 1;

  if v_inst_id is null then
    return '[]'::jsonb;
  end if;

  v_restriction := public.registration_program_restriction(v_inst_id, p_affiliate_id);
  v_restricted := coalesce((v_restriction->>'restricted')::boolean, false);
  v_programs := coalesce(v_restriction->'programs', '[]'::jsonb);

  if v_restricted then
    select coalesce(jsonb_agg(item order by item->>'name'), '[]'::jsonb)
    into v_rows
    from (
      select jsonb_build_object(
        'id', 'course:' || co.id::text,
        'name', co.name,
        'program_type', 'course',
        'program_id', co.id,
        'code', co.code,
        'class_id', (
          select c.id from public.classes c
          where c.institution_id = v_inst_id and c.status = 'active'
            and c.program_type = 'course' and c.course_id = co.id
            and (c.end_month is null or date_trunc('month', c.end_month)::date >= v_month)
          order by c.start_month desc nulls last, c.name limit 1
        ),
        'start_month', (
          select c.start_month from public.classes c
          where c.institution_id = v_inst_id and c.status = 'active'
            and c.program_type = 'course' and c.course_id = co.id
            and (c.end_month is null or date_trunc('month', c.end_month)::date >= v_month)
          order by c.start_month desc nulls last, c.name limit 1
        ),
        'end_month', (
          select c.end_month from public.classes c
          where c.institution_id = v_inst_id and c.status = 'active'
            and c.program_type = 'course' and c.course_id = co.id
            and (c.end_month is null or date_trunc('month', c.end_month)::date >= v_month)
          order by c.start_month desc nulls last, c.name limit 1
        )
      ) as item
      from public.courses co
      where co.institution_id = v_inst_id
        and exists (
          select 1 from jsonb_array_elements(v_programs) p
          where p->>'program_type' = 'course' and (p->>'program_id')::uuid = co.id
        )

      union all

      select jsonb_build_object(
        'id', 'diploma:' || d.id::text,
        'name', d.name,
        'program_type', 'diploma',
        'program_id', d.id,
        'code', null,
        'class_id', (
          select c.id from public.classes c
          where c.institution_id = v_inst_id and c.status = 'active'
            and c.program_type = 'diploma' and c.diploma_id = d.id
            and (c.end_month is null or date_trunc('month', c.end_month)::date >= v_month)
          order by c.start_month desc nulls last, c.name limit 1
        ),
        'start_month', (
          select c.start_month from public.classes c
          where c.institution_id = v_inst_id and c.status = 'active'
            and c.program_type = 'diploma' and c.diploma_id = d.id
            and (c.end_month is null or date_trunc('month', c.end_month)::date >= v_month)
          order by c.start_month desc nulls last, c.name limit 1
        ),
        'end_month', (
          select c.end_month from public.classes c
          where c.institution_id = v_inst_id and c.status = 'active'
            and c.program_type = 'diploma' and c.diploma_id = d.id
            and (c.end_month is null or date_trunc('month', c.end_month)::date >= v_month)
          order by c.start_month desc nulls last, c.name limit 1
        )
      ) as item
      from public.diplomas d
      where d.institution_id = v_inst_id
        and exists (
          select 1 from jsonb_array_elements(v_programs) p
          where p->>'program_type' = 'diploma' and (p->>'program_id')::uuid = d.id
        )
    ) opts;

    return coalesce(v_rows, '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id::text,
    'name', c.name,
    'program_type', c.program_type,
    'program_id', coalesce(c.course_id, c.diploma_id),
    'code', null,
    'class_id', c.id,
    'start_month', c.start_month,
    'end_month', c.end_month
  ) order by c.name), '[]'::jsonb)
  into v_rows
  from public.classes c
  where c.institution_id = v_inst_id
    and c.status = 'active'
    and (
      c.end_month is null
      or date_trunc('month', c.end_month)::date >= v_month
    );

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.get_public_registration_options(text, uuid) from public;
grant execute on function public.get_public_registration_options(text, uuid) to anon, authenticated, service_role;
