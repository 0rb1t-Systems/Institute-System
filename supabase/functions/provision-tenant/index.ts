// =====================================================================
//  Edge Function: provision-tenant
//  Super Admin only — creates Institution + Tenant Admin in one flow.
//  Service-role never exposed to the browser.
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

function slugify(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function mapProvisionError(msg: string): { error: string; status: number } {
  const m = String(msg || '')
  if (m.includes('INSTITUTION_SLUG_IN_USE')) {
    return { error: 'Institution slug is already in use.', status: 409 }
  }
  if (m.includes('ADMIN_EMAIL_EXISTS')) {
    return { error: 'A user with this email already exists.', status: 409 }
  }
  if (m.includes('SUPER_ADMIN_CANNOT_BE_TENANT')) {
    return { error: 'This account cannot be assigned to a tenant.', status: 400 }
  }
  if (m.includes('INSTITUTION_NAME_REQUIRED') || m.includes('INSTITUTION_SLUG_REQUIRED')) {
    return { error: 'Please complete all required fields.', status: 400 }
  }
  return { error: 'Unable to create tenant. Please try again.', status: 400 }
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

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = bearerToken(authHeader)
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

    const { data: caller, error: callerErr } = await admin
      .from('profiles')
      .select('id, role, institution_id')
      .eq('id', user.id)
      .single()

    if (callerErr || !caller || caller.role !== 'super_admin') {
      return json({ error: 'You do not have permission to perform this action.' }, 403)
    }
    if (caller.institution_id) {
      return json({ error: 'You do not have permission to perform this action.' }, 403)
    }

    const body = await req.json()
    const institution_name = String(body.institution_name || '').trim()
    const institution_slug = slugify(String(body.institution_slug || body.subdomain || ''))
    const institution_email = String(body.institution_email || '').trim().toLowerCase()
    const institution_phone = String(body.institution_phone || '').trim()
    const institution_address = String(body.institution_address || '').trim()
    const admin_full_name = String(body.admin_full_name || '').trim()
    const admin_email = String(body.admin_email || '').trim().toLowerCase()
    const temporary_password = String(body.temporary_password || '').trim()

    if (
      !institution_name ||
      !institution_slug ||
      !institution_email ||
      !institution_phone ||
      !institution_address ||
      !admin_full_name ||
      !admin_email ||
      !temporary_password
    ) {
      return json({ error: 'Please complete all required fields.' }, 400)
    }

    if (!isEmail(institution_email) || !isEmail(admin_email)) {
      return json({ error: 'Please provide a valid email address.' }, 400)
    }

    if (institution_slug.length < 2) {
      return json({ error: 'Institution slug is invalid.' }, 400)
    }

    if (temporary_password.length < 8) {
      return json({ error: 'Password must contain at least 8 characters.' }, 400)
    }

    // Pre-checks (friendly messages before mutating auth)
    const { data: slugHit } = await admin
      .from('institutions')
      .select('id')
      .eq('subdomain', institution_slug)
      .maybeSingle()
    if (slugHit) {
      return json({ error: 'Institution slug is already in use.' }, 409)
    }

    const { data: emailHit } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', admin_email)
      .maybeSingle()
    if (emailHit) {
      return json({ error: 'A user with this email already exists.' }, 409)
    }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: admin_email,
      password: temporary_password,
      email_confirm: true,
      user_metadata: {
        full_name: admin_full_name,
        role: 'admin',
      },
    })

    if (cErr || !created?.user) {
      const lower = String(cErr?.message || '').toLowerCase()
      console.error('[provision-tenant] createUser failed', cErr?.message)
      if (
        lower.includes('already been registered') ||
        lower.includes('already registered') ||
        lower.includes('already exists') ||
        lower.includes('email_exists') ||
        lower.includes('duplicate')
      ) {
        return json({ error: 'A user with this email already exists.' }, 409)
      }
      return json({ error: 'Unable to create Tenant Admin account. Please try again.' }, 400)
    }

    const adminUid = created.user.id

    const { data: institutionId, error: rpcErr } = await admin.rpc('provision_tenant_full', {
      p_name: institution_name,
      p_subdomain: institution_slug,
      p_email: institution_email,
      p_phone: institution_phone,
      p_address: institution_address,
      p_admin_uid: adminUid,
      p_admin_email: admin_email,
      p_admin_name: admin_full_name,
    })

    if (rpcErr || !institutionId) {
      await admin.auth.admin.deleteUser(adminUid)
      console.error('[provision-tenant] rpc failed', rpcErr?.message)
      const mapped = mapProvisionError(rpcErr?.message || '')
      return json({ error: mapped.error }, mapped.status)
    }

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'tenant.provisioned',
      entity_type: 'institution',
      entity_id: String(institutionId),
      metadata: {
        institution_name,
        institution_slug,
        admin_email,
        admin_id: adminUid,
      },
    })

    return json(
      {
        ok: true,
        institution_id: institutionId,
        institution_name,
        institution_slug,
        admin: {
          id: adminUid,
          email: admin_email,
          full_name: admin_full_name,
          password: temporary_password,
          role: 'admin',
        },
        message: 'Tenant created successfully.',
      },
      200,
    )
  } catch (e) {
    console.error('[provision-tenant] unhandled', e)
    return json({ error: 'Unable to create tenant. Please try again.' }, 500)
  }
})
