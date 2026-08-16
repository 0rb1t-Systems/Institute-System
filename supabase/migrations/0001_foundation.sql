-- =====================================================================
--  0001_foundation.sql
--  Training Center Platform — Naqshadaynta aasaasiga (Lakab 1 iyo 2)
--
--  Amarka: Institutions -> Profiles -> Courses -> Diplomas
--          -> Classes -> Enrollments
--  (RLS xeerarka waxaan ku daraynaa file kale — 0002_rls.sql)
-- =====================================================================


-- =====================================================================
--  ENUMS — Noocyo xaddidan oo qiyam la oggol yahay
--  (halkii aan text furan isticmaali lahayn, waxaan xaddidnaa qiyamka)
-- =====================================================================

create type user_role     as enum ('admin', 'staff', 'instructor', 'student');
create type profile_status as enum ('pending', 'approved', 'suspended');
create type course_type    as enum ('regular', 'e-learning');
create type program_type   as enum ('course', 'diploma');
create type class_status    as enum ('active', 'inactive');


-- =====================================================================
--  LAKAB 1 — TENANCY + IDENTITY
-- =====================================================================

-- ---------------------------------------------------------------------
-- institutions — Tenant kasta (xaruntaada tababar). ROOT-ka nidaamka.
-- Kani KELIYA ayaan lahayn 'institution_id' column — waa lafteeda tenant-ka.
-- ---------------------------------------------------------------------
create table institutions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subdomain   text not null unique,          -- tusaale: 'horizon' -> horizon.app.com
  logo_url    text,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- profiles — Isticmaalayaasha oo dhan (admin/staff/instructor/student)
-- Wuxuu ku xiran yahay Supabase `auth.users` (id isku mid).
-- QAANUUN 1: wuxuu leeyahay institution_id (tenant-kiisa).
-- ---------------------------------------------------------------------
create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  role           user_role not null,
  status         profile_status not null default 'pending',  -- approval workflow
  full_name      text not null,
  email          text not null,
  phone          text,
  created_at     timestamptz not null default now()
);

-- Index: query-yada badan waxay ku salaysnaan doonaan institution_id
create index idx_profiles_institution on profiles(institution_id);


-- =====================================================================
--  LAKAB 2 — ACADEMICS
--  Amarka: courses -> diplomas -> classes -> enrollments
-- =====================================================================

-- ---------------------------------------------------------------------
-- diplomas — Xirmo ka kooban hal ama in ka badan oo Course ah.
-- MA lahan jadwal/qiimo/muddo (kuwaas waxay ku jiraan Class-ka).
-- ---------------------------------------------------------------------
create table diplomas (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  name           text not null,
  description    text,
  created_at     timestamptz not null default now()
);

create index idx_diplomas_institution on diplomas(institution_id);

-- ---------------------------------------------------------------------
-- courses — Halbeegga ugu yar ee manhajka.
-- Wuxuu noqon karaa keligiis AMA qayb ka mid ah Diploma (diploma_id nullable).
-- ---------------------------------------------------------------------
create table courses (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  diploma_id     uuid references diplomas(id) on delete set null,  -- NULLABLE
  name           text not null,
  code           text not null,
  type           course_type not null default 'regular',
  created_at     timestamptz not null default now(),

  -- code-ku waa inuu ku gaar yahay xaruntaas gudaheeda (maaha guud ahaan)
  unique (institution_id, code)
);

create index idx_courses_institution on courses(institution_id);
create index idx_courses_diploma on courses(diploma_id);

-- ---------------------------------------------------------------------
-- classes — Wax la iibin karo: jadwal + qiimo leh.
-- Wuxuu tixraacaa AMA hal Course AMA hal Diploma (program_type ayaa go'aamiya).
-- Ardaydu waxay isku qoraan CLASSES — maaha courses ama diplomas si toos ah.
-- ---------------------------------------------------------------------
create table classes (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  instructor_id  uuid references profiles(id) on delete set null,

  program_type   program_type not null,       -- 'course' ama 'diploma'
  course_id      uuid references courses(id)  on delete restrict,
  diploma_id     uuid references diplomas(id) on delete restrict,

  name           text not null,
  start_month    date,
  end_month      date,
  duration       text,                         -- tusaale: "3 bilood"
  total_fee      numeric(12,2) not null default 0,
  status         class_status not null default 'active',
  created_at     timestamptz not null default now(),

  -- Xaqiiji: hadii course, course_id waa muhiim; hadii diploma, diploma_id waa muhiim
  constraint class_program_check check (
    (program_type = 'course'  and course_id  is not null and diploma_id is null) or
    (program_type = 'diploma' and diploma_id is not null and course_id  is null)
  )
);

create index idx_classes_institution on classes(institution_id);
create index idx_classes_instructor on classes(instructor_id);

-- ---------------------------------------------------------------------
-- enrollments — Isku-xirka arday <-> class (student-to-class assignment).
-- Kani waa "junction table" — wuxuu isku xiraa laba table (many-to-many).
-- Arday wuxuu isku qori karaa fasalo badan; fasalna arday badan.
-- ---------------------------------------------------------------------
create table enrollments (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  student_id     uuid not null references profiles(id) on delete cascade,
  class_id       uuid not null references classes(id)  on delete cascade,
  enrolled_at    timestamptz not null default now(),

  -- Arday isku mid laba jeer iskuma qori karo hal fasal
  unique (student_id, class_id)
);

create index idx_enrollments_institution on enrollments(institution_id);
create index idx_enrollments_student on enrollments(student_id);
create index idx_enrollments_class on enrollments(class_id);
