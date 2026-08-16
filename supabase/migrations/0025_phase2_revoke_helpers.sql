-- =====================================================================
--  0025_phase2_revoke_helpers.sql
--  Harden Phase 2 SECURITY DEFINER helpers (revoke PUBLIC/anon misuse)
-- =====================================================================

revoke all on function public.is_exam_instructor(uuid) from public, anon, authenticated;
revoke all on function public.is_assignment_instructor(uuid) from public, anon, authenticated;
revoke all on function public.is_enrolled_in_exam(uuid) from public, anon, authenticated;
revoke all on function public.is_enrolled_in_assignment(uuid) from public, anon, authenticated;
revoke all on function public.letter_from_mark(numeric) from public, anon, authenticated;
revoke all on function public.sync_gradebook_for_result(uuid) from public, anon, authenticated;
revoke all on function public.resync_gradebook_for_student_course(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_institution_from_class() from public, anon, authenticated;
revoke all on function public.set_institution_from_exam() from public, anon, authenticated;
revoke all on function public.set_institution_from_assignment() from public, anon, authenticated;
revoke all on function public.trg_sync_gradebook_on_result() from public, anon, authenticated;

grant execute on function public.is_exam_instructor(uuid) to authenticated, service_role;
grant execute on function public.is_assignment_instructor(uuid) to authenticated, service_role;
grant execute on function public.is_enrolled_in_exam(uuid) to authenticated, service_role;
grant execute on function public.is_enrolled_in_assignment(uuid) to authenticated, service_role;

revoke all on function public.finalize_gradebook(uuid) from public, anon;
grant execute on function public.finalize_gradebook(uuid) to authenticated, service_role;

revoke all on function public.verify_credential(text) from public;
grant execute on function public.verify_credential(text) to anon, authenticated, service_role;

grant execute on function public.sync_gradebook_for_result(uuid) to service_role;
grant execute on function public.resync_gradebook_for_student_course(uuid, uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.letter_from_mark(numeric) to service_role;
