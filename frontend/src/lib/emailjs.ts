/**
 * Welcome email via EmailJS (no custom domain required).
 *
 * Template placeholders (must match EmailJS template):
 *   {{to_email}} {{to_name}} {{full_name}} {{role}} {{login_email}}
 *   {{temporary_password}} {{login_url}} {{institution_name}}
 *   {{company_email}} {{subject}} {{welcome_message}} {{reply_to}}
 *
 * Tip in EmailJS dashboard: set Subject to {{subject}} and To Email to {{to_email}}.
 * Prefer connecting a normal Gmail/Outlook account as the EmailJS service sender.
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
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const cfg = getConfig()
  if (!cfg.ok) return { ok: false, skipped: true, error: cfg.error }

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
        role: 'User',
        temporary_password: '-',
        login_url:
          typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login',
        institution_name: 'Training Center',
        company_name: 'Training Center',
        company_email: '',
        reply_to: params.toEmail,
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
