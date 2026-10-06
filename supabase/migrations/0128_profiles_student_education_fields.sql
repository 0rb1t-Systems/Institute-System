-- Student education fields used by registration form + class Excel export.
alter table public.profiles
  add column if not exists university text,
  add column if not exists faculty text,
  add column if not exists year_of_study text;

comment on column public.profiles.university is 'Student university / school';
comment on column public.profiles.faculty is 'Student faculty / field of study';
comment on column public.profiles.year_of_study is 'Student year of study';

-- Backfill from latest matching registration inquiry when profile fields are empty.
update public.profiles p
set
  university = coalesce(nullif(trim(p.university), ''), nullif(trim(ri.university), '')),
  faculty = coalesce(nullif(trim(p.faculty), ''), nullif(trim(ri.faculty), '')),
  year_of_study = coalesce(nullif(trim(p.year_of_study), ''), nullif(trim(ri.year_of_study), ''))
from (
  select distinct on (lower(email), institution_id)
    lower(email) as email_key,
    institution_id,
    university,
    faculty,
    year_of_study
  from public.registration_inquiries
  where email is not null
  order by lower(email), institution_id, created_at desc nulls last
) ri
where p.role = 'student'
  and p.institution_id = ri.institution_id
  and lower(p.email) = ri.email_key
  and (
    nullif(trim(coalesce(p.university, '')), '') is null
    or nullif(trim(coalesce(p.faculty, '')), '') is null
    or nullif(trim(coalesce(p.year_of_study, '')), '') is null
  );
