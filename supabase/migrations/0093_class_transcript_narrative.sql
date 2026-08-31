-- Per-class transcript completion paragraph.
-- Shown on all transcript layouts only when this class has text.

alter table public.classes
  add column if not exists transcript_narrative_text text;

comment on column public.classes.transcript_narrative_text is
  'Optional paragraph shown on transcripts for students in this class. Empty = hidden.';
