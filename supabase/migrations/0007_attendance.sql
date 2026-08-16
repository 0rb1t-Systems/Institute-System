-- =====================================================================
--  0007_attendance.sql
--  Xaadirinta — 2 table: class_sessions + attendance
--  (RLS xeerarka waxaa lagu darayaa 0008)
-- =====================================================================

create type attendance_status as enum ('present', 'absent', 'late', 'excused');

-- ---------------------------------------------------------------------
-- class_sessions — maalin kasta oo fasalku dhaco (kalfadhi)
-- ---------------------------------------------------------------------
create table class_sessions (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  class_id       uuid not null references classes(id) on delete cascade,
  session_date   date not null,
  topic          text,
  created_at     timestamptz not null default now(),
  unique (class_id, session_date)   -- hal fasal + hal maalin = hal kalfadhi
);
create index idx_sessions_institution on class_sessions(institution_id);
create index idx_sessions_class on class_sessions(class_id);

-- ---------------------------------------------------------------------
-- attendance — arday kasta, kalfadhi kasta (present/absent/...)
-- ---------------------------------------------------------------------
create table attendance (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  session_id     uuid not null references class_sessions(id) on delete cascade,
  student_id     uuid not null references profiles(id) on delete cascade,
  status         attendance_status not null default 'present',
  marked_at      timestamptz not null default now(),
  unique (session_id, student_id)   -- arday hal mar la calaamadiyo kalfadhi kasta
);
create index idx_attendance_institution on attendance(institution_id);
create index idx_attendance_session on attendance(session_id);
create index idx_attendance_student on attendance(student_id);

-- Fur RLS (default-deny) — xeerarka waxaa lagu darayaa 0008
alter table class_sessions enable row level security;
alter table attendance     enable row level security;
