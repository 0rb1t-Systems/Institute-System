/**
 * EmailJS helpers (no custom domain required).
 *
 * Welcome template placeholders:
 *   {{to_email}} {{to_name}} {{full_name}} {{role}} {{login_email}}
 *   {{temporary_password}} {{login_url}} {{institution_name}}
 *   {{company_email}} {{subject}} {{welcome_message}} {{reply_to}}
 *
 * Class notification template (VITE_EMAILJS_CLASS_TEMPLATE_ID):
 *   {{email}} {{name}} {{subject}} {{message}} {{class_name}}
 *   {{institution_name}} {{domain_name}} {{reply_to}} {{from_name}}
 *
 * Tip: EmailJS Subject → {{subject}}, To Email → {{email}}, Reply To → {{reply_to}}.
 * From Name → {{from_name}}. Body: <div style="white-space:pre-wrap">{{message}}</div>
 * From address = the Gmail/Outlook connected to the EmailJS service (institution inbox).
 */
import emailjs from '@emailjs/browser'

export type WelcomeEmailParams = {
  fullName: string
  role: string
  email: string
  password: string
  institutionName?: string
  institutionEmail?: string
  loginUrl?: string
}

export type ClassNotificationEmailParams = {
  toEmail: string
  toName: string
  subject: string
  /** Personalized plain-text body (user-written, any language). */
  message: string
  className?: string
  institutionName?: string
  /** Always reply / appear as the institution. */
  institutionEmail?: string
  domainName?: string
}

function getConfig() {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  if (!serviceId || !templateId || !publicKey) {
    return {
      ok: false as const,
      error:
        'EmailJS is not configured. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY.',
    }
  }
  return { ok: true as const, serviceId, templateId, publicKey }
}

function getClassTemplateConfig() {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId =
    import.meta.env.VITE_EMAILJS_CLASS_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  if (!serviceId || !templateId || !publicKey) {
    return {
      ok: false as const,
      error:
        'EmailJS class template is not configured. Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_CLASS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY.',
    }
  }
  return { ok: true as const, serviceId, templateId, publicKey }
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Optional HTML form of the message (for templates that use {{{message_html}}}). */
export function plainMessageToHtml(message: string) {
  const escaped = escapeHtml(message).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 14px;">${block.replace(/\n/g, '<br>')}</p>`)
  return paragraphs.join('') || `<p style="margin:0;">${escaped}</p>`
}

function roleLabel(role: string) {
  const r = String(role || '').toLowerCase()
  if (r === 'admin') return 'Admin'
  if (r === 'staff') return 'Staff'
  if (r === 'instructor') return 'Instructor'
  if (r === 'affiliate') return 'Affiliate'
  if (r === 'student') return 'Student'
  return role || 'User'
}

/** Keep copy calm and transactional — fewer spam-filter triggers. */
function buildWelcomeCopy(params: WelcomeEmailParams) {
  const loginUrl =
    params.loginUrl ||
    (typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login')
  const institution = (params.institutionName || 'Training Center').trim()
  const role = roleLabel(params.role)
  const fullName = (params.fullName || 'there').trim()

  // Short subject, no em-dash / "Welcome to" promo tone
  const subject = `${institution} account details`

  const welcome_message = [
    `Hi ${fullName},`,
    ``,
    `Your ${role.toLowerCase()} account at ${institution} has been created.`,
    ``,
    `Email: ${params.email}`,
    `Password: ${params.password}`,
    `Login: ${loginUrl}`,
    ``,
    `After you sign in, please change your password.`,
    ``,
    `${institution}`,
  ].join('\n')

  const replyTo = (params.institutionEmail || '').trim()

  return { loginUrl, institution, role, fullName, subject, welcome_message, replyTo }
}

/**
 * Sends a personalized welcome email once after successful user creation.
 * Does not throw — returns { ok, error? } so the caller can keep the user record.
 */
export async function sendWelcomeEmail(
  params: WelcomeEmailParams,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const cfg = getConfig()
  if (!cfg.ok) {
    console.error('[emailjs]', cfg.error)
    return { ok: false, skipped: true, error: cfg.error }
  }

  const copy = buildWelcomeCopy(params)

  const templateParams = {
    to_email: params.email,
    subject: copy.subject,
    to_name: copy.fullName,
    full_name: copy.fullName,
    role: copy.role,
    login_email: params.email,
    temporary_password: params.password,
    login_url: copy.loginUrl,
    institution_name: copy.institution,
    company_name: copy.institution,
    // Avoid fake domains like example.com (spam signal)
    company_email: copy.replyTo || copy.institution,
    reply_to: copy.replyTo || params.email,
    welcome_message: copy.welcome_message,
    email: params.email,
    name: copy.fullName,
    password: params.password,
    message: copy.welcome_message,
  }

  try {
    await emailjs.send(cfg.serviceId, cfg.templateId, templateParams, {
      publicKey: cfg.publicKey,
    })
    return { ok: true }
  } catch (err) {
    const error =
      err?.text ||
      err?.message ||
      (typeof err === 'string' ? err : 'EmailJS send failed')
    console.error('[emailjs] welcome email failed', error)
    return { ok: false, error: String(error) }
  }
}

/**
 * Generic EmailJS send for non-welcome messages (e.g. payment reminders).
 */
export async function sendEmailJsMessage(params: {
  toEmail: string
  toName: string
  subject?: string
  message: string
  institutionName?: string
  replyTo?: string
  bccEmail?: string
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const cfg = getConfig()
  if (!cfg.ok) return { ok: false, skipped: true, error: cfg.error }

  const institution = (params.institutionName || 'Training Center').trim()
  const replyTo = (params.replyTo || params.bccEmail || '').trim()

  try {
    await emailjs.send(
      cfg.serviceId,
      cfg.templateId,
      {
        to_email: params.toEmail,
        to_name: params.toName,
        full_name: params.toName,
        subject: params.subject || 'Account notice',
        login_email: params.toEmail,
        welcome_message: params.message,
        message: params.message,
        role: 'Student',
        temporary_password: '-',
        login_url:
          typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login',
        institution_name: institution,
        company_name: institution,
        company_email: replyTo || institution,
        reply_to: replyTo || params.toEmail,
        // Optional BCC — only works if EmailJS template is configured for it
        bcc: params.bccEmail || '',
        bcc_email: params.bccEmail || '',
        email: params.toEmail,
        name: params.toName,
      },
      { publicKey: cfg.publicKey },
    )
    return { ok: true }
  } catch (err) {
    const error = err?.text || err?.message || 'EmailJS send failed'
    return { ok: false, error: String(error) }
  }
}

/**
 * Class / course notification — uses the beautiful HTML EmailJS template.
 * Admin writes plain text (any language); we wrap it and personalize per student.
 * Reply-To is always the institution email when provided.
 */
export async function sendClassNotificationEmail(
  params: ClassNotificationEmailParams,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const cfg = getClassTemplateConfig()
  if (!cfg.ok) {
    console.error('[emailjs]', cfg.error)
    return { ok: false, skipped: true, error: cfg.error }
  }

  const toEmail = String(params.toEmail || '').trim()
  const toName = String(params.toName || 'Student').trim()
  const subject = String(params.subject || '').trim()
  const institution = String(params.institutionName || 'Training Center').trim()
  const className = String(params.className || '').trim()
  const replyTo = String(params.institutionEmail || '').trim()
  const domainName = String(params.domainName || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
  const messageHtml = plainMessageToHtml(params.message)

  if (!toEmail.includes('@')) {
    return { ok: false, error: 'Recipient email is missing' }
  }
  if (!subject) {
    return { ok: false, error: 'Subject is required' }
  }

  try {
    await emailjs.send(
      cfg.serviceId,
      cfg.templateId,
      {
        // Match EmailJS "Welcome" / course template field names
        email: toEmail,
        to_email: toEmail,
        name: toName,
        to_name: toName,
        subject,
        message: params.message,
        message_html: messageHtml,
        class_name: className,
        institution_name: institution,
        from_name: institution,
        domain_name: domainName,
        company_email: replyTo || institution,
        reply_to: replyTo || toEmail,
      },
      { publicKey: cfg.publicKey },
    )
    return { ok: true }
  } catch (err) {
    const error = err?.text || err?.message || 'EmailJS send failed'
    console.error('[emailjs] class notification failed', error)
    return { ok: false, error: String(error) }
  }
}
