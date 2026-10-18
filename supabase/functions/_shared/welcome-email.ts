/**
 * Welcome email HTML for Resend — matches the product welcome template.
 * Variables: institution_name, full_name, role, login_email, temporary_password,
 * company_email, login_url.
 */
import { escapeHtml, sendResendEmail } from './resend.ts'

function roleLabel(role: string): string {
  const r = String(role || '').toLowerCase()
  if (r === 'admin') return 'Admin'
  if (r === 'staff') return 'Staff'
  if (r === 'instructor') return 'Instructor'
  if (r === 'affiliate') return 'Affiliate'
  if (r === 'student') return 'Student'
  return role || 'User'
}

export function buildTenantLoginUrl(subdomain?: string | null): string {
  const root = (Deno.env.get('APP_ROOT_DOMAIN') || 'tvetflow.online').trim().toLowerCase()
  const slug = String(subdomain || '')
    .trim()
    .toLowerCase()
  if (slug) return `https://${slug}.${root}/login`
  return `https://${root}/login`
}

export function buildWelcomeEmailHtml(opts: {
  institutionName: string
  fullName: string
  role: string
  loginEmail: string
  temporaryPassword: string
  companyEmail: string
  loginUrl: string
}): string {
  const institution = escapeHtml(opts.institutionName || 'Training Center')
  const fullName = escapeHtml(opts.fullName || 'there')
  const role = escapeHtml(roleLabel(opts.role))
  const loginEmail = escapeHtml(opts.loginEmail)
  const password = escapeHtml(opts.temporaryPassword)
  const companyEmail = escapeHtml(opts.companyEmail || opts.institutionName || 'support')
  const loginUrl = escapeHtml(opts.loginUrl)

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;line-height:1.6;color:#111111;max-width:560px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;font-weight:700;line-height:1.25;margin:0 0 20px;color:#111111;">
      Welcome to ${institution}, ${fullName}!
    </h1>
    <p style="margin:0 0 24px;">
      We're excited to have you join us as a ${role}. Your account has been successfully created and is now ready to use.
    </p>
    <h2 style="font-family:Georgia,'Times New Roman',Times,serif;font-size:18px;font-weight:700;margin:0 0 12px;color:#111111;">
      🔐 Login Details
    </h2>
    <p style="margin:0 0 4px;"><strong>Full Name:</strong> ${fullName}</p>
    <p style="margin:0 0 4px;"><strong>Role:</strong> ${role}</p>
    <p style="margin:0 0 4px;"><strong>Email:</strong> ${loginEmail}</p>
    <p style="margin:0 0 20px;"><strong>Temporary Password:</strong> ${password}</p>
    <p style="margin:0 0 28px;">
      For your security, please change your password after your first login.
    </p>
    <p style="margin:0 0 28px;">
      <a href="${loginUrl}"
         style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;font-weight:600;">
        Login to Dashboard
      </a>
    </p>
    <p style="margin:0 0 20px;">
      If you have any questions or need assistance, please contact us at ${companyEmail}.
    </p>
    <p style="margin:0 0 24px;">
      Thank you for choosing ${institution}. We wish you success in your learning journey.
    </p>
    <p style="margin:0;">Best regards,</p>
    <p style="margin:4px 0 0;"><strong>The ${institution} Team</strong></p>
  </div>
</body>
</html>`.trim()
}

export async function sendWelcomeResendEmail(opts: {
  to: string
  institutionName: string
  fullName: string
  role: string
  loginEmail: string
  temporaryPassword: string
  companyEmail?: string | null
  loginUrl?: string | null
  subdomain?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const institutionName = String(opts.institutionName || 'Training Center').trim()
  const loginUrl =
    String(opts.loginUrl || '').trim() || buildTenantLoginUrl(opts.subdomain)
  const companyEmail = String(opts.companyEmail || '').trim() || institutionName

  return sendResendEmail({
    to: opts.to,
    subject: `Welcome to ${institutionName}`,
    html: buildWelcomeEmailHtml({
      institutionName,
      fullName: opts.fullName,
      role: opts.role,
      loginEmail: opts.loginEmail,
      temporaryPassword: opts.temporaryPassword,
      companyEmail,
      loginUrl,
    }),
    replyTo: companyEmail.includes('@') ? companyEmail : undefined,
    fromName: institutionName,
  })
}
