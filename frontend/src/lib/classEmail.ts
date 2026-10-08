import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'

export type ClassEmailStudent = {
  id?: string
  name?: string | null
  email?: string | null
}

/** Last successful class broadcast — allows one Resend. */
export type ClassEmailSendRecord = {
  subject: string
  message: string
  sentAt: string
  /** True after the one allowed resend has been used. */
  resendUsed: boolean
}

const classEmailSendStorageKey = (classId: string) => `brce:classEmailSend:${classId}`

export function loadClassEmailSendRecord(classId: string): ClassEmailSendRecord | null {
  if (!classId || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(classEmailSendStorageKey(classId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ClassEmailSendRecord
    if (!parsed?.subject || !parsed?.message) return null
    return {
      subject: String(parsed.subject),
      message: String(parsed.message),
      sentAt: String(parsed.sentAt || ''),
      resendUsed: Boolean(parsed.resendUsed),
    }
  } catch {
    return null
  }
}

export function saveClassEmailSendRecord(classId: string, record: ClassEmailSendRecord) {
  if (!classId || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(classEmailSendStorageKey(classId), JSON.stringify(record))
  } catch {
    // ignore quota / private mode
  }
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

/** Full plain message students see in inbox (Resend sends this as-is). */
export function buildDefaultClassEmailMessage(classData: ClassEmailContext) {
  const endDate = formatDate(classData.end_date)
  const className = classData.name || 'this class'
  return [
    `The course you registered for (${className}) opens on ${endDate}.`,
    ``,
    `Please be ready. If you have questions, reply to this email.`,
    ``,
    `Thank you.`,
  ].join('\n')
}

/**
 * Exact message from the Message input.
 * Optional tokens like {name}, {class}, {end_date} are replaced only if written.
 * Nothing is auto-prepended (no “Hello …”).
 */
export function applyClassEmailTemplate(
  template: string,
  student: ClassEmailStudent,
  classData: ClassEmailContext,
) {
  const studentName = String(student.name || 'Student').trim()
  const map: Record<string, string> = {
    name: studentName,
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

/** Resolve a public domain for the class email website link. */
export function resolveInstitutionDomain(opts: {
  website?: string | null
  subdomain?: string | null
  customDomain?: string | null
}): string {
  const custom = String(opts.customDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
  if (custom) return custom.replace(/^www\./i, '')

  const website = String(opts.website || '').trim()
  if (website) {
    try {
      const url = new URL(website.includes('://') ? website : `https://${website}`)
      return url.hostname.replace(/^www\./i, '')
    } catch {
      return website.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '')
    }
  }

  const subdomain = String(opts.subdomain || '').trim()
  const root = String(import.meta.env.VITE_APP_ROOT_DOMAIN || '').trim()
  if (subdomain && root) return `${subdomain}.${root}`

  if (typeof window !== 'undefined' && window.location?.hostname) {
    return window.location.hostname
  }
  return ''
}

/** A few at a time — faster than one-by-one, without flooding Resend. */
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

async function readInvokePayload(data: unknown, error: unknown): Promise<Record<string, unknown> | null> {
  let payload = data
  if (error && typeof error === 'object' && error !== null && 'context' in error) {
    try {
      const ctx = (error as { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } })
        .context
      if (ctx && typeof ctx.json === 'function') payload = await ctx.json()
      else if (ctx && typeof ctx.text === 'function') {
        const text = await ctx.text()
        payload = text ? JSON.parse(text) : null
      }
    } catch {
      /* keep */
    }
  }
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
}

function friendlySendError(code: string): string {
  const c = String(code || '').trim()
  if (c === 'RESEND_NOT_CONFIGURED' || c === 'SERVER_MISCONFIGURED') {
    return 'Email is not configured on the server (Resend).'
  }
  if (c === 'RECIPIENT_NOT_STUDENT') return 'Recipient is not a student in this institution.'
  if (c === 'NOT_ENROLLED') return 'Student is not enrolled in this class.'
  if (c === 'UNAUTHORIZED' || c === 'FORBIDDEN') return 'You are not allowed to send class emails.'
  if (c === 'INVALID_TO') return 'Invalid recipient email.'
  if (/Failed to send a request to the Edge Function/i.test(c)) {
    return 'Could not reach email server. Refresh the page, stay logged in, then try again.'
  }
  return c || 'Send failed'
}

/** Fresh access token — required for send-class-email (verify_jwt). */
async function getAccessTokenForFunctions(): Promise<string> {
  let {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Must be logged in to send class emails')

  const expiresAtMs = Number(session.expires_at || 0) * 1000
  const needsRefresh = !expiresAtMs || expiresAtMs - Date.now() < 120_000
  if (needsRefresh) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
    if (!refreshErr && refreshed.session?.access_token) {
      session = refreshed.session
    }
  }
  if (!session?.access_token) throw new Error('Must be logged in to send class emails')
  return session.access_token
}

/** One Resend email via the send-class-email edge function (no EmailJS / Gmail OAuth). */
async function sendClassNotificationViaResend(params: {
  classId: string
  toEmail: string
  toName: string
  subject: string
  message: string
  className?: string
  institutionName?: string
  institutionEmail?: string
  domainName?: string
  accessToken: string
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const toEmail = String(params.toEmail || '').trim().toLowerCase()
  if (!toEmail.includes('@')) return { ok: false, error: 'Recipient email is missing' }

  try {
    const { data, error } = await supabase.functions.invoke('send-class-email', {
      headers: { Authorization: `Bearer ${params.accessToken}` },
      body: {
        to: toEmail,
        to_name: String(params.toName || 'Student').trim(),
        subject: params.subject,
        message: params.message,
        class_id: params.classId,
        reply_to: params.institutionEmail || undefined,
        from_name: params.institutionName || undefined,
        institution_name: params.institutionName || undefined,
        class_name: params.className || undefined,
        domain_name: params.domainName || undefined,
      },
    })

    const payload = await readInvokePayload(data, error)
    if (error || payload?.ok === false || payload?.error) {
      const code = String(payload?.error || (error as { message?: string })?.message || 'Send failed')
      return { ok: false, error: friendlySendError(code) }
    }
    return { ok: true }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: string }).message || 'Send failed')
        : 'Send failed'
    return { ok: false, error: message }
  }
}

/**
 * One Resend email per student (HTML template on the server).
 * The same address is never mailed twice.
 * A single inbox copy goes to the sender when that address is not already a student.
 * Reply-To is always the institution email when provided.
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
  domainName?: string | null
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

  const accessToken = await getAccessTokenForFunctions()

  const copyTo = String(opts.copyToEmail || '').trim().toLowerCase()
  const institutionName = String(opts.institutionName || '').trim() || 'Training Center'
  const institutionEmail = String(opts.institutionEmail || opts.copyToEmail || '').trim()
  const domainName = String(opts.domainName || '').trim()
  const className = String(opts.classData.name || '').trim()

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

  const sendOne = async (toEmail: string, toName: string, message: string) => {
    return sendClassNotificationViaResend({
      classId: opts.classId,
      toEmail,
      toName,
      subject,
      message,
      className,
      institutionName,
      institutionEmail,
      domainName,
      accessToken,
    })
  }

  let copyOk = false
  const copyPromise = (async () => {
    if (!copyTo.includes('@') || seen.has(copyTo)) return false
    const previewStudent = recipients[0] || { name: 'Admin' }
    const previewMessage = applyClassEmailTemplate(template, previewStudent, opts.classData)
    const copyResult = await sendOne(copyTo, 'Admin', previewMessage)
    if (!copyResult.ok && copyResult.error) errors.push(`Inbox: ${copyResult.error}`)
    return copyResult.ok
  })()

  const results = await mapPool(recipients, 2, async (student) => {
    const toEmail = String(student.email || '').trim().toLowerCase()
    const toName = String(student.name || 'Student').trim()
    const message = applyClassEmailTemplate(template, student, opts.classData)
    const result = await sendOne(toEmail, toName, message)
    done += 1
    opts.onProgress?.(done, total)
    if (result.ok) return { ok: true as const }
    return { ok: false as const, error: `${toName}: ${result.error || 'failed'}` }
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
