import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
import {
  addClassCourse,
  assignCourseToDiploma,
  autoGenerateCertificatesBatch,
  createClass,
  createCourse,
  createDiploma,
  createDiplomaSemester,
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
  getDiplomaSemesters,
  getDiplomas,
  getEnrollments,
  getExams,
  setDiplomaCourseSemester,
  updateClass,
} from '@/lib/api'

export const ALUMNI_COURSE_SLOTS = 8

export type AlumniTemplateKind = 'course' | 'diploma' | 'diploma_semester' | 'full'

const IDENTITY_HEADERS = ['full_name', 'email', 'phone', 'student_code', 'year'] as const

function slotHeaders(withSemester: boolean, count = ALUMNI_COURSE_SLOTS) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1
    return withSemester ? [`course_${n}`, `mark_${n}`, `semester_${n}`] : [`course_${n}`, `mark_${n}`]
  }).flat()
}

export const ALUMNI_TEMPLATES: {
  kind: AlumniTemplateKind
  title: string
  subtitle: string
  hint: string
  filename: string
  headers: string[]
  columns: { key: string; required: boolean; mapsTo: string }[]
}[] = [
  {
    kind: 'course',
    title: 'Courses',
    subtitle: 'Single course only',
    hint: 'One student, one course, one mark. No diploma or semester columns.',
    filename: 'alumni-template-courses.xlsx',
    headers: [...IDENTITY_HEADERS.slice(0, 4), 'course_name', 'year', 'mark'],
    columns: [
      { key: 'full_name', required: true, mapsTo: 'student name' },
      { key: 'email', required: true, mapsTo: 'account email' },
      { key: 'phone', required: false, mapsTo: 'phone' },
      { key: 'student_code', required: false, mapsTo: 'previous ID (6+ chars)' },
      { key: 'course_name', required: true, mapsTo: 'course name' },
      { key: 'year', required: false, mapsTo: 'completion year' },
      { key: 'mark', required: true, mapsTo: '0–100' },
    ],
  },
  {
    kind: 'diploma',
    title: 'Diplomas',
    subtitle: 'Diploma courses, no semester',
    hint: 'One row = one student. diploma_name plus course_1/mark_1 … course_8. No semester columns.',
    filename: 'alumni-template-diplomas.xlsx',
    headers: [...IDENTITY_HEADERS.slice(0, 4), 'diploma_name', 'year', ...slotHeaders(false)],
    columns: [
      { key: 'full_name', required: true, mapsTo: 'student name' },
      { key: 'email', required: true, mapsTo: 'account email' },
      { key: 'phone', required: false, mapsTo: 'phone' },
      { key: 'student_code', required: false, mapsTo: 'previous ID (6+ chars)' },
      { key: 'diploma_name', required: true, mapsTo: 'diploma name in Academic Programs' },
      { key: 'year', required: false, mapsTo: 'completion year' },
      { key: 'course_1 / mark_1 … course_8 / mark_8', required: true, mapsTo: 'each subject and mark' },
    ],
  },
  {
    kind: 'diploma_semester',
    title: 'Diploma + semester',
    subtitle: 'Diploma with semesters',
    hint: 'Same as diploma, plus semester_1 … semester_8 for each course (e.g. Semester one).',
    filename: 'alumni-template-diploma-semesters.xlsx',
    headers: [...IDENTITY_HEADERS.slice(0, 4), 'diploma_name', 'year', ...slotHeaders(true)],
    columns: [
      { key: 'full_name', required: true, mapsTo: 'student name' },
      { key: 'email', required: true, mapsTo: 'account email' },
      { key: 'phone', required: false, mapsTo: 'phone' },
      { key: 'student_code', required: false, mapsTo: 'previous ID (6+ chars)' },
      { key: 'diploma_name', required: true, mapsTo: 'diploma name in Academic Programs' },
      { key: 'year', required: false, mapsTo: 'completion year' },
      { key: 'course_n / mark_n / semester_n', required: true, mapsTo: 'subject, mark, and semester name' },
    ],
  },
  {
    kind: 'full',
    title: 'Full',
    subtitle: 'All columns (course + diploma + semester)',
    hint: 'Use when one file mixes course and diploma rows. Set program_type to course or diploma.',
    filename: 'alumni-template-full.xlsx',
    headers: ['full_name', 'email', 'phone', 'student_code', 'program_type', 'program_name', 'year', ...slotHeaders(true)],
    columns: [
      { key: 'program_type', required: true, mapsTo: 'course or diploma' },
      { key: 'program_name', required: true, mapsTo: 'course or diploma name' },
      { key: 'course_n / mark_n / semester_n', required: false, mapsTo: 'semester is optional' },
    ],
  },
]

export const ALUMNI_IMPORT_COLUMNS = ALUMNI_TEMPLATES.find((t) => t.kind === 'full')!.columns
export const ALUMNI_TEMPLATE_HEADERS = ALUMNI_TEMPLATES.find((t) => t.kind === 'full')!.headers

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
  const sem = n.match(/^(?:semester|semister|sem|term)_?(\d+)$/)
  if (sem) return `semester_${Number(sem[1])}`
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

function inferProgramType(
  out: Record<string, string>,
  slots: { name: string; semester: string }[],
): 'course' | 'diploma' | null {
  const parsed = parseProgramType(out.program_type || '')
  if (parsed) return parsed
  if (slots.some((s) => s.semester)) return 'diploma'
  const named = slots.filter((s) => s.name)
  if (named.length >= 2) return 'diploma'
  const programName = String(out.program_name || '').trim()
  if (programName && named[0]?.name && programName.toLowerCase() !== named[0].name.toLowerCase()) {
    return 'diploma'
  }
  if (named.length === 1 || programName) return 'course'
  return null
}

function writeAlumniWorkbook(filename: string, headers: string[], rows: Record<string, unknown>[], guide: string[][]) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
  XLSX.utils.book_append_sheet(wb, ws, 'Alumni')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(guide), 'Guide')
  XLSX.writeFile(wb, filename)
}

export function downloadAlumniTemplate(kind: AlumniTemplateKind = 'full') {
  const spec = ALUMNI_TEMPLATES.find((t) => t.kind === kind) || ALUMNI_TEMPLATES.find((t) => t.kind === 'full')
  if (!spec) return

  if (spec.kind === 'course') {
    writeAlumniWorkbook(
      spec.filename,
      spec.headers,
      [
        {
          full_name: 'Ahmed Ali',
          email: 'ahmed.ali@example.com',
          phone: '0612345678',
          student_code: '',
          course_name: 'Computer Basics',
          year: 2022,
          mark: 78,
        },
      ],
      [
        ['Template: Courses only. One row = one student = one course.'],
        ['Do not add diploma or semester columns.'],
        [''],
        ['Column', 'Required', 'Meaning'],
        ...spec.columns.map((c) => [c.key, c.required ? 'yes' : 'no', c.mapsTo]),
        [''],
        ['mark is 0–100. Upload this file in Alumni Import.'],
      ],
    )
    return
  }

  if (spec.kind === 'diploma') {
    const empty = Object.fromEntries(slotHeaders(false).map((h) => [h, '']))
    writeAlumniWorkbook(
      spec.filename,
      spec.headers,
      [
        {
          full_name: 'Amina Yusuf',
          email: 'amina.yusuf@example.com',
          phone: '',
          student_code: 'ACC2022001',
          diploma_name: 'Accounting Diploma',
          year: 2022,
          ...empty,
          course_1: 'Bookkeeping',
          mark_1: 80,
          course_2: 'Taxation',
          mark_2: 72,
          course_3: 'Auditing',
          mark_3: 68,
        },
      ],
      [
        ['Template: Diploma without semester columns.'],
        ['diploma_name must match Academic Programs. One row = one student.'],
        ['One alumni class for the whole diploma — not one class per semester.'],
        [''],
        ['Column', 'Required', 'Meaning'],
        ...spec.columns.map((c) => [c.key, c.required ? 'yes' : 'no', c.mapsTo]),
        [''],
        ['Fill only the course_n / mark_n pairs you need. Leave the rest empty.'],
      ],
    )
    return
  }

  if (spec.kind === 'diploma_semester') {
    const empty = Object.fromEntries(slotHeaders(true).map((h) => [h, '']))
    writeAlumniWorkbook(
      spec.filename,
      spec.headers,
      [
        {
          full_name: 'Amina Yusuf',
          email: 'amina.yusuf@example.com',
          phone: '',
          student_code: 'ACC2022001',
          diploma_name: 'deploma test',
          year: 2022,
          ...empty,
          course_1: 'Taxation',
          mark_1: 80,
          semester_1: 'semister one',
          course_2: 'Auditing',
          mark_2: 72,
          semester_2: 'semister one',
          course_3: 'Web Development',
          mark_3: 68,
          semester_3: 'semister two',
        },
      ],
      [
        ['Template: Diploma with semester per course.'],
        ['diploma_name must match Academic Programs. semester_n is the semester name for that course.'],
        ['One alumni class for the whole diploma — not one class per semester.'],
        [''],
        ['Column', 'Required', 'Meaning'],
        ...spec.columns.map((c) => [c.key, c.required ? 'yes' : 'no', c.mapsTo]),
      ],
    )
    return
  }

  const empty = Object.fromEntries(slotHeaders(true).map((h) => [h, '']))
  writeAlumniWorkbook(
    spec.filename,
    spec.headers,
    [
      {
        full_name: 'Ahmed Ali',
        email: 'ahmed.ali@example.com',
        phone: '0612345678',
        student_code: '',
        program_type: 'course',
        program_name: 'Computer Basics',
        year: 2022,
        ...empty,
        course_1: 'Computer Basics',
        mark_1: 78,
      },
      {
        full_name: 'Amina Yusuf',
        email: 'amina.yusuf@example.com',
        phone: '0611111111',
        student_code: 'ACC2022001',
        program_type: 'diploma',
        program_name: 'Accounting Diploma',
        year: 2022,
        ...empty,
        course_1: 'Bookkeeping',
        mark_1: 80,
        course_2: 'Taxation',
        mark_2: 72,
        course_3: 'Auditing',
        mark_3: 68,
      },
      {
        full_name: 'Hassan Mohamed',
        email: 'hassan.mohamed@example.com',
        phone: '0612222222',
        student_code: 'DIP2023001',
        program_type: 'diploma',
        program_name: 'deploma test',
        year: 2023,
        ...empty,
        course_1: 'Taxation',
        mark_1: 80,
        semester_1: 'semister one',
        course_2: 'Auditing',
        mark_2: 72,
        semester_2: 'semister one',
        course_3: 'Web Development',
        mark_3: 68,
        semester_3: 'semister two',
        course_4: 'Graphic Design',
        mark_4: 75,
        semester_4: 'semister two',
      },
    ],
    [
      ['Full template — 3 example students. Replace them with real alumni, then upload.'],
      ['Row 1 Ahmed: COURSE — only course_1 and mark_1. Leave semester empty.'],
      ['Row 2 Amina: DIPLOMA — several courses, no semester columns.'],
      ['Row 3 Hassan: DIPLOMA WITH SEMESTER — courses plus semester_1, semester_2, …'],
      ['program_type must be course or diploma. diploma program_name must match Academic Programs.'],
      [''],
      ['Column', 'Required', 'Meaning'],
      ...spec.columns.map((c) => [c.key, c.required ? 'yes' : 'no', c.mapsTo]),
    ],
  )
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
  semester_name: string
}

function collectCourseSlots(out: Record<string, string>) {
  const slots: { n: number; name: string; mark: number | null; code: string; semester: string }[] = []
  const indexes = new Set<number>()
  for (const key of Object.keys(out)) {
    const m = key.match(/^(?:course|mark|code|semester)_(\d+)$/)
    if (m) indexes.add(Number(m[1]))
  }
  for (const n of [...indexes].sort((a, b) => a - b)) {
    const name = String(out[`course_${n}`] || '').trim()
    const markRaw = String(out[`mark_${n}`] || '').trim()
    const code = String(out[`code_${n}`] || '').trim().toUpperCase()
    const semester = String(out[`semester_${n}`] || '').trim()
    if (!name && !markRaw) continue
    slots.push({ n, name, mark: markRaw ? parseMark(markRaw) : null, code, semester })
  }
  return slots
}

export function mapAndValidateRows(
  rawRows: Record<string, unknown>[],
  mapping: Record<string, string>,
): { rows: AlumniMappedRow[]; errors: string[] } {
  const errors: string[] = []
  const rows: AlumniMappedRow[] = []
  const dests = Object.values(mapping)
  if (!dests.includes('full_name')) errors.push('Missing column: full_name')
  if (!dests.includes('email')) errors.push('Missing column: email')
  const hasCourseCol = dests.some((v) => String(v).startsWith('course_')) || dests.includes('program_name')
  const hasMarkCol = dests.some((v) => String(v).startsWith('mark_'))
  if (!hasCourseCol) errors.push('Missing column: course_name or course_1')
  if (!hasMarkCol) errors.push('Missing column: mark or mark_1')
  if (errors.length) return { rows, errors }

  rawRows.forEach((raw, i) => {
    const rowNumber = i + 2
    const out: Record<string, string> = {}
    for (const [src, dest] of Object.entries(mapping)) {
      if (dest && dest !== 'skip') out[dest] = cell(raw, src)
    }
    const email = String(out.email || '').trim().toLowerCase()
    const full_name = String(out.full_name || '').trim()
    let slots = collectCourseSlots(out)
    if (!full_name && !email && !slots.length) return
    const program_type = inferProgramType(out, slots)
    let program_name = String(out.program_name || '').trim()
    if (!program_name && slots[0]?.name) program_name = slots[0].name
    const student_code = String(out.student_code || '').trim().toUpperCase()
    if (!slots.length && program_type === 'course' && program_name) {
      const mark = parseMark(out.mark_1 || '')
      if (mark != null) slots = [{ n: 1, name: program_name, mark, code: '', semester: '' }]
    }

    if (!full_name) errors.push(`Row ${rowNumber}: full_name is required`)
    if (!email || !isEmail(email)) errors.push(`Row ${rowNumber}: valid email is required`)
    if (!program_type) errors.push(`Row ${rowNumber}: could not tell course vs diploma — add program_type or extra courses`)
    if (!program_name) errors.push(`Row ${rowNumber}: course_name or diploma_name is required`)
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
        semester_name: slot.semester,
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

  const [diplomas, courses, classes, classCourses, diplomaCourses, diplomaSemesters, exams, enrollments] = await Promise.all([
    getDiplomas(),
    getCourses(),
    getClasses(),
    getClassCourses(),
    getDiplomaCourses(),
    getDiplomaSemesters(),
    getExams(),
    getEnrollments(),
  ])

  const diplomaList = [...(diplomas || [])]
  const courseList = [...(courses || [])]
  const classList = [...(classes || [])]
  const classCourseList = [...(classCourses || [])]
  const diplomaCourseList = [...(diplomaCourses || [])]
  const semesterList = [...(diplomaSemesters || [])]
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

  function namesMatch(a: string, b: string) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
  }

  async function ensureDiploma(programName: string, year: number) {
    const exact = findDiploma(programName)
    if (exact) return exact
    const legacy = findDiploma(`${programName} — Alumni ${year}`)
    if (legacy) return legacy
    const row = await createDiploma({ name: programName })
    diplomaList.push(row)
    return row
  }

  async function ensureSemester(diplomaId: string, name: string) {
    const label = String(name || '').trim()
    if (!diplomaId || !label) return null
    const hit = semesterList.find((s) => s.diploma_id === diplomaId && namesMatch(s.name, label))
    if (hit) return hit
    const row = await createDiplomaSemester(diplomaId, label)
    semesterList.push(row)
    return row
  }

  async function ensureCourse(name: string, code: string, diplomaId: string | null, semesterId: string | null) {
    const onDiploma = diplomaId
      ? courseList.filter((c) => diplomaCourseList.some((l) => l.diploma_id === diplomaId && l.course_id === c.id))
      : []
    const byCodeOnDiploma = code
      ? onDiploma.find((c) => String(c.code || '').toUpperCase() === code.toUpperCase())
      : null
    const byNameOnDiploma = onDiploma.find((c) => namesMatch(c.name, name))
    const hit = byCodeOnDiploma || byNameOnDiploma || (code ? findCourseByCode(code) : null) || findCourseByName(name)
    if (hit) {
      if (diplomaId) {
        const link = diplomaCourseList.find((l) => l.diploma_id === diplomaId && l.course_id === hit.id)
        if (!link) {
          try {
            const created = await assignCourseToDiploma(diplomaId, hit.id, semesterId)
            diplomaCourseList.push(created)
          } catch {
            /* already linked */
          }
        } else if (semesterId && link.semester_id !== semesterId) {
          try {
            const updated = await setDiplomaCourseSemester(diplomaId, hit.id, semesterId)
            Object.assign(link, updated)
          } catch {
            /* ignore */
          }
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
      semester_id: semesterId,
    })
    courseList.push(row)
    if (diplomaId) {
      diplomaCourseList.push({ diploma_id: diplomaId, course_id: row.id, semester_id: semesterId || null })
    }
    return row
  }

  async function ensureClass(programType: 'course' | 'diploma', programName: string, year: number, courseId: string | null, diplomaId: string | null) {
    const name = classNameFor(programName, year)
    const hit = findClassByName(name)
    if (hit) {
      if (programType === 'diploma' && diplomaId && hit.diploma_id !== diplomaId) {
        const row = await updateClass(hit.id, { diploma_id: diplomaId, program_type: 'diploma' })
        const idx = classList.findIndex((c) => c.id === hit.id)
        if (idx >= 0) classList[idx] = row
        return row
      }
      return hit
    }
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
          diplomaId = (await ensureDiploma(sample.program_name, sample.year)).id
        }
        const courseIds: string[] = []
        for (const r of classRows) {
          const semester = diplomaId && r.semester_name
            ? await ensureSemester(diplomaId, r.semester_name)
            : null
          const course = await ensureCourse(
            r.course_name,
            r.course_code,
            sample.program_type === 'diploma' ? diplomaId : null,
            semester?.id || null,
          )
          courseIds.push(course.id)
          if (sample.program_type === 'course') primaryCourseId = course.id
        }
        if (sample.program_type === 'course' && !primaryCourseId) {
          const c = await ensureCourse(sample.program_name, sample.course_code, null, null)
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
