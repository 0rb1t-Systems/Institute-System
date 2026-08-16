-- =====================================================================
--  0023_rls_phase2_academic.sql
--  Phase 2 RLS + verify_credential RPC (PRD Permission Matrix)
-- =====================================================================

-- Helper: exam belongs to instructor's class
create or replace function public.is_exam_instructor(p_exam uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.exams e
    where e.id = p_exam and public.is_class_instructor(e.class_id)
  )
$$;

create or replace function public.is_assignment_instructor(p_assignment uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.assignments a
    where a.id = p_assignment and public.is_class_instructor(a.class_id)
  )
$$;

create or replace function public.is_enrolled_in_exam(p_exam uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.exams e
    where e.id = p_exam and public.is_enrolled_in_class(e.class_id)
  )
$$;

create or replace function public.is_enrolled_in_assignment(p_assignment uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.assignments a
    where a.id = p_assignment and public.is_enrolled_in_class(a.class_id)
  )
$$;

-- =====================================================================
-- class_courses
-- =====================================================================
create policy "cc_select" on class_courses for select
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff()
        or public.is_class_instructor(class_id)
        or public.is_enrolled_in_class(class_id) )
);

create policy "cc_insert" on class_courses for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

create policy "cc_update" on class_courses for update
using  ( institution_id = public.current_institution_id() and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

create policy "cc_delete" on class_courses for delete
using ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

-- =====================================================================
-- exams
-- Students: schedule only (active); no questions
-- =====================================================================
create policy "exam_select" on exams for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_class_instructor(class_id)
    or ( public.is_enrolled_in_class(class_id) and is_active = true )
  )
);

create policy "exam_insert" on exams for insert
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
);

create policy "exam_update" on exams for update
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
)
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
);

create policy "exam_delete" on exams for delete
using ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

-- =====================================================================
-- exam_questions — students DENIED (PRD: Exams — for students)
-- =====================================================================
create policy "eq_select" on exam_questions for select
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_exam_instructor(exam_id) )
);

create policy "eq_insert" on exam_questions for insert
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_exam_instructor(exam_id) )
);

create policy "eq_update" on exam_questions for update
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_exam_instructor(exam_id) )
)
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_exam_instructor(exam_id) )
);

create policy "eq_delete" on exam_questions for delete
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_exam_instructor(exam_id) )
);

-- =====================================================================
-- exam_results — Own student SELECT; write staff/instructor Own-class
-- =====================================================================
create policy "er_select" on exam_results for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_exam_instructor(exam_id)
    or student_id = auth.uid()
  )
);

create policy "er_insert" on exam_results for insert
with check (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_exam_instructor(exam_id)
    or ( student_id = auth.uid() and public.is_enrolled_in_exam(exam_id) )
  )
);

create policy "er_update" on exam_results for update
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_exam_instructor(exam_id) )
)
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_exam_instructor(exam_id) )
);

create policy "er_delete" on exam_results for delete
using ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

-- =====================================================================
-- assignments
-- =====================================================================
create policy "asg_select" on assignments for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_class_instructor(class_id)
    or public.is_enrolled_in_class(class_id)
  )
);

create policy "asg_insert" on assignments for insert
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
);

create policy "asg_update" on assignments for update
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
)
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
);

create policy "asg_delete" on assignments for delete
using ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

-- =====================================================================
-- assignment_submissions
-- Student: Own insert/update content; grade updates = staff/instructor
-- =====================================================================
create policy "asub_select" on assignment_submissions for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_assignment_instructor(assignment_id)
    or student_id = auth.uid()
  )
);

create policy "asub_insert" on assignment_submissions for insert
with check (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_assignment_instructor(assignment_id)
    or ( student_id = auth.uid() and public.is_enrolled_in_assignment(assignment_id) )
  )
);

create policy "asub_update" on assignment_submissions for update
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_assignment_instructor(assignment_id)
    or student_id = auth.uid()
  )
)
with check (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_assignment_instructor(assignment_id)
    or student_id = auth.uid()
  )
);

create policy "asub_delete" on assignment_submissions for delete
using ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

-- =====================================================================
-- gradebook_entries
-- =====================================================================
create policy "gb_select" on gradebook_entries for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or public.is_class_instructor(class_id)
    or student_id = auth.uid()
  )
);

create policy "gb_insert" on gradebook_entries for insert
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
);

create policy "gb_update" on gradebook_entries for update
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
)
with check (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or public.is_class_instructor(class_id) )
);

create policy "gb_delete" on gradebook_entries for delete
using ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

-- =====================================================================
-- transcripts / transcript_entries
-- =====================================================================
create policy "tr_select" on transcripts for select
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or student_id = auth.uid() )
);

create policy "tr_insert" on transcripts for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

create policy "tr_update" on transcripts for update
using  ( institution_id = public.current_institution_id() and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

create policy "tr_delete" on transcripts for delete
using ( institution_id = public.current_institution_id() and public.is_admin() );

create policy "te_select" on transcript_entries for select
using (
  institution_id = public.current_institution_id()
  and (
    public.is_admin_or_staff()
    or exists (
      select 1 from public.transcripts t
      where t.id = transcript_id and t.student_id = auth.uid()
    )
  )
);

create policy "te_insert" on transcript_entries for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

create policy "te_update" on transcript_entries for update
using  ( institution_id = public.current_institution_id() and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

create policy "te_delete" on transcript_entries for delete
using ( institution_id = public.current_institution_id() and public.is_admin() );

-- =====================================================================
-- certificates
-- =====================================================================
create policy "cert_select" on certificates for select
using (
  institution_id = public.current_institution_id()
  and ( public.is_admin_or_staff() or student_id = auth.uid() )
);

create policy "cert_insert" on certificates for insert
with check (
  institution_id = public.current_institution_id()
  and public.is_admin_or_staff()
);

create policy "cert_update" on certificates for update
using  ( institution_id = public.current_institution_id() and public.is_admin_or_staff() )
with check ( institution_id = public.current_institution_id() and public.is_admin_or_staff() );

create policy "cert_delete" on certificates for delete
using ( institution_id = public.current_institution_id() and public.is_admin() );

-- =====================================================================
-- Public credential verification (no broad anon SELECT)
-- =====================================================================
create or replace function public.verify_credential(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert record;
  v_tr record;
  v_student text;
  v_inst_name text;
  v_class_name text;
  v_entries jsonb;
begin
  if p_code is null or length(trim(p_code)) < 8 then
    return null;
  end if;

  select c.*, i.name as institution_name, p.full_name as student_name, cl.name as class_name
    into v_cert
  from public.certificates c
  join public.institutions i on i.id = c.institution_id
  join public.profiles p on p.id = c.student_id
  left join public.classes cl on cl.id = c.class_id
  where c.verification_code = trim(p_code) and c.status = 'issued'
  limit 1;

  if found then
    return jsonb_build_object(
      'type', 'certificate',
      'valid', true,
      'certificate_number', v_cert.certificate_number,
      'student_name', v_cert.student_name,
      'institution_name', v_cert.institution_name,
      'class_name', v_cert.class_name,
      'issued_at', v_cert.issued_at,
      'verification_code', v_cert.verification_code
    );
  end if;

  select t.*, i.name as institution_name, p.full_name as student_name, cl.name as class_name
    into v_tr
  from public.transcripts t
  join public.institutions i on i.id = t.institution_id
  join public.profiles p on p.id = t.student_id
  left join public.classes cl on cl.id = t.class_id
  where t.verification_code = trim(p_code) and t.status = 'issued'
  limit 1;

  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'course_id', te.course_id,
      'course_name', co.name,
      'mark', te.mark,
      'grade', te.grade
    ) order by co.name), '[]'::jsonb)
    into v_entries
    from public.transcript_entries te
    join public.courses co on co.id = te.course_id
    where te.transcript_id = v_tr.id;

    return jsonb_build_object(
      'type', 'transcript',
      'valid', true,
      'student_name', v_tr.student_name,
      'institution_name', v_tr.institution_name,
      'class_name', v_tr.class_name,
      'issued_at', v_tr.issued_at,
      'verification_code', v_tr.verification_code,
      'entries', v_entries
    );
  end if;

  return jsonb_build_object('valid', false);
end;
$$;

revoke all on function public.verify_credential(text) from public;
grant execute on function public.verify_credential(text) to anon, authenticated, service_role;

revoke all on function public.finalize_gradebook(uuid) from public;
grant execute on function public.finalize_gradebook(uuid) to authenticated, service_role;

revoke all on function public.is_exam_instructor(uuid) from public;
revoke all on function public.is_assignment_instructor(uuid) from public;
revoke all on function public.is_enrolled_in_exam(uuid) from public;
revoke all on function public.is_enrolled_in_assignment(uuid) from public;
revoke all on function public.letter_from_mark(numeric) from public;
revoke all on function public.sync_gradebook_for_result(uuid) from public;

grant execute on function public.is_exam_instructor(uuid) to authenticated, service_role;
grant execute on function public.is_assignment_instructor(uuid) to authenticated, service_role;
grant execute on function public.is_enrolled_in_exam(uuid) to authenticated, service_role;
grant execute on function public.is_enrolled_in_assignment(uuid) to authenticated, service_role;
grant execute on function public.letter_from_mark(numeric) to authenticated, service_role;
grant execute on function public.sync_gradebook_for_result(uuid) to service_role;
