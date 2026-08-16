import React from 'react'
import { parseDurationMonths, parseLocalDate, isPlausibleCalendarDate, endOfMonth } from '@/lib/utils'
import { getInstitutionDisplayName } from '@/lib/institution'
import { useAuth } from '@/contexts/AuthContext'
import IdCard from '@/components/IdCard'

function resolveCardDates({ student, enrollment, course, classData }) {
  const cls = classData || enrollment?.class || null

  const rawStart =
    parseLocalDate(enrollment?.enrollment_date) ||
    parseLocalDate(cls?.start_date) ||
    parseLocalDate(cls?.start_month)

  const startDate = isPlausibleCalendarDate(rawStart) ? rawStart : new Date()

  let expirationDate =
    parseLocalDate(student?.valid_until) ||
    parseLocalDate(cls?.end_date) ||
    parseLocalDate(cls?.end_month)

  // Class months are YYYY-MM — Valid Until should be the last day of that month
  if (expirationDate && isPlausibleCalendarDate(expirationDate)) {
    const endRaw = String(cls?.end_date || cls?.end_month || '')
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(endRaw)) {
      expirationDate = endOfMonth(expirationDate)
    }
  }

  // Reject corrupt years and recompute from duration
  if (!isPlausibleCalendarDate(expirationDate)) {
    const durationMonths =
      parseDurationMonths(cls?.duration_months, 0) ||
      parseDurationMonths(cls?.duration, 0) ||
      parseDurationMonths(course?.duration, 12) ||
      12
    expirationDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    expirationDate.setFullYear(startDate.getFullYear())
    expirationDate.setMonth(expirationDate.getMonth() + durationMonths)
    expirationDate = endOfMonth(expirationDate)
  }

  return { startDate, expirationDate }
}

/** Student-facing adapter around shared IdCard (enrollment / program date resolution). */
const StudentIdCard = ({ student, enrollment, course, classData, className }: any) => {
  const { institution } = useAuth()
  const { expirationDate } = resolveCardDates({ student, enrollment, course, classData })

  const displayStudentCode = student?.student_code || 'STU-----'
  const displayProgram =
    enrollment?.class?.diploma?.name ||
    classData?.diploma?.name ||
    course?.name ||
    enrollment?.class?.course?.name ||
    classData?.course?.name ||
    classData?.name ||
    enrollment?.class?.name ||
    'General Program'

  const institutionName = getInstitutionDisplayName(institution)
  const safeName = institutionName.replace(/\s+/g, '_')

  return (
    <IdCard
      user={student}
      roleLabel="Student"
      nameLabel="Student Name"
      secondaryLabel="Program"
      secondaryValue={displayProgram}
      idLabel="Student ID"
      code={displayStudentCode}
      expirationDate={expirationDate}
      className={className}
      cardDomId="tenant-student-id-card"
      downloadName={`${safeName}_Student_ID_${displayStudentCode}.png`}
    />
  )
}

export default StudentIdCard
