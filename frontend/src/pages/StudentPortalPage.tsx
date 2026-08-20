import React, { useMemo } from 'react'
import { Helmet } from 'react-helmet'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { BookOpen, AlertCircle } from 'lucide-react'
import { getUserMessage, MESSAGES } from '@/lib/notify'
import ClassDetailsCard from '@/components/student/ClassDetailsCard'
import useClassManagement from '@/hooks/useClassManagement'

/**
 * Student "My Classes" — enrolled classes only (no admin controls / no duplicate portal chrome).
 */
const StudentPortalPage = () => {
  const { user } = useAuth()
  const { enrollments, classes, courses, diplomas, users, loading: dataLoading, error: dataError } =
    useData()
  const studentId = user?.studentId || user?.id
  const { getClassPayments, getClassResults } = useClassManagement()

  const myEnrollments = useMemo(() => {
    if (!studentId) return []
    return [...enrollments]
      .filter((e) => e.student_id === studentId)
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1
        if (b.status === 'active' && a.status !== 'active') return 1
        return (
          Number(new Date(b.enrollment_date || b.created_at || 0)) -
          Number(new Date(a.enrollment_date || a.created_at || 0))
        )
      })
  }, [studentId, enrollments])

  const activeCount = useMemo(
    () => myEnrollments.filter((e) => e.status === 'active').length,
    [myEnrollments],
  )

  const enrichClass = (classData) => {
    if (!classData) return null
    const course = classData.course_id ? courses.find((c) => c.id === classData.course_id) : null
    const diploma = classData.diploma_id ? diplomas.find((d) => d.id === classData.diploma_id) : null
    const fromUsers = classData.instructor_id
      ? users.find((u) => u.id === classData.instructor_id)
      : null
    const instructorName =
      classData.instructor?.name ||
      classData.instructor?.full_name ||
      classData.instructorName ||
      fromUsers?.name ||
      fromUsers?.full_name ||
      null
    return {
      ...classData,
      course: course || classData.course || null,
      diploma: diploma || classData.diploma || null,
      instructor: instructorName
        ? {
            id: classData.instructor_id || classData.instructor?.id || fromUsers?.id,
            name: instructorName,
            full_name: instructorName,
          }
        : null,
      instructorName,
    }
  }

  if (dataError) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {getUserMessage(dataError, {
              context: 'StudentPortalPage',
              fallback: MESSAGES.LOAD_FAILED,
            })}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>My Classes - Portal</title>
      </Helmet>

      <PageHeader
        title="My Classes"
        subtitle={
          dataLoading
            ? 'Loading your enrollments…'
            : activeCount > 0
              ? `${activeCount} active enrollment${activeCount === 1 ? '' : 's'}`
              : 'Your enrolled classes'
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        {dataLoading && (
          <div className="col-span-full text-center py-16 text-slate-500">Loading your classes…</div>
        )}

        {!dataLoading &&
          myEnrollments.map((enrollment) => {
            const classData = enrichClass(classes.find((c) => c.id === enrollment.class_id))
            if (!classData) return null

            return (
              <ClassDetailsCard
                key={enrollment.id}
                classData={classData}
                enrollment={enrollment}
                payments={getClassPayments(classData.id, studentId)}
                results={getClassResults(classData.id, studentId)}
              />
            )
          })}

        {!dataLoading && myEnrollments.length === 0 && (
          <Card className="col-span-full bg-slate-900/30 border border-dashed border-slate-800">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-12 w-12 text-slate-600 mb-3" />
              <h3 className="text-lg font-medium text-slate-300 mb-1">No classes yet</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                You are not enrolled in any class. Your institution admin will enroll you after
                registration is approved.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AnimatedPage>
  )
}

export default StudentPortalPage
