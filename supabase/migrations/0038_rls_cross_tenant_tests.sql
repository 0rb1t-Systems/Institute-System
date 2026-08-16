-- =====================================================================
--  0038_rls_cross_tenant_tests.sql
--  Automated cross-tenant RLS isolation suite (SECURITY INVOKER).
--
--  Run in SQL editor / MCP as postgres:
--    select public.run_rls_cross_tenant_tests();
--
--  Also: node scripts/run-rls-cross-tenant-tests.mjs (JWT client path)
-- =====================================================================

drop function if exists public._rls_role_probe();
drop function if exists public.run_rls_cross_tenant_tests();

create or replace function public.run_rls_cross_tenant_tests()
returns jsonb
language plpgsql
-- INVOKER (default): SET ROLE is allowed; DEFINER forbids it on Postgres.
set search_path = public, auth, extensions
as $$
declare
  v_inst_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_inst_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  v_admin_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_admin_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
  v_student_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
  v_student_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6';
  v_course_a uuid;
  v_course_b uuid;
  v_class_a uuid;
  v_class_b uuid;
  v_enr_a uuid;
  v_enr_b uuid;
  v_inq_a uuid;
  v_inq_b uuid;
  v_pay_a uuid;
  v_pay_b uuid;
  v_cnt int;
  v_ok boolean;
  v_results jsonb := '[]'::jsonb;
  v_failed int := 0;
  v_passed int := 0;
begin
  if current_user not in ('postgres', 'supabase_admin')
     and session_user not in ('postgres', 'supabase_admin')
  then
    raise exception 'FORBIDDEN: run as postgres/supabase_admin (SQL editor / MCP)';
  end if;

  delete from public.payments where institution_id in (v_inst_a, v_inst_b);
  delete from public.enrollments where institution_id in (v_inst_a, v_inst_b);
  delete from public.registration_inquiries where institution_id in (v_inst_a, v_inst_b);
  delete from public.classes where institution_id in (v_inst_a, v_inst_b);
  delete from public.courses where institution_id in (v_inst_a, v_inst_b);
  delete from public.profiles where institution_id in (v_inst_a, v_inst_b);
  delete from public.institutions where id in (v_inst_a, v_inst_b);
  delete from auth.users where id in (v_admin_a, v_admin_b, v_student_a, v_student_b);

  insert into public.institutions (id, name, subdomain, status) values
    (v_inst_a, 'RLS Test Tenant A', 'rls-test-a', 'active'),
    (v_inst_b, 'RLS Test Tenant B', 'rls-test-b', 'active');

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
  ) values
    ('00000000-0000-0000-0000-000000000000', v_admin_a, 'authenticated', 'authenticated',
     'rls-admin-a@example.invalid', crypt('rls-test-pw', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false, false),
    ('00000000-0000-0000-0000-000000000000', v_admin_b, 'authenticated', 'authenticated',
     'rls-admin-b@example.invalid', crypt('rls-test-pw', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false, false),
    ('00000000-0000-0000-0000-000000000000', v_student_a, 'authenticated', 'authenticated',
     'rls-student-a@example.invalid', crypt('rls-test-pw', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false, false),
    ('00000000-0000-0000-0000-000000000000', v_student_b, 'authenticated', 'authenticated',
     'rls-student-b@example.invalid', crypt('rls-test-pw', gen_salt('bf')),
     now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false, false);

  insert into public.profiles (id, institution_id, role, status, full_name, email) values
    (v_admin_a, v_inst_a, 'admin', 'approved', 'RLS Admin A', 'rls-admin-a@example.invalid'),
    (v_admin_b, v_inst_b, 'admin', 'approved', 'RLS Admin B', 'rls-admin-b@example.invalid'),
    (v_student_a, v_inst_a, 'student', 'approved', 'RLS Student A', 'rls-student-a@example.invalid'),
    (v_student_b, v_inst_b, 'student', 'approved', 'RLS Student B', 'rls-student-b@example.invalid');

  insert into public.courses (institution_id, name, code) values
    (v_inst_a, 'RLS Course A', 'RLS-A'),
    (v_inst_b, 'RLS Course B', 'RLS-B');
  select id into v_course_a from public.courses where institution_id = v_inst_a and code = 'RLS-A' limit 1;
  select id into v_course_b from public.courses where institution_id = v_inst_b and code = 'RLS-B' limit 1;

  insert into public.classes (institution_id, name, course_id, program_type, status, total_fee, duration) values
    (v_inst_a, 'RLS Class A', v_course_a, 'course', 'active', 100, '3'),
    (v_inst_b, 'RLS Class B', v_course_b, 'course', 'active', 200, '3');
  select id into v_class_a from public.classes where institution_id = v_inst_a and name = 'RLS Class A' limit 1;
  select id into v_class_b from public.classes where institution_id = v_inst_b and name = 'RLS Class B' limit 1;

  insert into public.enrollments (institution_id, student_id, class_id) values
    (v_inst_a, v_student_a, v_class_a),
    (v_inst_b, v_student_b, v_class_b);
  select id into v_enr_a from public.enrollments where institution_id = v_inst_a and student_id = v_student_a limit 1;
  select id into v_enr_b from public.enrollments where institution_id = v_inst_b and student_id = v_student_b limit 1;

  insert into public.registration_inquiries (institution_id, full_name, email, status, class_id) values
    (v_inst_a, 'Inquiry A', 'rls-inq-a@example.invalid', 'pending', v_class_a),
    (v_inst_b, 'Inquiry B', 'rls-inq-b@example.invalid', 'pending', v_class_b);
  select id into v_inq_a from public.registration_inquiries where institution_id = v_inst_a and email = 'rls-inq-a@example.invalid' limit 1;
  select id into v_inq_b from public.registration_inquiries where institution_id = v_inst_b and email = 'rls-inq-b@example.invalid' limit 1;

  insert into public.payments (institution_id, enrollment_id, amount, method, status) values
    (v_inst_a, v_enr_a, 50, 'cash', 'completed'),
    (v_inst_b, v_enr_b, 75, 'cash', 'completed');
  select id into v_pay_a from public.payments where institution_id = v_inst_a and enrollment_id = v_enr_a limit 1;
  select id into v_pay_b from public.payments where institution_id = v_inst_b and enrollment_id = v_enr_b limit 1;

  -- Admin A
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin_a::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_cnt from public.courses where id in (v_course_a, v_course_b);
  v_ok := (v_cnt = 1); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_a_cannot_see_tenant_b_courses','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  select count(*) into v_cnt from public.classes where id in (v_class_a, v_class_b);
  v_ok := (v_cnt = 1); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_a_cannot_see_tenant_b_classes','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  select count(*) into v_cnt from public.profiles where id in (v_admin_b, v_student_b);
  v_ok := (v_cnt = 0); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_a_cannot_see_tenant_b_profiles','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  select count(*) into v_cnt from public.registration_inquiries where id in (v_inq_a, v_inq_b);
  v_ok := (v_cnt = 1); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_a_cannot_see_tenant_b_inquiries','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  select count(*) into v_cnt from public.payments where id in (v_pay_a, v_pay_b);
  v_ok := (v_cnt = 1); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_a_cannot_see_tenant_b_payments','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  select count(*) into v_cnt from public.enrollments where id in (v_enr_a, v_enr_b);
  v_ok := (v_cnt = 1); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_a_cannot_see_tenant_b_enrollments','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  begin
    update public.registration_inquiries set status = 'rejected', rejection_reason = 'cross-tenant-probe' where id = v_inq_b;
    get diagnostics v_cnt = row_count;
  exception when others then v_cnt := 0;
  end;
  v_ok := (v_cnt = 0); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_a_cannot_update_tenant_b_inquiry','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  begin
    delete from public.payments where id = v_pay_b;
    get diagnostics v_cnt = row_count;
  exception when others then v_cnt := 0;
  end;
  v_ok := (v_cnt = 0); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_a_cannot_delete_tenant_b_payment','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  -- Student A
  perform set_config('request.jwt.claim.sub', v_student_a::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_student_a::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_cnt from public.payments where id = v_pay_b;
  v_ok := (v_cnt = 0); v_results := v_results || jsonb_build_array(jsonb_build_object('name','student_a_cannot_see_tenant_b_payments','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  select count(*) into v_cnt from public.registration_inquiries where id in (v_inq_a, v_inq_b);
  v_ok := (v_cnt = 0); v_results := v_results || jsonb_build_array(jsonb_build_object('name','student_a_cannot_see_registration_inquiries','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  -- Admin B
  perform set_config('request.jwt.claim.sub', v_admin_b::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin_b::text, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into v_cnt from public.courses where id in (v_course_a, v_course_b);
  v_ok := (v_cnt = 1) and exists (select 1 from public.courses where id = v_course_b);
  v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_b_sees_only_own_courses','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  select count(*) into v_cnt from public.registration_inquiries where id = v_inq_a;
  v_ok := (v_cnt = 0); v_results := v_results || jsonb_build_array(jsonb_build_object('name','admin_b_cannot_see_tenant_a_inquiry','pass',v_ok,'detail',v_cnt));
  if v_ok then v_passed := v_passed + 1; else v_failed := v_failed + 1; end if;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  delete from public.payments where institution_id in (v_inst_a, v_inst_b);
  delete from public.enrollments where institution_id in (v_inst_a, v_inst_b);
  delete from public.registration_inquiries where institution_id in (v_inst_a, v_inst_b);
  delete from public.classes where institution_id in (v_inst_a, v_inst_b);
  delete from public.courses where institution_id in (v_inst_a, v_inst_b);
  delete from public.profiles where institution_id in (v_inst_a, v_inst_b);
  delete from public.institutions where id in (v_inst_a, v_inst_b);
  delete from auth.users where id in (v_admin_a, v_admin_b, v_student_a, v_student_b);

  return jsonb_build_object('ok', v_failed = 0, 'passed', v_passed, 'failed', v_failed, 'total', v_passed + v_failed, 'tests', v_results);
exception when others then
  begin execute 'reset role'; exception when others then null; end;
  begin
    delete from public.payments where institution_id in (v_inst_a, v_inst_b);
    delete from public.enrollments where institution_id in (v_inst_a, v_inst_b);
    delete from public.registration_inquiries where institution_id in (v_inst_a, v_inst_b);
    delete from public.classes where institution_id in (v_inst_a, v_inst_b);
    delete from public.courses where institution_id in (v_inst_a, v_inst_b);
    delete from public.profiles where institution_id in (v_inst_a, v_inst_b);
    delete from public.institutions where id in (v_inst_a, v_inst_b);
    delete from auth.users where id in (v_admin_a, v_admin_b, v_student_a, v_student_b);
  exception when others then null;
  end;
  return jsonb_build_object('ok', false, 'error', SQLERRM, 'passed', v_passed, 'failed', v_failed, 'tests', v_results);
end;
$$;

revoke all on function public.run_rls_cross_tenant_tests() from public, anon, authenticated, service_role;
-- Executable only by postgres/supabase_admin via SQL editor (invoker privileges).
