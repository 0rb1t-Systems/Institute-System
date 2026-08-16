/**
 * Automated RLS cross-tenant isolation suite.
 *
 * Creates two ephemeral tenants + users, signs in with real JWTs,
 * asserts Admin A cannot read/mutate Tenant B data (and mirrors), then cleans up.
 *
 * Env:
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage (from repo root):
 *   node scripts/run-rls-cross-tenant-tests.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const require = createRequire(resolve(root, 'frontend', 'package.json'))
const { createClient } = require('@supabase/supabase-js')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(resolve(root, 'frontend', '.env'))
loadEnvFile(resolve(root, 'frontend', '.env.local'))
loadEnvFile(resolve(root, '.env'))

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const stamp = Date.now().toString(36)
const subdomainA = `rls-a-${stamp}`
const subdomainB = `rls-b-${stamp}`
const emailAdminA = `rls-admin-a-${stamp}@example.invalid`
const emailAdminB = `rls-admin-b-${stamp}@example.invalid`
const emailStudentA = `rls-student-a-${stamp}@example.invalid`
const password = `RlsTest!${stamp}Aa`

const results = []
let passed = 0
let failed = 0

function assert(name, ok, detail = null) {
  results.push({ name, pass: !!ok, detail })
  if (ok) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${name}${detail != null ? ` — ${detail}` : ''}`)
  }
}

async function signIn(email) {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(`signIn failed for ${email}: ${error?.message}`)
  return client
}

async function createAuthUser(email, fullName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`)
  return data.user
}

async function cleanup(ctx) {
  if (!ctx) return
  const { instA, instB, userIds = [] } = ctx
  if (instA || instB) {
    const ids = [instA, instB].filter(Boolean)
    await admin.from('payments').delete().in('institution_id', ids)
    await admin.from('enrollments').delete().in('institution_id', ids)
    await admin.from('registration_inquiries').delete().in('institution_id', ids)
    await admin.from('classes').delete().in('institution_id', ids)
    await admin.from('courses').delete().in('institution_id', ids)
    await admin.from('profiles').delete().in('institution_id', ids)
    await admin.from('institutions').delete().in('id', ids)
  }
  for (const id of userIds) {
    try {
      await admin.auth.admin.deleteUser(id)
    } catch {
      /* ignore */
    }
  }
}

let ctx = { userIds: [] }

try {
  console.log('RLS cross-tenant suite starting…')

  // --- fixtures ---
  const { data: instA, error: iaErr } = await admin
    .from('institutions')
    .insert({ name: 'RLS Tenant A', subdomain: subdomainA, status: 'active' })
    .select('id')
    .single()
  if (iaErr) throw iaErr

  const { data: instB, error: ibErr } = await admin
    .from('institutions')
    .insert({ name: 'RLS Tenant B', subdomain: subdomainB, status: 'active' })
    .select('id')
    .single()
  if (ibErr) throw ibErr

  ctx.instA = instA.id
  ctx.instB = instB.id

  const userAdminA = await createAuthUser(emailAdminA, 'RLS Admin A')
  const userAdminB = await createAuthUser(emailAdminB, 'RLS Admin B')
  const userStudentA = await createAuthUser(emailStudentA, 'RLS Student A')
  ctx.userIds = [userAdminA.id, userAdminB.id, userStudentA.id]

  const { error: profErr } = await admin.from('profiles').insert([
    {
      id: userAdminA.id,
      institution_id: instA.id,
      role: 'admin',
      status: 'approved',
      full_name: 'RLS Admin A',
      email: emailAdminA,
    },
    {
      id: userAdminB.id,
      institution_id: instB.id,
      role: 'admin',
      status: 'approved',
      full_name: 'RLS Admin B',
      email: emailAdminB,
    },
    {
      id: userStudentA.id,
      institution_id: instA.id,
      role: 'student',
      status: 'approved',
      full_name: 'RLS Student A',
      email: emailStudentA,
    },
  ])
  if (profErr) throw profErr

  const { data: courseA, error: caErr } = await admin
    .from('courses')
    .insert({ institution_id: instA.id, name: 'RLS Course A', code: `RLS-A-${stamp}` })
    .select('id')
    .single()
  if (caErr) throw caErr

  const { data: courseB, error: cbErr } = await admin
    .from('courses')
    .insert({ institution_id: instB.id, name: 'RLS Course B', code: `RLS-B-${stamp}` })
    .select('id')
    .single()
  if (cbErr) throw cbErr

  const { data: classA, error: claErr } = await admin
    .from('classes')
    .insert({
      institution_id: instA.id,
      name: 'RLS Class A',
      course_id: courseA.id,
      program_type: 'course',
      status: 'active',
      total_fee: 100,
      duration: '3',
    })
    .select('id')
    .single()
  if (claErr) throw claErr

  const { data: classB, error: clbErr } = await admin
    .from('classes')
    .insert({
      institution_id: instB.id,
      name: 'RLS Class B',
      course_id: courseB.id,
      program_type: 'course',
      status: 'active',
      total_fee: 200,
      duration: '3',
    })
    .select('id')
    .single()
  if (clbErr) throw clbErr

  // Need a student in B for enrollment/payment fixtures
  const emailStudentB = `rls-student-b-${stamp}@example.invalid`
  const userStudentB = await createAuthUser(emailStudentB, 'RLS Student B')
  ctx.userIds.push(userStudentB.id)
  await admin.from('profiles').insert({
    id: userStudentB.id,
    institution_id: instB.id,
    role: 'student',
    status: 'approved',
    full_name: 'RLS Student B',
    email: emailStudentB,
  })

  const { data: enrA, error: eaErr } = await admin
    .from('enrollments')
    .insert({ institution_id: instA.id, student_id: userStudentA.id, class_id: classA.id })
    .select('id')
    .single()
  if (eaErr) throw eaErr

  const { data: enrB, error: ebErr } = await admin
    .from('enrollments')
    .insert({ institution_id: instB.id, student_id: userStudentB.id, class_id: classB.id })
    .select('id')
    .single()
  if (ebErr) throw ebErr

  const { data: inqA, error: iqaErr } = await admin
    .from('registration_inquiries')
    .insert({
      institution_id: instA.id,
      full_name: 'Inquiry A',
      email: `rls-inq-a-${stamp}@example.invalid`,
      status: 'pending',
      class_id: classA.id,
    })
    .select('id')
    .single()
  if (iqaErr) throw iqaErr

  const { data: inqB, error: iqbErr } = await admin
    .from('registration_inquiries')
    .insert({
      institution_id: instB.id,
      full_name: 'Inquiry B',
      email: `rls-inq-b-${stamp}@example.invalid`,
      status: 'pending',
      class_id: classB.id,
    })
    .select('id')
    .single()
  if (iqbErr) throw iqbErr

  const { data: payA, error: paErr } = await admin
    .from('payments')
    .insert({
      institution_id: instA.id,
      enrollment_id: enrA.id,
      amount: 50,
      method: 'cash',
      status: 'completed',
    })
    .select('id')
    .single()
  if (paErr) throw paErr

  const { data: payB, error: pbErr } = await admin
    .from('payments')
    .insert({
      institution_id: instB.id,
      enrollment_id: enrB.id,
      amount: 75,
      method: 'cash',
      status: 'completed',
    })
    .select('id')
    .single()
  if (pbErr) throw pbErr

  // --- Admin A ---
  console.log('\nAs Admin A:')
  const clientA = await signIn(emailAdminA)

  {
    const { data } = await clientA.from('courses').select('id').in('id', [courseA.id, courseB.id])
    const ids = (data || []).map((r) => r.id)
    assert('admin_a_cannot_see_tenant_b_courses', ids.length === 1 && ids[0] === courseA.id, ids.join(','))
  }
  {
    const { data } = await clientA.from('classes').select('id').in('id', [classA.id, classB.id])
    const ids = (data || []).map((r) => r.id)
    assert('admin_a_cannot_see_tenant_b_classes', ids.length === 1 && ids[0] === classA.id, ids.join(','))
  }
  {
    const { data } = await clientA.from('profiles').select('id').in('id', [userAdminB.id, userStudentB.id])
    assert('admin_a_cannot_see_tenant_b_profiles', (data || []).length === 0, (data || []).length)
  }
  {
    const { data } = await clientA.from('registration_inquiries').select('id').in('id', [inqA.id, inqB.id])
    const ids = (data || []).map((r) => r.id)
    assert('admin_a_cannot_see_tenant_b_inquiries', ids.length === 1 && ids[0] === inqA.id, ids.join(','))
  }
  {
    const { data } = await clientA.from('payments').select('id').in('id', [payA.id, payB.id])
    const ids = (data || []).map((r) => r.id)
    assert('admin_a_cannot_see_tenant_b_payments', ids.length === 1 && ids[0] === payA.id, ids.join(','))
  }
  {
    const { data } = await clientA.from('enrollments').select('id').in('id', [enrA.id, enrB.id])
    const ids = (data || []).map((r) => r.id)
    assert('admin_a_cannot_see_tenant_b_enrollments', ids.length === 1 && ids[0] === enrA.id, ids.join(','))
  }
  {
    const { data, error } = await clientA
      .from('registration_inquiries')
      .update({ status: 'rejected', rejection_reason: 'cross-tenant-probe' })
      .eq('id', inqB.id)
      .select('id')
    assert('admin_a_cannot_update_tenant_b_inquiry', !error && (data || []).length === 0, error?.message || (data || []).length)
  }
  {
    const { data, error } = await clientA.from('payments').delete().eq('id', payB.id).select('id')
    assert('admin_a_cannot_delete_tenant_b_payment', !error && (data || []).length === 0, error?.message || (data || []).length)
  }

  // --- Student A ---
  console.log('\nAs Student A:')
  const clientStudentA = await signIn(emailStudentA)
  {
    const { data } = await clientStudentA.from('payments').select('id').eq('id', payB.id)
    assert('student_a_cannot_see_tenant_b_payments', (data || []).length === 0, (data || []).length)
  }
  {
    const { data } = await clientStudentA
      .from('registration_inquiries')
      .select('id')
      .in('id', [inqA.id, inqB.id])
    assert('student_a_cannot_see_registration_inquiries', (data || []).length === 0, (data || []).length)
  }

  // --- Admin B ---
  console.log('\nAs Admin B:')
  const clientB = await signIn(emailAdminB)
  {
    const { data } = await clientB.from('courses').select('id').in('id', [courseA.id, courseB.id])
    const ids = (data || []).map((r) => r.id)
    assert('admin_b_sees_only_own_courses', ids.length === 1 && ids[0] === courseB.id, ids.join(','))
  }
  {
    const { data } = await clientB.from('registration_inquiries').select('id').eq('id', inqA.id)
    assert('admin_b_cannot_see_tenant_a_inquiry', (data || []).length === 0, (data || []).length)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed / ${passed + failed} total`)
  await cleanup(ctx)

  if (failed > 0) process.exit(1)
  console.log('RLS cross-tenant suite PASSED')
  process.exit(0)
} catch (err) {
  console.error('\nSuite error:', err?.message || err)
  await cleanup(ctx)
  process.exit(1)
}
