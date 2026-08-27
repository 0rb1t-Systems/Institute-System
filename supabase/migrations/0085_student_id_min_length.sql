-- Student IDs are also the first login password. GoTrue requires >= 6 characters,
-- so pad the numeric part until the full ID meets that length (e.g. DI123 → DI0123).
create or replace function public.format_student_code(p_prefix text, p_n integer, p_pad integer)
returns text
language sql
immutable
as $$
  select concat(
    coalesce(p_prefix, ''),
    lpad(
      p_n::text,
      greatest(
        coalesce(p_pad, 3),
        length(p_n::text),
        greatest(6 - length(coalesce(p_prefix, '')), 1)
      ),
      '0'
    )
  );
$$;

comment on function public.format_student_code(text, integer, integer) is
  'Formats sequential student IDs. Numeric part is padded so the full ID is at least 6 characters (auth password minimum).';
