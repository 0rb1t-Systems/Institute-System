-- =====================================================================
--  0014_seed_barre.sql
--  Provision 2 xarun (Barre A + Barre B) + koorsooyin
--  Ka hor: admin-a@barre.com & admin-b@barre.com waa dashboard ku jiraan
-- =====================================================================

-- 1) Provision labada xarun
select public.provision_tenant('Barre Institute A', 'barre-a', 'admin-a@barre.com', 'Admin A');
select public.provision_tenant('Barre Institute B', 'barre-b', 'admin-b@barre.com', 'Admin B');

-- 2) Koorsooyin — Barre A
insert into courses (institution_id, name, code)
select i.id, x.name, x.code
from institutions i
cross join (values
  ('Web Design',        'WD-101'),
  ('English Language',  'EN-101'),
  ('Computer Basics',   'CB-101')
) as x(name, code)
where i.subdomain = 'barre-a';

-- 3) Koorsooyin — Barre B
insert into courses (institution_id, name, code)
select i.id, x.name, x.code
from institutions i
cross join (values
  ('Accounting',      'AC-101'),
  ('Graphic Design',  'GD-101')
) as x(name, code)
where i.subdomain = 'barre-b';
