// =====================================================================
//  Edge Function: delete-user
//  Permanently deletes an auth user + cascaded profile/related rows.
//  PRD Permission Matrix: Admin only for staff/instructor/student delete.
//
//  Auth:
//   - Verifies caller JWT
//   - Caller must be admin in the same tenant as the target
//   - Cannot delete yourself
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
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
      return json({ error: 'Only Admin can permanently delete users' }, 403)
    }

    const body = await req.json()
    const targetId = String(body.user_id || body.id || '').trim()
    if (!targetId) return json({ error: 'user_id is required' }, 400)
    if (targetId === user.id) {
      return json({ error: 'You cannot delete your own account' }, 400)
    }

    const { data: target } = await admin
      .from('profiles')
      .select('id, role, institution_id, email, full_name')
      .eq('id', targetId)
      .maybeSingle()

    if (!target) return json({ error: 'User not found' }, 404)
    if (target.institution_id !== caller.institution_id) {
      return json({ error: 'Cross-tenant delete is forbidden' }, 403)
    }

    // Deleting auth.users cascades to profiles (FK on delete cascade)
    const { error: dErr } = await admin.auth.admin.deleteUser(targetId)
    if (dErr) {
      console.error('[delete-user] failed', dErr.message)
      return json({ error: dErr.message }, 400)
    }

    return json({
      ok: true,
      id: targetId,
      email: target.email,
      role: target.role,
    })
  } catch (e) {
    console.error('[delete-user] unhandled', e)
    return json({ error: String(e) }, 500)
  }
})
