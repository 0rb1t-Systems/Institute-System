/**
 * Assignment marks are bonus points added to the course exam score.
 * Final points = min(examTotal, examScore + sum(assignmentScores))
 * Never exceed the exam total (e.g. 100).
 */

export type ExamLike = {
  id: string;
  class_id?: string;
  course_id?: string | null;
  total_marks?: number;
  final_marks?: number;
  marking_type?: string;
};

export type ResultLike = {
  exam_id: string;
  student_id: string;
  score?: number | null;
  final_score?: number | null;
};

export type AssignmentLike = {
  id: string;
  class_id?: string;
  course_id?: string | null;
  total_marks?: number;
};

export type SubmissionLike = {
  id?: string;
  assignment_id: string;
  student_id: string;
  score?: number | null;
  grade?: number | null;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getExamTotal(exam?: ExamLike | null): number {
  if (!exam) return 100;
  const t = num(exam.total_marks ?? exam.final_marks, 100);
  return t > 0 ? t : 100;
}

export function getResultScore(result?: ResultLike | null): number | null {
  if (!result) return null;
  if (result.score != null) return num(result.score);
  if (result.final_score != null) return num(result.final_score);
  return null;
}

/**
 * Resolve how many assignment points can still be awarded for this student
 * without exceeding the exam total.
 */
export function getAssignmentBonusRoom({
  studentId,
  assignment,
  assignments = [],
  exams = [],
  results = [],
  submissions = [],
  classPrimaryCourseId = null,
}: {
  studentId: string;
  assignment: AssignmentLike;
  assignments?: AssignmentLike[];
  exams?: ExamLike[];
  results?: ResultLike[];
  submissions?: SubmissionLike[];
  classPrimaryCourseId?: string | null;
}): {
  exam: ExamLike | null;
  examScore: number | null;
  examTotal: number;
  otherAssignmentPoints: number;
  room: number | null;
  maxAllowedForThisAssignment: number;
} {
  const courseId = assignment.course_id || classPrimaryCourseId || null;
  const exam =
    exams.find(
      (e) =>
        e.class_id === assignment.class_id &&
        (e.marking_type === 'manual' || !e.marking_type) &&
        (courseId ? e.course_id === courseId || (!e.course_id && classPrimaryCourseId === courseId) : true)
    ) ||
    exams.find((e) => e.class_id === assignment.class_id && (e.marking_type === 'manual' || !e.marking_type)) ||
    null;

  const examTotal = getExamTotal(exam);
  const result = exam
    ? results.find((r) => r.exam_id === exam.id && r.student_id === studentId)
    : null;
  const examScore = getResultScore(result);

  const otherAssignmentPoints = (assignments || [])
    .filter((a) => a.id !== assignment.id && a.class_id === assignment.class_id)
    .filter((a) => {
      const aCourse = a.course_id || classPrimaryCourseId;
      if (!courseId) return true;
      return aCourse === courseId;
    })
    .reduce((sum, a) => {
      const sub = (submissions || []).find(
        (s) => s.assignment_id === a.id && s.student_id === studentId
      );
      const score = sub?.score ?? sub?.grade;
      if (score == null) return sum;
      return sum + num(score);
    }, 0);

  const assignMax = Math.max(0, num(assignment.total_marks, 0));

  // No exam grade yet → allow up to assignment max (sync waits for exam).
  if (examScore == null) {
    return {
      exam,
      examScore: null,
      examTotal,
      otherAssignmentPoints,
      room: null,
      maxAllowedForThisAssignment: assignMax,
    };
  }

  const room = Math.max(0, examTotal - examScore - otherAssignmentPoints);
  return {
    exam,
    examScore,
    examTotal,
    otherAssignmentPoints,
    room,
    maxAllowedForThisAssignment: Math.min(assignMax, room),
  };
}
