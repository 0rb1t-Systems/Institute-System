import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, User, DollarSign, GraduationCap, ClipboardCheck } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

function enrollmentBadge(status) {
  switch (status) {
    case 'active':
      return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'completed':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'dropped':
    case 'withdrawn':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
}

/**
 * Read-only class card for the student portal (no suspend / admin actions).
 */
const ClassDetailsCard = ({ classData, enrollment, payments = [], results = [] }) => {
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const averageGrade =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / results.length)
      : null

  const enrolledAt = enrollment?.enrollment_date || enrollment?.created_at
  let enrolledLabel = '—'
  try {
    if (enrolledAt) enrolledLabel = format(new Date(enrolledAt), 'MMM d, yyyy')
  } catch {
    enrolledLabel = '—'
  }

  const statusLabel = String(enrollment?.status || 'enrolled').replace(/_/g, ' ')

  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors overflow-hidden">
      <CardContent className="p-0">
        <div className="p-5 space-y-4">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">{classData.name}</h3>
              <p className="text-sm text-slate-400 truncate mt-0.5">
                {classData.course?.name || classData.diploma?.name || 'Program'}
              </p>
            </div>
            <Badge variant="outline" className={`shrink-0 capitalize ${enrollmentBadge(enrollment?.status)}`}>
              {statusLabel}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Instructor</span>
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="truncate">
                  {classData.instructor?.name ||
                    classData.instructor?.full_name ||
                    classData.instructorName ||
                    'Unassigned'}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Enrolled</span>
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>{enrolledLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
            <div className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-sm text-slate-200">{formatCurrency(totalPaid)} paid</span>
            </div>
            {averageGrade !== null && (
              <div className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-sm text-slate-200">{averageGrade}% avg</span>
              </div>
            )}
            <div className="flex-1" />
            <Button asChild variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-white px-2">
              <Link to="/portal/finance">
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Finance
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 text-slate-400 hover:text-white px-2">
              <Link to="/portal/attendance">
                <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Attendance
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ClassDetailsCard
