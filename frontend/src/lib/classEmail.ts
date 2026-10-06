import { sendEmailJsMessage } from '@/lib/emailjs'
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

async function sendViaResend(params: {
  to: string
  subject: string
  message: string
  classId?: string
  bcc?: string[]
  replyTo?: string
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('send-class-email', {
    body: {
      to: params.to,
      subject: params.subject,
      message: params.message,
      class_id: params.classId || undefined,
      bcc: params.bcc || [],
      reply_to: params.replyTo || undefined,
    },
  })

  if (error) return { ok: false, error: error.message || 'Resend invoke failed' }
  if (data?.ok === false || data?.error) {
    return { ok: false, error: String(data.error || 'Resend send failed') }
  }
  return { ok: true }
}

/**
 * EmailJS first; if EmailJS returns ok:false (or skipped), fall back to Resend.
 * Always attempts to place a copy in the sender inbox.
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
  const institutionName = String(opts.institutionName || 'Training Center').trim()

  const recipients = opts.students.filter((s) => {
    const email = String(s.email || '').trim().toLowerCase()
    return email.includes('@')
  })
  const skipped = opts.students.length - recipients.length

  let sent = 0
  let failed = 0
  let viaEmailJs = 0
  let viaResend = 0
  const errors: string[] = []

  for (const student of recipients) {
    const toEmail = String(student.email || '').trim().toLowerCase()
    const toName = String(student.name || 'Student').trim()
    const message = applyClassEmailTemplate(template, student, opts.classData)

    const emailJs = await sendEmailJsMessage({
      toEmail,
      toName,
      subject,
      message,
      institutionName,
      replyTo,
      bccEmail: copyTo || undefined,
    })

    if (emailJs.ok) {
      sent += 1
      viaEmailJs += 1
      continue
    }

    const resend = await sendViaResend({
      to: toEmail,
      subject,
      message,
      classId: opts.classId,
      bcc: copyTo ? [copyTo] : [],
      replyTo,
    })

    if (resend.ok) {
      sent += 1
      viaResend += 1
    } else {
      failed += 1
      errors.push(`${toName}: ${resend.error || emailJs.error || 'failed'}`)
    }
  }

  // Guaranteed inbox copy for the sender (same body, first student placeholders or class-level)
  let copyOk = false
  if (copyTo.includes('@')) {
    const previewStudent = recipients[0] || { name: 'Admin' }
    const previewMessage = [
      `COPY — emailed to ${sent} student(s) in class "${opts.classData.name || ''}".`,
      ``,
      applyClassEmailTemplate(template, previewStudent, opts.classData),
    ].join('\n')

    const copyJs = await sendEmailJsMessage({
      toEmail: copyTo,
      toName: 'Admin',
      subject: `[Copy] ${subject}`,
      message: previewMessage,
      institutionName,
      replyTo,
    })

    if (copyJs.ok) {
      copyOk = true
    } else {
      const copyResend = await sendViaResend({
        to: copyTo,
        subject: `[Copy] ${subject}`,
        message: previewMessage,
        replyTo,
      })
      copyOk = copyResend.ok
      if (!copyResend.ok && copyResend.error) {
        errors.push(`Inbox copy: ${copyResend.error}`)
      }
    }
  }

  return { sent, failed, skipped, viaEmailJs, viaResend, copyOk, errors }
}
