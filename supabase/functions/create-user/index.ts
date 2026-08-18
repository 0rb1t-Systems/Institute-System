// =====================================================================
//  Edge Function: create-user
//  Creates auth user + profile in the caller's tenant.
//  Welcome email is sent from the frontend via EmailJS (not here).
//
//  Security:
//   - Caller JWT verified (gateway + getUser)
//   - admin  -> student | staff | instructor | admin | affiliate
//   - staff  -> student | instructor
//   - New user inherits caller's institution_id only (tenant isolation)
//   - Service-role client never inherits the caller's Authorization header
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CREATABLE_ROLES = ['student', 'staff', 'instructor', 'admin', 'affiliate'] as const

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

/** Normalize Edge secret (trim / strip accidental Bearer prefix). */
function normalizeSecret(raw: string | undefined | null): string {
  let key = String(raw || '').trim()
  if (/^bearer\s+/i.test(key)) key = key.replace(/^bearer\s+/i, '').trim()
  // Strip wrapping quotes if pasted into secrets UI
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
      return json({ error: 'Server misconfigured: missing Supabase secrets' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = bearerToken(authHeader)
    if (!token) return json({ error: 'Unauthorized: missing Bearer token' }, 401)

    // Caller verification ONLY
    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: uErr,
    } = await asCaller.auth.getUser(token)

    if (uErr || !user) {
      return json(
        { error: `Unauthorized: ${uErr?.message || 'invalid or expired session'}` },
        401,
      )
    }

    // Same pattern as delete-user (proven working): clean service-role client,
    // do NOT copy the caller's Authorization header.
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: caller, error: callerErr } = await admin
      .from('profiles')
      .select('role, institution_id')
      .eq('id', user.id)
      .single()

    if (callerErr || !caller) return json({ error: 'No profile for caller' }, 403)
    if (!caller.institution_id) {
      return json({ error: 'Caller has no institution (tenant) assigned' }, 403)
    }

    const { data: callerInst } = await admin
      .from('institutions')
      .select('id, status')
      .eq('id', caller.institution_id)
      .maybeSingle()

    if (!callerInst || callerInst.status === 'suspended') {
      return json({ error: 'AUTH.TENANT_SUSPENDED' }, 403)
    }

    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const full_name = String(body.full_name || '').trim()
    const role = String(body.role || '').trim().toLowerCase()
    const phone = body.phone ? String(body.phone).trim() : null
    const password = body.password
    const settlement_model =
      role === 'instructor' && String(body.settlement_model || '').trim() === 'fixed_fee'
        ? 'fixed_fee'
        : 'commission'
    const fixed_fee_amount =
      role === 'instructor' && settlement_model === 'fixed_fee'
        ? Math.max(0, Number(body.fixed_fee_amount) || 0)
        : 0

    if (!email || !full_name || !role) {
      return json({ error: 'email, full_name, role are required' }, 400)
    }
    if (role === 'instructor' && settlement_model === 'fixed_fee' && fixed_fee_amount <= 0) {
      return json({ error: 'fixed_fee_amount must be greater than 0 for fixed-fee instructors' }, 400)
    }
    if (!CREATABLE_ROLES.includes(role as (typeof CREATABLE_ROLES)[number])) {
      return json({ error: 'Invalid role. Use student | staff | instructor | admin | affiliate' }, 400)
    }
    // Platform role is never creatable via tenant user management
    if (role === 'super_admin' || caller.role === 'super_admin') {
      return json({ error: 'Not allowed to create this role' }, 403)
    }

    // Permission Matrix — staff may create students only; instructors are admin-only
    const allowed =
      caller.role === 'admin' ||
      (caller.role === 'staff' && role === 'student')
    if (!allowed) {
      return json(
        {
          error:
            caller.role === 'staff'
              ? 'Staff may only create student accounts'
              : 'Not allowed to create this role',
        },
        403,
      )
    }

    const pwd =
      password && String(password).length >= 6
        ? String(password)
        : crypto.randomUUID().slice(0, 8) + 'Aa1!'

    // Same-tenant suspended user → reactivate (admin only) instead of failing
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, role, status, institution_id')
      .eq('email', email)
      .maybeSingle()

    if (
      existingProfile &&
      existingProfile.institution_id === caller.institution_id &&
      existingProfile.status === 'suspended' &&
      caller.role === 'admin'
    ) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(existingProfile.id, {
        password: pwd,
        email_confirm: true,
        user_metadata: { full_name, role },
      })
      if (pwErr) return json({ error: pwErr.message }, 400)

      const { error: reactivateErr } = await admin
        .from('profiles')
        .update({
          status: 'approved',
          full_name,
          role,
          phone,
          ...(role === 'instructor'
            ? { settlement_model, fixed_fee_amount }
            : {}),
        })
        .eq('id', existingProfile.id)

      if (reactivateErr) return json({ error: reactivateErr.message }, 400)

      const { data: inst } = await admin
        .from('institutions')
        .select('name')
        .eq('id', caller.institution_id)
        .single()

      return json(
        {
          id: existingProfile.id,
          email,
          password: pwd,
          role,
          full_name,
          institution_id: caller.institution_id,
          institution_name: inst?.name ?? 'Training Center',
          reactivated: true,
        },
        200,
      )
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: pwd,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (cErr || !created?.user) {
      const msg = cErr?.message ?? 'createUser failed'
      const lower = msg.toLowerCase()
      console.error('[create-user] admin.createUser failed', msg)

      if (
        lower.includes('already been registered') ||
        lower.includes('already registered') ||
        lower.includes('already exists') ||
        lower.includes('email_exists') ||
        lower.includes('duplicate')
      ) {
        return json(
          { error: 'USER_ACCOUNT_EXISTS: A user with this email already exists' },
          409,
        )
      }

      return json({ error: msg }, 400)
    }

    const newUserId = created.user.id

    const { error: pErr } = await admin.from('profiles').insert({
      id: newUserId,
      institution_id: caller.institution_id,
      role,
      status: 'approved',
      full_name,
      email,
      phone,
      settlement_model: role === 'instructor' ? settlement_model : 'commission',
      fixed_fee_amount: role === 'instructor' ? fixed_fee_amount : 0,
    })

    if (pErr) {
      await admin.auth.admin.deleteUser(newUserId)
      console.error('[create-user] profile insert failed', pErr.message)
      return json({ error: pErr.message }, 400)
    }

    const { data: inst } = await admin
      .from('institutions')
      .select('name')
      .eq('id', caller.institution_id)
      .single()

    return json(
      {
        id: newUserId,
        email,
        password: pwd,
        role,
        full_name,
        institution_id: caller.institution_id,
        institution_name: inst?.name ?? 'Training Center',
      },
      200,
    )
  } catch (e) {
    console.error('[create-user] unhandled', e)
    return json({ error: String(e) }, 500)
  }
})
