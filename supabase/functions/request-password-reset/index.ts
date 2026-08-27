// =====================================================================
//  Public password reset: resolve identifier → recovery link → Resend.
//  Always returns the same success payload (no account enumeration).
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { escapeHtml, normalizeSecret, sendResendEmail } from '../_shared/resend.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GENERIC = { ok: true }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function rootDomain(): string {
  return (Deno.env.get('APP_ROOT_DOMAIN') || 'tvetflow.online').trim().toLowerCase()
}

function isAllowedRedirect(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.pathname !== '/reset-password') return false
  const host = u.hostname.toLowerCase()
  if (
    (host === 'localhost' || host === '127.0.0.1') &&
    (u.protocol === 'http:' || u.protocol === 'https:')
  ) {
    return true
  }
  if (u.protocol !== 'https:') return false
  const root = rootDomain()
  if (host === root) return true
  if (!host.endsWith('.' + root)) return false
  const sub = host.slice(0, -(root.length + 1))
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(sub)
}

function fallbackRedirect(subdomain: string): string {
  const root = rootDomain()
  if (subdomain) return `https://${subdomain}.${root}/reset-password`
  return `https://${root}/reset-password`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = normalizeSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    if (!url || !serviceKey) return json({ error: 'SERVER_MISCONFIGURED' }, 500)
    if (!normalizeSecret(Deno.env.get('RESEND_API_KEY'))) {
      return json({ error: 'SERVER_MISCONFIGURED' }, 500)
    }

    const body = await req.json().catch(() => ({}))
    const identifier = String(body.identifier || body.email || '').trim().slice(0, 180)
    const subdomain = String(body.subdomain || '').trim().toLowerCase().slice(0, 80)
    let redirectTo = String(body.redirect_to || '').trim()

    if (!identifier) return json(GENERIC)
    if (!isAllowedRedirect(redirectTo)) redirectTo = fallbackRedirect(subdomain)

    await new Promise((r) => setTimeout(r, 400))

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let institutionId: string | null = null
    let institutionName = 'TvetFlow'

    if (subdomain) {
      const { data: inst } = await admin
        .from('institutions')
        .select('id, name, status')
        .eq('subdomain', subdomain)
        .maybeSingle()
      if (!inst || inst.status === 'suspended') return json(GENERIC)
      institutionId = inst.id
      institutionName = inst.name || institutionName
    }

    let email: string | null = null

    if (isEmail(identifier)) {
      let q = admin.from('profiles').select('id, email, status, institution_id').ilike('email', identifier)
      if (institutionId) q = q.eq('institution_id', institutionId)
      const { data: rows } = await q.limit(5)
      const match = (rows || []).find(
        (p) => String(p.email || '').toLowerCase() === identifier.toLowerCase(),
      )
      if (match?.status === 'approved') email = String(match.email).trim().toLowerCase()
    } else if (institutionId) {
      const prefix = identifier.replace(/[@\s]/g, '')
      const { data: byCode } = await admin
        .from('profiles')
        .select('id, email, status')
        .eq('institution_id', institutionId)
        .ilike('student_code', prefix)
        .eq('status', 'approved')
        .maybeSingle()
      if (byCode?.email) {
        email = String(byCode.email).trim().toLowerCase()
      } else {
        const { data: rows } = await admin
          .from('profiles')
          .select('id, email, status')
          .eq('institution_id', institutionId)
          .ilike('email', `${prefix}%`)
          .limit(10)
        const match = (rows || []).find((p) => {
          const local = String(p.email || '').split('@')[0]
          return local.toLowerCase() === prefix.toLowerCase() && p.status === 'approved'
        })
        if (match?.email) email = String(match.email).trim().toLowerCase()
      }
    }

    if (!email) return json(GENERIC)

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('[request-password-reset] generateLink', linkErr?.message || 'no link')
      return json(GENERIC)
    }

    const safeName = escapeHtml(institutionName)
    const sent = await sendResendEmail({
      to: email,
      subject: `${institutionName} — reset your password`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
          <h1 style="font-size:20px;margin:0 0 12px">${safeName}</h1>
          <p style="margin:0 0 16px;line-height:1.5">We received a request to reset your password. This link expires soon and can be used once.</p>
          <p style="margin:0 0 24px">
            <a href="${escapeHtml(linkData.properties.action_link)}"
               style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">
              Set a new password
            </a>
          </p>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5">If you did not ask for this, you can ignore this email. Your password will stay the same.</p>
        </div>
      `,
    })

    if (!sent.ok) console.error('[request-password-reset] resend', sent.error)
    return json(GENERIC)
  } catch (err) {
    console.error('[request-password-reset]', err)
    return json(GENERIC)
  }
})
