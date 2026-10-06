import { supabase } from '@/lib/supabaseClient'
import { formatDate } from '@/lib/utils'

export type ClassEmailStudent = {
  id?: string
  name?: string | null
  email?: string | null
}

export type ClassEmailContext = {
  name?: string | null
  displayProgram?: string | null
  instructorName?: string | null
  start_date?: string | null
  end_date?: string | null
  duration_months?: number | string | null
  fee?: number | null
}

export function buildDefaultClassEmailMessage(classData: ClassEmailContext) {
  const endDate = formatDate(classData.end_date)
  const className = classData.name || 'this class'
  return [
    `Hello {name},`,
    ``,
    `The course you registered for (${className}) opens on ${endDate}.`,
    ``,
    `Please be ready. If you have questions, reply to this email.`,
    ``,
    `Thank you.`,
  ].join('\n')
}

export function applyClassEmailTemplate(
  template: string,
  student: ClassEmailStudent,
  classData: ClassEmailContext,
) {
  const map: Record<string, string> = {
    name: String(student.name || 'Student').trim(),
    class: String(classData.name || '').trim(),
    program: String(classData.displayProgram || '').trim(),
    instructor: String(classData.instructorName || 'Unassigned').trim(),
    start_date: formatDate(classData.start_date),
    end_date: formatDate(classData.end_date),
    duration: classData.duration_months != null ? String(classData.duration_months) : '',
  }

  return String(template || '').replace(/\{([a-z_]+)\}/gi, (_full, key: string) => {
    const k = String(key || '').toLowerCase()
    return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : `{${key}}`
  })
}

/** A few at a time — faster than one-by-one, without flooding the provider. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

async function sendViaResend(params: {
  to: string
  subject: string
  message: string
  classId?: string
  bcc?: string[]
  replyTo?: string
  fromName?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('send-class-email', {
    body: {
      to: params.to,
      subject: params.subject,
      message: params.message,
      class_id: params.classId || undefined,
      bcc: params.bcc || [],
      reply_to: params.replyTo || undefined,
      from_name: params.fromName || undefined,
    },
  })

  if (error) return { ok: false, error: error.message || 'Resend invoke failed' }
  if (data?.ok === false || data?.error) {
    return { ok: false, error: String(data.error || 'Resend send failed') }
  }
  return { ok: true }
}

/**
 * One Resend email per student. The same address is never mailed twice.
 * A single inbox copy goes to the sender, and only if that address is not already a student.
 */
export async function sendClassStudentEmails(opts: {
  classId: string
  classData: ClassEmailContext
  students: ClassEmailStudent[]
  subject: string
  messageTemplate: string
  copyToEmail?: string | null
  institutionName?: string | null
  institutionEmail?: string | null
  onProgress?: (done: number, total: number) => void
}): Promise<{
  sent: number
  failed: number
  skipped: number
  viaEmailJs: number
  viaResend: number
  copyOk: boolean
  errors: string[]
}> {
  const subject = String(opts.subject || '').trim()
  const template = String(opts.messageTemplate || '').trim()
  if (!subject) throw new Error('Subject is required')
  if (!template) throw new Error('Message is required')

  const copyTo = String(opts.copyToEmail || '').trim().toLowerCase()
  const replyTo = String(opts.institutionEmail || opts.copyToEmail || '').trim()

  const seen = new Set<string>()
  const recipients: ClassEmailStudent[] = []
  for (const student of opts.students) {
    const email = String(student.email || '').trim().toLowerCase()
    if (!email.includes('@') || seen.has(email)) continue
    seen.add(email)
    recipients.push({ ...student, email })
  }
  const skipped = opts.students.length - recipients.length

  let sent = 0
  let failed = 0
  const errors: string[] = []
  let done = 0
  const total = recipients.length

  const fromName = String(opts.institutionName || '').trim() || null

  let copyOk = false
  const copyPromise = (async () => {
    if (!copyTo.includes('@') || seen.has(copyTo)) return false
    const previewStudent = recipients[0] || { name: 'Admin' }
    const previewMessage = applyClassEmailTemplate(template, previewStudent, opts.classData)
    const copyResend = await sendViaResend({
      to: copyTo,
      subject,
      message: previewMessage,
      replyTo,
      fromName,
    })
    if (!copyResend.ok && copyResend.error) errors.push(`Inbox: ${copyResend.error}`)
    return copyResend.ok
  })()

  const results = await mapPool(recipients, 4, async (student) => {
    const toEmail = String(student.email || '').trim().toLowerCase()
    const toName = String(student.name || 'Student').trim()
    const message = applyClassEmailTemplate(template, student, opts.classData)
    const resend = await sendViaResend({
      to: toEmail,
      subject,
      message,
      classId: opts.classId,
      replyTo,
      fromName,
    })
    done += 1
    opts.onProgress?.(done, total)
    if (resend.ok) return { ok: true as const }
    return { ok: false as const, error: `${toName}: ${resend.error || 'failed'}` }
  })

  for (const result of results) {
    if (result.ok) sent += 1
    else {
      failed += 1
      errors.push(result.error)
    }
  }

  copyOk = await copyPromise
  return { sent, failed, skipped, viaEmailJs: 0, viaResend: sent, copyOk, errors }
}
