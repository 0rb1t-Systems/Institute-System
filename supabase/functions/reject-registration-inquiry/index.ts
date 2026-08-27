// =====================================================================
//  Admin/staff reject a pending inquiry and email the applicant via Resend.
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
      .select('id, role, institution_id')
      .eq('id', user.id)
      .single()

    if (!caller?.institution_id || !['admin', 'staff'].includes(caller.role)) {
      return json({ error: 'FORBIDDEN' }, 403)
    }

    const { data: callerInst } = await admin
      .from('institutions')
      .select('id, name, status')
      .eq('id', caller.institution_id)
      .maybeSingle()

    if (!callerInst || callerInst.status === 'suspended') {
      return json({ error: 'AUTH.TENANT_SUSPENDED' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const inquiryId = String(body.inquiry_id || body.id || '').trim()
    const reason = String(body.rejection_reason || body.reason || '')
      .trim()
      .slice(0, 500)
    if (!inquiryId) return json({ error: 'INQUIRY_ID_REQUIRED' }, 400)

    const { data: inquiry, error: inqErr } = await admin
      .from('registration_inquiries')
      .select('id, email, full_name, status, institution_id, rejection_reason')
      .eq('id', inquiryId)
      .single()

    if (inqErr || !inquiry) return json({ error: 'INQUIRY_NOT_FOUND' }, 404)
    if (inquiry.institution_id !== caller.institution_id) {
      return json({ error: 'CROSS_TENANT_NOT_ALLOWED' }, 403)
    }

    if (inquiry.status === 'rejected') {
      return json({
        id: inquiry.id,
        status: 'rejected',
        emailed: false,
        already_rejected: true,
      })
    }

    if (inquiry.status !== 'pending') {
      return json({ error: 'INVALID_INQUIRY' }, 400)
    }

    const { data: updated, error: updErr } = await admin
      .from('registration_inquiries')
      .update({
        status: 'rejected',
        rejection_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inquiryId)
      .eq('status', 'pending')
      .select('id, email, full_name, status, rejection_reason')
      .maybeSingle()

    if (updErr) return json({ error: updErr.message }, 400)
    if (!updated) return json({ error: 'INVALID_INQUIRY' }, 400)

    const to = String(updated.email || '').trim().toLowerCase()
    const instName = callerInst.name || 'the institution'
    const applicant = String(updated.full_name || 'Applicant').trim()
    const reasonHtml = reason
      ? `<p style="margin:16px 0;line-height:1.5"><strong>Reason:</strong> ${escapeHtml(reason)}</p>`
      : ''

    let emailed = false
    if (to.includes('@')) {
      const sent = await sendResendEmail({
        to,
        subject: `${instName} — registration update`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
            <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(instName)}</h1>
            <p style="margin:0 0 12px;line-height:1.5">Hello ${escapeHtml(applicant)},</p>
            <p style="margin:0;line-height:1.5">Your online registration was not approved.</p>
            ${reasonHtml}
            <p style="margin:16px 0 0;line-height:1.5;color:#64748b;font-size:13px">You may submit a new application if you still wish to join. If you have questions, contact the institution office.</p>
          </div>
        `,
      })
      emailed = sent.ok
      if (!sent.ok) console.error('[reject-registration-inquiry] resend', sent.error)
    }

    return json({
      id: updated.id,
      status: 'rejected',
      emailed,
      already_rejected: false,
    })
  } catch (err) {
    console.error('[reject-registration-inquiry]', err)
    return json({ error: 'REJECT_FAILED' }, 500)
  }
})
