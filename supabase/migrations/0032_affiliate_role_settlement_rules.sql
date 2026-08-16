-- =====================================================================
--  0032_affiliate_role_settlement_rules.sql
--  Only users with role = 'affiliate' earn / can be attributed.
-- =====================================================================

create or replace function public.create_settlement_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id      uuid;
  v_instructor_id uuid;
  v_rate          numeric;
  v_student_id    uuid;
  v_affiliate_id  uuid;
  v_aff_rate      numeric;
begin
  if coalesce(new.is_registration_fee, false) = true then
    return new;
  end if;
  if coalesce(new.status, 'completed') <> 'completed' then
    return new;
  end if;

  select c.id, c.instructor_id, coalesce(c.commission_rate, 0), e.student_id
    into v_class_id, v_instructor_id, v_rate, v_student_id
  from public.enrollments e
  join public.classes c on c.id = e.class_id
  where e.id = new.enrollment_id;

  if v_instructor_id is not null and v_rate > 0 then
    insert into public.instructor_settlements
      (institution_id, instructor_id, payment_id, class_id, rate, amount)
    values
      (new.institution_id, v_instructor_id, new.id, v_class_id, v_rate,
       round(new.amount * v_rate, 2))
    on conflict (payment_id) do update
      set rate = excluded.rate,
          amount = excluded.amount,
          instructor_id = excluded.instructor_id,
          class_id = excluded.class_id;
  end if;

  select p.affiliate_id, coalesce(i.affiliate_commission_rate, 0)
    into v_affiliate_id, v_aff_rate
  from public.profiles p
  join public.institutions i on i.id = p.institution_id
  where p.id = v_student_id
    and p.institution_id = new.institution_id;

  if v_affiliate_id is not null
     and v_aff_rate > 0
     and exists (
       select 1 from public.profiles a
       where a.id = v_affiliate_id
         and a.institution_id = new.institution_id
         and a.role = 'affiliate'
         and a.status = 'approved'
     )
  then
    insert into public.affiliate_settlements
      (institution_id, affiliate_id, payment_id, student_id, class_id, rate, amount)
    values
      (new.institution_id, v_affiliate_id, new.id, v_student_id, v_class_id, v_aff_rate,
       round(new.amount * v_aff_rate, 2))
    on conflict (payment_id) do update
      set rate = excluded.rate,
          amount = excluded.amount,
          affiliate_id = excluded.affiliate_id,
          student_id = excluded.student_id,
          class_id = excluded.class_id;
  end if;

  return new;
end;
$$;

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

  if exists (
    select 1 from public.profiles
    where institution_id = v_inst.id
      and lower(email) = v_email
  ) then
    raise exception 'USER_ACCOUNT_EXISTS';
  end if;

  if exists (
    select 1 from public.registration_inquiries
    where institution_id = v_inst.id
      and lower(email) = v_email
      and status = 'pending'
  ) then
    raise exception 'DUPLICATE_INQUIRY';
  end if;

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
