-- =====================================================================
--  0107_security_harden_definer_grants.sql
--  Harden SECURITY DEFINER surface (defense-in-depth grants + search_path).
--  Does NOT change function business logic except next_student_codes
--  auth/tenant guards (was callable by any authenticated user).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Admin/staff mutators: authenticated + service_role only (not anon)
--    Internal auth checks already exist; revoke anon for PostgREST surface.
-- ---------------------------------------------------------------------
revoke all on function public.reorder_diploma_courses(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_diploma_courses(uuid, uuid[]) to authenticated, service_role;

revoke all on function public.set_landing_template(text, uuid) from public, anon;
grant execute on function public.set_landing_template(text, uuid) to authenticated, service_role;

revoke all on function public.set_registration_form_programs(boolean, jsonb, uuid) from public, anon;
grant execute on function public.set_registration_form_programs(boolean, jsonb, uuid) to authenticated, service_role;

revoke all on function public.rotate_rating_public_token(uuid) from public, anon;
grant execute on function public.rotate_rating_public_token(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) RLS helpers: authenticated + service_role (policies need EXECUTE)
-- ---------------------------------------------------------------------
revoke all on function public.is_my_class_instructor(uuid) from public, anon;
grant execute on function public.is_my_class_instructor(uuid) to authenticated, service_role;

revoke all on function public.is_enrolled_in_rating_evaluation(uuid) from public, anon;
grant execute on function public.is_enrolled_in_rating_evaluation(uuid) to authenticated, service_role;

-- Internal helper used by public RPCs — not a public PostgREST endpoint
revoke all on function public.class_matches_registration_programs(public.classes, jsonb)
  from public, anon, authenticated;
grant execute on function public.class_matches_registration_programs(public.classes, jsonb)
  to service_role;

-- ---------------------------------------------------------------------
-- 3) Trigger-only SECURITY DEFINER: never callable via PostgREST
--    Triggers still run as owner; EXECUTE revoke does not break them.
-- ---------------------------------------------------------------------
revoke all on function public.enforce_registration_fee_before_other_payments()
  from public, anon, authenticated;
grant execute on function public.enforce_registration_fee_before_other_payments() to service_role;

revoke all on function public.sync_course_primary_diploma()
  from public, anon, authenticated;
grant execute on function public.sync_course_primary_diploma() to service_role;

revoke all on function public.trg_profiles_assign_student_code()
  from public, anon, authenticated;
grant execute on function public.trg_profiles_assign_student_code() to service_role;

revoke all on function public.set_institution_from_rating_evaluation()
  from public, anon, authenticated;
grant execute on function public.set_institution_from_rating_evaluation() to service_role;

-- ---------------------------------------------------------------------
-- 4) next_student_codes: require admin/staff of same tenant (or super_admin
--    / service_role with no JWT). Trigger path still works: admin/staff
--    insert student, or service_role provisioning (auth.uid() is null).
-- ---------------------------------------------------------------------
create or replace function public.next_student_codes(p_institution_id uuid, p_count integer)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid := p_institution_id;
  v_name text;
  v_prefix text;
  v_start integer;
  v_pad integer;
  v_last integer;
  v_n integer;
  v_label text;
  v_out text[] := '{}';
  v_i integer;
  v_guard integer;
  v_caller_inst uuid;
begin
  if v_inst is null then
    raise exception 'FORBIDDEN';
  end if;
  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'INVALID_STUDENT_ID_COUNT';
  end if;

  -- AuthZ: service_role / definer chains without JWT; else admin/staff same tenant
  if auth.uid() is not null then
    if public.is_super_admin() then
      null;
    elsif public.is_admin_or_staff() then
      v_caller_inst := public.current_institution_id();
      if v_caller_inst is null or v_caller_inst is distinct from v_inst then
        raise exception 'FORBIDDEN';
      end if;
    else
      raise exception 'FORBIDDEN';
    end if;
  end if;

  select name, student_id_prefix, student_id_start, student_id_pad, student_id_last
    into v_name, v_prefix, v_start, v_pad, v_last
  from public.institutions
  where id = v_inst
  for update;

  if not found then
    raise exception 'FORBIDDEN';
  end if;

  if v_prefix is null then
    v_prefix := public.institution_name_initials(v_name);
    v_start := coalesce(v_start, 123);
    v_pad := coalesce(v_pad, 3);
  end if;

  v_start := coalesce(v_start, 0);
  v_pad := greatest(coalesce(v_pad, 1), 1);
  v_last := coalesce(v_last, -1);
  v_n := greatest(v_last, v_start - 1);

  for v_i in 1..p_count loop
    v_guard := 0;
    loop
      v_n := v_n + 1;
      v_guard := v_guard + 1;
      if v_n > 999999999 or v_guard > 2000 then
        raise exception 'STUDENT_ID_EXHAUSTED';
      end if;
      v_label := public.format_student_code(v_prefix, v_n, v_pad);
      exit when not public.student_code_is_taken(v_inst, v_label);
    end loop;
    v_out := array_append(v_out, v_label);
  end loop;

  update public.institutions
  set student_id_last = v_n
  where id = v_inst;

  return v_out;
end;
$$;

revoke all on function public.next_student_codes(uuid, integer) from public, anon;
grant execute on function public.next_student_codes(uuid, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5) Fix mutable search_path on helper functions (advisor WARN)
-- ---------------------------------------------------------------------
alter function public.letter_from_mark(numeric) set search_path = public;
alter function public.sanitize_plain_text(text, integer) set search_path = public;
alter function public.institutions_sanitize_landing_content() set search_path = public;
alter function public.institution_name_initials(text) set search_path = public;
alter function public.format_certificate_serial(integer, integer) set search_path = public;
alter function public.sanitize_landing_program_image_url(text) set search_path = public;
alter function public.sanitize_landing_program_icon(text) set search_path = public;
alter function public.sanitize_landing_content(jsonb) set search_path = public;
alter function public.format_student_code(text, integer, integer) set search_path = public;
alter function public.student_code_prefix(text) set search_path = public;
alter function public.student_code_serial(text) set search_path = public;
