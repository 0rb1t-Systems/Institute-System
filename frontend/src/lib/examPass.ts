/**
 * Exam pass/fail — single rule for student portal, admin marking, and reports.
 * passing_score is a percentage 0–100 (column on exams).
 * Course letter grades / GPA use a 60% pass mark (transcript scale).
 */

export function getExamTotalMarks(exam?: { total_marks?: number | null; final_marks?: number | null } | null): number {
  const n = Number(exam?.total_marks ?? exam?.final_marks ?? 100)
  return Number.isFinite(n) && n > 0 ? n : 100
}

export function getExamPassingPercent(exam?: { passing_score?: number | null } | null): number {
  const n = Number(exam?.passing_score)
  if (Number.isFinite(n) && n >= 0 && n <= 100) return n
  return 50
}

export function getExamScorePercent(
  score: number | null | undefined,
  exam?: { total_marks?: number | null; final_marks?: number | null } | null,
): number {
  const total = getExamTotalMarks(exam)
  const s = Number(score)
  if (!Number.isFinite(s) || total <= 0) return 0
  return (s / total) * 100
}

/** True when score meets the exam's passing percentage. */
export function isExamPassed(
  score: number | null | undefined,
  exam?: { passing_score?: number | null; total_marks?: number | null; final_marks?: number | null } | null,
): boolean {
  return getExamScorePercent(score, exam) >= getExamPassingPercent(exam)
}

/** Letter grade from a percentage mark (0–100). */
export function getLetterGrade(percentage: number): string {
  const p = Number(percentage)
  if (!Number.isFinite(p)) return '-'
  if (p >= 90) return 'A'
  if (p >= 80) return 'B'
  if (p >= 70) return 'C'
  if (p >= 60) return 'D'
  return 'F'
}

/** 4.0-scale grade points from a percentage mark. */
export function getGradePoints(percentage: number): number {
  const p = Number(percentage)
  if (!Number.isFinite(p)) return 0
  if (p >= 90) return 4.0
  if (p >= 80) return 3.0
  if (p >= 70) return 2.0
  if (p >= 60) return 1.0
  return 0.0
}

/** Course pass/fail on the transcript scale (default 60%). */
export function isCoursePassed(percentage: number, passMark = 60): boolean {
  return Number(percentage) >= passMark
}
