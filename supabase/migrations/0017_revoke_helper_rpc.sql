-- Phase 1 security hardening (Supabase advisor):
-- Prevent anonymous PostgREST RPC of SECURITY DEFINER helpers.
-- Keep EXECUTE for authenticated — RLS policies invoke these helpers.
-- Triggers (guard_profile_columns, settlements, withdrawals) still work as table-owner.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'current_institution_id',
        'current_user_role',
        'is_admin',
        'is_admin_or_staff',
        'is_class_instructor',
        'is_enrolled_in_class',
        'is_enrolled_in_session',
        'is_session_instructor',
        'is_my_student',
        'owns_enrollment',
        'instructor_available_balance',
        'guard_profile_columns',
        'check_withdrawal_balance',
        'create_settlement_on_payment'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
      r.proname,
      r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role, postgres',
      r.proname,
      r.args
    );
  END LOOP;
END $$;
