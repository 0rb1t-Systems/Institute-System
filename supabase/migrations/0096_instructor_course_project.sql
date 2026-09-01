-- Instructors at BRCE / Hankaal may set course_project when grading (exam_results).
-- Course catalog default remains admin/staff only.

create or replace function public.guard_course_project_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_allowed boolean;
begin
  new.course_project := public.sanitize_course_project_text(new.course_project);

  if new.course_project is null then
    return new;
  end if;

  if not public.institution_allows_course_projects(new.institution_id) then
    new.course_project := null;
    return new;
  end if;

  if tg_table_name = 'transcript_entries' then
    return new;
  end if;

  v_role := public.current_user_role()::text;
  v_allowed := v_role in ('admin', 'staff', 'super_admin')
    or (tg_table_name = 'exam_results' and v_role = 'instructor');

  if not v_allowed then
    if tg_op = 'UPDATE' then
      new.course_project := old.course_project;
    else
      new.course_project := null;
    end if;
  end if;

  return new;
end;
$$;
