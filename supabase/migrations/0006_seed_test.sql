-- =====================================================================
--  0006_seed_test.sql   (XOG TIJAABO AH — test only)
--  Ka hor: abuur admin-a@test.com + admin-b@test.com dashboard-ka
-- =====================================================================

-- 2 xarun (tenants)
insert into institutions (id, name, subdomain) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Tenant A College', 'tenant-a'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Tenant B College', 'tenant-b');

-- Admin kasta -> profile (id-ga waxaan ka soo qaadnaa auth.users email-kiisa)
insert into profiles (id, institution_id, role, status, full_name, email)
select id, 'aaaaaaaa-0000-0000-0000-000000000001', 'admin', 'approved', 'Admin A', email
from auth.users where email = 'admin-a@test.com';

insert into profiles (id, institution_id, role, status, full_name, email)
select id, 'bbbbbbbb-0000-0000-0000-000000000002', 'admin', 'approved', 'Admin B', email
from auth.users where email = 'admin-b@test.com';

-- Koorsooyin: 2 Tenant A, 1 Tenant B
insert into courses (institution_id, name, code) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Web Design A', 'WD-A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'English A',    'EN-A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Accounting B', 'AC-B');
