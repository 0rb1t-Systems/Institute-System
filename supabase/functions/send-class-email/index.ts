// =====================================================================
//  Admin/staff: one Resend email to a single recipient.
//  Body: { to, subject, message, reply_to?, class_id? }
//  No automatic BCC — the caller sends at most one separate inbox copy.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { escapeHtml, normalizeSecret, sendResendEmail } from '../_shared/resend.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function bearerToken(authHeader: string): string | null {
  const m = authHeader.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function toHtml(message: string): string {
  const escaped = escapeHtml(message).replace(/\r\n|\r|\n/g, '<br/>')
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.55">
      ${escaped}
    </div>
  `
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = normalizeSecret(Deno.env.get('SUPABASE_ANON_KEY'))
    const serviceKey = normalizeSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    if (!url || !anonKey || !serviceKey) return json({ error: 'SERVER_MISCONFIGURED' }, 500)

    const token = bearerToken(req.headers.get('Authorization') ?? '')
    if (!token) return json({ error: 'UNAUTHORIZED' }, 401)

    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const {
      data: { user },
      error: uErr,
    } = await asCaller.auth.getUser(token)
    if (uErr || !user) return json({ error: 'UNAUTHORIZED' }, 401)

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: caller } = await admin
      .from('profiles')
      .select('id, role, institution_id, email, full_name')
      .eq('id', user.id)
      .single()

    if (!caller?.institution_id || !['admin', 'staff'].includes(caller.role)) {
      return json({ error: 'FORBIDDEN' }, 403)
    }

    const { data: callerInst } = await admin
      .from('institutions')
      .select('id, name, email, status')
      .eq('id', caller.institution_id)
      .maybeSingle()

    if (!callerInst || callerInst.status === 'suspended') {
      return json({ error: 'AUTH.TENANT_SUSPENDED' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const to = String(body.to || body.to_email || '').trim().toLowerCase()
    const subject = String(body.subject || '').trim().slice(0, 200)
    const message = String(body.message || body.body || '').trim().slice(0, 8000)
    const classId = String(body.class_id || '').trim()
    const replyTo = String(body.reply_to || caller.email || callerInst.email || '').trim()

    if (!to.includes('@')) return json({ error: 'INVALID_TO' }, 400)
    if (!subject) return json({ error: 'SUBJECT_REQUIRED' }, 400)
    if (!message) return json({ error: 'MESSAGE_REQUIRED' }, 400)

    // Recipient must be a student profile in the same institution
    const { data: recipient } = await admin
      .from('profiles')
      .select('id, email, role, institution_id, full_name')
      .ilike('email', to)
      .eq('institution_id', caller.institution_id)
      .maybeSingle()

    // Allow sending a personal inbox copy to the caller themselves
    const isSelfCopy = to === String(caller.email || '').trim().toLowerCase()
    if (!isSelfCopy) {
      if (!recipient || recipient.role !== 'student') {
        return json({ error: 'RECIPIENT_NOT_STUDENT' }, 403)
      }
      if (classId) {
        const { data: enrollment } = await admin
          .from('enrollments')
          .select('id, status')
          .eq('class_id', classId)
          .eq('student_id', recipient.id)
          .neq('status', 'inactive')
          .maybeSingle()
        if (!enrollment) return json({ error: 'NOT_ENROLLED' }, 403)
      }
    }

    const sent = await sendResendEmail({
      to,
      subject,
      html: toHtml(message),
      replyTo,
    })

    if (!sent.ok) {
      console.error('[send-class-email] resend', sent.error)
      return json({ ok: false, error: sent.error, provider: 'resend' }, 502)
    }

    return json({ ok: true, provider: 'resend', emailed: true })
  } catch (err) {
    console.error('[send-class-email]', err)
    return json({ error: 'SEND_FAILED' }, 500)
  }
})
