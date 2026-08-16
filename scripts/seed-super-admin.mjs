/**
 * One-time Super Admin provisioning (System Owner).
 *
 * NEVER hardcode the password in source. Pass it via env:
 *
 *   SUPER_ADMIN_PASSWORD="…" `
 *   SUPABASE_URL="https://….supabase.co" `
 *   SUPABASE_SERVICE_ROLE_KEY="…" `
 *   node scripts/seed-super-admin.mjs
 *
 * Idempotent: if owner@brce.com already exists as super_admin, exits 0.
 * Will not attach a tenant (institution_id stays null).
 */
import { createClient } from '@supabase/supabase-js'

const EMAIL = 'owner@brce.com'
const FULL_NAME = 'Barre'
const ROLE = 'super_admin'

function requireEnv(name) {
  const v = String(process.env[name] || '').trim()
  if (!v) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

const url = requireEnv('SUPABASE_URL')
const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const password = requireEnv('SUPER_ADMIN_PASSWORD')

if (password.length < 12) {
  console.error('SUPER_ADMIN_PASSWORD must be at least 12 characters.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findAuthUserByEmail(email) {
  // Paginate lightly — platform seed expects a small user set
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = (data?.users || []).find(
      (u) => String(u.email || '').toLowerCase() === email.toLowerCase(),
    )
    if (found) return found
    if (!data?.users?.length || data.users.length < perPage) return null
    page += 1
    if (page > 20) return null
  }
}

async function main() {
  const existingProfile = await admin
    .from('profiles')
    .select('id, role, institution_id, email')
    .eq('email', EMAIL)
    .maybeSingle()

  if (existingProfile.data?.role === ROLE) {
    console.log(`OK: Super Admin already provisioned (${EMAIL}).`)
    process.exit(0)
  }

  if (existingProfile.data && existingProfile.data.role !== ROLE) {
    console.error(
      `Refusing: ${EMAIL} already exists as role=${existingProfile.data.role}.`,
    )
    process.exit(1)
  }

  let user = await findAuthUserByEmail(EMAIL)

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME, role: ROLE },
    })
    if (error || !data?.user) {
      console.error('Failed to create auth user:', error?.message || 'unknown')
      process.exit(1)
    }
    user = data.user
    console.log('Created auth user:', user.id)
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME, role: ROLE },
    })
    if (error) {
      console.error('Failed to update auth user password:', error.message)
      process.exit(1)
    }
    console.log('Updated existing auth user password:', user.id)
  }

  const { error: profileErr } = await admin.from('profiles').upsert(
    {
      id: user.id,
      institution_id: null,
      role: ROLE,
      status: 'approved',
      full_name: FULL_NAME,
      email: EMAIL,
    },
    { onConflict: 'id' },
  )

  if (profileErr) {
    console.error('Failed to create super_admin profile:', profileErr.message)
    process.exit(1)
  }

  await admin.from('audit_logs').insert({
    actor_id: user.id,
    action: 'seed.super_admin',
    entity_type: 'profile',
    entity_id: user.id,
    metadata: { email: EMAIL, name: FULL_NAME },
  })

  console.log('SUCCESS: Super Admin provisioned.')
  console.log(`  Name:  ${FULL_NAME}`)
  console.log(`  Email: ${EMAIL}`)
  console.log(`  Role:  ${ROLE}`)
  console.log('  Tenant: none (institution_id = null)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
