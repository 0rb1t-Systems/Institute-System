// =====================================================================
//  Edge Function: delete-tenant
//  Super Admin only — permanently deletes an institution and its users.
//  Requires exact confirmation_name matching the tenant name.
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

function normalizeName(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
    const confirmation_name = normalizeName(String(body.confirmation_name || ''))

    if (!institution_id || !confirmation_name) {
      return json({
        error: 'Institution ID and exact tenant name confirmation are required.',
      }, 400)
    }

    const { data: inst } = await admin
      .from('institutions')
      .select('id, name, subdomain, status')
      .eq('id', institution_id)
      .maybeSingle()

    if (!inst) return json({ error: 'Tenant not found.' }, 404)

    if (confirmation_name !== normalizeName(inst.name)) {
      return json({
        error: 'Confirmation name does not match the tenant name exactly.',
      }, 400)
    }

    const { data: members } = await admin
      .from('profiles')
      .select('id, role')
      .eq('institution_id', institution_id)

    const memberIds = (members || []).map((m) => m.id)
    const memberCount = memberIds.length
    const roleCounts: Record<string, number> = {}
    for (const m of members || []) {
      roleCounts[m.role] = (roleCounts[m.role] || 0) + 1
    }

    // Audit BEFORE destructive delete (survives even if later steps fail partially)
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'tenant.deleted',
      entity_type: 'institution',
      entity_id: institution_id,
      metadata: {
        name: inst.name,
        subdomain: inst.subdomain,
        status: inst.status,
        members_removed: memberCount,
        roles: roleCounts,
      },
    })

    // Clear RESTRICT FKs that can block profile/institution cascade
    const { error: affErr } = await admin
      .from('affiliate_settlements')
      .delete()
      .eq('institution_id', institution_id)
    if (affErr) {
      console.error('[delete-tenant] affiliate_settlements', affErr.message)
      return json({ error: `Unable to clear affiliate settlements: ${affErr.message}` }, 500)
    }

    // Null class program refs before cascading courses/diplomas (RESTRICT FKs)
    const { error: classNullErr } = await admin
      .from('classes')
      .update({ course_id: null, diploma_id: null })
      .eq('institution_id', institution_id)
    if (classNullErr) {
      console.error('[delete-tenant] classes null refs', classNullErr.message)
      // non-fatal if columns disallow null — continue to cascade delete
    }

    // Cascade-delete tenant data via institutions FK
    const { error: delInstErr } = await admin
      .from('institutions')
      .delete()
      .eq('id', institution_id)

    if (delInstErr) {
      console.error('[delete-tenant] institution delete failed', delInstErr.message)
      return json({
        error: `Unable to delete tenant data: ${delInstErr.message}`,
      }, 500)
    }

    // Confirm gone
    const { data: stillThere } = await admin
      .from('institutions')
      .select('id')
      .eq('id', institution_id)
      .maybeSingle()
    if (stillThere) {
      return json({ error: 'Tenant was not deleted. Please try again.' }, 500)
    }

    // Remove Auth accounts (profiles already cascaded with institution)
    const authFailures: string[] = []
    for (const id of memberIds) {
      const { error: authErr } = await admin.auth.admin.deleteUser(id)
      if (authErr) {
        console.error('[delete-tenant] auth delete failed', id, authErr.message)
        authFailures.push(id)
      }
    }

    return json({
      ok: true,
      institution_id,
      name: inst.name,
      members_removed: memberCount,
      auth_cleanup_failures: authFailures.length,
    })
  } catch (err) {
    console.error('[delete-tenant]', err)
    return json({ error: 'Unable to delete tenant. Please try again.' }, 500)
  }
})
