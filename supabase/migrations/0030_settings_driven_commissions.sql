-- =====================================================================
--  0030_settings_driven_commissions.sql
--  Institution-level default instructor commission; no hard-coded 40%.
--  Registration fee stays configurable (0 allowed = disabled).
--  Affiliates can read only students attributed to them (own referrals).
-- =====================================================================

alter table institutions
  add column if not exists default_instructor_commission_rate numeric(5,4) not null default 0.4000
    check (default_instructor_commission_rate >= 0 and default_instructor_commission_rate <= 1);

-- Classes still store their own commission_rate (per-class override).
-- Neutral DB default so inserts that omit the column do not invent 40%;
-- the app always sends the institution default on create.
alter table classes
  alter column commission_rate set default 0;

comment on column institutions.default_instructor_commission_rate is
  'Default instructor commission rate (0-1) applied when creating new classes; editable in Institution Settings.';

comment on column institutions.affiliate_commission_rate is
  'Affiliate commission rate (0-1) applied to referred tuition payments; editable in Institution Settings.';

comment on column institutions.registration_fee_amount is
  'Registration fee amount (currency units). 0 disables the fee; editable in Institution Settings.';

-- Affiliates may select students referred to them.
drop policy if exists "prof_select_own_referrals" on profiles;
create policy "prof_select_own_referrals" on profiles for select
using (
  institution_id = public.current_institution_id()
  and affiliate_id = auth.uid()
  and role = 'student'
);

-- Affiliates may read enrollments for their referred students.
drop policy if exists "enr_select_affiliate" on enrollments;
create policy "enr_select_affiliate" on enrollments for select
using (
  institution_id = public.current_institution_id()
  and exists (
    select 1 from public.profiles p
    where p.id = enrollments.student_id
      and p.affiliate_id = auth.uid()
      and p.institution_id = enrollments.institution_id
      and p.role = 'student'
  )
);

-- Affiliates may read payments for their referred students.
drop policy if exists "pay_select_affiliate" on payments;
create policy "pay_select_affiliate" on payments for select
using (
  institution_id = public.current_institution_id()
  and exists (
    select 1
    from public.enrollments e
    join public.profiles p on p.id = e.student_id
    where e.id = payments.enrollment_id
      and p.affiliate_id = auth.uid()
      and p.institution_id = payments.institution_id
      and p.role = 'student'
  )
);
