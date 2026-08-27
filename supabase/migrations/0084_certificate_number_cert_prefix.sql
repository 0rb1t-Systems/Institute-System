-- Issued certificate numbers are always CERT-{serial}, e.g. CERT-001.

alter table public.institutions
  alter column certificate_number_pad set default 3;

create or replace function public.format_certificate_serial(p_n integer, p_pad integer)
returns text
language sql
immutable
as $$
  select concat(
    'CERT-',
    lpad(p_n::text, greatest(coalesce(p_pad, 3), length(p_n::text)), '0')
  );
$$;
