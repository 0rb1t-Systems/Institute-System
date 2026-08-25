import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  ShieldCheck,
  Search,
  Loader2,
  User,
  CheckCircle2,
  XCircle,
  Award,
  BookOpen,
  BadgeCheck,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { verifyStudentProfile } from '@/lib/api'
import { MESSAGES } from '@/lib/messages'
import { cn } from '@/lib/utils'

const academicStatusTone = (status?: string) => {
  const s = String(status || '').toLowerCase()
  if (s === 'completed') return 'bg-emerald-600/25 text-emerald-300 border-emerald-500/40'
  if (s === 'enrolled' || s === 'verified') return 'bg-sky-600/20 text-sky-300 border-sky-500/40'
  if (s === 'inactive') return 'bg-amber-600/20 text-amber-300 border-amber-500/40'
  return 'bg-slate-700/50 text-slate-300 border-slate-600/50'
}

type Props = {
  /** When set, lookup is limited to that tenant. When omitted, any institution on the platform. */
  tenantSlug?: string | null
  tenantName?: string | null
  accent?: string
  prefillId?: string
  variant?: 'platform' | 'portal'
}

export default function StudentIdentityVerify({
  tenantSlug = '',
  tenantName = '',
  accent,
  prefillId = '',
  variant = 'portal',
}: Props) {
  const isPlatform = variant === 'platform' || !String(tenantSlug || '').trim()
  const brand = accent || (isPlatform ? '#14b8a6' : '#2563eb')

  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [student, setStudent] = useState<any>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: { studentId: prefillId },
  })

  const runVerify = async (studentId: string) => {
    setIsLoading(true)
    setStatus('idle')
    setStudent(null)
    try {
      const result: any = await verifyStudentProfile(studentId, isPlatform ? '' : tenantSlug)
      const studentData = result?.data || (result?.name ? result : null)
      if (result?.valid && studentData) {
        setStudent(studentData)
        setStatus('success')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setIsLoading(false)
      setIsOpen(true)
    }
  }

  useEffect(() => {
    if (!prefillId) return
    setValue('studentId', prefillId)
    void runVerify(prefillId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillId])

  const institutionName = student?.institution_name || tenantName || 'Training Center'
  const logoUrl = student?.institution_logo_url || null
  const recordAccent = student?.theme_primary || brand
  const programLabel = student?.program_name || student?.class_name || '—'
  const academicStatus = student?.academic_status || 'Verified'
  const initials =
    String(student?.name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'ST'

  return (
    <div className="w-full max-w-lg mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto border shadow-lg"
          style={{
            backgroundColor: `${brand}18`,
            borderColor: `${brand}40`,
            boxShadow: `0 10px 30px ${brand}22`,
          }}
        >
          <ShieldCheck className="h-8 w-8" style={{ color: brand }} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Verify Identity</h2>
          <p className="text-slate-400 mt-2 text-sm">
            {isPlatform
              ? 'Enter a Student ID to confirm the official academic record at any institution on TvetFlow.'
              : `Enter a Student ID to confirm the official academic record${tenantName ? ` at ${tenantName}` : ''}.`}
          </p>
        </div>
      </div>

      <Card className="shadow-2xl border-slate-800 bg-[#0c1628]/80 sm:bg-slate-900 overflow-hidden">
        <div className="h-1 w-full" style={{ backgroundColor: brand }} />
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-white">Student Verification</CardTitle>
          <CardDescription className="text-slate-400">
            {isPlatform
              ? 'Secure check against the platform registry'
              : 'Secure check against the institution registry'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((data) => runVerify(String(data.studentId || '').trim()))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="studentId" className="sr-only">
                Student ID
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="studentId"
                  placeholder="e.g. BRCE01106"
                  className="pl-9 h-11 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600"
                  style={{ ['--tw-ring-color' as string]: brand }}
                  {...register('studentId', { required: MESSAGES.VALIDATION.STUDENT_ID })}
                />
              </div>
              {errors.studentId && (
                <p className="text-xs text-red-400">{String(errors.studentId.message || '')}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-white shadow-lg transition-all hover:opacity-90"
              style={{ backgroundColor: brand }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" /> Verify Now
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-[#121826] border-slate-800 text-slate-100 gap-0">
          {status === 'success' && student ? (
            <div className="flex flex-col">
              <div className="h-1 w-full" style={{ backgroundColor: recordAccent }} />

              <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Award className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">Official Record</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2">{institutionName}</p>
                  </div>
                </div>
                <div className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verified Credential
                </div>
              </div>

              <div className="px-5 pb-5 flex items-center gap-4">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 border-2 border-slate-700 shadow-lg">
                    <AvatarImage src={student.avatar_url || undefined} alt="" />
                    <AvatarFallback className="bg-slate-800 text-slate-300 text-xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-amber-400 border-2 border-[#121826] flex items-center justify-center">
                    <BadgeCheck className="h-3.5 w-3.5 text-slate-900" />
                  </span>
                </div>
                <div className="min-w-0 text-left space-y-2">
                  <h3 className="text-xl font-bold text-white leading-tight truncate">{student.name}</h3>
                  <span className="inline-flex items-center rounded-full bg-slate-800 border border-slate-700 px-3 py-1 font-mono text-sm text-white tracking-wide">
                    {student.student_code}
                  </span>
                </div>
              </div>

              <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 text-left sm:col-span-2">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 className="h-3.5 w-3.5" style={{ color: recordAccent }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Institution</p>
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug">{institutionName}</p>
                </div>
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 text-left">
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Program / Course
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug">{programLabel}</p>
                </div>
                <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Academic Status
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                      academicStatusTone(academicStatus),
                    )}
                  >
                    {academicStatus}
                  </span>
                </div>
              </div>

              <p className="px-5 pb-5 text-center text-[11px] leading-relaxed text-slate-500">
                This verification confirms the authenticity of the student&apos;s academic record at {institutionName}.
              </p>

              <div className="px-5 pb-5">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="w-full border-slate-700 hover:bg-slate-800 text-slate-200"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-8 text-center space-y-4">
              <XCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-xl font-bold text-white">Not Verified</h3>
                <p className="text-slate-400 mt-2 text-sm">{MESSAGES.DOMAIN.STUDENT_NOT_FOUND}</p>
                <p className="text-sm mt-1 text-slate-500">Please check the ID and try again.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="w-full border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
