-- =====================================================================
--  0028_phase3_branding_affiliate_verify.sql
--  Phase 3: institution document branding, affiliate settlements,
--  public registration inquiries, hardened credential verification.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Institution branding + affiliate rate + registration fee
-- ---------------------------------------------------------------------
alter table institutions
  add column if not exists affiliate_commission_rate numeric(5,4) not null default 0
    check (affiliate_commission_rate >= 0 and affiliate_commission_rate <= 1),
  add column if not exists registration_fee_amount numeric(12,2) not null default 5.00
    check (registration_fee_amount >= 0),
  add column if not exists signatory_left_title text not null default 'Academic Registrar',
  add column if not exists signatory_right_title text not null default 'Principal',
  add column if not exists signatory_left_name text,
  add column if not exists signatory_right_name text,
  add column if not exists seal_url text;

-- ---------------------------------------------------------------------
-- Affiliate settlements (commission when institution rate > 0)
-- ---------------------------------------------------------------------
create table if not exists affiliate_settlements (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references institutions(id) on delete cascade,
  affiliate_id    uuid not null references profiles(id) on delete restrict,
  payment_id      uuid not null references payments(id) on delete cascade,
  student_id      uuid not null references profiles(id) on delete restrict,
  class_id        uuid references classes(id) on delete set null,
  rate            numeric(5,4) not null check (rate >= 0 and rate <= 1),
  amount          numeric(12,2) not null check (amount >= 0),
  created_at      timestamptz not null default now(),
  unique (payment_id)
);

create index if not exists idx_aff_settlements_institution
  on affiliate_settlements(institution_id);
create index if not exists idx_aff_settlements_affiliate
  on affiliate_settlements(affiliate_id);
create index if not exists idx_aff_settlements_created
  on affiliate_settlements(institution_id, created_at);

alter table affiliate_settlements enable row level security;

drop policy if exists "aff_settle_select" on affiliate_settlements;
create policy "aff_settle_select" on affiliate_settlements for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or affiliate_id = auth.uid()
  )
);

-- No direct client inserts/updates/deletes — trigger + service_role only
drop policy if exists "aff_settle_insert" on affiliate_settlements;
drop policy if exists "aff_settle_update" on affiliate_settlements;
drop policy if exists "aff_settle_delete" on affiliate_settlements;

-- ---------------------------------------------------------------------
-- Extend payment trigger: instructor settlement + affiliate settlement
-- ---------------------------------------------------------------------
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

  -- Affiliate commission (tenant-configured rate; attribution via profiles.affiliate_id)
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
         and a.role in ('admin', 'staff', 'instructor')
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

-- ---------------------------------------------------------------------
-- Public registration inquiries (tenant-scoped inbox)
-- ---------------------------------------------------------------------
create table if not exists registration_inquiries (
  id               uuid primary key default gen_random_uuid(),
  institution_id   uuid not null references institutions(id) on delete cascade,
  full_name        text not null,
  email            text not null,
  phone            text,
  university       text,
  faculty          text,
  year_of_study    text,
  class_id         uuid references classes(id) on delete set null,
  affiliate_id     uuid references profiles(id) on delete set null,
  notes            text,
  status           text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_reg_inq_institution
  on registration_inquiries(institution_id, created_at desc);
create index if not exists idx_reg_inq_email
  on registration_inquiries(institution_id, lower(email));

alter table registration_inquiries enable row level security;

drop policy if exists "reg_inq_select" on registration_inquiries;
create policy "reg_inq_select" on registration_inquiries for select
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

drop policy if exists "reg_inq_update" on registration_inquiries;
create policy "reg_inq_update" on registration_inquiries for update
using (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
)
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

drop policy if exists "reg_inq_delete" on registration_inquiries;
create policy "reg_inq_delete" on registration_inquiries for delete
using (
  institution_id = public.current_institution_id()
  and public.is_admin()
);

-- Public submit via security-definer RPC (no broad anon INSERT)
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
      and role in ('admin', 'staff', 'instructor')
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

revoke all on function public.submit_registration_inquiry(
  text, text, text, text, text, text, text, uuid, uuid, text
) from public;
grant execute on function public.submit_registration_inquiry(
  text, text, text, text, text, text, text, uuid, uuid, text
) to anon, authenticated, service_role;

-- Public class list for registration (minimal fields, active tenants only)
create or replace function public.get_public_classes(p_subdomain text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst_id uuid;
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
    and c.status = 'active';

  return v_rows;
end;
$$;

revoke all on function public.get_public_classes(text) from public;
grant execute on function public.get_public_classes(text) to anon, authenticated, service_role;

-- Public institution branding by subdomain (no secrets)
create or replace function public.get_public_institution(p_subdomain text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row institutions%rowtype;
begin
  if p_subdomain is null or length(trim(p_subdomain)) < 1 then
    return null;
  end if;

  select * into v_row
  from public.institutions
  where lower(subdomain) = lower(trim(p_subdomain))
    and coalesce(status, 'active') = 'active'
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'subdomain', v_row.subdomain,
    'logo_url', v_row.logo_url,
    'description', v_row.description,
    'email', v_row.email,
    'phone', v_row.phone,
    'address', v_row.address,
    'theme_primary', v_row.theme_primary,
    'theme_accent', v_row.theme_accent
  );
end;
$$;

revoke all on function public.get_public_institution(text) from public;
grant execute on function public.get_public_institution(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Hardened public credential verification (privacy: no grades / emails)
-- ---------------------------------------------------------------------
create or replace function public.verify_credential(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert record;
  v_tr record;
begin
  if p_code is null or length(trim(p_code)) < 8 then
    return jsonb_build_object('valid', false);
  end if;

  select
    c.certificate_number,
    c.verification_code,
    c.issued_at,
    c.status,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    p.full_name as student_name,
    cl.name as class_name
  into v_cert
  from public.certificates c
  join public.institutions i on i.id = c.institution_id
  join public.profiles p on p.id = c.student_id
  left join public.classes cl on cl.id = c.class_id
  where c.verification_code = trim(p_code)
    and c.status = 'issued'
  limit 1;

  if found then
    return jsonb_build_object(
      'type', 'certificate',
      'valid', true,
      'certificate_number', v_cert.certificate_number,
      'student_name', v_cert.student_name,
      'institution_name', v_cert.institution_name,
      'institution_logo_url', v_cert.institution_logo_url,
      'theme_primary', v_cert.theme_primary,
      'theme_accent', v_cert.theme_accent,
      'class_name', v_cert.class_name,
      'title', v_cert.class_name,
      'issued_at', v_cert.issued_at,
      'date', v_cert.issued_at,
      'verification_code', v_cert.verification_code
    );
  end if;

  select
    t.verification_code,
    t.issued_at,
    t.status,
    i.name as institution_name,
    i.logo_url as institution_logo_url,
    i.theme_primary,
    i.theme_accent,
    p.full_name as student_name,
    cl.name as class_name
  into v_tr
  from public.transcripts t
  join public.institutions i on i.id = t.institution_id
  join public.profiles p on p.id = t.student_id
  left join public.classes cl on cl.id = t.class_id
  where t.verification_code = trim(p_code)
    and t.status = 'issued'
  limit 1;

  if found then
    -- Privacy: do NOT expose grade entries to anonymous callers
    return jsonb_build_object(
      'type', 'transcript',
      'valid', true,
      'student_name', v_tr.student_name,
      'institution_name', v_tr.institution_name,
      'institution_logo_url', v_tr.institution_logo_url,
      'theme_primary', v_tr.theme_primary,
      'theme_accent', v_tr.theme_accent,
      'class_name', v_tr.class_name,
      'title', v_tr.class_name,
      'issued_at', v_tr.issued_at,
      'date', v_tr.issued_at,
      'verification_code', v_tr.verification_code
    );
  end if;

  return jsonb_build_object('valid', false);
end;
$$;

revoke all on function public.verify_credential(text) from public;
grant execute on function public.verify_credential(text) to anon, authenticated, service_role;
