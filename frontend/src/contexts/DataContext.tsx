import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/lib/api';
import { logError } from '@/lib/errorHandler';
import { computeStudentBalance } from '@/lib/finance';
import { notify, MESSAGES } from '@/lib/notify';

const DataContext = createContext<any>(null);

/**
 * Efficient data strategy:
 * 1) Core shell first (dashboard + most menus) → clear loading quickly
 * 2) Secondary (users, settlements, withdrawals) in background — never blocks nav
 * 3) Attendance is NOT loaded globally — pages fetch filtered data on demand
 * 4) Mutations refresh ONLY the resources they touched (see MUTATION_SCOPES)
 *
 * Performance notes:
 * - Every fetch is generation-stamped. Responses from a superseded load are
 *   discarded, so switching pages mid-flight can no longer overwrite fresh
 *   state with stale rows (the old cause of the flicker on rapid navigation).
 * - setState is skipped when the incoming rows are identical to what is already
 *   held, which keeps array identities stable and stops every downstream
 *   useMemo in the app from recomputing after an unrelated mutation.
 */

/** Which slices each fetcher owns. */
const CORE_KEYS = ['students', 'courses', 'diplomas', 'diplomaCourses', 'diplomaSemesters', 'classes', 'enrollments', 'payments', 'generalRegistrations'];
const SECONDARY_KEYS = [
  'users',
  'affiliateSettlements',
  'withdrawalRequests',
  'instructorEarnings',
  'classCourses',
  'exams',
  'results',
  'assignments',
  'assignmentSubmissions',
  'gradebookEntries',
  'certificates',
  'transcripts',
];

const FETCHERS = {
  students: api.getStudents,
  courses: api.getCourses,
  diplomas: api.getDiplomas,
  diplomaCourses: api.getDiplomaCourses,
  diplomaSemesters: api.getDiplomaSemesters,
  classes: api.getClasses,
  enrollments: api.getEnrollments,
  payments: api.getPayments,
  users: api.getAllProfiles,
  affiliateSettlements: api.getAffiliateSettlements,
  withdrawalRequests: api.getWithdrawalRequests,
  instructorEarnings: api.getInstructorEarnings,
  classCourses: api.getClassCourses,
  exams: api.getExams,
  results: api.getResults,
  assignments: api.getAssignments,
  assignmentSubmissions: api.getAssignmentSubmissions,
  gradebookEntries: api.getGradebookEntries,
  certificates: api.getAllCertificates,
  transcripts: api.getTranscripts,
  generalRegistrations: api.getGeneralRegistrations,
};

/**
 * A mutation only invalidates the tables it can actually change. Previously
 * every mutation re-ran all ten endpoints (~10 round trips at ~300 ms each)
 * and replaced all twenty state arrays, re-rendering the whole app.
 */
const MUTATION_SCOPES = {
  student: ['students', 'generalRegistrations'],
  studentEnrolled: ['students', 'enrollments', 'generalRegistrations'],
  course: ['courses', 'diplomaCourses', 'diplomaSemesters'],
  diploma: ['diplomas', 'courses', 'diplomaCourses', 'diplomaSemesters'],
  class: ['classes', 'classCourses'],
  enrollment: ['enrollments'],
  payment: ['payments', 'instructorEarnings', 'affiliateSettlements'],
  withdrawal: ['withdrawalRequests', 'instructorEarnings'],
  exam: ['exams', 'results', 'gradebookEntries'],
  assignment: ['assignments', 'assignmentSubmissions', 'gradebookEntries'],
  certificate: ['certificates'],
  transcript: ['transcripts', 'gradebookEntries'],
  none: [],
};

/**
 * Shared frozen empty array for the Phase 2/3 stub slices. Using one constant
 * (instead of a per-provider useState([])) guarantees these never change
 * identity, so consumers' memos that depend on them never invalidate.
 */
const EMPTY = Object.freeze([]);

/** Cheap identity check so unchanged rows keep their array identity. */
const sameRows = (a, b) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (!x || !y || typeof x !== 'object' || typeof y !== 'object') return false;
    // Rows are re-created by the mappers on every fetch, so compare by identity
    // fields rather than reference.
    const xk = Object.keys(x);
    if (xk.length !== Object.keys(y).length) return false;
    for (const k of xk) {
      if (x[k] !== y[k]) return false;
    }
  }
  return true;
};

export const DataProvider = ({ children }) => {
  const { user, institution } = useAuth();

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [diplomas, setDiplomas] = useState([]);
  const [diplomaCourses, setDiplomaCourses] = useState([]);
  const [diplomaSemesters, setDiplomaSemesters] = useState([]);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [instructorEarnings, setInstructorEarnings] = useState([]);
  const [classCourses, setClassCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([]);
  const [gradebookEntries, setGradebookEntries] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [affiliateSettlements, setAffiliateSettlements] = useState([]);
  const [generalRegistrations, setGeneralRegistrations] = useState([]);

  // Remaining stubs — frozen so they never invalidate consumer memos.
  // Attendance is fetched per-page, never held globally.
  const attendance = EMPTY;
  const notifications = EMPTY;
  const documentRequests = EMPTY;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userIdRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  /** Bumped on every full (re)load; stale responses are dropped. */
  const generationRef = useRef(0);
  /** key -> in-flight promise, so concurrent refreshes share one request. */
  const inFlightRef = useRef(new Map());

  const SETTERS = useRef({
    students: setStudents,
    courses: setCourses,
    diplomas: setDiplomas,
    diplomaCourses: setDiplomaCourses,
    diplomaSemesters: setDiplomaSemesters,
    classes: setClasses,
    enrollments: setEnrollments,
    payments: setPayments,
    users: setUsers,
    withdrawalRequests: setWithdrawalRequests,
    instructorEarnings: setInstructorEarnings,
    classCourses: setClassCourses,
    exams: setExams,
    results: setResults,
    assignments: setAssignments,
    assignmentSubmissions: setAssignmentSubmissions,
    gradebookEntries: setGradebookEntries,
    certificates: setCertificates,
    transcripts: setTranscripts,
    affiliateSettlements: setAffiliateSettlements,
    generalRegistrations: setGeneralRegistrations,
  }).current;

  /**
   * Fetch a set of slices. Concurrent requests for the same key are shared,
   * and a response is only applied if its generation is still current.
   */
  const fetchKeys = useCallback(async (keys, generation) => {
    const results = await Promise.allSettled(
      keys.map((key) => {
        const existing = inFlightRef.current.get(key);
        if (existing) return existing;
        const p = FETCHERS[key]().finally(() => {
          if (inFlightRef.current.get(key) === p) inFlightRef.current.delete(key);
        });
        inFlightRef.current.set(key, p);
        return p;
      })
    );

    // A newer load started while this one was in flight — discard.
    if (generation !== generationRef.current) return;

    keys.forEach((key, i) => {
      const outcome = results[i];
      if (outcome.status !== 'fulfilled') {
        logError(`DataContext - fetch ${key}`, outcome.reason);
        return;
      }
      const next = outcome.value || [];
      SETTERS[key]((prev) => (sameRows(prev, next) ? prev : next));
    });
  }, [SETTERS]);

  const loadData = useCallback(
    async ({ soft = false, keys = null } = {}) => {
      const generation = keys ? generationRef.current : (generationRef.current += 1);

      try {
        if (!soft) {
          setLoading(true);
          setError(null);
        }

        if (keys) {
          await fetchKeys(keys, generation);
          return;
        }

        await fetchKeys(CORE_KEYS, generation);
        hasLoadedOnceRef.current = true;
        if (!soft) setLoading(false);

        // Secondary never blocks the UI.
        fetchKeys(SECONDARY_KEYS, generation).catch((err) =>
          console.warn('Secondary data fetch failed', err)
        );
      } catch (err) {
        logError('DataContext - loadData', err);
        if (generation === generationRef.current) setError(err);
        if (!soft) {
          notify.error(err, {
            context: 'DataContext - loadData',
            fallback: MESSAGES.LOAD_FAILED,
          });
        }
      } finally {
        if (!soft && !keys) setLoading(false);
      }
    },
    [fetchKeys]
  );

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      userIdRef.current = null;
      hasLoadedOnceRef.current = false;
      generationRef.current += 1; // invalidate anything still in flight
      return;
    }
    // Platform System Owner has no tenant data shell
    if (user.role === 'super_admin') {
      setLoading(false);
      userIdRef.current = user.id;
      hasLoadedOnceRef.current = true;
      return;
    }
    if (user.id !== userIdRef.current) {
      userIdRef.current = user.id;
      hasLoadedOnceRef.current = false;
      loadData({ soft: false });
    } else if (!hasLoadedOnceRef.current) {
      loadData({ soft: false });
    }
  }, [user?.id, user?.role, loadData]);

  const calculateStudentFinancials = useCallback(() => {
    // Index payments/enrollments once instead of scanning the full arrays for
    // every student (this was O(students × payments) on every call).
    const paymentsByStudent = new Map();
    for (const p of payments) {
      const list = paymentsByStudent.get(p.student_id);
      if (list) list.push(p);
      else paymentsByStudent.set(p.student_id, [p]);
    }
    const activeEnrollmentByStudent = new Map();
    for (const e of enrollments) {
      if (e.status === 'active' && !activeEnrollmentByStudent.has(e.student_id)) {
        activeEnrollmentByStudent.set(e.student_id, e);
      }
    }
    const classById = new Map(classes.map((c) => [c.id, c]));

    return students.map((student) => {
      const studentPayments = paymentsByStudent.get(student.id) || [];
      const activeEnrollment = activeEnrollmentByStudent.get(student.id) || undefined;
      const activeClass = activeEnrollment ? classById.get(activeEnrollment.class_id) || null : null;
      const bal = computeStudentBalance({
        payments: studentPayments,
        activeClass,
        enrollment: activeEnrollment,
        institution,
      });

      return {
        student,
        activeEnrollment,
        activeClass,
        registrationPaid: bal.registrationPaid,
        registrationPaidAmount: bal.registrationPaidAmount,
        totalPaid: bal.totalPaid,
        balance: bal.balance,
        payments: studentPayments,
      };
    });
  }, [students, payments, enrollments, classes, institution]);

  const getNextPaymentMonth = useCallback(
    (studentId) => {
      const studentPayments = payments.filter(
        (p) => p.student_id === studentId && p.month_paid && !p.is_registration_fee
      );
      if (studentPayments.length === 0) return new Date().toISOString().slice(0, 7);
      const sorted = [...studentPayments].sort((a, b) => a.month_paid.localeCompare(b.month_paid));
      const lastMonthStr = sorted[sorted.length - 1].month_paid;
      const [year, month] = lastMonthStr.split('-').map(Number);
      const date = new Date(year, month - 1 + 1, 1);
      const nextY = date.getFullYear();
      const nextM = String(date.getMonth() + 1).padStart(2, '0');
      return `${nextY}-${nextM}`;
    },
    [payments]
  );

  // loadData in a ref so every action below keeps a stable identity forever.
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  /** Runs the mutation, then refreshes only the slices it can have changed. */
  const runMutation = useCallback(async (scope, apiCall) => {
    const result = await apiCall();
    const keys = MUTATION_SCOPES[scope] || [];
    if (keys.length) loadDataRef.current({ soft: true, keys });
    return result;
  }, []);

  // Actions are created once and never change identity, so passing them to
  // memoised children no longer defeats the memo.
  const actions = useMemo(
    () => ({
      addStudent: (data) =>
        runMutation(data.class_id && data.class_id !== 'none' ? 'studentEnrolled' : 'student', () =>
          data.class_id && data.class_id !== 'none'
            ? api.registerManualStudent(data)
            : api.createStudentWithAutoCode(data)
        ),
      updateStudentData: (id, u) => runMutation('student', () => api.updateStudent(id, u)),
      deleteStudentData: (id) => runMutation('studentEnrolled', () => api.deleteStudent(id)),

      addCourse: (d) => runMutation('course', () => api.createCourse(d)),
      updateCourseData: (id, u) => runMutation('course', () => api.updateCourse(id, u)),
      deleteCourse: (id) => runMutation('course', () => api.deleteCourse(id)),
      reorderDiplomaCourses: (diplomaId, courseIds) =>
        runMutation('course', () => api.reorderDiplomaCourses(diplomaId, courseIds)),
      assignCourseToDiploma: (diplomaId, courseId, semesterId) =>
        runMutation('course', () => api.assignCourseToDiploma(diplomaId, courseId, semesterId)),
      removeCourseFromDiploma: (diplomaId, courseId) =>
        runMutation('course', () => api.removeCourseFromDiploma(diplomaId, courseId)),
      addDiplomaSemester: (diplomaId, name) =>
        runMutation('diploma', () => api.createDiplomaSemester(diplomaId, name)),
      updateDiplomaSemesterData: (id, data) =>
        runMutation('diploma', () => api.updateDiplomaSemester(id, data)),
      deleteDiplomaSemesterData: (id) =>
        runMutation('diploma', () => api.deleteDiplomaSemester(id)),
      setDiplomaCourseSemester: (diplomaId, courseId, semesterId) =>
        runMutation('course', () => api.setDiplomaCourseSemester(diplomaId, courseId, semesterId)),

      addDiploma: (d) => runMutation('diploma', () => api.createDiploma(d)),
      updateDiplomaData: (id, u) => runMutation('diploma', () => api.updateDiploma(id, u)),
      deleteDiplomaData: (id) => runMutation('diploma', () => api.deleteDiploma(id)),

      addClass: (d) => runMutation('class', () => api.createClass(d)),
      updateClassData: (id, u) => runMutation('class', () => api.updateClass(id, u)),
      deleteClassData: (id) => runMutation('class', () => api.deleteClass(id)),
      addCourseToClass: (cid, coid) => runMutation('class', () => api.addClassCourse(cid, coid)),
      removeCourseFromClass: (id) => runMutation('class', () => api.removeClassCourse(id)),

      enrollStudent: (d) =>
        runMutation('enrollment', () =>
          api.createEnrollment({ ...d, status: 'active', enrollment_date: new Date().toISOString() })
        ),
      updateEnrollment: (id, data) => runMutation('enrollment', () => api.updateEnrollment(id, data)),
      unenrollStudent: (id) => runMutation('enrollment', () => api.deleteEnrollment(id)),
      transferStudent: (id, nid) => runMutation('enrollment', () => api.updateEnrollment(id, { class_id: nid })),

      addPayment: (d) => runMutation('payment', () => api.createPayment(d)),
      updatePaymentData: (id, d) => runMutation('payment', () => api.updatePayment(id, d)),
      deletePaymentData: (id) => runMutation('payment', () => api.deletePayment(id)),

      saveAssignment: (assignmentData) =>
        runMutation('assignment', async () =>
          assignmentData.id
            ? api.updateAssignment(assignmentData.id, assignmentData)
            : api.createAssignment(assignmentData)
        ),
      deleteAssignmentData: (id) => runMutation('assignment', () => api.deleteAssignment(id)),
      saveSubmissionGrade: (submissionId, gradeData) =>
        runMutation('assignment', () => api.gradeSubmission(submissionId, gradeData)),
      createManualSubmission: (submissionData) =>
        runMutation('assignment', () => api.createSubmission(submissionData)),

      createWithdrawal: (data) => runMutation('withdrawal', () => api.createWithdrawalRequest(data)),
      approveWithdrawal: (id, updates) =>
        runMutation('withdrawal', () => api.updateWithdrawalRequest(id, updates)),

      sendPaymentReminder: (studentId, message) => api.sendPaymentReminderEmail(studentId, message),

      markRead: (id) => runMutation('none', () => api.markNotificationRead(id)),

      requestDocument: (data) => runMutation('none', () => api.createDocumentRequest(data)),
      updateDocumentStatus: (id, status, docUrl = null) =>
        runMutation('none', () =>
          api.updateDocumentRequest(id, { status, ...(docUrl && { document_url: docUrl }) })
        ),

      approveRegistrationRecord: (id, _approverId) =>
        runMutation('studentEnrolled', () => api.approveRegistrationInquiry(id)),
      updateGeneralRegistration: (id, data) =>
        runMutation('student', () => api.updateGeneralRegistration(id, data)),
      deleteRegistrationRecord: (id) => runMutation('student', () => api.deleteRegistrationRecord(id)),

      saveExam: (examData) =>
        runMutation('exam', async () => {
          const { total_marks, ...rest } = examData;
          const dataToSave = {
            ...rest,
            // Institution exams are manual-only (staff/instructor enter grades).
            marking_type: 'manual',
            final_marks: total_marks || rest.final_marks || 0,
            attendance_marks: rest.attendance_marks || 0,
            open_time: rest.open_time || new Date().toISOString(),
            close_time: rest.close_time || new Date(Date.now() + 31536000000).toISOString(),
          };
          if (dataToSave.id) {
            return api.updateExam(dataToSave.id, dataToSave);
          }
          return api.createExam(dataToSave);
        }),
      updateExamPartial: (id, u) => runMutation('exam', () => api.updateExam(id, u)),
      deleteExamData: (id) => runMutation('exam', () => api.deleteExam(id)),
      saveManualGrades: (gradesArray) =>
        runMutation('exam', () => Promise.all(gradesArray.map((g) => api.upsertResult(g)))),
      finalizeGradebookForClass: (classId) =>
        runMutation('transcript', () => api.finalizeGradebook(classId)),
      issueCertificates: (items) =>
        runMutation('certificate', () => api.generateCertificatesBatch(items)),

      refreshData: () => loadDataRef.current({ soft: false }),
    }),
    [runMutation]
  );

  const value = useMemo(
    () => ({
      students,
      courses,
      diplomas,
      diplomaCourses,
      diplomaSemesters,
      classes,
      classCourses,
      enrollments,
      payments,
      exams,
      results,
      assignments,
      assignmentSubmissions,
      gradebookEntries,
      certificates,
      transcripts,
      attendance,
      users,
      // Alias only — same array as instructorEarnings (no second fetch)
      commissions: instructorEarnings,
      affiliateSettlements,
      withdrawalRequests,
      instructorEarnings,
      notifications,
      generalRegistrations,
      documentRequests,
      loading,
      error,
      getNextPaymentMonth,
      calculateStudentFinancials,
      ...actions,
    }),
    [
      students,
      courses,
      diplomas,
      diplomaCourses,
      diplomaSemesters,
      classes,
      classCourses,
      enrollments,
      payments,
      exams,
      results,
      assignments,
      assignmentSubmissions,
      gradebookEntries,
      certificates,
      transcripts,
      attendance,
      users,
      affiliateSettlements,
      withdrawalRequests,
      instructorEarnings,
      notifications,
      generalRegistrations,
      documentRequests,
      loading,
      error,
      getNextPaymentMonth,
      calculateStudentFinancials,
      actions,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};
