// =====================================================================
//  Edge Function: create-tenant-admin
//  Super Admin only — creates an additional Tenant Admin for an institution.
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

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = normalizeSecret(Deno.env.get('SUPABASE_ANON_KEY'))
    const serviceKey = normalizeSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    if (!url || !anonKey || !serviceKey) {
      return json({ error: 'Unable to process this request. Please try again later.' }, 500)
    }

    const token = bearerToken(req.headers.get('Authorization') ?? '')
    if (!token) return json({ error: 'Please sign in to continue.' }, 401)

    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const {
      data: { user },
      error: uErr,
    } = await asCaller.auth.getUser(token)
    if (uErr || !user) {
      return json({ error: 'Your session has expired. Please sign in again.' }, 401)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: caller } = await admin
      .from('profiles')
      .select('role, institution_id')
      .eq('id', user.id)
      .single()

    if (!caller || caller.role !== 'super_admin' || caller.institution_id) {
      return json({ error: 'You do not have permission to perform this action.' }, 403)
    }

    const body = await req.json()
    const institution_id = String(body.institution_id || '').trim()
    const full_name = String(body.full_name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const temporary_password = String(body.temporary_password || '').trim()

    if (!institution_id || !full_name || !email || !temporary_password) {
      return json({ error: 'Please complete all required fields.' }, 400)
    }
    if (!isEmail(email)) {
      return json({ error: 'Please provide a valid email address.' }, 400)
    }
    if (temporary_password.length < 8) {
      return json({ error: 'Password must contain at least 8 characters.' }, 400)
    }

    const { data: inst } = await admin
      .from('institutions')
      .select('id, name')
      .eq('id', institution_id)
      .maybeSingle()
    if (!inst) return json({ error: 'Tenant not found.' }, 404)

    const { data: emailHit } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle()
    if (emailHit) {
      return json({ error: 'A user with this email already exists.' }, 409)
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
      user_metadata: { full_name, role: 'admin' },
    })
    if (cErr || !created?.user) {
      const lower = String(cErr?.message || '').toLowerCase()
      if (lower.includes('already') || lower.includes('duplicate') || lower.includes('exists')) {
        return json({ error: 'A user with this email already exists.' }, 409)
      }
      return json({ error: 'Unable to create Tenant Admin account. Please try again.' }, 400)
    }

    const newId = created.user.id
    const { error: pErr } = await admin.from('profiles').insert({
      id: newId,
      institution_id,
      role: 'admin',
      status: 'approved',
      full_name,
      email,
    })

    if (pErr) {
      await admin.auth.admin.deleteUser(newId)
      console.error('[create-tenant-admin] profile insert', pErr.message)
      return json({ error: 'Unable to create Tenant Admin account. Please try again.' }, 400)
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'tenant.admin_created',
      entity_type: 'profile',
      entity_id: newId,
      metadata: { institution_id, email, full_name },
    })

    return json({
      ok: true,
      id: newId,
      email,
      password: temporary_password,
      full_name,
      role: 'admin',
      institution_id,
      institution_name: inst.name,
      message: 'Tenant Admin account created successfully.',
    })
  } catch (e) {
    console.error('[create-tenant-admin] unhandled', e)
    return json({ error: 'Unable to create Tenant Admin account. Please try again.' }, 500)
  }
})
