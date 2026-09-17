/**
 * Manual course grading uses one exam container per (class_id, course_id).
 * Historical races created duplicates — always prefer a single canonical exam.
 */

export function isManualExam(exam) {
  return !exam?.marking_type || exam.marking_type === 'manual';
}

/** Pick the canonical manual exam for a class+course (most results, then oldest). */
export function pickCanonicalManualExam(exams, classId, courseId, results = []) {
  if (!classId || !courseId || !Array.isArray(exams)) return null;
  const matches = exams.filter(
    (e) => e.class_id === classId && e.course_id === courseId && isManualExam(e),
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const scored = matches.map((e) => ({
    exam: e,
    count: (results || []).filter((r) => r.exam_id === e.id).length,
    created: e.created_at ? Date.parse(e.created_at) : 0,
  }));
  scored.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.created !== b.created) return a.created - b.created;
    return String(a.exam.id).localeCompare(String(b.exam.id));
  });
  return scored[0].exam;
}

/** Dedupe manual exams for gradebook columns — one column per course. */
export function dedupeManualExamsByCourse(exams, results = []) {
  if (!Array.isArray(exams) || exams.length === 0) return [];
  const byCourse = new Map();
  for (const exam of exams) {
    if (!isManualExam(exam)) continue;
    const key = exam.course_id || exam.id;
    const prev = byCourse.get(key);
    if (!prev) {
      byCourse.set(key, exam);
      continue;
    }
    const winner = pickCanonicalManualExam([prev, exam], exam.class_id, exam.course_id || prev.course_id, results);
    byCourse.set(key, winner || prev);
  }
  return Array.from(byCourse.values());
}
