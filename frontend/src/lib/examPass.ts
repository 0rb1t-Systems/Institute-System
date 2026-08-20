/**
 * Exam pass/fail — single rule for student portal, admin marking, and reports.
 * passing_score is a percentage 0–100 (column on exams).
 * Course letter grades / GPA use institution grading scale (default 60% pass).
 */
import {
  getDefaultGradingScale,
  getGradePointsFromScale,
  getLetterGradeFromScale,
  isCoursePassedFromScale,
  type GradingScale,
} from '@/lib/gradingScale'

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

/** Letter grade from a percentage mark (0–100). Optional institution scale. */
export function getLetterGrade(percentage: number, scale?: GradingScale | null): string {
  return getLetterGradeFromScale(percentage, scale || getDefaultGradingScale())
}

/** Grade points from a percentage mark. Optional institution scale. */
export function getGradePoints(percentage: number, scale?: GradingScale | null): number {
  return getGradePointsFromScale(percentage, scale || getDefaultGradingScale())
}

/** Course pass/fail on the transcript scale. */
export function isCoursePassed(
  percentage: number,
  passMarkOrScale: number | GradingScale | null | undefined = 60,
): boolean {
  if (passMarkOrScale && typeof passMarkOrScale === 'object') {
    return isCoursePassedFromScale(percentage, passMarkOrScale)
  }
  const passMark = typeof passMarkOrScale === 'number' ? passMarkOrScale : 60
  return Number(percentage) >= passMark
}
