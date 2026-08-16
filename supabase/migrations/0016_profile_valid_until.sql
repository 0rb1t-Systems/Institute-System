-- =====================================================================
--  0016 — profiles.valid_until for ID card expiry (staff/instructor renew)
--  Additive only; nullable; does not change RLS or tenant isolation.
-- =====================================================================

alter table profiles
  add column if not exists valid_until date;

comment on column profiles.valid_until is
  'Optional ID card validity end date. Students usually derive expiry from class end_month.';
