-- Document: enrollment_balances is a SQL mirror; app SSOT is frontend finance.ts
comment on view public.enrollment_balances is
  'SQL mirror aligned with frontend computeStudentBalance (finance.ts). App UI SSOT is computeStudentBalance — do not treat this view as a second app data source.';
