-- =============================================================================
-- 0122_rls_auth_uid_initplan_perf.sql
-- Performance-only: wrap auth.uid() in (select auth.uid()) so Postgres evaluates
-- it once per query (InitPlan) instead of once per row.
-- Behavior / permissions are unchanged — no data migration.
-- =============================================================================

-- profiles
drop policy if exists prof_select_own on public.profiles;
create policy prof_select_own on public.profiles
  for select to public
  using (id = (select auth.uid()));

drop policy if exists prof_update_own on public.profiles;
create policy prof_update_own on public.profiles
  for update to public
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists prof_select_own_referrals on public.profiles;
create policy prof_select_own_referrals on public.profiles
  for select to public
  using (
    institution_id = current_institution_id()
    and affiliate_id = (select auth.uid())
    and role = 'student'::user_role
  );

-- classes
drop policy if exists cls_select_instructor on public.classes;
create policy cls_select_instructor on public.classes
  for select to public
  using (
    institution_id = current_institution_id()
    and instructor_id = (select auth.uid())
  );

-- enrollments
drop policy if exists enr_select_student on public.enrollments;
create policy enr_select_student on public.enrollments
  for select to public
  using (
    institution_id = current_institution_id()
    and student_id = (select auth.uid())
  );

drop policy if exists enr_select_affiliate on public.enrollments;
create policy enr_select_affiliate on public.enrollments
  for select to public
  using (
    institution_id = current_institution_id()
    and exists (
      select 1
      from profiles p
      where p.id = enrollments.student_id
        and p.affiliate_id = (select auth.uid())
        and p.institution_id = enrollments.institution_id
        and p.role = 'student'::user_role
    )
  );

-- instructor_settlements
drop policy if exists settle_select on public.instructor_settlements;
create policy settle_select on public.instructor_settlements
  for select to public
  using (
    institution_id = current_institution_id()
    and (is_admin() or instructor_id = (select auth.uid()))
  );

-- affiliate_settlements
drop policy if exists aff_settle_select on public.affiliate_settlements;
create policy aff_settle_select on public.affiliate_settlements
  for select to public
  using (
    institution_id = current_institution_id()
    and (is_admin_or_staff() or affiliate_id = (select auth.uid()))
  );

-- payments
drop policy if exists pay_select_affiliate on public.payments;
create policy pay_select_affiliate on public.payments
  for select to public
  using (
    institution_id = current_institution_id()
    and exists (
      select 1
      from enrollments e
      join profiles p on p.id = e.student_id
      where e.id = payments.enrollment_id
        and p.affiliate_id = (select auth.uid())
        and p.institution_id = payments.institution_id
        and p.role = 'student'::user_role
    )
  );

drop policy if exists pay_select_instructor on public.payments;
create policy pay_select_instructor on public.payments
  for select to public
  using (
    institution_id = current_institution_id()
    and exists (
      select 1
      from enrollments e
      join classes c on c.id = e.class_id
      where e.id = payments.enrollment_id
        and c.instructor_id = (select auth.uid())
        and c.institution_id = payments.institution_id
    )
  );

-- exam_results
drop policy if exists er_select on public.exam_results;
create policy er_select on public.exam_results
  for select to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or is_exam_instructor(exam_id)
      or (
        student_id = (select auth.uid())
        and current_student_registration_fee_ok()
      )
    )
  );

-- gradebook_entries
drop policy if exists gb_select on public.gradebook_entries;
create policy gb_select on public.gradebook_entries
  for select to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or is_class_instructor(class_id)
      or (
        student_id = (select auth.uid())
        and current_student_registration_fee_ok()
      )
    )
  );

-- transcripts
drop policy if exists tr_select on public.transcripts;
create policy tr_select on public.transcripts
  for select to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or (
        student_id = (select auth.uid())
        and current_student_registration_fee_ok()
      )
    )
  );

-- transcript_entries
drop policy if exists te_select on public.transcript_entries;
create policy te_select on public.transcript_entries
  for select to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or exists (
        select 1
        from transcripts t
        where t.id = transcript_entries.transcript_id
          and t.student_id = (select auth.uid())
          and current_student_registration_fee_ok()
      )
    )
  );

-- certificates
drop policy if exists cert_select on public.certificates;
create policy cert_select on public.certificates
  for select to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or (
        student_id = (select auth.uid())
        and current_student_registration_fee_ok()
      )
    )
  );

-- attendance
drop policy if exists att_select on public.attendance;
create policy att_select on public.attendance
  for select to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or is_session_instructor(session_id)
      or (
        student_id = (select auth.uid())
        and current_student_registration_fee_ok()
      )
    )
  );

-- assignment_submissions
drop policy if exists asub_insert on public.assignment_submissions;
create policy asub_insert on public.assignment_submissions
  for insert to public
  with check (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or is_assignment_instructor(assignment_id)
      or (
        student_id = (select auth.uid())
        and is_enrolled_in_assignment(assignment_id)
      )
    )
  );

drop policy if exists asub_select on public.assignment_submissions;
create policy asub_select on public.assignment_submissions
  for select to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or is_assignment_instructor(assignment_id)
      or (
        student_id = (select auth.uid())
        and current_student_registration_fee_ok()
      )
    )
  );

drop policy if exists asub_update on public.assignment_submissions;
create policy asub_update on public.assignment_submissions
  for update to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or is_assignment_instructor(assignment_id)
      or (
        student_id = (select auth.uid())
        and current_student_registration_fee_ok()
      )
    )
  )
  with check (
    institution_id = current_institution_id()
    and (
      is_admin_or_staff()
      or is_assignment_instructor(assignment_id)
      or (
        student_id = (select auth.uid())
        and current_student_registration_fee_ok()
      )
    )
  );

-- withdrawals
drop policy if exists wd_select on public.withdrawals;
create policy wd_select on public.withdrawals
  for select to public
  using (
    institution_id = current_institution_id()
    and (
      is_admin()
      or instructor_id = (select auth.uid())
      or affiliate_id = (select auth.uid())
    )
  );

drop policy if exists wd_insert on public.withdrawals;
create policy wd_insert on public.withdrawals
  for insert to public
  with check (
    institution_id = current_institution_id()
    and (
      is_admin()
      or (
        instructor_id = (select auth.uid())
        and affiliate_id is null
        and current_user_role() = 'instructor'::user_role
      )
      or (
        affiliate_id = (select auth.uid())
        and instructor_id is null
        and current_user_role() = 'affiliate'::user_role
      )
    )
  );

-- rating_responses
drop policy if exists rr_select on public.rating_responses;
create policy rr_select on public.rating_responses
  for select to public
  using (
    institution_id = current_institution_id()
    and (is_admin_or_staff() or student_id = (select auth.uid()))
  );

drop policy if exists rr_insert on public.rating_responses;
create policy rr_insert on public.rating_responses
  for insert to public
  with check (
    institution_id = current_institution_id()
    and student_id = (select auth.uid())
    and is_enrolled_in_rating_evaluation(evaluation_id)
  );

drop policy if exists rr_update on public.rating_responses;
create policy rr_update on public.rating_responses
  for update to public
  using (
    institution_id = current_institution_id()
    and student_id = (select auth.uid())
  )
  with check (
    institution_id = current_institution_id()
    and student_id = (select auth.uid())
  );
