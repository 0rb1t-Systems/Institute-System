// =====================================================================
//  Edge Function: public-provision-tenant
//  Public self-service — creates Institution + Tenant Admin (no JWT).
//  Service-role never exposed to the browser.
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'ftp',
  'localhost',
  'super-admin',
  'superadmin',
  'platform',
  'support',
  'help',
  'status',
  'cdn',
  'static',
  'assets',
  'login',
  'signup',
  'register',
  'verify',
])

const LANDING_TEMPLATES = new Set([
  'classic',
  'aurora',
  'campus',
  'horizon',
  'crest',
  'nova',
  'ledger',
  'atelier',
])

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

function isHexColor(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v)
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
  return { error: 'Unable to create institution. Please try again.', status: 400 }
}

function parseDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } | null {
  const raw = String(dataUrl || '').trim()
  const m = /^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/i.exec(raw)
  if (!m) return null
  const contentType = m[1].toLowerCase()
  const subtype = m[2].toLowerCase()
  const b64 = m[3]
  try {
    const bin = atob(b64)
    if (bin.length > 5 * 1024 * 1024) return null
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const ext =
      subtype === 'jpeg' || subtype === 'jpg'
        ? 'jpg'
        : subtype === 'svg+xml'
          ? 'svg'
          : subtype
    return { bytes, contentType, ext }
  } catch {
    return null
  }
}

async function uploadAsset(
  admin: ReturnType<typeof createClient>,
  institutionId: string,
  kind: 'logo' | 'hero',
  dataUrl: string | null,
): Promise<string | null> {
  if (!dataUrl) return null
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return null
  if (kind === 'hero' && parsed.ext === 'svg') return null

  const path = `${institutionId}/${kind}-${Date.now()}.${parsed.ext}`
  const { error } = await admin.storage.from('institution-assets').upload(path, parsed.bytes, {
    contentType: parsed.contentType,
    upsert: true,
  })
  if (error) {
    console.error('[public-provision-tenant] asset upload failed', kind, error.message)
    return null
  }
  const { data } = admin.storage.from('institution-assets').getPublicUrl(path)
  return data?.publicUrl || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = normalizeSecret(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

    if (!url || !serviceKey) {
      return json({ error: 'Unable to process this request. Please try again later.' }, 500)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json()
    const institution_name = String(body.institution_name || '').trim()
    const institution_slug = slugify(String(body.institution_slug || body.subdomain || ''))
    const institution_email = String(body.institution_email || '').trim().toLowerCase()
    const institution_phone = String(body.institution_phone || '').trim()
    const institution_address = String(body.institution_address || '').trim()
    const admin_full_name = String(body.admin_full_name || '').trim()
    const admin_email = String(body.admin_email || '').trim().toLowerCase()
    const password = String(body.password || body.temporary_password || '').trim()

    let landing_template_id = String(body.landing_template_id || 'classic').trim().toLowerCase()
    if (!LANDING_TEMPLATES.has(landing_template_id)) landing_template_id = 'classic'

    const hero_headline = String(body.hero_headline || '').trim() || null
    const footer_text = String(body.footer_text || '').trim() || null
    const description = String(body.description || '').trim() || null
    let theme_primary = String(body.theme_primary || '').trim()
    let theme_accent = String(body.theme_accent || '').trim()
    if (theme_primary && !isHexColor(theme_primary)) theme_primary = ''
    if (theme_accent && !isHexColor(theme_accent)) theme_accent = ''

    const logo_data_url = body.logo_data_url ? String(body.logo_data_url) : null
    const hero_data_url = body.hero_data_url ? String(body.hero_data_url) : null

    if (
      !institution_name ||
      !institution_slug ||
      !institution_email ||
      !institution_phone ||
      !institution_address ||
      !admin_full_name ||
      !admin_email ||
      !password
    ) {
      return json({ error: 'Please complete all required fields.' }, 400)
    }

    if (!isEmail(institution_email) || !isEmail(admin_email)) {
      return json({ error: 'Please provide a valid email address.' }, 400)
    }

    if (institution_slug.length < 2 || RESERVED_SLUGS.has(institution_slug)) {
      return json({ error: 'Institution slug is invalid or reserved.' }, 400)
    }

    if (password.length < 8) {
      return json({ error: 'Password must contain at least 8 characters.' }, 400)
    }

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
      password,
      email_confirm: true,
      user_metadata: {
        full_name: admin_full_name,
        role: 'admin',
      },
    })

    if (cErr || !created?.user) {
      const lower = String(cErr?.message || '').toLowerCase()
      console.error('[public-provision-tenant] createUser failed', cErr?.message)
      if (
        lower.includes('already been registered') ||
        lower.includes('already registered') ||
        lower.includes('already exists') ||
        lower.includes('email_exists') ||
        lower.includes('duplicate')
      ) {
        return json({ error: 'A user with this email already exists.' }, 409)
      }
      return json({ error: 'Unable to create admin account. Please try again.' }, 400)
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
      console.error('[public-provision-tenant] rpc failed', rpcErr?.message)
      const mapped = mapProvisionError(rpcErr?.message || '')
      return json({ error: mapped.error }, mapped.status)
    }

    const instId = String(institutionId)
    const [logo_url, hero_image_url] = await Promise.all([
      uploadAsset(admin, instId, 'logo', logo_data_url),
      uploadAsset(admin, instId, 'hero', hero_data_url),
    ])

    const branding: Record<string, unknown> = {
      landing_template_id,
      hero_headline,
      footer_text,
      description,
    }
    if (theme_primary) branding.theme_primary = theme_primary
    if (theme_accent) branding.theme_accent = theme_accent
    if (logo_url) branding.logo_url = logo_url
    if (hero_image_url) branding.hero_image_url = hero_image_url

    const { error: brandErr } = await admin.from('institutions').update(branding).eq('id', instId)
    if (brandErr) {
      console.error('[public-provision-tenant] branding update failed', brandErr.message)
    }

    await admin.from('audit_logs').insert({
      actor_id: adminUid,
      action: 'tenant.self_provisioned',
      entity_type: 'institution',
      entity_id: instId,
      metadata: {
        institution_name,
        institution_slug,
        admin_email,
        admin_id: adminUid,
        source: 'public_self_service',
        landing_template_id,
      },
    })

    return json(
      {
        ok: true,
        institution_id: institutionId,
        institution_name,
        institution_slug,
        landing_template_id,
        admin: {
          id: adminUid,
          email: admin_email,
          full_name: admin_full_name,
          role: 'admin',
        },
        message: 'Institution created successfully.',
      },
      200,
    )
  } catch (e) {
    console.error('[public-provision-tenant] unhandled', e)
    return json({ error: 'Unable to create institution. Please try again.' }, 500)
  }
})
