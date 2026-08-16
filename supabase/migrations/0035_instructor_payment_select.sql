-- =====================================================================
--  0035_instructor_payment_select.sql
--  Instructors can read tuition payments for students in their classes
--  so commission history can show real student names (not Unknown).
-- =====================================================================

drop policy if exists "pay_select_instructor" on public.payments;
create policy "pay_select_instructor" on public.payments
for select
using (
  institution_id = public.current_institution_id()
  and exists (
    select 1
    from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.id = payments.enrollment_id
      and c.instructor_id = auth.uid()
      and c.institution_id = payments.institution_id
  )
);
