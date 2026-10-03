// =====================================================================
//  Edge Function: approve-registration-inquiry
//  Option B — Admin/Staff approve a pending inquiry → create student
//  account only (no auto-enrollment). Idempotent on repeated approval.
//  Registration History stays on registration_inquiries (status=approved).
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

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

function normalizeSecret(raw: string | undefined | null): string {
  let key = String(raw || '').trim()
  if (/^bearer\s+/i.test(key)) key = key.replace(/^bearer\s+/i, '').trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim()
  }
  return key
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = normalizeSecret(Deno.env.get('SUPABASE_ANON_KEY'))
    const serviceKey = normalizeSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    if (!url || !anonKey || !serviceKey) {
      return json({ error: 'SERVER_MISCONFIGURED' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = bearerToken(authHeader)
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
      .select('id, status')
      .eq('id', caller.institution_id)
      .maybeSingle()

    if (!callerInst || callerInst.status === 'suspended') {
      return json({ error: 'AUTH.TENANT_SUSPENDED' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const inquiryId = String(body.inquiry_id || body.id || '').trim()
    if (!inquiryId) return json({ error: 'INQUIRY_ID_REQUIRED' }, 400)

    const { data: inquiry, error: inqErr } = await admin
      .from('registration_inquiries')
      .select('*')
      .eq('id', inquiryId)
      .single()

    if (inqErr || !inquiry) return json({ error: 'INQUIRY_NOT_FOUND' }, 404)
    if (inquiry.institution_id !== caller.institution_id) {
      return json({ error: 'CROSS_TENANT_NOT_ALLOWED' }, 403)
    }

    const email = String(inquiry.email || '').trim().toLowerCase()
    const fullName = String(inquiry.full_name || '').trim()

    const alreadyApproved = inquiry.status === 'approved'
    if (inquiry.status !== 'pending' && !alreadyApproved) {
      return json({ error: 'INVALID_INQUIRY' }, 400)
    }

    // Claim pending inquiry — history row stays as status=approved forever.
    if (!alreadyApproved) {
      const { data: claimed, error: claimErr } = await admin
        .from('registration_inquiries')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', inquiryId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (claimErr) return json({ error: claimErr.message }, 400)
      if (!claimed) {
        return json({ error: 'ALREADY_PROCESSED' }, 409)
      }
    }

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, full_name, email, student_code')
      .eq('institution_id', caller.institution_id)
      .ilike('email', email)
      .maybeSingle()

    let studentId = existingProfile?.id || null
    let tempPassword: string | null = null

    if (!studentId) {
      const bootstrapPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1'
      const { data: createdAuth, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: bootstrapPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

      const revertClaim = async () => {
        if (alreadyApproved) return
        await admin
          .from('registration_inquiries')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', inquiryId)
      }

      if (authErr || !createdAuth?.user) {
        await revertClaim()
        const msg = String(authErr?.message || 'USER_CREATE_FAILED')
        if (/already|exists|registered/i.test(msg)) {
          return json({ error: 'USER_ACCOUNT_EXISTS' }, 409)
        }
        return json({ error: msg }, 400)
      }

      studentId = createdAuth.user.id
      const { error: profErr } = await admin.from('profiles').insert({
        id: studentId,
        institution_id: caller.institution_id,
        role: 'student',
        status: 'approved',
        full_name: fullName,
        email,
        phone: inquiry.phone || null,
        affiliate_id: inquiry.affiliate_id || null,
      })

      if (profErr) {
        await admin.auth.admin.deleteUser(studentId)
        await revertClaim()
        return json({ error: profErr.message }, 400)
      }

      const { data: codeRow } = await admin
        .from('profiles')
        .select('student_code')
        .eq('id', studentId)
        .maybeSingle()
      const studentCode = String(codeRow?.student_code || '').trim()
      if (!studentCode) {
        await admin.auth.admin.deleteUser(studentId)
        await revertClaim()
        return json({ error: 'STUDENT_ID_REQUIRED' }, 400)
      }
      if (studentCode.length < 3) {
        await admin.auth.admin.deleteUser(studentId)
        await revertClaim()
        return json({ error: 'STUDENT_ID_TOO_SHORT' }, 400)
      }
      const { error: pwErr } = await admin.rpc('set_auth_password_exact', {
        p_user_id: studentId,
        p_password: studentCode,
      })
      if (pwErr) {
        await admin.auth.admin.deleteUser(studentId)
        await revertClaim()
        console.error('[approve-registration-inquiry] student ID password failed', pwErr.message)
        const short = /at least \d+ characters/i.test(pwErr.message || '')
        return json({ error: short ? 'STUDENT_ID_TOO_SHORT' : 'STUDENT_PASSWORD_FAILED' }, 400)
      }
      tempPassword = studentCode
    } else if (inquiry.affiliate_id) {
      await admin
        .from('profiles')
        .update({ affiliate_id: inquiry.affiliate_id })
        .eq('id', studentId)
        .is('affiliate_id', null)
    }

    // No enrollment on approve — staff enrolls manually when ready.
    if (!alreadyApproved || !existingProfile || tempPassword) {
      await admin.from('audit_logs').insert({
        actor_id: caller.id,
        action: alreadyApproved ? 'registration.approved_healed' : 'registration.approved',
        entity_type: 'registration_inquiry',
        entity_id: inquiryId,
        metadata: {
          institution_id: caller.institution_id,
          student_id: studentId,
          email,
          enrolled: false,
          reused_existing: !!existingProfile,
        },
      })
    }

    let studentCode = existingProfile?.student_code || null
    if (studentId) {
      const { data: codeRow } = await admin
        .from('profiles')
        .select('student_code')
        .eq('id', studentId)
        .maybeSingle()
      studentCode = codeRow?.student_code || studentCode
    }

    return json({
      id: studentId,
      name: fullName,
      email,
      student_code: studentCode,
      password: tempPassword,
      already_approved: alreadyApproved,
      reused_existing: !!existingProfile,
      enrolled: false,
      class_id: null,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
