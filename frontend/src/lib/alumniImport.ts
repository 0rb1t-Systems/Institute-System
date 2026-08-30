import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import {
  addClassCourse,
  assignCourseToDiploma,
  autoGenerateCertificatesBatch,
  createClass,
  createCourse,
  createDiploma,
  createEnrollment,
  createExam,
  createOrUpdateExamResult,
  createStudentWithAutoCode,
  finalizeGradebook,
  findStudentByEmail,
  getClassCourses,
  getClasses,
  getCourses,
  getDiplomaCourses,
  getDiplomas,
  getEnrollments,
  getExams,
} from '@/lib/api'

export const ALUMNI_COURSE_SLOTS = 8

export const ALUMNI_IMPORT_COLUMNS = [
  { key: 'full_name', label: 'full_name', required: true, mapsTo: 'profiles.full_name' },
  { key: 'email', label: 'email', required: true, mapsTo: 'profiles.email' },
  { key: 'phone', label: 'phone', required: false, mapsTo: 'profiles.phone' },
  { key: 'student_code', label: 'student_code', required: false, mapsTo: 'profiles.student_code' },
  { key: 'program_type', label: 'program_type', required: true, mapsTo: 'course | diploma' },
  { key: 'program_name', label: 'program_name', required: true, mapsTo: 'diploma or single course name' },
  { key: 'year', label: 'year', required: false, mapsTo: 'alumni class year' },
  { key: 'course_1', label: 'course_1', required: true, mapsTo: 'first course name' },
  { key: 'mark_1', label: 'mark_1', required: true, mapsTo: 'first course mark 0–100' },
  { key: 'course_2', label: 'course_2', required: false, mapsTo: 'diploma course 2' },
  { key: 'mark_2', label: 'mark_2', required: false, mapsTo: 'diploma mark 2' },
  { key: 'course_3', label: 'course_3', required: false, mapsTo: 'diploma course 3' },
  { key: 'mark_3', label: 'mark_3', required: false, mapsTo: 'diploma mark 3' },
] as const

export const ALUMNI_TEMPLATE_HEADERS = [
  'full_name',
  'email',
  'phone',
  'student_code',
  'program_type',
  'program_name',
  'year',
  ...Array.from({ length: ALUMNI_COURSE_SLOTS }, (_, i) => [`course_${i + 1}`, `mark_${i + 1}`]).flat(),
]

const HEADER_ALIASES: Record<string, string> = {
  full_name: 'full_name',
  name: 'full_name',
  student_name: 'full_name',
  fullname: 'full_name',
  magaca: 'full_name',
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  phone: 'phone',
  mobile: 'phone',
  tel: 'phone',
  telephone: 'phone',
  student_code: 'student_code',
  student_id: 'student_code',
  studentid: 'student_code',
  id: 'student_code',
  program_type: 'program_type',
  type: 'program_type',
  program_name: 'program_name',
  program: 'program_name',
  diploma: 'program_name',
  diploma_name: 'program_name',
  year: 'year',
  completion_year: 'year',
  batch: 'year',
}

export const MAX_ALUMNI_IMPORT_ROWS = 500

function normHeader(h: unknown) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function cell(row: Record<string, unknown>, key: string) {
  const v = row[key]
  if (v == null) return ''
  return String(v).trim()
}

function parseYear(raw: string) {
  const n = Number(String(raw).replace(/[^\d]/g, '').slice(0, 4))
  if (Number.isFinite(n) && n >= 1990 && n <= 2100) return n
  return new Date().getFullYear()
}

function parseMark(raw: string) {
  const n = Number(String(raw).replace('%', '').replace(',', '.').trim())
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, n))
}

function parseProgramType(raw: string): 'course' | 'diploma' | null {
  const n = String(raw || '').trim().toLowerCase()
  if (['course', 'koorso', 'regular', 'short'].includes(n)) return 'course'
  if (['diploma', 'diplom', 'program'].includes(n)) return 'diploma'
  return null
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function slugCode(name: string, prefix = 'ALM') {
  const base = String(name || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 10)
    .toUpperCase()
  return `${prefix}-${base || 'CRS'}`
}

function numberedField(header: string): string | null {
  const n = normHeader(header)
  const course = n.match(/^(?:course|subject|module|maado|maadada)_?(\d+)(?:_name)?$/)
  if (course) return `course_${Number(course[1])}`
  const mark = n.match(/^(?:mark|score|grade|dhibcaha|final_mark)_?(\d+)$/)
  if (mark) return `mark_${Number(mark[1])}`
  const code = n.match(/^(?:course_code|code)_?(\d+)$/)
  if (code) return `code_${Number(code[1])}`
  if (['course_name', 'subject', 'module', 'maadada'].includes(n)) return 'course_1'
  if (['mark', 'score', 'grade', 'final_mark', 'dhibcaha'].includes(n)) return 'mark_1'
  if (['course_code', 'code'].includes(n)) return 'code_1'
  return null
}

export function mapAlumniHeaders(headers: string[]) {
  const mapping: Record<string, string> = {}
  for (const h of headers) {
    mapping[h] = numberedField(h) || HEADER_ALIASES[normHeader(h)] || 'skip'
  }
  return mapping
}

export function rowsFromWorkbook(buf: ArrayBuffer) {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames.find((n) => String(n).toLowerCase() !== 'guide') || wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]
  return json
}

export function downloadAlumniTemplate() {
  const emptySlots = Object.fromEntries(
    Array.from({ length: ALUMNI_COURSE_SLOTS }, (_, i) => [
      [`course_${i + 1}`, ''],
      [`mark_${i + 1}`, ''],
    ]).flat(),
  )
  const example = [
    {
      full_name: 'Ahmed Ali',
      email: 'ahmed.ali@example.com',
      phone: '0612345678',
      student_code: '',
      program_type: 'course',
      program_name: 'Computer Basics',
      year: 2022,
      ...emptySlots,
      course_1: 'Computer Basics',
      mark_1: 78,
    },
    {
      full_name: 'Amina Yusuf',
      email: 'amina.yusuf@example.com',
      phone: '',
      student_code: 'ACC2022001',
      program_type: 'diploma',
      program_name: 'Accounting Diploma',
      year: 2022,
      ...emptySlots,
      course_1: 'Bookkeeping',
      mark_1: 80,
      course_2: 'Taxation',
      mark_2: 72,
      course_3: 'Auditing',
      mark_3: 68,
    },
  ]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(example, { header: [...ALUMNI_TEMPLATE_HEADERS] })
  XLSX.utils.book_append_sheet(wb, ws, 'Alumni')
  const guide = XLSX.utils.aoa_to_sheet([
    ['One row = one student. Diploma courses go in course_1/mark_1, course_2/mark_2, …'],
    [''],
    ['Column', 'Required', 'Meaning'],
    ...ALUMNI_IMPORT_COLUMNS.map((c) => [c.label, c.required ? 'yes' : 'no', c.mapsTo]),
    ['course_4 … course_8', 'no', 'more diploma courses if needed'],
    [''],
    ['Diploma: Amina is ONE row — course_1 Bookkeeping 80, course_2 Taxation 72, course_3 Auditing 68.'],
    ['Single course: fill course_1 and mark_1 only.'],
    ['mark is 0–100. Certificates require 60+ on every course listed for that student.'],
  ])
  XLSX.utils.book_append_sheet(wb, guide, 'Guide')
  XLSX.writeFile(wb, 'alumni-import-template.xlsx')
}

export type AlumniMappedRow = {
  rowNumber: number
  full_name: string
  email: string
  phone: string
  student_code: string
  program_type: 'course' | 'diploma'
  program_name: string
  year: number
  course_name: string
  course_code: string
  mark: number
}

function collectCourseSlots(out: Record<string, string>) {
  const slots: { n: number; name: string; mark: number | null; code: string }[] = []
  const indexes = new Set<number>()
  for (const key of Object.keys(out)) {
    const m = key.match(/^(?:course|mark|code)_(\d+)$/)
    if (m) indexes.add(Number(m[1]))
  }
  for (const n of [...indexes].sort((a, b) => a - b)) {
    const name = String(out[`course_${n}`] || '').trim()
    const markRaw = String(out[`mark_${n}`] || '').trim()
    const code = String(out[`code_${n}`] || '').trim().toUpperCase()
    if (!name && !markRaw) continue
    slots.push({ n, name, mark: markRaw ? parseMark(markRaw) : null, code })
  }
  return slots
}

export function mapAndValidateRows(
  rawRows: Record<string, unknown>[],
  mapping: Record<string, string>,
): { rows: AlumniMappedRow[]; errors: string[] } {
  const errors: string[] = []
  const rows: AlumniMappedRow[] = []
  const identityRequired = ['full_name', 'email', 'program_type', 'program_name']
  for (const key of identityRequired) {
    if (!Object.values(mapping).includes(key)) errors.push(`Missing column: ${key}`)
  }
  const hasCourseCol = Object.values(mapping).some((v) => String(v).startsWith('course_'))
  const hasMarkCol = Object.values(mapping).some((v) => String(v).startsWith('mark_'))
  if (!hasCourseCol) errors.push('Missing column: course_1')
  if (!hasMarkCol) errors.push('Missing column: mark_1')
  if (errors.length) return { rows, errors }

  rawRows.forEach((raw, i) => {
    const rowNumber = i + 2
    const out: Record<string, string> = {}
    for (const [src, dest] of Object.entries(mapping)) {
      if (dest && dest !== 'skip') out[dest] = cell(raw, src)
    }
    const program_type = parseProgramType(out.program_type || '')
    const email = String(out.email || '').trim().toLowerCase()
    const full_name = String(out.full_name || '').trim()
    const program_name = String(out.program_name || '').trim()
    const student_code = String(out.student_code || '').trim().toUpperCase()
    let slots = collectCourseSlots(out)
    if (!slots.length && program_type === 'course' && program_name) {
      const mark = parseMark(out.mark_1 || '')
      if (mark != null) slots = [{ n: 1, name: program_name, mark, code: '' }]
    }

    if (!full_name) errors.push(`Row ${rowNumber}: full_name is required`)
    if (!email || !isEmail(email)) errors.push(`Row ${rowNumber}: valid email is required`)
    if (!program_type) errors.push(`Row ${rowNumber}: program_type must be course or diploma`)
    if (!program_name) errors.push(`Row ${rowNumber}: program_name is required`)
    if (student_code && student_code.length < 6) {
      errors.push(`Row ${rowNumber}: student_code must be at least 6 characters`)
    }
    if (!slots.length) errors.push(`Row ${rowNumber}: add at least course_1 and mark_1`)
    for (const slot of slots) {
      if (!slot.name) errors.push(`Row ${rowNumber}: course_${slot.n} name is missing`)
      if (slot.mark == null) errors.push(`Row ${rowNumber}: mark_${slot.n} must be a number 0–100`)
    }
    if (!full_name || !email || !isEmail(email) || !program_type || !program_name) return
    for (const slot of slots) {
      if (!slot.name || slot.mark == null) continue
      rows.push({
        rowNumber,
        full_name,
        email,
        phone: String(out.phone || '').trim(),
        student_code,
        program_type,
        program_name,
        year: parseYear(out.year || ''),
        course_name: slot.name,
        course_code: slot.code,
        mark: slot.mark,
      })
    }
  })
  return { rows, errors }
}

function classNameFor(program_name: string, year: number) {
  return `${program_name} — Alumni ${year}`
}

function classKey(row: AlumniMappedRow) {
  return `${row.program_type}|${row.program_name.toLowerCase()}|${row.year}`
}

async function uniqueCourseCode(existing: any[], preferred: string, name: string) {
  const used = new Set((existing || []).map((c) => String(c.code || '').toUpperCase()))
  let code = (preferred || slugCode(name)).toUpperCase().slice(0, 32)
  if (!used.has(code)) return code
  let n = 2
  while (used.has(`${code}${n}`)) n += 1
  return `${code}${n}`.slice(0, 32)
}

export async function runAlumniImport(
  mappedRows: AlumniMappedRow[],
  options: { sendWelcomeEmail?: boolean; issueDocuments?: boolean } = {},
) {
  const sendWelcomeEmail = options.sendWelcomeEmail === true
  const issueDocuments = options.issueDocuments !== false

  const [diplomas, courses, classes, classCourses, diplomaCourses, exams, enrollments] = await Promise.all([
    getDiplomas(),
    getCourses(),
    getClasses(),
    getClassCourses(),
    getDiplomaCourses(),
    getExams(),
    getEnrollments(),
  ])

  const diplomaList = [...(diplomas || [])]
  const courseList = [...(courses || [])]
  const classList = [...(classes || [])]
  const classCourseList = [...(classCourses || [])]
  const diplomaCourseList = [...(diplomaCourses || [])]
  const examList = [...(exams || [])]
  const enrollmentList = [...(enrollments || [])]
  const studentByEmail = new Map<string, any>()

  const findDiploma = (name: string) =>
    diplomaList.find((d) => String(d.name || '').trim().toLowerCase() === name.trim().toLowerCase())
  const findCourseByName = (name: string) =>
    courseList.find((c) => String(c.name || '').trim().toLowerCase() === name.trim().toLowerCase())
  const findCourseByCode = (code: string) =>
    courseList.find((c) => String(c.code || '').toUpperCase() === code.toUpperCase())
  const findClassByName = (name: string) =>
    classList.find((c) => String(c.name || '').trim().toLowerCase() === name.trim().toLowerCase())

  async function ensureDiploma(name: string) {
    const hit = findDiploma(name)
    if (hit) return hit
    const row = await createDiploma({ name, description: 'Alumni import' })
    diplomaList.push(row)
    return row
  }

  async function ensureCourse(name: string, code: string, diplomaId: string | null) {
    const byCode = code ? findCourseByCode(code) : null
    const hit = byCode || findCourseByName(name)
    if (hit) {
      if (diplomaId && !diplomaCourseList.some((l) => l.diploma_id === diplomaId && l.course_id === hit.id)) {
        try {
          const link = await assignCourseToDiploma(diplomaId, hit.id)
          diplomaCourseList.push(link)
        } catch {
          /* already linked */
        }
      }
      return hit
    }
    const unique = await uniqueCourseCode(courseList, code, name)
    const row = await createCourse({
      name,
      code: unique,
      type: 'regular',
      diploma_ids: diplomaId ? [diplomaId] : [],
    })
    courseList.push(row)
    if (diplomaId) {
      diplomaCourseList.push({ diploma_id: diplomaId, course_id: row.id })
    }
    return row
  }

  async function ensureClass(programType: 'course' | 'diploma', programName: string, year: number, courseId: string | null, diplomaId: string | null) {
    const name = classNameFor(programName, year)
    const hit = findClassByName(name)
    if (hit) return hit
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const row = await createClass({
      name,
      program_type: programType,
      course_id: programType === 'course' ? courseId : null,
      diploma_id: programType === 'diploma' ? diplomaId : null,
      start_date: start,
      end_date: end,
      duration: '1',
      fee: 0,
      total_fee: 0,
      status: 'inactive',
      is_active: false,
    })
    classList.push(row)
    return row
  }

  async function ensureClassCourse(classId: string, courseId: string) {
    if (classCourseList.some((l) => l.class_id === classId && l.course_id === courseId)) return
    try {
      const row = await addClassCourse(classId, courseId)
      classCourseList.push(row)
    } catch {
      /* unique */
    }
  }

  async function ensureExam(classId: string, courseId: string, courseName: string) {
    const hit = examList.find((e) => e.class_id === classId && e.course_id === courseId)
    if (hit) return hit
    const row = await createExam({
      class_id: classId,
      course_id: courseId,
      title: `${courseName} (alumni record)`,
      final_marks: 100,
      total_marks: 100,
      attendance_marks: 0,
      weight: 100,
      passing_score: 60,
      is_active: false,
    })
    examList.push(row)
    return row
  }

  async function ensureStudent(row: AlumniMappedRow) {
    if (studentByEmail.has(row.email)) return { student: studentByEmail.get(row.email), reused: true }
    const existing = await findStudentByEmail(row.email)
    if (existing) {
      studentByEmail.set(row.email, existing)
      return { student: existing, reused: true }
    }
    const student = await createStudentWithAutoCode({
      name: row.full_name,
      email: row.email,
      phone: row.phone || undefined,
      student_code: row.student_code || undefined,
      skipWelcomeEmail: !sendWelcomeEmail,
    })
    studentByEmail.set(row.email, student)
    return { student, reused: false }
  }

  async function ensureEnrollment(studentId: string, classId: string) {
    const hit = enrollmentList.find((e) => e.student_id === studentId && e.class_id === classId)
    if (hit) return hit
    try {
      const row = await createEnrollment({
        student_id: studentId,
        class_id: classId,
        discount_amount: 0,
      })
      enrollmentList.push(row)
      return row
    } catch (err) {
      const { data } = await supabase
        .from('enrollments')
        .select('*')
        .eq('student_id', studentId)
        .eq('class_id', classId)
        .maybeSingle()
      if (data) {
        enrollmentList.push(data)
        return data
      }
      throw err
    }
  }

  const result = {
    studentsCreated: 0,
    studentsReused: 0,
    gradesWritten: 0,
    classesTouched: new Set<string>(),
    enrollmentIds: [] as string[],
    errors: [] as string[],
    documents: null as null | { transcripts: string; certificates: string },
  }

  const byStudent = new Map<string, AlumniMappedRow[]>()
  for (const row of mappedRows) {
    const list = byStudent.get(row.email) || []
    list.push(row)
    byStudent.set(row.email, list)
  }

  for (const [, studentRows] of byStudent) {
    const first = studentRows[0]
    try {
      const { student, reused } = await ensureStudent(first)
      if (reused) result.studentsReused += 1
      else result.studentsCreated += 1

      const byClass = new Map<string, AlumniMappedRow[]>()
      for (const r of studentRows) {
        const k = classKey(r)
        const list = byClass.get(k) || []
        list.push(r)
        byClass.set(k, list)
      }

      for (const classRows of byClass.values()) {
        const sample = classRows[0]
        let diplomaId: string | null = null
        let primaryCourseId: string | null = null
        if (sample.program_type === 'diploma') {
          diplomaId = (await ensureDiploma(`${sample.program_name} — Alumni ${sample.year}`)).id
        }
        const courseIds: string[] = []
        for (const r of classRows) {
          const course = await ensureCourse(
            r.course_name,
            r.course_code,
            sample.program_type === 'diploma' ? diplomaId : null,
          )
          courseIds.push(course.id)
          if (sample.program_type === 'course') primaryCourseId = course.id
        }
        if (sample.program_type === 'course' && !primaryCourseId) {
          const c = await ensureCourse(sample.program_name, sample.course_code, null)
          primaryCourseId = c.id
        }
        const cls = await ensureClass(
          sample.program_type,
          sample.program_name,
          sample.year,
          primaryCourseId,
          diplomaId,
        )
        result.classesTouched.add(cls.id)
        for (let i = 0; i < classRows.length; i++) {
          await ensureClassCourse(cls.id, courseIds[i])
        }
        const enrollment = await ensureEnrollment(student.id, cls.id)
        result.enrollmentIds.push(enrollment.id)
        for (let i = 0; i < classRows.length; i++) {
          const r = classRows[i]
          const exam = await ensureExam(cls.id, courseIds[i], r.course_name)
          await createOrUpdateExamResult({
            exam_id: exam.id,
            student_id: student.id,
            enrollment_id: enrollment.id,
            raw_score: r.mark,
            final_score: r.mark,
            comments: 'Alumni import',
          })
          result.gradesWritten += 1
        }
      }
    } catch (err: any) {
      result.errors.push(`${first.email}: ${err?.message || String(err)}`)
    }
  }

  if (issueDocuments && result.classesTouched.size) {
    const transcriptNotes: string[] = []
    const certNotes: string[] = []
    for (const classId of result.classesTouched) {
      try {
        await finalizeGradebook(classId)
        transcriptNotes.push('ok')
      } catch (err: any) {
        transcriptNotes.push(err?.message || String(err))
      }
      try {
        const cert = await autoGenerateCertificatesBatch({ classId })
        certNotes.push(`${cert?.generated || 0} issued`)
      } catch (err: any) {
        certNotes.push(err?.message || String(err))
      }
    }
    result.documents = {
      transcripts: transcriptNotes.every((n) => n === 'ok')
        ? 'Issued'
        : `Saved grades; transcripts: ${transcriptNotes.join('; ')}`,
      certificates: certNotes.join('; '),
    }
  }

  return {
    ...result,
    classesTouched: result.classesTouched.size,
  }
}
