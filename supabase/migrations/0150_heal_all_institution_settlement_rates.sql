-- =====================================================================
--  0150_heal_all_institution_settlement_rates.sql
--  One-time: recalculate commission settlements for every class in every
--  institution so locked rates match the current instructor/institution
--  commission (past payments included). Going forward, 0149 triggers
--  already resync on commission edit / reassignment.
-- =====================================================================

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select c.id
    from public.classes c
    where c.instructor_id is not null
      and coalesce(c.settlement_model, 'commission') = 'commission'
  loop
    perform public.resync_class_instructor_settlements(r.id);
    n := n + 1;
  end loop;
  raise notice 'resync_class_instructor_settlements ran for % classes', n;
end;
$$;
