-- Replace password-style class PIN with a simple pin-to-top flag.

alter table public.classes
  add column if not exists is_pinned boolean not null default false;

comment on column public.classes.is_pinned is
  'When true, class is shown at the top of the Classes list.';

-- Drop password PIN helpers from 0140 (no longer used).
drop function if exists public.set_class_access_pin(uuid, text);
drop function if exists public.clear_class_access_pin(uuid, text);
drop function if exists public.verify_class_access_pin(uuid, text);

alter table public.classes
  drop column if exists access_pin_hash;
