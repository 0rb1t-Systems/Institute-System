-- Remove online MCQ exam-taking. Institution exams are manual grading only.
-- Keeps exams / exam_results / exam_questions tables for historical data & manual flows.

-- Drop student-facing MCQ RPCs (also revoked for authenticated in case DROP IF EXISTS skips).
DROP FUNCTION IF EXISTS public.get_exam_paper_for_student(uuid);
DROP FUNCTION IF EXISTS public.submit_exam_attempt(uuid, jsonb);

-- Disable any remaining published MCQ exams so they cannot be treated as live online papers.
UPDATE public.exams
SET is_active = false
WHERE marking_type = 'mcq'
  AND is_active = true;

-- Revoke direct table access patterns that only served online MCQ authoring/taking.
-- Staff/admin still manage grades via exam_results RLS; exam_questions is unused going forward.
REVOKE ALL ON TABLE public.exam_questions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exam_questions TO service_role;
