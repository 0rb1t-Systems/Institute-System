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
import { studentIdVerifyPlaceholder } from '@/lib/institution'
import { cn } from '@/lib/utils'
import { usePlatformTheme } from '@/contexts/PlatformThemeContext'

const academicStatusTone = (status?: string, platform?: boolean, light?: boolean) => {
  const s = String(status || '').toLowerCase()
  if (s === 'completed') {
    if (platform) return 'bg-teal-500/15 text-teal-600 border-teal-500/35'
    return light
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-emerald-600/25 text-emerald-300 border-emerald-500/40'
  }
  if (s === 'enrolled' || s === 'verified') {
    if (platform) return 'bg-teal-500/12 text-[var(--pf-text)] border-teal-500/30'
    return light
      ? 'bg-sky-50 text-sky-800 border-sky-200'
      : 'bg-sky-600/20 text-sky-300 border-sky-500/40'
  }
  if (s === 'inactive') {
    return light || platform
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-amber-600/20 text-amber-300 border-amber-500/40'
  }
  if (platform) return 'bg-[var(--pf-hover)] text-[var(--pf-muted)] border-[var(--pf-line)]'
  return light
    ? 'bg-slate-100 text-slate-700 border-slate-200'
    : 'bg-slate-700/50 text-slate-300 border-slate-600/50'
}

type Props = {
  /** When set, lookup is limited to that tenant. When omitted, any institution on the platform. */
  tenantSlug?: string | null
  tenantName?: string | null
  /** Institution branding used to build the Student ID placeholder example. */
  institution?: {
    name?: string | null
    student_id_prefix?: string | null
    student_id_start?: number | null
    student_id_pad?: number | null
  } | null
  accent?: string
  prefillId?: string
  variant?: 'platform' | 'portal'
}

export default function StudentIdentityVerify({
  tenantSlug = '',
  tenantName = '',
  institution = null,
  accent,
  prefillId = '',
  variant = 'portal',
}: Props) {
  const isPlatform = variant === 'platform' || !String(tenantSlug || '').trim()
  const { mode } = usePlatformTheme()
  const light = !isPlatform && mode === 'light'
  const brand = accent || (isPlatform ? '#14b8a6' : '#2563eb')
  const titleCls = isPlatform ? 'text-[var(--pf-text)]' : light ? 'text-slate-900' : 'text-white'
  const mutedCls = isPlatform ? 'text-[var(--pf-muted)]' : light ? 'text-slate-500' : 'text-slate-400'
  const faintCls = isPlatform ? 'text-[var(--pf-faint)]' : light ? 'text-slate-400' : 'text-slate-500'
  const panelCls = isPlatform
    ? 'border-[var(--pf-line)] bg-[var(--pf-bg)]'
    : light
      ? 'border-slate-200 bg-slate-50'
      : 'border-slate-800 bg-slate-900/80'
  const outlineBtnCls = isPlatform
    ? 'w-full border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]'
    : light
      ? 'w-full border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
      : 'w-full border-slate-700 text-slate-200 hover:bg-slate-800'

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
  const recordAccent = isPlatform ? brand : student?.theme_primary || brand
  const programLabel = student?.program_name || student?.class_name || '—'
  const academicStatus = student?.academic_status || 'Verified'
  const idPlaceholder = studentIdVerifyPlaceholder(
    isPlatform
      ? null
      : institution || (tenantName ? { name: tenantName } : null),
  )
  const initials =
    String(student?.name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'ST'

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      <div className="space-y-4 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border shadow-lg"
          style={{
            backgroundColor: `${brand}18`,
            borderColor: `${brand}40`,
            boxShadow: `0 10px 30px ${brand}22`,
          }}
        >
          <ShieldCheck className="h-8 w-8" style={{ color: brand }} />
        </div>
        <div>
          <h2 className={cn('font-display text-2xl font-bold', titleCls)}>Verify Identity</h2>
          <p className={cn('mt-2 text-sm', mutedCls)}>
            {isPlatform
              ? 'Enter a Student ID to confirm the official academic record at any institution on TvetFlow.'
              : `Enter a Student ID to confirm the official academic record${tenantName ? ` at ${tenantName}` : ''}.`}
          </p>
        </div>
      </div>

      <Card
        className={cn(
          'overflow-hidden shadow-2xl',
          isPlatform
            ? 'border-[var(--pf-line)] bg-[var(--pf-bg)]'
            : light
              ? 'border-slate-200 bg-white'
              : 'border-slate-800 bg-[#0c1628]/80 sm:bg-slate-900',
        )}
      >
        <div className="h-1 w-full" style={{ backgroundColor: brand }} />
        <CardHeader className="pb-2 text-center">
          <CardTitle className={titleCls}>Student Verification</CardTitle>
          <CardDescription className={mutedCls}>
            {isPlatform ? 'Secure check against TvetFlow records' : 'Secure check against the institution registry'}
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
                <User
                  className={cn(
                    'absolute left-3 top-3 h-4 w-4',
                    isPlatform ? 'text-teal-600' : light ? 'text-slate-400' : 'text-slate-500',
                  )}
                />
                <Input
                  id="studentId"
                  placeholder={idPlaceholder}
                  className={cn(
                    'h-11 pl-9',
                    isPlatform
                      ? 'border-teal-500/45 bg-[var(--pf-bg-2)] text-[var(--pf-text)] placeholder:text-[var(--pf-faint)] shadow-[0_0_0_1px_rgba(20,184,166,0.12)] focus-visible:ring-teal-500'
                      : light
                        ? 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
                        : 'border-slate-800 bg-slate-950 text-white placeholder:text-slate-600',
                  )}
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
              className={cn(
                'h-11 w-full shadow-lg transition-all hover:opacity-90',
                isPlatform ? 'bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)]' : 'text-white',
              )}
              style={isPlatform ? undefined : { backgroundColor: brand }}
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
        <DialogContent
          className={cn(
            'gap-0 overflow-hidden p-0 sm:max-w-lg',
            isPlatform
              ? 'border-[var(--pf-line)] bg-[var(--pf-surface)] text-[var(--pf-text)]'
              : light
                ? 'border-slate-200 bg-white text-slate-900'
                : 'border-slate-800 bg-[#121826] text-slate-100',
          )}
        >
          {status === 'success' && student ? (
            <div className="flex flex-col">
              <div className="h-1 w-full" style={{ backgroundColor: recordAccent }} />

              <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border',
                      panelCls,
                    )}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Award className={cn('h-5 w-5', isPlatform ? 'text-teal-600' : light ? 'text-slate-500' : 'text-slate-300')} />
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className={cn('text-[11px] font-bold uppercase tracking-[0.14em]', titleCls)}>
                      Official Record
                    </p>
                    <p className={cn('mt-0.5 line-clamp-2 text-xs leading-snug', mutedCls)}>
                      {institutionName}
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide',
                    isPlatform
                      ? 'border-teal-500/40 text-teal-600'
                      : light
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-emerald-500/50 text-emerald-400',
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verified Credential
                </div>
              </div>

              <div className="flex items-center gap-4 px-5 pb-5">
                <div className="relative shrink-0">
                  <Avatar
                    className={cn(
                      'h-20 w-20 border-2 shadow-lg',
                      isPlatform ? 'border-[var(--pf-line)]' : light ? 'border-slate-200' : 'border-slate-700',
                    )}
                  >
                    <AvatarImage src={student.avatar_url || undefined} alt="" />
                    <AvatarFallback
                      className={cn(
                        'text-xl font-bold',
                        isPlatform
                          ? 'bg-[var(--pf-bg)] text-[var(--pf-text)]'
                          : light
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-slate-800 text-slate-300',
                      )}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2',
                      isPlatform
                        ? 'border-[var(--pf-surface)] bg-teal-500'
                        : light
                          ? 'border-white bg-amber-400'
                          : 'border-[#121826] bg-amber-400',
                    )}
                  >
                    <BadgeCheck className={cn('h-3.5 w-3.5', isPlatform ? 'text-[#04201c]' : 'text-slate-900')} />
                  </span>
                </div>
                <div className="min-w-0 space-y-2 text-left">
                  <h3 className={cn('truncate text-xl font-bold leading-tight', titleCls)}>{student.name}</h3>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 font-mono text-sm tracking-wide',
                      isPlatform
                        ? 'border-[var(--pf-line)] bg-[var(--pf-bg)] text-[var(--pf-text)]'
                        : light
                          ? 'border-slate-200 bg-slate-50 text-slate-900'
                          : 'border-slate-700 bg-slate-800 text-white',
                    )}
                  >
                    {student.student_code}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2">
                <div className={cn('rounded-xl border p-3.5 text-left sm:col-span-2', panelCls)}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" style={{ color: recordAccent }} />
                    <p className={cn('text-[10px] font-semibold uppercase tracking-wider', faintCls)}>Institution</p>
                  </div>
                  <p className={cn('text-sm font-semibold leading-snug', titleCls)}>{institutionName}</p>
                </div>
                <div className={cn('rounded-xl border p-3.5 text-left', panelCls)}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <BookOpen className={cn('h-3.5 w-3.5', isPlatform ? 'text-teal-600' : light ? 'text-sky-600' : 'text-sky-400')} />
                    <p className={cn('text-[10px] font-semibold uppercase tracking-wider', faintCls)}>
                      Program / Course
                    </p>
                  </div>
                  <p className={cn('text-sm font-semibold leading-snug', titleCls)}>{programLabel}</p>
                </div>
                <div className={cn('rounded-xl border p-3.5 text-left', panelCls)}>
                  <p className={cn('mb-2 text-[10px] font-semibold uppercase tracking-wider', faintCls)}>
                    Academic Status
                  </p>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                      academicStatusTone(academicStatus, isPlatform, light),
                    )}
                  >
                    {academicStatus}
                  </span>
                </div>
              </div>

              <p className={cn('px-5 pb-5 text-center text-[11px] leading-relaxed', faintCls)}>
                This verification confirms the authenticity of the student&apos;s academic record at {institutionName}.
              </p>

              <div className="px-5 pb-5">
                <Button variant="outline" onClick={() => setIsOpen(false)} className={outlineBtnCls}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-5 py-8 text-center">
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
              <div>
                <h3 className={cn('text-xl font-bold', titleCls)}>Not Verified</h3>
                <p className={cn('mt-2 text-sm', mutedCls)}>{MESSAGES.DOMAIN.STUDENT_NOT_FOUND}</p>
                <p className={cn('mt-1 text-sm', faintCls)}>Please check the ID and try again.</p>
              </div>
              <Button variant="outline" onClick={() => setIsOpen(false)} className={outlineBtnCls}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
