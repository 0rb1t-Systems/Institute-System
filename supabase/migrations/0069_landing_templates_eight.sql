-- Expand allowed landing templates to 8 designs
alter table public.institutions
  drop constraint if exists institutions_landing_template_id_check;

alter table public.institutions
  add constraint institutions_landing_template_id_check
  check (landing_template_id in (
    'classic', 'aurora', 'campus', 'horizon', 'crest',
    'nova', 'ledger', 'atelier'
  ));
