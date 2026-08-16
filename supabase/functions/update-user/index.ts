// =====================================================================
//  Edge Function: update-user
//  Tenant admin updates another user's auth email / password / name.
//  PRD: Admin manages staff, instructor, student (and peer admins) in-tenant.
//
//  Auth:
//   - Verifies caller JWT
//   - Caller must be admin in the same tenant as the target
//   - Cannot change super_admin accounts
//   - Updates auth.users (login identity) + profiles in sync
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const {
      data: { user },
      error: uErr,
    } = await asCaller.auth.getUser(token)
    if (uErr || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: caller } = await admin
      .from('profiles')
      .select('role, institution_id')
      .eq('id', user.id)
      .single()
    if (!caller) return json({ error: 'No profile for caller' }, 403)
    if (caller.role !== 'admin') {
      return json({ error: 'Only Admin can update user login credentials' }, 403)
    }
    if (!caller.institution_id) {
      return json({ error: 'Caller has no institution (tenant) assigned' }, 403)
    }

    const body = await req.json()
    const targetId = String(body.user_id || body.id || '').trim()
    if (!targetId) return json({ error: 'user_id is required' }, 400)

    const emailRaw = body.email != null ? String(body.email).trim().toLowerCase() : ''
    const passwordRaw = body.password != null ? String(body.password) : ''
    const fullNameRaw =
      body.full_name != null
        ? String(body.full_name).trim()
        : body.name != null
          ? String(body.name).trim()
          : ''

    if (!emailRaw && !passwordRaw && !fullNameRaw) {
      return json({ error: 'Provide email, password, and/or full_name to update' }, 400)
    }
    if (emailRaw && !EMAIL_RE.test(emailRaw)) {
      return json({ error: 'Invalid email address' }, 400)
    }
    if (passwordRaw && passwordRaw.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400)
    }

    const { data: target } = await admin
      .from('profiles')
      .select('id, role, institution_id, email, full_name')
      .eq('id', targetId)
      .maybeSingle()

    if (!target) return json({ error: 'User not found' }, 404)
    if (target.institution_id !== caller.institution_id) {
      return json({ error: 'Cross-tenant update is forbidden' }, 403)
    }
    if (target.role === 'super_admin') {
      return json({ error: 'Cannot modify platform super admin' }, 403)
    }

    if (emailRaw && emailRaw !== String(target.email || '').toLowerCase()) {
      const { data: clash } = await admin
        .from('profiles')
        .select('id')
        .eq('email', emailRaw)
        .neq('id', targetId)
        .maybeSingle()
      if (clash) return json({ error: 'Email is already in use' }, 400)
    }

    const authPatch: Record<string, unknown> = {}
    if (emailRaw) {
      authPatch.email = emailRaw
      authPatch.email_confirm = true
    }
    if (passwordRaw) authPatch.password = passwordRaw
    if (fullNameRaw) {
      authPatch.user_metadata = {
        full_name: fullNameRaw,
        name: fullNameRaw,
        role: target.role,
      }
    }

    if (Object.keys(authPatch).length > 0) {
      const { error: authErr } = await admin.auth.admin.updateUserById(targetId, authPatch)
      if (authErr) {
        console.error('[update-user] auth update failed', authErr.message)
        const msg = String(authErr.message || '')
        if (/already.*(registered|exists|been)/i.test(msg) || /duplicate/i.test(msg)) {
          return json({ error: 'Email is already in use' }, 400)
        }
        return json({ error: authErr.message }, 400)
      }
    }

    const profilePatch: Record<string, unknown> = {}
    if (emailRaw) profilePatch.email = emailRaw
    if (fullNameRaw) profilePatch.full_name = fullNameRaw

    if (Object.keys(profilePatch).length > 0) {
      const { error: pErr } = await admin.from('profiles').update(profilePatch).eq('id', targetId)
      if (pErr) {
        console.error('[update-user] profile update failed', pErr.message)
        return json({ error: pErr.message }, 400)
      }
    }

    const { data: updated } = await admin
      .from('profiles')
      .select('id, email, full_name, role, status, institution_id')
      .eq('id', targetId)
      .single()

    return json({
      ok: true,
      id: targetId,
      email: updated?.email ?? (emailRaw || target.email),
      full_name: updated?.full_name ?? (fullNameRaw || target.full_name),
      role: updated?.role ?? target.role,
      password_updated: Boolean(passwordRaw),
    })
  } catch (e) {
    console.error('[update-user] unhandled', e)
    return json({ error: String(e) }, 500)
  }
})
