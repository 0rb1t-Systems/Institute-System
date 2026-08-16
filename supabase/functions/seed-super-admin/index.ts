// =====================================================================
//  Edge Function: seed-super-admin
//  One-time System Owner provisioning. Idempotent.
//  Password is NEVER hardcoded — pass it in the JSON body.
//  Only succeeds when no super_admin profile exists yet.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-seed-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL = 'owner@brce.com'
const FULL_NAME = 'Barre'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
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
    const serviceKey = normalizeSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    const seedSecret = normalizeSecret(Deno.env.get('SUPER_ADMIN_SEED_SECRET'))

    if (!url || !serviceKey) {
      return json({ error: 'Server misconfigured.' }, 500)
    }

    // Optional shared secret (set in Supabase secrets). If set, require it.
    if (seedSecret) {
      const provided = String(req.headers.get('x-seed-secret') || '').trim()
      if (provided !== seedSecret) {
        return json({ error: 'Forbidden.' }, 403)
      }
    }

    const body = await req.json().catch(() => ({}))
    const password = String(body.password || '').trim()
    if (password.length < 12) {
      return json({ error: 'Password must be at least 12 characters.' }, 400)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: existing } = await admin
      .from('profiles')
      .select('id, role')
      .eq('role', 'super_admin')
      .limit(1)

    if (existing && existing.length > 0) {
      return json({ ok: true, already_provisioned: true, email: EMAIL })
    }

    const { data: byEmail } = await admin
      .from('profiles')
      .select('id, role')
      .eq('email', EMAIL)
      .maybeSingle()

    if (byEmail && byEmail.role !== 'super_admin') {
      return json({ error: 'Email already used by a non-platform account.' }, 409)
    }

    // Find or create auth user
    let userId: string | null = byEmail?.id ?? null
    if (!userId) {
      const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const found = (listed?.users || []).find(
        (u) => String(u.email || '').toLowerCase() === EMAIL,
      )
      userId = found?.id ?? null
    }

    if (!userId) {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: EMAIL,
        password,
        email_confirm: true,
        user_metadata: { full_name: FULL_NAME, role: 'super_admin' },
      })
      if (cErr || !created?.user) {
        console.error('[seed-super-admin] createUser', cErr?.message)
        return json({ error: 'Unable to create System Owner account.' }, 400)
      }
      userId = created.user.id
    } else {
      const { error: uErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: FULL_NAME, role: 'super_admin' },
      })
      if (uErr) {
        console.error('[seed-super-admin] updateUser', uErr.message)
        return json({ error: 'Unable to update System Owner account.' }, 400)
      }
    }

    const { error: pErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        institution_id: null,
        role: 'super_admin',
        status: 'approved',
        full_name: FULL_NAME,
        email: EMAIL,
      },
      { onConflict: 'id' },
    )

    if (pErr) {
      console.error('[seed-super-admin] profile', pErr.message)
      return json({ error: 'Unable to create System Owner profile.' }, 400)
    }

    await admin.from('audit_logs').insert({
      actor_id: userId,
      action: 'seed.super_admin',
      entity_type: 'profile',
      entity_id: userId,
      metadata: { email: EMAIL, name: FULL_NAME },
    })

    return json({
      ok: true,
      created: true,
      email: EMAIL,
      name: FULL_NAME,
      role: 'super_admin',
      institution_id: null,
    })
  } catch (e) {
    console.error('[seed-super-admin] unhandled', e)
    return json({ error: 'Unable to provision System Owner.' }, 500)
  }
})
