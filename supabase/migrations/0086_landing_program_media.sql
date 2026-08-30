-- Keep program photos and icons on landing_content.
-- 0076 only stored title + description, so uploads vanished on save.

create or replace function public.sanitize_landing_program_image_url(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v text := trim(coalesce(p_value, ''));
begin
  if v = '' then
    return '';
  end if;
  if v ~* '^javascript:' or v ~* '^data:' or v ~ '[[:space:]<>''"]' then
    return '';
  end if;
  if v !~* '^https?://' then
    return '';
  end if;
  if char_length(v) > 2000 then
    v := left(v, 2000);
  end if;
  return v;
end;
$$;

create or replace function public.sanitize_landing_program_icon(p_value text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_value, '')));
begin
  if v in (
    'graduation',
    'book',
    'code',
    'palette',
    'briefcase',
    'laptop',
    'camera',
    'globe',
    'languages',
    'calculator',
    'music',
    'stethoscope',
    'wrench',
    'megaphone',
    'award',
    'users'
  ) then
    return v;
  end if;
  return '';
end;
$$;

create or replace function public.sanitize_landing_content(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v jsonb := coalesce(p, '{}'::jsonb);
  v_highlights jsonb := '[]'::jsonb;
  v_programs jsonb := '[]'::jsonb;
  v_item jsonb;
  v_title text;
  v_desc text;
  v_img text;
  v_icon text;
  i int;
begin
  if jsonb_typeof(v) is distinct from 'object' then
    v := '{}'::jsonb;
  end if;

  if jsonb_typeof(v->'about_highlights') = 'array' then
    for i in 0 .. least(jsonb_array_length(v->'about_highlights') - 1, 3) loop
      v_title := public.sanitize_plain_text(v->'about_highlights'->>i, 90);
      if v_title <> '' then
        v_highlights := v_highlights || jsonb_build_array(v_title);
      end if;
    end loop;
  end if;

  if jsonb_typeof(v->'programs') = 'array' then
    for i in 0 .. least(jsonb_array_length(v->'programs') - 1, 7) loop
      v_item := v->'programs'->i;
      if jsonb_typeof(v_item) is distinct from 'object' then
        continue;
      end if;
      v_title := public.sanitize_plain_text(v_item->>'title', 80);
      v_desc := public.sanitize_plain_text(v_item->>'description', 280);
      v_img := public.sanitize_landing_program_image_url(v_item->>'image_url');
      v_icon := public.sanitize_landing_program_icon(v_item->>'icon');
      if v_title <> '' or v_desc <> '' or v_img <> '' then
        v_programs := v_programs || jsonb_build_array(
          jsonb_build_object(
            'title', v_title,
            'description', v_desc,
            'image_url', v_img,
            'icon', v_icon
          )
        );
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'about_title', public.sanitize_plain_text(v->>'about_title', 80),
    'about_body', public.sanitize_plain_text(v->>'about_body', 4000),
    'about_highlights', v_highlights,
    'programs_intro', public.sanitize_plain_text(v->>'programs_intro', 400),
    'programs', v_programs
  );
end;
$$;
