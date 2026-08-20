import React, { useMemo, useState } from 'react'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { FileDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import {
  getExamScorePercent,
  getExamTotalMarks,
  getLetterGrade,
  isCoursePassed,
} from '@/lib/examPass'
import { getInstitutionGradeScale } from '@/lib/gradingScale'

const COLORS = ['#00C49F', '#FF8042']

type ReportRow = {
  id: string
  date: string | null
  studentId: string
  studentName: string
  studentCode: string
  classId: string
  courseId: string
  courseName: string
  examTitle: string
  percentage: number
  letter: string
  passed: boolean
  source: 'gradebook' | 'exam'
}

const ExamReport = () => {
  const { institution } = useAuth()
  const {
    results = [],
    exams = [],
    students = [],
    classes = [],
    courses = [],
    gradebookEntries = [],
  } = useData()
  const gradeScale = useMemo(() => getInstitutionGradeScale(institution), [institution])

  const [classFilter, setClassFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [studentFilter, setStudentFilter] = useState('')

  /** Gradebook-first rows (exam + assignment bonus finals). Fallback to raw exams if empty. */
  const allRows = useMemo(() => {
    const studentById = Object.fromEntries((students || []).map((s) => [s.id, s]))
    const courseById = Object.fromEntries((courses || []).map((c) => [c.id, c]))
    const classById = Object.fromEntries((classes || []).map((c) => [c.id, c]))
    const examByClassCourse = new Map()
    for (const exam of exams || []) {
      if (!exam.class_id || !exam.course_id) continue
      const key = `${exam.class_id}:${exam.course_id}`
      const prev = examByClassCourse.get(key)
      if (!prev) examByClassCourse.set(key, exam)
    }

    const gbRows: ReportRow[] = (gradebookEntries || [])
      .filter((g) => g && g.final_mark != null)
      .map((g) => {
        const student = studentById[g.student_id]
        const course = courseById[g.course_id]
        const exam = examByClassCourse.get(`${g.class_id}:${g.course_id}`)
        const percentage = Number(g.final_mark)
        const letter =
          (g.letter_grade && g.letter_grade !== '-'
            ? g.letter_grade
            : getLetterGrade(percentage, gradeScale)) || '-'
        return {
          id: `gb-${g.id}`,
          date: g.synced_at || null,
          studentId: g.student_id,
          studentName: student?.name || 'Unknown',
          studentCode: String(student?.student_code || ''),
          classId: g.class_id,
          courseId: g.course_id,
          courseName: course?.name || 'Course',
          examTitle: exam?.title || `${course?.name || 'Course'} — Final`,
          percentage,
          letter,
          passed: isCoursePassed(percentage, gradeScale),
          source: 'gradebook' as const,
        }
      })

    if (gbRows.length > 0) {
      return gbRows.sort(
        (a, b) => Number(new Date(b.date || 0)) - Number(new Date(a.date || 0)),
      )
    }

    // Fallback: raw exam results (when gradebook not yet synced)
    return (results || [])
      .map((r) => {
        const exam = (exams || []).find((e) => e.id === r.exam_id)
        const student = studentById[r.student_id]
        if (!exam || !student) return null
        const total = getExamTotalMarks(exam)
        const percentage = getExamScorePercent(r.final_score ?? r.score, exam)
        const letter = getLetterGrade(percentage, gradeScale)
        return {
          id: `ex-${r.id}`,
          date: r.graded_at || r.submission_date || r.created_at || null,
          studentId: r.student_id,
          studentName: student.name || 'Unknown',
          studentCode: String(student.student_code || ''),
          classId: exam.class_id,
          courseId: exam.course_id || classById[exam.class_id]?.course_id || '',
          courseName: courseById[exam.course_id]?.name || exam.title || 'Exam',
          examTitle: exam.title || 'Exam',
          percentage,
          letter,
          passed: isCoursePassed(percentage, gradeScale),
          source: 'exam' as const,
        } satisfies ReportRow
      })
      .filter(Boolean)
      .sort((a, b) => Number(new Date(b!.date || 0)) - Number(new Date(a!.date || 0))) as ReportRow[]
  }, [gradebookEntries, results, exams, students, courses, classes, gradeScale])

  const filteredRows = useMemo(() => {
    const term = studentFilter.trim().toLowerCase()
    return allRows.filter((row) => {
      if (classFilter !== 'all' && row.classId !== classFilter) return false
      if (courseFilter !== 'all' && row.courseId !== courseFilter) return false
      if (term) {
        const hay = `${row.studentName} ${row.studentCode}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [allRows, classFilter, courseFilter, studentFilter])

  const passFailData = useMemo(() => {
    let passed = 0
    let failed = 0
    filteredRows.forEach((r) => {
      if (r.passed) passed++
      else failed++
    })
    return [
      { name: 'Passed', value: passed },
      { name: 'Failed', value: failed },
    ]
  }, [filteredRows])

  const avgScoreData = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {}
    filteredRows.forEach((r) => {
      const key = r.courseId || r.examTitle
      if (!map[key]) {
        map[key] = { name: r.courseName || r.examTitle, total: 0, count: 0 }
      }
      map[key].total += r.percentage
      map[key].count += 1
    })
    return Object.values(map)
      .map((e) => ({
        name: e.name.length > 28 ? `${e.name.slice(0, 26)}…` : e.name,
        average: Math.round(e.total / e.count),
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 10)
  }, [filteredRows])

  const usingGradebook = allRows.some((r) => r.source === 'gradebook')

  const generatePDF = () => {
    const doc = new jsPDF()
    doc.text('Gradebook / Examination Report', 14, 20)
    doc.setFontSize(10)
    doc.text(
      usingGradebook
        ? 'Source: Institution gradebook (exam + assignment bonuses)'
        : 'Source: Exam results (gradebook not yet populated)',
      14,
      28,
    )

    const tableRows = filteredRows.map((r) => [
      formatDate(r.date),
      r.studentName,
      r.examTitle,
      `${Math.round(r.percentage)}/100 (${r.letter})`,
      r.passed ? 'Passed' : 'Failed',
    ])

    doc.autoTable({
      startY: 34,
      head: [['Date', 'Student', 'Course / Exam', 'Score', 'Status']],
      body: tableRows,
    })
    doc.save('Exam_Gradebook_Report.pdf')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
        <div className="grid gap-2 w-full md:min-w-[200px] min-w-0">
          <Label className="text-white">Filter by Class</Label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 w-full md:min-w-[200px] min-w-0">
          <Label className="text-white">Filter by Course</Label>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 flex-1 min-w-0 w-full">
          <Label className="text-white">Search Student</Label>
          <Input
            placeholder="Student name or ID…"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="bg-slate-950 border-slate-700 text-white"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={generatePDF} variant="outline" disabled={filteredRows.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-500 -mt-2">
        {usingGradebook
          ? `Using institution gradebook finals · Pass mark ${gradeScale.pass_mark}% · Scale max ${gradeScale.scale_max}`
          : `Showing exam scores (gradebook empty) · Pass mark ${gradeScale.pass_mark}%`}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Pass / fail from institution grading scale</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {filteredRows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No gradebook results yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={passFailData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {passFailData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Scores by Course</CardTitle>
            <CardDescription>Mean final mark (%) from gradebook</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {avgScoreData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No averages to chart.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgScoreData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="average" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Results</CardTitle>
          <CardDescription>
            Gradebook finals (exam score + assignment bonuses), letter grades from institution
            settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Course / Exam</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell className="font-medium">{r.studentName}</TableCell>
                      <TableCell>{r.examTitle}</TableCell>
                      <TableCell className="text-center font-bold tabular-nums">
                        {Math.round(r.percentage)}/100
                      </TableCell>
                      <TableCell className="text-center font-semibold">{r.letter}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            r.passed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {r.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                      No gradebook results match your filters. Mark exams/assignments so finals
                      sync into the gradebook.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ExamReport
