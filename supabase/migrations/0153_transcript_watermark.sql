-- Transcript page watermark (faint logo behind content).
-- Default in the app: institution logo_url when transcript_watermark_url is null.

alter table public.institutions
  add column if not exists transcript_watermark_url text,
  add column if not exists transcript_watermark_opacity numeric(5,2);

comment on column public.institutions.transcript_watermark_url is
  'Optional custom transcript watermark image. Null → use institution logo_url.';
comment on column public.institutions.transcript_watermark_opacity is
  'Watermark opacity percent (0–40). Null → default faint (~12).';

-- Keep existing rows usable; app defaults opacity when null.
update public.institutions
set transcript_watermark_opacity = 12
where transcript_watermark_opacity is null;
