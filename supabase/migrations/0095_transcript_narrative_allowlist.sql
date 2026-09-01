-- Class transcript paragraph: BRCE + Hankaal admin only.
-- Other tenants keep any existing text but cannot change it from the dashboard/API.

create or replace function public.guard_class_transcript_narrative()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.transcript_narrative_text is not distinct from old.transcript_narrative_text then
    return new;
  end if;

  if not public.institution_allows_course_projects(new.institution_id)
     or public.current_user_role() not in ('admin', 'super_admin') then
    if tg_op = 'UPDATE' then
      new.transcript_narrative_text := old.transcript_narrative_text;
    else
      new.transcript_narrative_text := null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_class_transcript_narrative() from public, anon, authenticated;
grant execute on function public.guard_class_transcript_narrative() to service_role;

drop trigger if exists trg_guard_class_transcript_narrative on public.classes;
create trigger trg_guard_class_transcript_narrative
before insert or update on public.classes
for each row
execute function public.guard_class_transcript_narrative();
