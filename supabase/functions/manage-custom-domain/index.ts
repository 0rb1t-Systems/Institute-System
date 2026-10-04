// =====================================================================
//  manage-custom-domain
//  Institution admin: start / verify / disconnect / status for apex + www.
//  DNS ownership via TXT; attach to Vercel Domains API when secrets set.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VERCEL_A = '76.76.21.21'
const VERCEL_CNAME = 'cname.vercel-dns.com'
const TXT_PREFIX = 'tvetflow-verify='
const VERIFY_COOLDOWN_MS = 60_000

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

function rootDomain(): string {
  return (Deno.env.get('APP_ROOT_DOMAIN') || 'tvetflow.online').trim().toLowerCase()
}

function normalizeDomain(raw: string): string | null {
  let d = String(raw || '').trim().toLowerCase()
  d = d.replace(/^https?:\/\//i, '')
  d = d.split('/')[0] || ''
  d = d.split('?')[0] || ''
  d = d.split('#')[0] || ''
  if (d.includes(':')) d = d.split(':')[0] || ''
  if (d.startsWith('www.')) d = d.slice(4)
  d = d.replace(/\.$/, '')
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(d)) {
    return null
  }
  if (d.split('.').length < 2) return null
  return d
}

function isBlockedDomain(apex: string): string | null {
  const root = rootDomain()
  if (apex === root || apex.endsWith('.' + root)) {
    return 'Use your own domain, not the platform domain.'
  }
  if (
    apex.endsWith('.vercel.app') ||
    apex.endsWith('.netlify.app') ||
    apex.endsWith('.pages.dev') ||
    apex.endsWith('.web.app') ||
    apex === 'localhost'
  ) {
    return 'That host cannot be used as a custom domain.'
  }
  return null
}

function randomToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return TXT_PREFIX + hex
}

function dnsInstructions(apex: string, token: string) {
  return {
    apex,
    www: `www.${apex}`,
    records: [
      {
        type: 'A',
        host: '@',
        hostFull: apex,
        value: VERCEL_A,
        note: 'Apex / root domain. If using Cloudflare, set proxy to DNS only (grey cloud).',
      },
      {
        type: 'CNAME',
        host: 'www',
        hostFull: `www.${apex}`,
        value: VERCEL_CNAME,
        note: 'www subdomain',
      },
      {
        type: 'TXT',
        host: '@',
        hostFull: apex,
        value: token,
        note: 'Ownership verification — must match exactly',
      },
    ],
  }
}

async function resolveDns(name: string, type: 'A' | 'AAAA' | 'CNAME' | 'TXT'): Promise<string[]> {
  try {
    const records = await Deno.resolveDns(name, type)
    if (type === 'CNAME' || type === 'TXT') {
      return (records as string[]).map((r) => String(r).replace(/\.$/, '').toLowerCase().replace(/^"|"$/g, ''))
    }
    return (records as string[]).map((r) => String(r).toLowerCase())
  } catch {
    // Fallback: Cloudflare DNS-over-HTTPS
    try {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`
      const res = await fetch(url, { headers: { Accept: 'application/dns-json' } })
      if (!res.ok) return []
      const data = await res.json()
      const answers = Array.isArray(data?.Answer) ? data.Answer : []
      return answers
        .map((a: { data?: string }) =>
          String(a.data || '')
            .replace(/\.$/, '')
            .toLowerCase()
            .replace(/^"|"$/g, ''),
        )
        .filter(Boolean)
    } catch {
      return []
    }
  }
}

async function checkDns(apex: string, token: string) {
  const txt = await resolveDns(apex, 'TXT')
  const txtOk = txt.some((v) => v.includes(token.toLowerCase()) || v === token.toLowerCase())
  const a = await resolveDns(apex, 'A')
  const aOk = a.includes(VERCEL_A)
  const cname = await resolveDns(`www.${apex}`, 'CNAME')
  const cnameOk = cname.some(
    (v) => v === VERCEL_CNAME || v.endsWith('.vercel-dns.com') || v.includes('vercel-dns'),
  )
  const issues: string[] = []
  if (!txtOk) issues.push('TXT verification record not found on apex (or not propagated yet).')
  if (!aOk) issues.push(`Apex A record must point to ${VERCEL_A}.`)
  if (!cnameOk) issues.push(`www CNAME must point to ${VERCEL_CNAME}.`)
  return { ok: txtOk && aOk && cnameOk, txtOk, aOk, cnameOk, issues, observed: { txt, a, cname } }
}

function vercelConfig() {
  const token = normalizeSecret(Deno.env.get('VERCEL_TOKEN'))
  const projectId = normalizeSecret(Deno.env.get('VERCEL_PROJECT_ID'))
  const teamId = normalizeSecret(Deno.env.get('VERCEL_TEAM_ID'))
  return { token, projectId, teamId }
}

async function vercelAddDomain(name: string): Promise<{ ok: boolean; error?: string }> {
  const { token, projectId, teamId } = vercelConfig()
  if (!token || !projectId) {
    return {
      ok: false,
      error:
        'Platform Vercel secrets are not configured (VERCEL_TOKEN, VERCEL_PROJECT_ID). Contact platform support.',
    }
  }
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains${qs}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    },
  )
  if (res.ok || res.status === 409) return { ok: true }
  const body = await res.json().catch(() => ({}))
  const msg =
    String(body?.error?.message || body?.message || '').trim() ||
    `Vercel rejected domain ${name} (${res.status}).`
  // Domain already on project
  if (/already|exist/i.test(msg)) return { ok: true }
  return { ok: false, error: msg }
}

async function vercelRemoveDomain(name: string): Promise<void> {
  const { token, projectId, teamId } = vercelConfig()
  if (!token || !projectId) return
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  try {
    await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}${qs}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    )
  } catch {
    /* best-effort */
  }
}

function statusPayload(row: Record<string, unknown>) {
  const apex = String(row.custom_domain || '') || null
  const token = String(row.custom_domain_verification_token || '') || null
  const status = String(row.custom_domain_status || 'none')
  return {
    ok: true,
    custom_domain: apex,
    custom_domain_www: row.custom_domain_www !== false,
    custom_domain_status: status,
    custom_domain_verified_at: row.custom_domain_verified_at || null,
    custom_domain_error: row.custom_domain_error || null,
    verification_token: token,
    dns: apex && token ? dnsInstructions(apex, token) : null,
    fallback_subdomain: row.subdomain || null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = normalizeSecret(Deno.env.get('SUPABASE_ANON_KEY'))
    const serviceKey = normalizeSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
    if (!url || !anonKey || !serviceKey) {
      return json({ error: 'SERVER_MISCONFIGURED' }, 500)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'UNAUTHORIZED' }, 401)

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, institution_id, status')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'admin' || !profile.institution_id) {
      return json({ error: 'FORBIDDEN' }, 403)
    }
    if (profile.status === 'suspended') return json({ error: 'FORBIDDEN' }, 403)

    const institutionId = profile.institution_id as string
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'status').trim().toLowerCase()

    const { data: inst, error: instErr } = await admin
      .from('institutions')
      .select(
        'id, name, subdomain, status, custom_domain, custom_domain_www, custom_domain_status, custom_domain_verification_token, custom_domain_verified_at, custom_domain_error, custom_domain_last_check_at',
      )
      .eq('id', institutionId)
      .maybeSingle()

    if (instErr || !inst) return json({ error: 'INSTITUTION_NOT_FOUND' }, 404)
    if (inst.status === 'suspended') return json({ error: 'INSTITUTION_SUSPENDED' }, 403)

    if (action === 'status') {
      return json(statusPayload(inst))
    }

    if (action === 'start') {
      const apex = normalizeDomain(String(body.domain || body.custom_domain || ''))
      if (!apex) return json({ error: 'INVALID_DOMAIN' }, 400)
      const blocked = isBlockedDomain(apex)
      if (blocked) return json({ error: 'DOMAIN_BLOCKED', message: blocked }, 400)

      const { data: taken } = await admin
        .from('institutions')
        .select('id')
        .eq('custom_domain', apex)
        .neq('id', institutionId)
        .maybeSingle()
      if (taken) return json({ error: 'DOMAIN_IN_USE' }, 409)

      const keepToken =
        inst.custom_domain === apex && inst.custom_domain_verification_token
          ? String(inst.custom_domain_verification_token)
          : randomToken()

      const { data: updated, error: upErr } = await admin
        .from('institutions')
        .update({
          custom_domain: apex,
          custom_domain_www: true,
          custom_domain_status: 'pending',
          custom_domain_verification_token: keepToken,
          custom_domain_verified_at: null,
          custom_domain_error: null,
        })
        .eq('id', institutionId)
        .select(
          'id, subdomain, custom_domain, custom_domain_www, custom_domain_status, custom_domain_verification_token, custom_domain_verified_at, custom_domain_error',
        )
        .single()

      if (upErr) {
        if (/unique|duplicate/i.test(upErr.message || '')) {
          return json({ error: 'DOMAIN_IN_USE' }, 409)
        }
        return json({ error: 'UPDATE_FAILED', message: upErr.message }, 500)
      }
      return json(statusPayload(updated))
    }

    if (action === 'verify') {
      if (!inst.custom_domain || !inst.custom_domain_verification_token) {
        return json({ error: 'NO_PENDING_DOMAIN' }, 400)
      }
      const last = inst.custom_domain_last_check_at
        ? new Date(String(inst.custom_domain_last_check_at)).getTime()
        : 0
      if (last && Date.now() - last < VERIFY_COOLDOWN_MS) {
        return json(
          {
            error: 'RATE_LIMITED',
            message: 'Wait about a minute before checking DNS again.',
            ...statusPayload(inst),
          },
          429,
        )
      }

      await admin
        .from('institutions')
        .update({ custom_domain_last_check_at: new Date().toISOString() })
        .eq('id', institutionId)

      const apex = String(inst.custom_domain)
      const token = String(inst.custom_domain_verification_token)
      const dns = await checkDns(apex, token)

      if (!dns.ok) {
        const errMsg = dns.issues.join(' ')
        const { data: updated } = await admin
          .from('institutions')
          .update({
            custom_domain_status: 'pending',
            custom_domain_error: errMsg,
          })
          .eq('id', institutionId)
          .select(
            'id, subdomain, custom_domain, custom_domain_www, custom_domain_status, custom_domain_verification_token, custom_domain_verified_at, custom_domain_error',
          )
          .single()
        return json({
          ...statusPayload(updated || inst),
          verified: false,
          dns_check: dns,
          message: errMsg,
        })
      }

      const addApex = await vercelAddDomain(apex)
      if (!addApex.ok) {
        const { data: updated } = await admin
          .from('institutions')
          .update({
            custom_domain_status: 'error',
            custom_domain_error: addApex.error || 'Vercel domain attach failed.',
          })
          .eq('id', institutionId)
          .select(
            'id, subdomain, custom_domain, custom_domain_www, custom_domain_status, custom_domain_verification_token, custom_domain_verified_at, custom_domain_error',
          )
          .single()
        return json(
          {
            ...statusPayload(updated || inst),
            verified: false,
            message: addApex.error,
          },
          502,
        )
      }

      const addWww = await vercelAddDomain(`www.${apex}`)
      if (!addWww.ok) {
        const { data: updated } = await admin
          .from('institutions')
          .update({
            custom_domain_status: 'error',
            custom_domain_error: addWww.error || 'Vercel www domain attach failed.',
          })
          .eq('id', institutionId)
          .select(
            'id, subdomain, custom_domain, custom_domain_www, custom_domain_status, custom_domain_verification_token, custom_domain_verified_at, custom_domain_error',
          )
          .single()
        return json(
          {
            ...statusPayload(updated || inst),
            verified: false,
            message: addWww.error,
          },
          502,
        )
      }

      const { data: updated, error: upErr } = await admin
        .from('institutions')
        .update({
          custom_domain_status: 'active',
          custom_domain_verified_at: new Date().toISOString(),
          custom_domain_error: null,
        })
        .eq('id', institutionId)
        .select(
          'id, subdomain, custom_domain, custom_domain_www, custom_domain_status, custom_domain_verification_token, custom_domain_verified_at, custom_domain_error',
        )
        .single()

      if (upErr) return json({ error: 'UPDATE_FAILED', message: upErr.message }, 500)
      return json({
        ...statusPayload(updated),
        verified: true,
        message: 'Custom domain is active. SSL may take a few minutes on Vercel.',
      })
    }

    if (action === 'disconnect') {
      const apex = inst.custom_domain ? String(inst.custom_domain) : null
      if (apex) {
        await vercelRemoveDomain(apex)
        await vercelRemoveDomain(`www.${apex}`)
      }
      const { data: updated, error: upErr } = await admin
        .from('institutions')
        .update({
          custom_domain: null,
          custom_domain_www: true,
          custom_domain_status: 'none',
          custom_domain_verification_token: null,
          custom_domain_verified_at: null,
          custom_domain_error: null,
          custom_domain_last_check_at: null,
        })
        .eq('id', institutionId)
        .select(
          'id, subdomain, custom_domain, custom_domain_www, custom_domain_status, custom_domain_verification_token, custom_domain_verified_at, custom_domain_error',
        )
        .single()
      if (upErr) return json({ error: 'UPDATE_FAILED', message: upErr.message }, 500)
      return json({ ...statusPayload(updated), message: 'Custom domain disconnected.' })
    }

    return json({ error: 'UNKNOWN_ACTION' }, 400)
  } catch (e) {
    console.error('[manage-custom-domain]', e)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
})
