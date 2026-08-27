/**
 * Supabase-backed Phase 1–3 API (live DB + RLS).
 * Document-request workflow remains out of v1 scope and throws FEATURE_UNAVAILABLE.
 */
import { supabase, getSupabaseUrl } from '@/lib/supabaseClient'
import { resolvePublicTenantSubdomain, getTenantLoginUrl } from '@/lib/institution'
import { createDefaultUploadFieldLayout } from '@/lib/certificateBuilder'
import { LANDING_TEMPLATE_IDS } from '@/lib/landingTemplates'
import { landingContentForSave } from '@/lib/landingContent'

const notReady = (_feature) => new Error('FEATURE_UNAVAILABLE')

const INST_SELECT =
  'id, name, subdomain, logo_url, description, email, phone, address, website, motto, theme_primary, theme_accent, theme_tertiary, social_whatsapp, social_facebook, social_tiktok, status, created_at, affiliate_commission_rate, registration_fee_amount, default_instructor_commission_rate, currency, currency_symbol, signatory_left_title, signatory_right_title, signatory_left_name, signatory_right_name, seal_url, signature_url, certificate_footer_text, transcript_footer_text, invoice_footer_text, settings_completed_at, landing_template_id, hero_image_url, hero_headline, footer_text, landing_content, grading_scale'

async function requireUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('UNAUTHORIZED')
  return data.user
}

async function getMyProfile() {
  const user = await requireUser()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

function mapProfile(p) {
  if (!p) return null
  return {
    ...p,
    name: p.full_name,
    username: p.email?.split('@')[0] || p.id.slice(0, 8),
    avatar_url: p.avatar_url ?? null,
  }
}

function mapStudent(p) {
  if (!p) return null
  return {
    id: p.id,
    profile_id: p.id,
    student_code: (p.email?.split('@')[0] || p.id.slice(0, 8)).toUpperCase(),
    name: p.full_name,
    email: p.email,
    phone: p.phone ?? null,
    address: '',
    registration_date: p.created_at,
    avatar_url: p.avatar_url ?? null,
    status: p.status,
    institution_id: p.institution_id,
    role: p.role,
    affiliate_id: p.affiliate_id ?? null,
  }
}

function mapClass(row) {
  if (!row) return null
  const durationMonths =
    typeof row.duration === 'number'
      ? row.duration
      : parseInt(String(row.duration || '1').replace(/\D/g, ''), 10) || 1
  const settlementModel =
    row.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission'
  const instructorRow = row.instructor && typeof row.instructor === 'object' ? row.instructor : null
  const instructorName = String(
    instructorRow?.full_name || instructorRow?.name || row.instructor_name || '',
  ).trim()
  return {
    ...row,
    fee: Number(row.total_fee ?? 0),
    is_active: row.status === 'active',
    start_date: row.start_month,
    end_date: row.end_month,
    duration_months: durationMonths,
    commission_rate: Number(row.commission_rate ?? 0),
    settlement_model: settlementModel,
    instructor_fixed_fee: Number(row.instructor_fixed_fee ?? 0),
    instructor: instructorRow
      ? {
          id: instructorRow.id,
          name: instructorName || instructorRow.full_name || null,
          full_name: instructorRow.full_name || instructorName || null,
        }
      : instructorName
        ? { id: row.instructor_id, name: instructorName, full_name: instructorName }
        : null,
    instructorName: instructorName || null,
  }
}

function classPayloadFromUi(data) {
  const settlementModel =
    data.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission'
  const payload = {
    name: data.name,
    program_type: data.program_type || (data.diploma_id ? 'diploma' : 'course'),
    course_id: data.course_id && data.course_id !== 'none' ? data.course_id : null,
    diploma_id: data.diploma_id && data.diploma_id !== 'none' ? data.diploma_id : null,
    instructor_id: data.instructor_id && data.instructor_id !== 'none' ? data.instructor_id : null,
    start_month: data.start_date || data.start_month || null,
    end_month: data.end_date || data.end_month || null,
    duration:
      data.duration_months != null
        ? String(data.duration_months)
        : data.duration != null
          ? String(data.duration)
          : '1',
    total_fee: Number(data.fee ?? data.total_fee ?? 0),
    status:
      data.is_active === false || data.status === 'inactive' ? 'inactive' : 'active',
    commission_rate: Number(data.commission_rate ?? 0),
    settlement_model: settlementModel,
    instructor_fixed_fee:
      settlementModel === 'fixed_fee'
        ? Math.max(0, Number(data.instructor_fixed_fee ?? 0))
        : 0,
  }
  if (payload.program_type === 'course') payload.diploma_id = null
  if (payload.program_type === 'diploma') payload.course_id = null
  return payload
}

function mapEnrollment(row) {
  if (!row) return null
  return {
    ...row,
    status: 'active',
    enrollment_date: row.enrolled_at,
  }
}

function mapPayment(row, enrollmentById: any = {}) {
  if (!row) return null
  const enr = enrollmentById[row.enrollment_id]
  const note = row.note != null ? String(row.note).trim() : ''
  const amount = Number(row.amount)
  // Trust the DB flag only — never infer registration fees from a hard-coded amount.
  const isReg = row.is_registration_fee === true

  let monthPaid = null
  if (!isReg) {
    if (/^\d{4}-\d{2}/.test(note)) monthPaid = note.slice(0, 7)
    else if (row.paid_at) monthPaid = String(row.paid_at).slice(0, 7)
  }

  return {
    ...row,
    student_id: enr?.student_id ?? row.student_id ?? null,
    class_id: enr?.class_id ?? row.class_id ?? null,
    payment_date: row.paid_at,
    amount,
    status: row.status || 'completed',
    is_registration_fee: Boolean(isReg),
    month_paid: monthPaid,
    notes: note || null,
  }
}

function mapAttendance(row, sessionById: any = {}) {
  if (!row) return null
  const sess = sessionById[row.session_id]
  return {
    ...row,
    class_id: sess?.class_id ?? row.class_id,
    date: sess?.session_date ?? row.date,
  }
}

function mapSettlement(row, ctx: any = {}) {
  if (!row) return null
  const payment = ctx.paymentById?.[row.payment_id]
  const classRow = ctx.classById?.[row.class_id]
  const studentId = payment?.student_id ?? row.student_id ?? null
  const student = studentId ? ctx.profileById?.[studentId] : null
  return {
    ...row,
    instructor_id: row.instructor_id,
    student_id: studentId,
    amount: Number(row.amount),
    rate: Number(row.rate),
    settlement_type: row.settlement_type === 'fixed_fee' ? 'fixed_fee' : 'commission',
    class: classRow ? { id: classRow.id, name: classRow.name } : null,
    class_id: row.class_id,
    student: student
      ? { id: student.id, name: student.full_name || student.name, student_code: student.email?.split('@')[0]?.toUpperCase() }
      : null,
    payment: payment ? { id: payment.id, amount: Number(payment.amount) } : null,
  }
}

async function enrichSettlements(rows) {
  if (!rows?.length) return []
  const paymentIds = [...new Set(rows.map((r) => r.payment_id).filter(Boolean))]
  const classIds = [...new Set(rows.map((r) => r.class_id).filter(Boolean))]

  const [paymentsRes, classesRes] = await Promise.all([
    paymentIds.length
      ? supabase.from('payments').select('id, amount, enrollment_id').in('id', paymentIds)
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase.from('classes').select('id, name').in('id', classIds)
      : Promise.resolve({ data: [] }),
  ])

  const enrollmentIds = [
    ...new Set((paymentsRes.data || []).map((p) => p.enrollment_id).filter(Boolean)),
  ]
  const enrollmentsRes = enrollmentIds.length
    ? await supabase.from('enrollments').select('id, student_id').in('id', enrollmentIds)
    : { data: [] }

  const studentIds = [
    ...new Set((enrollmentsRes.data || []).map((e) => e.student_id).filter(Boolean)),
  ]
  const profilesRes = studentIds.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', studentIds)
    : { data: [] }

  const enrollmentById = Object.fromEntries((enrollmentsRes.data || []).map((e) => [e.id, e]))
  const paymentById = Object.fromEntries(
    (paymentsRes.data || []).map((p) => [
      p.id,
      {
        ...p,
        student_id: enrollmentById[p.enrollment_id]?.student_id ?? null,
      },
    ])
  )
  const classById = Object.fromEntries((classesRes.data || []).map((c) => [c.id, c]))
  const profileById = Object.fromEntries((profilesRes.data || []).map((p) => [p.id, p]))

  return rows.map((r) => mapSettlement(r, { paymentById, classById, profileById }))
}

// --- Session helpers (legacy names kept for AuthContext migration) ---
export function getMockSession() {
  return null
}

export function setMockSession(_user) {
  /* no-op: Supabase persists session */
}

export function resetMockStore() {
  /* no-op */
}

export function getStoreSnapshot() {
  return {}
}

// --- Auth ---
export const verifyStudentCredentials = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { success: false, error: 'AUTH.INVALID_CREDENTIALS' }
  return {
    success: true,
    user: data.user,
    session: data.session,
  }
}

export const getEmailByUsername = async (username) => {
  if (!username) return null
  const q = username.trim()
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .ilike('email', `${q}%`)
    .limit(10)
  if (error || !data?.length) return null
  const exact = data.find((p) => p.email?.split('@')[0]?.toLowerCase() === q.toLowerCase())
  return (exact || data[0]).email
}

export const createNewUser = async (data) => {
  const email = data.email
  const password = data.password
  const meta = data.user_metadata || {}
  const role = meta.role || data.role || 'student'
  const full_name = meta.name || meta.full_name || data.full_name || email

  // Ensure a fresh access token before Edge Function invoke (avoids stale JWT 401s)
  let {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Must be logged in to create users')

  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
  if (!refreshErr && refreshed.session?.access_token) {
    session = refreshed.session
  }

  const settlementModel =
    meta.settlement_model === 'fixed_fee' || data.settlement_model === 'fixed_fee'
      ? 'fixed_fee'
      : 'commission'
  const fixedFeeAmount = Math.max(
    0,
    Number(meta.fixed_fee_amount ?? data.fixed_fee_amount ?? 0) || 0,
  )
  const uniqueRateRaw = meta.instructor_commission_rate ?? data.instructor_commission_rate
  const instructorCommissionRate =
    role === 'instructor' && settlementModel === 'commission' && uniqueRateRaw != null && uniqueRateRaw !== ''
      ? Math.min(1, Math.max(0, Number(uniqueRateRaw)))
      : null

  const { data: result, error } = await supabase.functions.invoke('create-user', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      email,
      password,
      full_name,
      role,
      phone: meta.phone || data.phone || null,
      settlement_model: role === 'instructor' ? settlementModel : undefined,
      fixed_fee_amount: role === 'instructor' ? fixedFeeAmount : undefined,
      instructor_commission_rate: role === 'instructor' ? instructorCommissionRate : undefined,
    },
  })

  // Prefer JSON body from the Edge Function (even on non-2xx)
  let payload = result
  if (error) {
    try {
      const ctx = error.context
      if (ctx && typeof ctx.json === 'function') {
        payload = await ctx.json()
      } else if (ctx && typeof ctx.text === 'function') {
        const text = await ctx.text()
        payload = text ? JSON.parse(text) : null
      }
    } catch {
      /* keep original error */
    }
  }

  // Success-first: if the user was created (id present), never treat as failure.
  if (payload?.id) {
    const createdRole = payload.role || role
    const skipWelcomeEmail =
      data.skipWelcomeEmail === true || createdRole === 'affiliate'

    let emailed = false
    let emailSkipped = skipWelcomeEmail
    let emailError = null

    if (!skipWelcomeEmail) {
      // Welcome email via EmailJS — login link = this institution's subdomain /login
      const institution = await getMyInstitution().catch(() => null)
      const { sendWelcomeEmail } = await import('@/lib/emailjs')
      const emailResult = await sendWelcomeEmail({
        fullName: payload.full_name || full_name,
        role: createdRole,
        email: payload.email || email,
        password: payload.password,
        institutionName: payload.institution_name || institution?.name || 'Training Center',
        institutionEmail: institution?.email || undefined,
        loginUrl: getTenantLoginUrl({
          subdomain: institution?.subdomain || payload.institution_subdomain,
          name: payload.institution_name || institution?.name,
        }),
      })

      if (!emailResult.ok) {
        console.warn('[createNewUser] welcome email failed', emailResult.error || emailResult.skipped)
      }
      emailed = Boolean(emailResult.ok)
      emailSkipped = Boolean(emailResult.skipped)
      emailError = emailResult.ok ? null : 'WELCOME_EMAIL_FAILED'
    }

    return {
      user: {
        id: payload.id,
        email: payload.email,
        user_metadata: { name: full_name, role: createdRole },
      },
      password: payload.password,
      role: createdRole,
      emailed,
      email_skipped: emailSkipped,
      email_error: emailError,
    }
  }

  const serverMsg = payload?.error || error?.message || null
  if (serverMsg) {
    const lower = String(serverMsg).toLowerCase()
    if (
      lower.includes('user_account_exists') ||
      lower.includes('already been registered') ||
      lower.includes('already registered') ||
      lower.includes('already exists') ||
      lower.includes('user already') ||
      lower.includes('duplicate') ||
      lower.includes('email_exists')
    ) {
      throw new Error('USER_ACCOUNT_EXISTS')
    }
    if (lower.includes('unauthorized') || lower.includes('invalid or expired session')) {
      throw new Error('SESSION_EXPIRED')
    }
    if (lower.includes('staff may only create student')) {
      throw new Error('FORBIDDEN_ROLE')
    }
    if (lower.includes('not allowed') || lower.includes('forbidden')) {
      throw new Error('FORBIDDEN')
    }
    // Auth Admin / service-role misconfig — never expose internals to the client
    if (lower.includes('bad_jwt') || lower.includes('unrecognized jwt kid') || lower.includes('service role')) {
      throw new Error('SERVER_AUTH_MISCONFIGURED')
    }
    throw new Error('UNEXPECTED')
  }

  throw new Error('UNEXPECTED')
}

export const updateUser = async (userId, data) => {
  const {
    data: { user: me },
  } = await supabase.auth.getUser()
  if (!me) throw new Error('UNAUTHORIZED')

  const email = data.email ? String(data.email).trim().toLowerCase() : ''
  const password = data.password ? String(data.password) : ''
  const fullName = data.name || data.full_name || ''
  const isSelf = me.id === userId
  const needsAdminAuthUpdate = Boolean(email || password) && !isSelf

  // Tenant admin changing another user's login email/password → Edge Function
  // (auth.users requires service role; profiles.email alone would desync login)
  if (needsAdminAuthUpdate) {
    let {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('UNAUTHORIZED')

    const { data: refreshed } = await supabase.auth.refreshSession()
    if (refreshed.session?.access_token) session = refreshed.session

    const { data: result, error } = await supabase.functions.invoke('update-user', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        user_id: userId,
        email: email || undefined,
        password: password || undefined,
        full_name: fullName || undefined,
      },
    })

    let payload = result
    if (error) {
      try {
        const ctx = error.context
        if (ctx && typeof ctx.json === 'function') payload = await ctx.json()
      } catch {
        /* keep */
      }
    }

    if (payload?.ok || payload?.id) {
      const extra: any = {}
      if (data.settlement_model !== undefined) {
        extra.settlement_model =
          data.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission'
      }
      if (data.fixed_fee_amount !== undefined) {
        extra.fixed_fee_amount = Math.max(0, Number(data.fixed_fee_amount) || 0)
      }
      if (data.instructor_commission_rate !== undefined) {
        extra.instructor_commission_rate =
          data.instructor_commission_rate == null || data.instructor_commission_rate === ''
            ? null
            : Math.min(1, Math.max(0, Number(data.instructor_commission_rate)))
      }
      if (fullName) extra.full_name = fullName
      if (Object.keys(extra).length > 0) {
        await supabase.from('profiles').update(extra).eq('id', userId)
      }
      if (data.settlement_model !== undefined || data.fixed_fee_amount !== undefined || data.instructor_commission_rate !== undefined) {
        await applyInstructorSettlementToClasses(
          userId,
          data.settlement_model,
          data.fixed_fee_amount,
          data.instructor_commission_rate
        )
      }
      return getProfile(userId)
    }

    const msg = String(payload?.error || error?.message || '')
    const lower = msg.toLowerCase()
    if (lower.includes('already in use') || lower.includes('already been registered')) {
      throw new Error('EMAIL_IN_USE')
    }
    if (lower.includes('unauthorized') || lower.includes('invalid or expired')) {
      throw new Error('SESSION_EXPIRED')
    }
    if (lower.includes('only admin') || lower.includes('forbidden') || lower.includes('cross-tenant')) {
      throw new Error('FORBIDDEN')
    }
    if (lower.includes('not found')) throw new Error('NOT_FOUND')
    if (msg) throw new Error(msg)
    throw new Error('UPDATE_FAILED')
  }

  // Self password change — Auth API only (never store password on profiles)
  if (password) {
    if (!isSelf) throw new Error('FORBIDDEN')
    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) throw pwErr
  }

  // Self email change (confirmation email may be required by Auth settings)
  if (email && isSelf) {
    const { error: emailErr } = await supabase.auth.updateUser({ email })
    if (emailErr) throw emailErr
  }

  const updates: any = {}
  if (fullName) updates.full_name = fullName
  if (email) updates.email = email
  if (data.phone !== undefined) updates.phone = data.phone
  if (data.status) updates.status = data.status
  if (data.role) updates.role = data.role
  if (data.valid_until !== undefined) updates.valid_until = data.valid_until
  if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url
  if (data.settlement_model !== undefined) {
    updates.settlement_model =
      data.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission'
  }
  if (data.fixed_fee_amount !== undefined) {
    updates.fixed_fee_amount = Math.max(0, Number(data.fixed_fee_amount) || 0)
  }
  if (data.instructor_commission_rate !== undefined) {
    updates.instructor_commission_rate =
      data.instructor_commission_rate == null || data.instructor_commission_rate === ''
        ? null
        : Math.min(1, Math.max(0, Number(data.instructor_commission_rate)))
  }

  if (Object.keys(updates).length === 0) {
    return getProfile(userId)
  }

  const { data: row, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error

  if (data.settlement_model !== undefined || data.fixed_fee_amount !== undefined || data.instructor_commission_rate !== undefined) {
    await applyInstructorSettlementToClasses(
      userId,
      updates.settlement_model ?? data.settlement_model,
      updates.fixed_fee_amount ?? data.fixed_fee_amount,
      data.instructor_commission_rate
    )
  }

  return mapProfile(row)
}

/** When admin changes an instructor's default pay, apply it to their classes. */
const applyInstructorSettlementToClasses = async (
  instructorId,
  settlementModel,
  fixedFeeAmount,
  uniqueCommissionRate
) => {
  if (!instructorId) return
  const me = await getMyProfile()
  if (!me?.institution_id) return

  const model =
    settlementModel === 'fixed_fee' || settlementModel === 'commission' ? settlementModel : null
  const fee = Math.max(0, Number(fixedFeeAmount) || 0)

  if (model === 'fixed_fee') {
    const { error } = await supabase
      .from('classes')
      .update({
        settlement_model: 'fixed_fee',
        instructor_fixed_fee: fee,
      })
      .eq('instructor_id', instructorId)
      .eq('institution_id', me.institution_id)
    if (error) throw error
    return
  }

  let commissionRate = null
  if (uniqueCommissionRate != null && uniqueCommissionRate !== '') {
    commissionRate = Math.min(1, Math.max(0, Number(uniqueCommissionRate)))
  } else {
    const { data: inst } = await supabase
      .from('institutions')
      .select('default_instructor_commission_rate')
      .eq('id', me.institution_id)
      .maybeSingle()
    commissionRate = Math.min(1, Math.max(0, Number(inst?.default_instructor_commission_rate) || 0))
  }

  const payload: any = {
    instructor_fixed_fee: 0,
    commission_rate: commissionRate,
  }
  if (model === 'commission') payload.settlement_model = 'commission'

  let query = supabase
    .from('classes')
    .update(payload)
    .eq('instructor_id', instructorId)
    .eq('institution_id', me.institution_id)

  if (model !== 'commission') {
    query = query.eq('settlement_model', 'commission')
  }

  const { error } = await query
  if (error) throw error
}

export const deleteUser = async (userId) => {
  let {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('UNAUTHORIZED')

  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed.session?.access_token) session = refreshed.session

  const { data: result, error } = await supabase.functions.invoke('delete-user', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { user_id: userId },
  })

  let payload = result
  if (error) {
    try {
      const ctx = error.context
      if (ctx && typeof ctx.json === 'function') payload = await ctx.json()
    } catch {
      /* keep */
    }
  }

  if (payload?.ok) return true

  const msg = payload?.error || error?.message || ''
  const lower = String(msg).toLowerCase()
  if (lower.includes('not found') || lower.includes('404')) {
    throw new Error('NOT_FOUND')
  }
  if (lower.includes('unauthorized') || lower.includes('invalid or expired')) {
    throw new Error('SESSION_EXPIRED')
  }
  if (lower.includes('forbidden') || lower.includes('not allowed') || lower.includes('only admin')) {
    throw new Error('FORBIDDEN')
  }
  throw new Error('DELETION_FAILED')
}

export const fetchAllUsers = async () => getAllProfiles()

export const getAllProfiles = async () => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapProfile)
}

export const getProfile = async (id) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return mapProfile(data)
}

export const updateProfile = async (userId, updates) => updateUser(userId, updates)

export const linkStudentToProfile = async (_studentId, _profileId) => true

// --- Students (profiles where role = student) ---
export const getStudents = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .neq('status', 'suspended')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapStudent)
}

export const createStudentWithAutoCode = async (data) => {
  const result = await createNewUser({
    email: data.email,
    password: data.password,
    user_metadata: {
      name: data.name || data.full_name,
      role: 'student',
      phone: data.phone,
    },
    phone: data.phone,
  })
  const profile = await getProfile(result.user.id)
  const student = mapStudent({
    id: result.user.id,
    full_name: data.name || data.full_name,
    email: data.email,
    phone: data.phone || null,
    created_at: new Date().toISOString(),
    status: 'approved',
    role: 'student',
    ...(profile || {}),
  })
  return {
    ...student,
    password: result.password,
    emailed: result.emailed,
    email_skipped: result.email_skipped,
    email_error: result.email_error,
  }
}

export const registerManualStudent = async (data) => {
  let student = await createStudentWithAutoCode(data)
  if (data.affiliate_id && data.affiliate_id !== 'none') {
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ affiliate_id: data.affiliate_id })
      .eq('id', student.id)
      .select('*')
      .single()
    if (error) throw error
    student = {
      ...mapStudent(updated),
      password: student.password,
      emailed: student.emailed,
      email_skipped: student.email_skipped,
      email_error: student.email_error,
    }
  }
  if (data.class_id && data.class_id !== 'none') {
    await createEnrollment({
      student_id: student.id,
      class_id: data.class_id,
      discount_amount: Number(data.discount_amount ?? 0),
    })
  }
  return student
}

export const createStudent = createStudentWithAutoCode
export const addStudent = createStudentWithAutoCode

export const updateStudent = async (id, data) => {
  const updates: any = {}
  if (data.name || data.full_name) updates.full_name = data.name || data.full_name
  if (data.email) updates.email = data.email
  if (data.phone !== undefined) updates.phone = data.phone
  if (data.status) updates.status = data.status
  if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url
  if (data.affiliate_id !== undefined) {
    updates.affiliate_id =
      data.affiliate_id && data.affiliate_id !== 'none' ? data.affiliate_id : null
  }
  const { data: row, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single()
  if (error) throw error
  return mapStudent(row)
}

export const updateStudentProfile = updateStudent

export const deleteStudent = async (studentId) => {
  // PRD: Admin has Delete on student registration — hard-delete via Edge Function
  return deleteUser(studentId)
}

export const getStudentByProfileId = async (profileId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .eq('role', 'student')
    .maybeSingle()
  if (error) throw error
  return mapStudent(data)
}

export const getStudentByNameAndPhone = async (name, phone) => {
  let query = supabase.from('profiles').select('*').eq('role', 'student')
  if (phone) query = query.eq('phone', phone.trim())
  const { data, error } = await query.limit(20)
  if (error) throw error
  const match = (data || []).find((s) => {
    const nameMatch = !name || s.full_name?.toLowerCase() === name.trim().toLowerCase()
    const phoneMatch = !phone || s.phone === phone.trim()
    return nameMatch && phoneMatch
  })
  return mapStudent(match || null)
}

export const findStudentByPhone = async (phone) => {
  if (!phone) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .eq('phone', phone.trim())
    .maybeSingle()
  if (error) throw error
  return mapStudent(data)
}

export const updateStudentAndProfile = async (studentId, profileId, updates) => {
  const id = profileId || studentId
  return updateStudent(id, updates)
}

export const verifyStudentProfile = async (identifier, subdomain) => {
  const raw = String(identifier || '').trim()
  if (raw.length < 3) return { valid: false, data: null }

  // Student code only — never email or UUID on the public verify path.
  if (raw.includes('@')) return { valid: false, data: null }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return { valid: false, data: null }
  }

  const slug = String(subdomain || '').trim().toLowerCase()

  const { data, error } = await supabase.rpc('verify_student_identity', {
    p_identifier: raw,
    p_subdomain: slug || null,
  })
  if (error) throw error

  if (!data?.valid) return { valid: false, data: null }

  return {
    valid: true,
    data: {
      id: data.student_code,
      name: data.student_name,
      student_code: data.student_code,
      email: null,
      academic_status: data.academic_status,
      institution_name: data.institution_name,
      institution_logo_url: data.institution_logo_url,
      institution_subdomain: data.institution_subdomain,
      theme_primary: data.theme_primary,
      theme_accent: data.theme_accent,
      class_name: data.class_name,
      program_name: data.program_name || data.class_name,
      program_type: data.program_type,
      avatar_url: data.avatar_url || null,
    },
  }
}

export const uploadAvatar = async (file, userId) => {
  if (!file) throw new Error('MISSING_FILE')

  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
  const type = String(file.type || '').toLowerCase()
  if (type && !allowed.includes(type)) {
    throw new Error('INVALID_IMAGE_TYPE')
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('FILE_TOO_LARGE')
  }

  const {
    data: { user: me },
  } = await supabase.auth.getUser()
  if (!me) throw new Error('UNAUTHORIZED')

  const targetUserId = userId || me.id

  // Resolve tenant folder for storage path
  let institutionFolder = 'platform'
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, institution_id')
    .eq('id', targetUserId)
    .maybeSingle()

  if (targetProfile?.institution_id) {
    institutionFolder = targetProfile.institution_id
  } else if (me.id === targetUserId) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('institution_id')
      .eq('id', me.id)
      .maybeSingle()
    institutionFolder = myProfile?.institution_id || 'platform'
  }

  const extFromName = String(file.name || '').split('.').pop()?.toLowerCase()
  const extFromType = type.replace('image/', '').replace('jpeg', 'jpg')
  let ext = extFromName || extFromType || 'png'
  if (!['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) ext = 'png'
  if (ext === 'jpeg') ext = 'jpg'

  const path = `${institutionFolder}/${targetUserId}/avatar-${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: type || `image/${ext}`,
    cacheControl: '3600',
  })
  if (upErr) {
    console.error('[uploadAvatar]', upErr.message)
    throw new Error('UPLOAD_FAILED')
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const publicUrl = data?.publicUrl
  if (!publicUrl) throw new Error('UPLOAD_FAILED')

  // Persist on profile immediately so ID cards / header refresh correctly
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', targetUserId)
  if (profileErr) {
    console.error('[uploadAvatar] profile update', profileErr.message)
    throw new Error('SAVE_FAILED')
  }

  return publicUrl
}

export const removeAvatar = async (userId) => {
  const {
    data: { user: me },
  } = await supabase.auth.getUser()
  if (!me) throw new Error('UNAUTHORIZED')
  const targetUserId = userId || me.id

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', targetUserId)
  if (error) throw error
  return true
}

export const uploadStudentProfileImage = async (file, userId) => uploadAvatar(file, userId)

/** Extract storage object path from a stored path or legacy public URL. */
export const assignmentStoragePath = (pathOrUrl) => {
  if (!pathOrUrl) return null
  const raw = String(pathOrUrl).trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) {
    return raw.replace(/^\/+/, '')
  }
  try {
    const u = new URL(raw)
    const marker = '/storage/v1/object/public/assignments/'
    const signedMarker = '/storage/v1/object/sign/assignments/'
    const authMarker = '/storage/v1/object/authenticated/assignments/'
    for (const m of [marker, signedMarker, authMarker]) {
      const idx = u.pathname.indexOf(m)
      if (idx >= 0) {
        return decodeURIComponent(u.pathname.slice(idx + m.length).split('?')[0])
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Signed download URL for a private assignments-bucket object (path or legacy public URL). */
export const resolveAssignmentFileUrl = async (pathOrUrl, expiresIn = 3600) => {
  const path = assignmentStoragePath(pathOrUrl)
  if (!path) return pathOrUrl || null
  const { data, error } = await supabase.storage.from('assignments').createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) {
    console.error('[resolveAssignmentFileUrl]', error?.message || 'no url')
    throw new Error('ASSIGNMENT_FILE_URL_FAILED')
  }
  return data.signedUrl
}

/** Upload assignment attachment (PDF, Word, images, etc.) for instructor or student.
 *  Returns the storage path (bucket is private — use resolveAssignmentFileUrl to download). */
export const uploadAssignmentFile = async (file, folderHint = 'assignments') => {
  if (!file) throw new Error('MISSING_FILE')
  if (file.size > 10 * 1024 * 1024) throw new Error('ASSIGNMENT_FILE_TOO_LARGE')

  const me = await getMyProfile()
  if (!me) throw new Error('UNAUTHORIZED')
  if (!me.institution_id) throw new Error('FORBIDDEN')

  const rawExt = String(file.name || '').split('.').pop()?.toLowerCase() || 'bin'
  const safeExt = rawExt.replace(/[^a-z0-9]/g, '') || 'bin'
  const hint = String(folderHint || 'file').replace(/[^a-z0-9_-]/gi, '_')
  // Path must be: {institution_id}/{user_id}/{filename}  (RLS on storage.objects)
  const path = `${me.institution_id}/${me.id}/${hint}-${Date.now()}.${safeExt}`

  const contentType =
    file.type ||
    (safeExt === 'txt'
      ? 'text/plain'
      : safeExt === 'pdf'
        ? 'application/pdf'
        : 'application/octet-stream')

  const { error: upErr } = await supabase.storage.from('assignments').upload(path, file, {
    upsert: true,
    contentType,
    cacheControl: '3600',
  })
  if (upErr) {
    console.error('[uploadAssignmentFile]', upErr.message)
    throw new Error('ASSIGNMENT_UPLOAD_FAILED')
  }

  return path
}

const ALLOWED_ASSET_KINDS = new Set(['logo', 'stamp', 'seal', 'signature', 'hero', 'grading_key'])
const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const MAX_ASSET_BYTES = 5 * 1024 * 1024

/**
 * Persist institution branding assets under {institution_id}/{kind}-*.{ext}.
 * institutionId is taken from the authenticated profile — never trusted from callers alone.
 */
export const uploadInstitutionAsset = async (file, kind = 'logo') => {
  const me = await getMyProfile()
  if (!me?.institution_id || me.role !== 'admin') throw new Error('FORBIDDEN')
  if (!file) throw new Error('MISSING_FILE')
  const assetKind = String(kind || 'logo').toLowerCase()
  if (!ALLOWED_ASSET_KINDS.has(assetKind)) throw new Error('INVALID_ASSET_KIND')
  if (file.size > MAX_ASSET_BYTES) throw new Error('FILE_TOO_LARGE')
  const mime = String(file.type || '').toLowerCase()
  if (mime && !ALLOWED_IMAGE_MIME.has(mime)) throw new Error('INVALID_FILE_TYPE')
  if (assetKind === 'hero' && mime === 'image/svg+xml') throw new Error('INVALID_FILE_TYPE')

  const ext = String(file.name || 'png').split('.').pop()?.toLowerCase() || 'png'
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext) ? ext : 'png'
  if (assetKind === 'hero' && safeExt === 'svg') throw new Error('INVALID_FILE_TYPE')
  const path = `${me.institution_id}/${assetKind}-${Date.now()}.${safeExt}`

  const { error } = await supabase.storage.from('institution-assets').upload(path, file, {
    upsert: true,
    cacheControl: '0',
    contentType: mime || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
  })
  if (error) throw error

  const { data } = supabase.storage.from('institution-assets').getPublicUrl(path)
  return data?.publicUrl || null
}

/** @deprecated Prefer uploadInstitutionAsset(file, 'logo') */
export const uploadInstitutionLogo = async (file, _institutionId) =>
  uploadInstitutionAsset(file, 'logo')

export const getMyInstitution = async () => {
  const me = await getMyProfile()
  if (!me?.institution_id) return null
  const { data, error } = await supabase
    .from('institutions')
    .select(INST_SELECT)
    .eq('id', me.institution_id)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Persist the active public landing template (institution admin only). */
export const setLandingTemplate = async (templateId, institutionId = null) => {
  const tid = String(templateId || '').trim().toLowerCase()
  if (!LANDING_TEMPLATE_IDS.includes(tid as (typeof LANDING_TEMPLATE_IDS)[number])) {
    throw new Error('INVALID_LANDING_TEMPLATE')
  }
  const { data, error } = await supabase.rpc('set_landing_template', {
    p_template_id: tid,
    p_institution_id: institutionId || null,
  })
  if (error) throw error
  return data
}

export const updateInstitution = async (updates) => {
  const me = await getMyProfile()
  if (!me?.institution_id) throw new Error('FORBIDDEN')
  if (me.role !== 'admin') throw new Error('FORBIDDEN')

  const allowed: any = {}
  if (updates.name !== undefined) allowed.name = String(updates.name).trim()
  if (updates.logo_url !== undefined) allowed.logo_url = updates.logo_url || null
  if (updates.description !== undefined) allowed.description = updates.description || null
  if (updates.email !== undefined) allowed.email = String(updates.email || '').trim().toLowerCase() || null
  if (updates.phone !== undefined) allowed.phone = String(updates.phone || '').trim() || null
  if (updates.address !== undefined) allowed.address = String(updates.address || '').trim() || null
  if (updates.website !== undefined) {
    const site = String(updates.website || '').trim()
    allowed.website = site || null
  }
  if (updates.motto !== undefined) {
    allowed.motto = String(updates.motto || '').trim() || null
  }
  if (updates.theme_primary !== undefined) allowed.theme_primary = updates.theme_primary
  if (updates.theme_accent !== undefined) allowed.theme_accent = updates.theme_accent
  if (updates.theme_tertiary !== undefined) {
    const t = String(updates.theme_tertiary || '').trim()
    allowed.theme_tertiary = t || null
  }
  if (updates.social_whatsapp !== undefined) {
    allowed.social_whatsapp = String(updates.social_whatsapp || '').trim().slice(0, 500) || null
  }
  if (updates.social_facebook !== undefined) {
    allowed.social_facebook = String(updates.social_facebook || '').trim().slice(0, 500) || null
  }
  if (updates.social_tiktok !== undefined) {
    allowed.social_tiktok = String(updates.social_tiktok || '').trim().slice(0, 500) || null
  }
  if (updates.landing_template_id !== undefined) {
    const tid = String(updates.landing_template_id || '').trim().toLowerCase()
    if (!LANDING_TEMPLATE_IDS.includes(tid as (typeof LANDING_TEMPLATE_IDS)[number])) {
      throw new Error('INVALID_LANDING_TEMPLATE')
    }
    allowed.landing_template_id = tid
  }
  if (updates.hero_image_url !== undefined) allowed.hero_image_url = updates.hero_image_url || null
  if (updates.hero_headline !== undefined) {
    allowed.hero_headline = String(updates.hero_headline || '').trim() || null
  }
  if (updates.footer_text !== undefined) {
    allowed.footer_text = String(updates.footer_text || '').trim() || null
  }
  if (updates.landing_content !== undefined) {
    allowed.landing_content = landingContentForSave(updates.landing_content)
  }
  if (updates.affiliate_commission_rate !== undefined) {
    const rate = Number(updates.affiliate_commission_rate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error('INVALID_AFFILIATE_RATE')
    allowed.affiliate_commission_rate = rate
  }
  if (updates.registration_fee_amount !== undefined) {
    const fee = Number(updates.registration_fee_amount)
    if (!Number.isFinite(fee) || fee < 0) throw new Error('INVALID_REGISTRATION_FEE')
    allowed.registration_fee_amount = fee
  }
  if (updates.default_instructor_commission_rate !== undefined) {
    const rate = Number(updates.default_instructor_commission_rate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error('INVALID_INSTRUCTOR_RATE')
    allowed.default_instructor_commission_rate = rate
  }
  if (updates.currency !== undefined) {
    const code = String(updates.currency || '')
      .trim()
      .toUpperCase()
    if (!/^[A-Z]{3}$/.test(code)) throw new Error('INVALID_CURRENCY')
    allowed.currency = code
  }
  if (updates.currency_symbol !== undefined) {
    const sym = String(updates.currency_symbol || '').trim()
    if (!sym || sym.length > 8) throw new Error('INVALID_CURRENCY_SYMBOL')
    allowed.currency_symbol = sym
  }
  if (updates.signatory_left_title !== undefined) {
    allowed.signatory_left_title = String(updates.signatory_left_title || '').trim() || 'Academic Registrar'
  }
  if (updates.signatory_right_title !== undefined) {
    allowed.signatory_right_title = String(updates.signatory_right_title || '').trim() || 'Principal'
  }
  if (updates.signatory_left_name !== undefined) {
    allowed.signatory_left_name = String(updates.signatory_left_name || '').trim() || null
  }
  if (updates.signatory_right_name !== undefined) {
    allowed.signatory_right_name = String(updates.signatory_right_name || '').trim() || null
  }
  if (updates.seal_url !== undefined) allowed.seal_url = updates.seal_url || null
  if (updates.signature_url !== undefined) allowed.signature_url = updates.signature_url || null
  if (updates.certificate_footer_text !== undefined) {
    allowed.certificate_footer_text = String(updates.certificate_footer_text || '').trim() || null
  }
  if (updates.transcript_footer_text !== undefined) {
    allowed.transcript_footer_text = String(updates.transcript_footer_text || '').trim() || null
  }
  if (updates.invoice_footer_text !== undefined) {
    allowed.invoice_footer_text = String(updates.invoice_footer_text || '').trim() || null
  }
  if (updates.grading_scale !== undefined) {
    // null clears custom scale (fallback to platform default)
    allowed.grading_scale = updates.grading_scale === null ? null : updates.grading_scale
  }
  // subdomain is provision-time only — never editable by tenant admin via this path

  const { data, error } = await supabase
    .from('institutions')
    .update(allowed)
    .eq('id', me.institution_id)
    .select(INST_SELECT)
    .single()
  if (error) throw error

  // Keep class commission_rate aligned with Institution Settings so UI matches settlements
  if (allowed.default_instructor_commission_rate !== undefined) {
    const { data: uniqueInstructors } = await supabase
      .from('profiles')
      .select('id')
      .eq('institution_id', me.institution_id)
      .eq('role', 'instructor')
      .not('instructor_commission_rate', 'is', null)
    const uniqueIds = (uniqueInstructors || []).map((p) => p.id)
    let q = supabase
      .from('classes')
      .update({ commission_rate: allowed.default_instructor_commission_rate })
      .eq('institution_id', me.institution_id)
      .eq('settlement_model', 'commission')
    if (uniqueIds.length > 0) {
      q = q.not('instructor_id', 'in', `(${uniqueIds.join(',')})`)
    }
    await q
  }

  // Complete settings + ensure default document templates (server-side institution_id)
  const requiredOk =
    Boolean(String(data?.name || '').trim()) &&
    Boolean(String(data?.email || '').trim()) &&
    Boolean(String(data?.phone || '').trim()) &&
    Boolean(String(data?.address || '').trim())
  if (requiredOk) {
    const { error: markErr } = await supabase.rpc('mark_institution_settings_complete')
    if (!markErr) {
      const { data: refreshed } = await supabase
        .from('institutions')
        .select(INST_SELECT)
        .eq('id', me.institution_id)
        .single()
      if (refreshed) return refreshed
    }
  }

  return data
}

/** Recompute auto gradebook letter grades after institution grading_scale changes. */
export const resyncInstitutionGradeLetters = async (institutionId) => {
  const { data, error } = await supabase.rpc('resync_institution_grade_letters', {
    p_institution_id: institutionId,
  })
  if (error) throw error
  return data
}

export const getDocumentTemplate = async (documentType) => {
  const { data, error } = await supabase.rpc('get_document_template', {
    p_document_type: documentType,
  })
  if (error) throw error
  return data
}

export const upsertDocumentTemplate = async (documentType, updates: any = {}) => {
  const me = await getMyProfile()
  if (!me?.institution_id || me.role !== 'admin') throw new Error('FORBIDDEN')
  const type = String(documentType || '').toLowerCase()
  if (!['certificate', 'transcript', 'invoice'].includes(type)) {
    throw new Error('INVALID_DOCUMENT_TYPE')
  }

  await supabase.rpc('get_document_template', { p_document_type: type })

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (updates.layout_key !== undefined) {
    payload.layout_key = String(updates.layout_key || 'default').trim() || 'default'
  }
  if (updates.config !== undefined) {
    payload.config = updates.config && typeof updates.config === 'object' ? updates.config : {}
  }

  const { data, error } = await supabase
    .from('document_templates')
    .update(payload)
    .eq('institution_id', me.institution_id)
    .eq('document_type', type)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

/** Set the institution's active certificate layout (server resolves institution_id). */
export const setActiveCertificateTemplate = async (layoutKey) => {
  const key = String(layoutKey || '').trim().toLowerCase()
  if (!key) throw new Error('INVALID_DOCUMENT_TYPE')
  const { data, error } = await supabase.rpc('set_active_certificate_template', {
    p_layout_key: key,
  })
  if (error) throw error
  return data
}

const CERT_TEMPLATE_BUCKET = 'certificate-templates'
const MAX_CERT_TEMPLATE_BYTES = 10 * 1024 * 1024
const ALLOWED_CERT_TEMPLATE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
])
const ALLOWED_BUILDER_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

/** Short-lived signed URL for a private certificate-templates object (tenant RLS enforced). */
export const getCertificateTemplateSignedUrl = async (path, expiresIn = 3600) => {
  const clean = String(path || '').trim()
  if (!clean || clean.includes('..')) throw new Error('INVALID_STORAGE_PATH')
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('blob:')) {
    return clean
  }
  const { data, error } = await supabase.storage
    .from(CERT_TEMPLATE_BUCKET)
    .createSignedUrl(clean, expiresIn)
  if (error) throw error
  return data?.signedUrl || null
}

export type DocumentTemplateType = 'certificate' | 'transcript' | 'invoice'

/** Save logo/page builder design for certificate | transcript | invoice. */
export const saveDocumentLogoBuilder = async (
  documentType: DocumentTemplateType,
  design,
  activate = true,
) => {
  const type = String(documentType || '').trim().toLowerCase()
  if (!['certificate', 'transcript', 'invoice'].includes(type)) {
    throw new Error('INVALID_DOCUMENT_TYPE')
  }
  const { data, error } = await supabase.rpc('save_document_logo_builder', {
    p_document_type: type,
    p_design: design && typeof design === 'object' ? design : {},
    p_activate: activate !== false,
  })
  if (error) throw error
  return data
}

/** Save logo/page builder design and activate it for the institution by default. */
export const saveCertificateLogoBuilder = async (design, activate = true) => {
  return saveDocumentLogoBuilder('certificate', design, activate)
}

/** Upload an image asset used inside the logo page builder (private bucket). */
export const uploadCertificateBuilderImage = async (file) => {
  const me = await getMyProfile()
  if (!me?.institution_id || me.role !== 'admin') throw new Error('FORBIDDEN')
  if (!file) throw new Error('MISSING_FILE')
  if (file.size > MAX_CERT_TEMPLATE_BYTES) throw new Error('CERT_TEMPLATE_TOO_LARGE')
  const mime = String(file.type || '').toLowerCase()
  if (!ALLOWED_BUILDER_IMAGE_MIME.has(mime)) throw new Error('INVALID_CERT_TEMPLATE_TYPE')

  const ext = String(file.name || 'png').split('.').pop()?.toLowerCase() || 'png'
  const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'
  const path = `${me.institution_id}/builder-${crypto.randomUUID()}.${safeExt}`

  const { error } = await supabase.storage.from(CERT_TEMPLATE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: mime,
  })
  if (error) throw error

  const signedUrl = await getCertificateTemplateSignedUrl(path)
  // Persist storage path in designs (not the short-lived signed URL)
  return { path, signedUrl }
}

async function rasterizePdfFirstPage(file) {
  const pdfjs = await import('pdfjs-dist')
  // Vite worker
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('UPLOAD_FAILED')
  await page.render({ canvasContext: ctx, viewport }).promise
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('UPLOAD_FAILED'))), 'image/png')
  })
  return blob
}

/** Reject spoofed Content-Type by checking file magic bytes. */
async function assertCertTemplateMagicBytes(file) {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
  const isWebp =
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  if (!isPdf && !isPng && !isJpeg && !isWebp) throw new Error('INVALID_CERT_TEMPLATE_TYPE')

  const mime = String(file.type || '').toLowerCase()
  if (mime === 'application/pdf' && !isPdf) throw new Error('INVALID_CERT_TEMPLATE_TYPE')
  if (mime === 'image/png' && !isPng) throw new Error('INVALID_CERT_TEMPLATE_TYPE')
  if ((mime === 'image/jpeg' || mime === 'image/jpg') && !isJpeg) {
    throw new Error('INVALID_CERT_TEMPLATE_TYPE')
  }
  if (mime === 'image/webp' && !isWebp) throw new Error('INVALID_CERT_TEMPLATE_TYPE')
}

/** Best-effort remove prior template objects after a successful replace. */
async function removeOrphanCertTemplatePaths(paths) {
  const unique = [...new Set((paths || []).map((p) => String(p || '').trim()).filter(Boolean))]
  if (!unique.length) return
  try {
    await supabase.storage.from(CERT_TEMPLATE_BUCKET).remove(unique)
  } catch {
    /* non-fatal — new upload already succeeded */
  }
}

/**
 * Upload institution-owned document template (PDF/image) to private storage.
 * Path is always prefixed with authenticated institution_id — never client-supplied.
 */
export const uploadOwnDocumentTemplate = async (
  documentType: DocumentTemplateType,
  file,
  activate = true,
) => {
  const type = String(documentType || 'certificate').trim().toLowerCase() as DocumentTemplateType
  if (!['certificate', 'transcript', 'invoice'].includes(type)) {
    throw new Error('INVALID_DOCUMENT_TYPE')
  }
  const me = await getMyProfile()
  if (!me?.institution_id || me.role !== 'admin') throw new Error('FORBIDDEN')
  if (!file) throw new Error('MISSING_FILE')
  if (file.size > MAX_CERT_TEMPLATE_BYTES) throw new Error('CERT_TEMPLATE_TOO_LARGE')

  let previousFieldLayout = null
  let orphanPaths = []
  try {
    const prevTpl = await getDocumentTemplate(type)
    const prevUpload = prevTpl?.config?.custom_upload
    previousFieldLayout = prevUpload?.field_layout || null
    if (prevUpload?.storage_path) orphanPaths.push(prevUpload.storage_path)
    if (prevUpload?.preview_path && prevUpload.preview_path !== prevUpload.storage_path) {
      orphanPaths.push(prevUpload.preview_path)
    }
  } catch {
    previousFieldLayout = null
  }

  const mime = String(file.type || '').toLowerCase()
  if (!ALLOWED_CERT_TEMPLATE_MIME.has(mime)) throw new Error('INVALID_CERT_TEMPLATE_TYPE')
  await assertCertTemplateMagicBytes(file)

  const extFromName = String(file.name || '').split('.').pop()?.toLowerCase() || ''
  const safeExt =
    mime === 'application/pdf'
      ? 'pdf'
      : ['png', 'jpg', 'jpeg', 'webp'].includes(extFromName)
        ? extFromName
        : mime === 'image/png'
          ? 'png'
          : mime === 'image/webp'
            ? 'webp'
            : 'jpg'

  const path = `${me.institution_id}/${type}-template-${crypto.randomUUID()}.${safeExt}`
  const { error: upErr } = await supabase.storage.from(CERT_TEMPLATE_BUCKET).upload(path, file, {
    upsert: false,
    contentType: mime,
  })
  if (upErr) throw upErr

  let previewPath = null
  let aspectRatio = null
  if (mime === 'application/pdf') {
    try {
      const previewBlob = await rasterizePdfFirstPage(file)
      previewPath = `${me.institution_id}/${type}-preview-${crypto.randomUUID()}.png`
      const { error: prevErr } = await supabase.storage
        .from(CERT_TEMPLATE_BUCKET)
        .upload(previewPath, previewBlob, {
          upsert: false,
          contentType: 'image/png',
        })
      if (prevErr) {
        previewPath = null
      } else {
        const previewUrl = URL.createObjectURL(previewBlob)
        try {
          aspectRatio = await new Promise((resolve) => {
            const img = new Image()
            img.onload = () =>
              resolve(
                img.naturalWidth > 0 && img.naturalHeight > 0
                  ? img.naturalWidth / img.naturalHeight
                  : null,
              )
            img.onerror = () => resolve(null)
            img.src = previewUrl
          })
        } finally {
          URL.revokeObjectURL(previewUrl)
        }
      }
    } catch {
      previewPath = null
    }
  } else {
    previewPath = path
    const objectUrl = URL.createObjectURL(file)
    try {
      aspectRatio = await new Promise((resolve) => {
        const img = new Image()
        img.onload = () =>
          resolve(
            img.naturalWidth > 0 && img.naturalHeight > 0
              ? img.naturalWidth / img.naturalHeight
              : null,
          )
        img.onerror = () => resolve(null)
        img.src = objectUrl
      })
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const { data, error } = await supabase.rpc('save_document_custom_upload', {
    p_document_type: type,
    p_storage_path: path,
    p_file_name: String(file.name || `${type}-template`).slice(0, 180),
    p_mime_type: mime,
    p_preview_path: previewPath,
    p_activate: Boolean(activate),
  })
  if (error) {
    // Roll back the just-uploaded objects if DB registration failed
    await removeOrphanCertTemplatePaths([path, previewPath].filter(Boolean))
    throw error
  }

  // Drop superseded files only after the new paths are registered
  await removeOrphanCertTemplatePaths(
    orphanPaths.filter((p) => p !== path && p !== previewPath),
  )

  if (data?.config?.custom_upload) {
    const nextConfig = {
      ...(data.config || {}),
      custom_upload: {
        ...data.config.custom_upload,
        aspect_ratio: aspectRatio,
        field_layout:
          previousFieldLayout ||
          data.config.custom_upload.field_layout ||
          createDefaultUploadFieldLayout(aspectRatio, type),
        // New artwork — paper text layers must be re-scanned
        paper_layers: [],
      },
    }
    const { data: updated, error: cfgErr } = await supabase
      .from('document_templates')
      .update({ config: nextConfig, updated_at: new Date().toISOString() })
      .eq('institution_id', me.institution_id)
      .eq('document_type', type)
      .select('*')
      .maybeSingle()
    if (!cfgErr && updated) return updated
  }

  return data
}

export const uploadOwnCertificateTemplate = async (file, activate = true) =>
  uploadOwnDocumentTemplate('certificate', file, activate)

/** Save matched field positions and/or editable paper text layers on uploaded template. */
export const saveCustomUploadFieldLayout = async (
  fieldLayout,
  documentType: DocumentTemplateType = 'certificate',
  paperLayers = undefined,
) => {
  const type = String(documentType || 'certificate').trim().toLowerCase() as DocumentTemplateType
  if (!['certificate', 'transcript', 'invoice'].includes(type)) {
    throw new Error('INVALID_DOCUMENT_TYPE')
  }
  const me = await getMyProfile()
  if (!me?.institution_id || me.role !== 'admin') throw new Error('FORBIDDEN')
  const tpl = await getDocumentTemplate(type)
  const upload = tpl?.config?.custom_upload
  if (!upload?.storage_path) throw new Error('CERT_TEMPLATE_NOT_FOUND')

  const nextConfig = {
    ...(tpl.config || {}),
    custom_upload: {
      ...upload,
      ...(fieldLayout !== undefined ? { field_layout: fieldLayout } : {}),
      ...(paperLayers !== undefined ? { paper_layers: paperLayers } : {}),
    },
  }
  const { data, error } = await supabase
    .from('document_templates')
    .update({
      config: nextConfig,
      layout_key: 'custom_upload',
      updated_at: new Date().toISOString(),
    })
    .eq('institution_id', me.institution_id)
    .eq('document_type', type)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data
}

export const saveCustomUploadPaperLayers = async (
  paperLayers,
  documentType: DocumentTemplateType = 'certificate',
) => {
  return saveCustomUploadFieldLayout(undefined, documentType, paperLayers)
}

/** Register an already-uploaded custom template path (admin RPC; validates tenant path). */
export const saveCertificateCustomUpload = async ({
  storagePath,
  fileName,
  mimeType,
  previewPath = null,
  activate = true,
}) => {
  const { data, error } = await supabase.rpc('save_certificate_custom_upload', {
    p_storage_path: storagePath,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_preview_path: previewPath,
    p_activate: Boolean(activate),
  })
  if (error) throw error
  return data
}

/** Set the institution's active transcript layout (server resolves institution_id). */
export const setActiveTranscriptTemplate = async (layoutKey) => {
  const key = String(layoutKey || '').trim().toLowerCase()
  if (!key) throw new Error('INVALID_DOCUMENT_TYPE')
  const { data, error } = await supabase.rpc('set_active_transcript_template', {
    p_layout_key: key,
  })
  if (error) throw error
  return data
}

/** Set the institution's active invoice layout (server resolves institution_id). */
export const setActiveInvoiceTemplate = async (layoutKey) => {
  const key = String(layoutKey || '').trim().toLowerCase()
  if (!key) throw new Error('INVALID_DOCUMENT_TYPE')
  const { data, error } = await supabase.rpc('set_active_invoice_template', {
    p_layout_key: key,
  })
  if (error) throw error
  return data
}

const normalizeDiplomaIds = (data) => {
  if (Array.isArray(data?.diploma_ids)) {
    return [...new Set(data.diploma_ids.filter((id) => id && id !== 'none'))]
  }
  if (data?.diploma_id !== undefined) {
    const diplomaId = data.diploma_id && data.diploma_id !== 'none' ? data.diploma_id : null
    return diplomaId ? [diplomaId] : []
  }
  return null
}

const nextDiplomaCourseSort = async (diplomaId) => {
  const { data: maxRow } = await supabase
    .from('diploma_courses')
    .select('sort_order')
    .eq('diploma_id', diplomaId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  return Number(maxRow?.sort_order || 0) + 1
}

export const syncCourseDiplomas = async (courseId, diplomaIds) => {
  const me = await getMyProfile()
  const wanted = [...new Set((diplomaIds || []).filter(Boolean))]
  const { data: existing, error: existingError } = await supabase
    .from('diploma_courses')
    .select('id, diploma_id')
    .eq('course_id', courseId)
  if (existingError) throw existingError

  const existingIds = new Set((existing || []).map((r) => r.diploma_id))
  const toAdd = wanted.filter((id) => !existingIds.has(id))
  const toRemove = (existing || []).filter((r) => !wanted.includes(r.diploma_id))

  for (const diplomaId of toAdd) {
    const sortOrder = await nextDiplomaCourseSort(diplomaId)
    const { error } = await supabase.from('diploma_courses').insert({
      institution_id: me.institution_id,
      diploma_id: diplomaId,
      course_id: courseId,
      sort_order: sortOrder,
    })
    if (error) throw error
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('diploma_courses')
      .delete()
      .in('id', toRemove.map((r) => r.id))
    if (error) throw error
  }

  return wanted
}

export const getDiplomaCourses = async () => {
  const { data, error } = await supabase
    .from('diploma_courses')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export const assignCourseToDiploma = async (diplomaId, courseId) => {
  const me = await getMyProfile()
  const sortOrder = await nextDiplomaCourseSort(diplomaId)
  const { data: row, error } = await supabase
    .from('diploma_courses')
    .insert({
      institution_id: me.institution_id,
      diploma_id: diplomaId,
      course_id: courseId,
      sort_order: sortOrder,
    })
    .select()
    .single()
  if (error) throw error
  return row
}

export const removeCourseFromDiploma = async (diplomaId, courseId) => {
  const { error } = await supabase
    .from('diploma_courses')
    .delete()
    .eq('diploma_id', diplomaId)
    .eq('course_id', courseId)
  if (error) throw error
  return true
}

// --- Courses ---
export const getCourses = async () => {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export const createCourse = async (data) => {
  const me = await getMyProfile()
  const diplomaIds = normalizeDiplomaIds(data) || []
  const primaryDiplomaId = diplomaIds[0] || null

  const { data: row, error } = await supabase
    .from('courses')
    .insert({
      institution_id: me.institution_id,
      name: data.name,
      code: data.code,
      type: data.type || 'regular',
      diploma_id: primaryDiplomaId,
      sort_order: 0,
    })
    .select()
    .single()
  if (error) throw error

  if (diplomaIds.length) {
    await syncCourseDiplomas(row.id, diplomaIds)
  }
  return row
}

export const updateCourse = async (id, data) => {
  const updates: any = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.code !== undefined) updates.code = data.code
  if (data.type !== undefined) updates.type = data.type
  if (data.sort_order !== undefined) updates.sort_order = Number(data.sort_order) || 0

  // diploma_ids replaces membership; diploma_id on edit is ignored so the
  // original course form cannot pull a shared course off other diplomas.
  if (Array.isArray(data?.diploma_ids)) {
    const diplomaIds = normalizeDiplomaIds(data) || []
    updates.diploma_id = diplomaIds[0] || null
    if (!diplomaIds.length) updates.sort_order = 0
    const { data: row, error } = await supabase.from('courses').update(updates).eq('id', id).select().single()
    if (error) throw error
    await syncCourseDiplomas(id, diplomaIds)
    return row
  }

  const { data: row, error } = await supabase.from('courses').update(updates).eq('id', id).select().single()
  if (error) throw error
  return row
}

export const deleteCourse = async (id) => {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
  return true
}

/** Persist diploma course order (1-based via RPC). */
export const reorderDiplomaCourses = async (diplomaId, courseIds) => {
  const ids = (Array.isArray(courseIds) ? courseIds : []).map(String).filter(Boolean)
  if (!diplomaId || ids.length === 0) throw new Error('INVALID_COURSE_LIST')
  const { data, error } = await supabase.rpc('reorder_diploma_courses', {
    p_diploma_id: diplomaId,
    p_course_ids: ids,
  })
  if (error) throw error
  return data
}

// --- Diplomas ---
export const getDiplomas = async () => {
  const { data, error } = await supabase.from('diplomas').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const createDiploma = async (data) => {
  const me = await getMyProfile()
  const { data: row, error } = await supabase
    .from('diplomas')
    .insert({
      institution_id: me.institution_id,
      name: data.name,
      description: data.description || null,
    })
    .select()
    .single()
  if (error) throw error
  return row
}

export const updateDiploma = async (id, data) => {
  const { data: row, error } = await supabase
    .from('diplomas')
    .update({
      name: data.name,
      description: data.description,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return row
}

export const deleteDiploma = async (id) => {
  const { error } = await supabase.from('diplomas').delete().eq('id', id)
  if (error) throw error
  return true
}

// --- Classes ---
export const getClasses = async () => {
  const withInstructor = await supabase
    .from('classes')
    .select('*, instructor:profiles!classes_instructor_id_fkey(id, full_name, email)')
    .order('created_at', { ascending: false })
  if (!withInstructor.error) {
    return (withInstructor.data || []).map(mapClass)
  }
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapClass)
}

export const getActiveClasses = async () => {
  const all = await getClasses()
  return all.filter((c) => c.is_active)
}

export const createClass = async (data) => {
  const me = await getMyProfile()
  const payload = { ...classPayloadFromUi(data), institution_id: me.institution_id }
  const CLASS_SELECT =
    '*, instructor:profiles!classes_instructor_id_fkey(id, full_name, email)'

  const { data: row, error } = await supabase.from('classes').insert(payload).select(CLASS_SELECT).single()
  if (error) throw error
  return mapClass(row)
}

export const updateClass = async (id, data) => {
  const updates: any = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.instructor_id !== undefined) {
    updates.instructor_id =
      data.instructor_id && data.instructor_id !== 'none' ? data.instructor_id : null
  }
  if (data.start_date !== undefined) updates.start_month = data.start_date
  if (data.start_month !== undefined) updates.start_month = data.start_month
  if (data.end_date !== undefined) updates.end_month = data.end_date
  if (data.end_month !== undefined) updates.end_month = data.end_month
  if (data.duration_months !== undefined) updates.duration = String(data.duration_months)
  if (data.duration !== undefined) updates.duration = String(data.duration)
  if (data.fee !== undefined) updates.total_fee = Number(data.fee)
  if (data.total_fee !== undefined) updates.total_fee = Number(data.total_fee)
  if (data.is_active !== undefined) updates.status = data.is_active ? 'active' : 'inactive'
  if (data.status !== undefined) updates.status = data.status
  if (data.commission_rate !== undefined) updates.commission_rate = Number(data.commission_rate)
  if (data.settlement_model !== undefined) {
    updates.settlement_model =
      data.settlement_model === 'fixed_fee' ? 'fixed_fee' : 'commission'
  }
  if (data.instructor_fixed_fee !== undefined) {
    updates.instructor_fixed_fee = Math.max(0, Number(data.instructor_fixed_fee) || 0)
  }
  if (data.program_type !== undefined) updates.program_type = data.program_type
  if (data.course_id !== undefined) {
    updates.course_id = data.course_id && data.course_id !== 'none' ? data.course_id : null
  }
  if (data.diploma_id !== undefined) {
    updates.diploma_id = data.diploma_id && data.diploma_id !== 'none' ? data.diploma_id : null
  }
  // Keep fee at 0 when switching back to commission
  if (updates.settlement_model === 'commission' && data.instructor_fixed_fee === undefined) {
    updates.instructor_fixed_fee = 0
  }

  const { data: row, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', id)
    .select('*, instructor:profiles!classes_instructor_id_fkey(id, full_name, email)')
    .single()
  if (error) throw error
  return mapClass(row)
}

export const deleteClass = async (id) => {
  const { error } = await supabase.from('classes').delete().eq('id', id)
  if (error) throw error
  return true
}

export const getClassCourses = async () => {
  const { data, error } = await supabase.from('class_courses').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export const addClassCourse = async (classId, courseId) => {
  const me = await getMyProfile()
  const { data: row, error } = await supabase
    .from('class_courses')
    .insert({
      institution_id: me.institution_id,
      class_id: classId,
      course_id: courseId,
    })
    .select()
    .single()
  if (error) throw error
  return row
}

export const removeClassCourse = async (id) => {
  const { error } = await supabase.from('class_courses').delete().eq('id', id)
  if (error) throw error
  return true
}

// --- Enrollments ---
export const getEnrollments = async () => {
  const { data, error } = await supabase.from('enrollments').select('*').order('enrolled_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapEnrollment)
}

export const createEnrollment = async (data) => {
  const me = await getMyProfile()
  const { data: row, error } = await supabase
    .from('enrollments')
    .insert({
      institution_id: me.institution_id,
      student_id: data.student_id,
      class_id: data.class_id,
      discount_amount: Number(data.discount_amount ?? 0),
    })
    .select()
    .single()
  if (error) throw error
  return mapEnrollment(row)
}

export const updateEnrollment = async (id, data) => {
  const updates: any = {}
  if (data.class_id) updates.class_id = data.class_id
  if (data.student_id) updates.student_id = data.student_id
  if (data.discount_amount !== undefined) updates.discount_amount = Number(data.discount_amount)
  const { data: row, error } = await supabase.from('enrollments').update(updates).eq('id', id).select().single()
  if (error) throw error
  return mapEnrollment(row)
}

export const deleteEnrollment = async (id) => {
  const { error } = await supabase.from('enrollments').delete().eq('id', id)
  if (error) throw error
  return true
}

// --- Payments ---
export const getPayments = async () => {
  const [{ data: payments, error }, { data: enrollments }] = await Promise.all([
    supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    supabase.from('enrollments').select('id, student_id, class_id'),
  ])
  if (error) throw error
  const byId = Object.fromEntries((enrollments || []).map((e) => [e.id, e]))
  return (payments || []).map((p) => mapPayment(p, byId))
}

/** Completed registration-fee payment for this student (DB SSOT; fee amount 0 = cleared). */
export const studentHasPaidRegistrationFee = async (studentId) => {
  if (!studentId) return false
  const { data, error } = await supabase.rpc('student_has_cleared_registration_fee', {
    p_student_id: studentId,
  })
  if (error) throw error
  return Boolean(data)
}

async function assertRegistrationFeePaidIfRequired({
  institutionId,
  studentId,
  isRegistration,
}) {
  if (isRegistration || !institutionId || !studentId) return

  const { data: inst, error: instErr } = await supabase
    .from('institutions')
    .select('registration_fee_amount')
    .eq('id', institutionId)
    .maybeSingle()
  if (instErr) throw instErr

  const fee = Number(inst?.registration_fee_amount ?? 0)
  if (!Number.isFinite(fee) || fee <= 0) return

  const paid = await studentHasPaidRegistrationFee(studentId)
  if (!paid) throw new Error('REGISTRATION_FEE_REQUIRED')
}

export const createPayment = async (data) => {
  const me = await getMyProfile()
  let enrollmentId = data.enrollment_id
  let studentId = data.student_id
  if (!enrollmentId && data.student_id && data.class_id) {
    const { data: enr } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', data.student_id)
      .eq('class_id', data.class_id)
      .maybeSingle()
    enrollmentId = enr?.id
  }
  if (!enrollmentId) throw new Error('Enrollment required — select student and class')

  if (!studentId) {
    const { data: enr } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('id', enrollmentId)
      .maybeSingle()
    studentId = enr?.student_id
  }

  const method = ['cash', 'bank', 'other'].includes(data.method) ? data.method : 'cash'
  const isRegistration = Boolean(data.is_registration_fee)
  const status = ['pending', 'completed', 'failed'].includes(data.status) ? data.status : 'completed'

  const monthKey = String(data.month_paid || '').trim().slice(0, 7)
  const extraNote = String(data.notes || data.note || '').trim()
  let note: string | null = null
  if (isRegistration) {
    note = extraNote || 'Registration Fee'
  } else if (/^\d{4}-\d{2}$/.test(monthKey)) {
    const cleaned = extraNote.replace(/^\d{4}-\d{2}\s*[—\-–]?\s*/, '')
    note = cleaned && cleaned !== monthKey ? `${monthKey} — ${cleaned}` : monthKey
  } else {
    note = extraNote || null
  }

  const amount = Number(data.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT')

  await assertRegistrationFeePaidIfRequired({
    institutionId: me.institution_id,
    studentId,
    isRegistration,
  })

  const { data: row, error } = await supabase
    .from('payments')
    .insert({
      institution_id: me.institution_id,
      enrollment_id: enrollmentId,
      amount,
      method,
      note,
      status,
      is_registration_fee: isRegistration,
      recorded_by: me.id,
      paid_at: data.payment_date || data.paid_at || new Date().toISOString(),
    })
    .select()
    .single()
  if (error) {
    const msg = String(error.message || '')
    if (/REGISTRATION_FEE_REQUIRED/i.test(msg)) throw new Error('REGISTRATION_FEE_REQUIRED')
    if (/PAYMENT_EXCEEDS_MONTHLY_DUE/i.test(msg)) throw new Error('PAYMENT_EXCEEDS_MONTHLY_DUE')
    if (/PAYMENT_EXCEEDS_BALANCE/i.test(msg)) throw new Error('PAYMENT_EXCEEDS_BALANCE')
    if (/REGISTRATION_FEE_DISABLED/i.test(msg)) throw new Error('REGISTRATION_FEE_DISABLED')
    throw error
  }

  await writeTenantAuditLog('payment.created', 'payment', row.id, {
    enrollment_id: enrollmentId,
    amount,
    method,
    status,
    is_registration_fee: isRegistration,
  })

  return mapPayment(row, { [enrollmentId]: { student_id: data.student_id, class_id: data.class_id } })
}

export const updatePayment = async (id, data) => {
  const updates: any = {}
  if (data.amount !== undefined) updates.amount = Number(data.amount)
  if (data.method) updates.method = data.method
  if (data.status !== undefined) updates.status = data.status
  if (data.is_registration_fee !== undefined) {
    updates.is_registration_fee = Boolean(data.is_registration_fee)
  }
  if (data.payment_date || data.paid_at) {
    updates.paid_at = data.payment_date || data.paid_at
  }

  const isRegistration = data.is_registration_fee === true
  const monthKey = String(data.month_paid || '').trim().slice(0, 7)
  const extraNote = String(data.notes ?? data.note ?? '').trim()
  if (data.note !== undefined || data.notes !== undefined || data.month_paid !== undefined) {
    if (isRegistration || data.is_registration_fee === true) {
      updates.note = extraNote || 'Registration Fee'
    } else if (/^\d{4}-\d{2}$/.test(monthKey)) {
      const cleaned = extraNote.replace(/^\d{4}-\d{2}\s*[—\-–]?\s*/, '')
      updates.note = cleaned && cleaned !== monthKey ? `${monthKey} — ${cleaned}` : monthKey
    } else if (data.note !== undefined) {
      updates.note = data.note
    } else if (data.notes !== undefined) {
      updates.note = data.notes
    }
  }

  const { data: row, error } = await supabase.from('payments').update(updates).eq('id', id).select().single()
  if (error) {
    const msg = String(error.message || '')
    if (/PAYMENT_EXCEEDS_MONTHLY_DUE/i.test(msg)) throw new Error('PAYMENT_EXCEEDS_MONTHLY_DUE')
    if (/PAYMENT_EXCEEDS_BALANCE/i.test(msg)) throw new Error('PAYMENT_EXCEEDS_BALANCE')
    if (/REGISTRATION_FEE_DISABLED/i.test(msg)) throw new Error('REGISTRATION_FEE_DISABLED')
    throw error
  }
  return mapPayment(row)
}

export const deletePayment = async (id) => {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
  return true
}

/** @deprecated Tenant WaafiPay charging is disabled — institutions use manual Finance payments.
 *  Platform Plans & Subscriptions billing is deferred to super-admin (no tenant enrollment charges). */
export const chargeWaafiPay = async (_args?: { enrollment_id?: string; amount?: number; phone?: string }) => {
  throw new Error('WAAFIPAY_TENANT_DISABLED')
}

// --- Attendance ---
async function ensureSession(classId, date, topic = null) {
  const me = await getMyProfile()
  const sessionDate = String(date).slice(0, 10)
  const { data: existing } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('class_id', classId)
    .eq('session_date', sessionDate)
    .maybeSingle()
  if (existing) return existing
  const { data: created, error } = await supabase
    .from('class_sessions')
    .insert({
      institution_id: me.institution_id,
      class_id: classId,
      session_date: sessionDate,
      topic,
    })
    .select()
    .single()
  if (error) throw error
  return created
}

async function fetchAttendanceForSessions(sessionIds) {
  if (!sessionIds.length) return []
  const chunkSize = 100
  const rows = []
  for (let i = 0; i < sessionIds.length; i += chunkSize) {
    const chunk = sessionIds.slice(i, i + chunkSize)
    const { data, error } = await supabase.from('attendance').select('*').in('session_id', chunk)
    if (error) throw error
    if (data?.length) rows.push(...data)
  }
  return rows
}

export const getAttendance = async () => {
  // Prefer filtered helpers (getAttendanceEnriched / ByClassAndDate) — full dump is expensive
  const { data: sessions, error: sErr } = await supabase
    .from('class_sessions')
    .select('id, class_id, session_date, topic')
    .order('session_date', { ascending: false })
    .limit(500)
  if (sErr) throw sErr
  const byId = Object.fromEntries((sessions || []).map((s) => [s.id, s]))
  const rows = await fetchAttendanceForSessions((sessions || []).map((s) => s.id))
  return rows.map((r) => mapAttendance(r, byId))
}

export const getAttendanceByClass = async (classId) => {
  const { data: sessions, error: sErr } = await supabase
    .from('class_sessions')
    .select('id, class_id, session_date, topic')
    .eq('class_id', classId)
  if (sErr) throw sErr
  const byId = Object.fromEntries((sessions || []).map((s) => [s.id, s]))
  const rows = await fetchAttendanceForSessions((sessions || []).map((s) => s.id))
  return rows.map((r) => mapAttendance(r, byId))
}

export const getAttendanceByClassAndDate = async (classId, date) => {
  const day = String(date).slice(0, 10)
  const { data: session, error: sErr } = await supabase
    .from('class_sessions')
    .select('id, class_id, session_date, topic')
    .eq('class_id', classId)
    .eq('session_date', day)
    .maybeSingle()
  if (sErr) throw sErr
  if (!session) return []
  const rows = await fetchAttendanceForSessions([session.id])
  return rows.map((r) => mapAttendance(r, { [session.id]: session }))
}

/**
 * Filtered attendance for reports. Accepts hook-style keys:
 * dateFrom, dateTo, classId | class_id, classIds, student_id
 */
export const getAttendanceEnriched = async (filters: any = {}) => {
  let sessionQuery = supabase
    .from('class_sessions')
    .select('id, class_id, session_date, topic')

  const dateFrom = filters.dateFrom || filters.date_from
  const dateTo = filters.dateTo || filters.date_to
  const classId = filters.classId || filters.class_id
  const classIds = filters.classIds || filters.class_ids

  if (dateFrom) sessionQuery = sessionQuery.gte('session_date', String(dateFrom).slice(0, 10))
  if (dateTo) sessionQuery = sessionQuery.lte('session_date', String(dateTo).slice(0, 10))
  if (filters.date) sessionQuery = sessionQuery.eq('session_date', String(filters.date).slice(0, 10))
  if (classId && classId !== 'all') sessionQuery = sessionQuery.eq('class_id', classId)
  else if (Array.isArray(classIds) && classIds.length) sessionQuery = sessionQuery.in('class_id', classIds)

  const { data: sessions, error: sErr } = await sessionQuery
  if (sErr) throw sErr
  if (!sessions?.length) return []

  const byId = Object.fromEntries(sessions.map((s) => [s.id, s]))
  let rows = await fetchAttendanceForSessions(sessions.map((s) => s.id))
  if (filters.student_id) rows = rows.filter((r) => r.student_id === filters.student_id)

  const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))]
  const uniqueClassIds = [...new Set(sessions.map((s) => s.class_id).filter(Boolean))]

  const [profilesRes, classesRes] = await Promise.all([
    studentIds.length
      ? supabase.from('profiles').select('id, full_name, email').in('id', studentIds)
      : Promise.resolve({ data: [] }),
    uniqueClassIds.length
      ? supabase.from('classes').select('id, name').in('id', uniqueClassIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileById = Object.fromEntries((profilesRes.data || []).map((p) => [p.id, p]))
  const classById = Object.fromEntries((classesRes.data || []).map((c) => [c.id, c]))

  return rows.map((r) => {
    const mapped = mapAttendance(r, byId)
    const profile = profileById[r.student_id]
    const cls = classById[mapped.class_id]
    return {
      ...mapped,
      student: profile
        ? { id: profile.id, name: profile.full_name, student_code: profile.email?.split('@')[0] }
        : null,
      class: cls ? { id: cls.id, name: cls.name } : null,
    }
  })
}

/** Transactional email via EmailJS (client-side). */
export const sendTransactionalEmail = async ({ trigger, ...payload }) => {
  const { sendEmailJsMessage } = await import('@/lib/emailjs')

  if (trigger === 'payment_due') {
    const studentId = payload.student_id
    if (!studentId) throw new Error('student_id required')
    const student = await getProfile(studentId)
    if (!student?.email) throw new Error('Student has no email')
    const message = payload.message || 'You have an outstanding balance. Please pay soon.'
    const result = await sendEmailJsMessage({
      toEmail: student.email,
      toName: student.name || student.full_name || 'Student',
      subject: 'Payment reminder',
      message,
    })
    if (!result.ok) throw new Error(result.error || 'Email failed')
    return { ok: true, emailed: true, trigger }
  }

  throw new Error(`Email trigger "${trigger}" is not supported via EmailJS yet`)
}

export const sendPaymentReminderEmail = async (studentId, message) =>
  sendTransactionalEmail({
    trigger: 'payment_due',
    student_id: studentId,
    message,
  })

export const bulkUpsertAttendanceWithDuplicatePrevention = async (records) => {
  const me = await getMyProfile()
  const results = []
  for (const rec of records) {
    const classId = rec.class_id
    const date = rec.date
    const session = await ensureSession(classId, date, rec.topic)
    const status = ['present', 'absent', 'late', 'excused'].includes(rec.status) ? rec.status : 'present'
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('session_id', session.id)
      .eq('student_id', rec.student_id)
      .maybeSingle()
    if (existing) {
      const { data, error } = await supabase
        .from('attendance')
        .update({ status, notes: rec.notes ?? null })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) throw error
      results.push(mapAttendance(data, { [session.id]: session }))
    } else {
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          institution_id: me.institution_id,
          session_id: session.id,
          student_id: rec.student_id,
          status,
          notes: rec.notes ?? null,
        })
        .select()
        .single()
      if (error) throw error
      results.push(mapAttendance(data, { [session.id]: session }))
    }
  }
  return results
}

export const upsertAttendanceRecord = async (record) => {
  const [row] = await bulkUpsertAttendanceWithDuplicatePrevention([record])
  return row
}

// --- Settlements / withdrawals ---
export const getCommissions = async () => {
  const { data, error } = await supabase
    .from('instructor_settlements')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return enrichSettlements(data || [])
}

export const getAffiliateSettlements = async () => {
  const { data, error } = await supabase
    .from('affiliate_settlements')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const getWithdrawalRequests = async () => {
  const { data, error } = await supabase.from('withdrawals').select('*').order('requested_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const createWithdrawalRequest = async (data) => {
  const me = await getMyProfile()
  const amount = Number(data.amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_AMOUNT')
  const isAffiliate = me.role === 'affiliate' || data.affiliate_id
  const payload = isAffiliate
    ? {
        institution_id: me.institution_id,
        instructor_id: null,
        affiliate_id: data.affiliate_id || me.id,
        amount,
        note: data.note || null,
        method: data.method || null,
        payment_details: data.payment_details || null,
        status: 'pending',
      }
    : {
        institution_id: me.institution_id,
        instructor_id: data.instructor_id || me.id,
        affiliate_id: null,
        amount,
        note: data.note || null,
        method: data.method || null,
        payment_details: data.payment_details || null,
        status: 'pending',
      }
  const { data: row, error } = await supabase
    .from('withdrawals')
    .insert(payload)
    .select()
    .single()
  if (error) {
    const msg = String(error.message || '')
    if (/WITHDRAWAL_EXCEEDS_BALANCE|ka badan yahay balance/i.test(msg)) {
      throw new Error('WITHDRAWAL_EXCEEDS_BALANCE')
    }
    throw error
  }
  return row
}

export const updateWithdrawalRequest = async (id, data) => {
  const updates = { ...data }
  if (data.status && data.status !== 'pending') {
    updates.processed_at = new Date().toISOString()
    const me = await getMyProfile()
    updates.processed_by = me.id
  }
  const { data: row, error } = await supabase.from('withdrawals').update(updates).eq('id', id).select().single()
  if (error) {
    const msg = String(error.message || '')
    if (/WITHDRAWAL_EXCEEDS_BALANCE|ka badan yahay balance/i.test(msg)) {
      throw new Error('WITHDRAWAL_EXCEEDS_BALANCE')
    }
    throw error
  }
  return row
}

/** Flat settlement rows (created_at, amount, class_id, …) — UI expects this shape. */
export const getInstructorEarnings = async () => getCommissions()

type CertificateEligibilityOptions = {
  classId?: string | null
  studentId?: string | null
}

type CertificateBatchOptions = CertificateEligibilityOptions & {
  enrollmentIds?: string[] | null
  studentIds?: string[] | null
}

/** Certificate eligibility rows from DB (class finished + grades + paid + not issued). */
export const listCertificateEligibleEnrollments = async (
  options: CertificateEligibilityOptions = {},
) => {
  const { data, error } = await supabase.rpc('list_certificate_eligible_enrollments', {
    p_class_id: options.classId || null,
    p_student_id: options.studentId || null,
  })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export const checkEnrollmentCertificateEligibility = async (enrollmentId) => {
  const { data, error } = await supabase.rpc('check_enrollment_certificate_eligibility', {
    p_enrollment_id: enrollmentId,
  })
  if (error) throw error
  return data
}

/** Auto-generate certificates for eligible enrollments only (DB-gated). */
export const autoGenerateCertificatesBatch = async (options: CertificateBatchOptions = {}) => {
  const enrollmentIds = Array.isArray(options.enrollmentIds)
    ? options.enrollmentIds.filter(Boolean)
    : null
  const studentIds = Array.isArray(options.studentIds) ? options.studentIds.filter(Boolean) : null
  const classId = options.classId || null
  const studentId = options.studentId || (studentIds?.length === 1 ? studentIds[0] : null)

  const me = await getMyProfile()
  if (!me?.institution_id) throw new Error('FORBIDDEN')

  const { data: complete } = await supabase.rpc('institution_settings_complete', {
    p_institution_id: me.institution_id,
  })
  if (!complete) throw new Error('INSTITUTION_SETTINGS_INCOMPLETE')

  const eligibilityRows = await listCertificateEligibleEnrollments({
    classId,
    studentId: studentId || null,
  })

  let candidates = (eligibilityRows || []).filter((row) => row?.eligible === true)
  if (enrollmentIds?.length) {
    const allow = new Set(enrollmentIds)
    candidates = candidates.filter((row) => allow.has(row.enrollment_id))
  }
  if (studentIds?.length) {
    const allow = new Set(studentIds)
    candidates = candidates.filter((row) => allow.has(row.student_id))
  }

  const [{ data: existing, error: certErr }] = await Promise.all([
    supabase
      .from('certificates')
      .select('id, student_id, class_id, enrollment_id, certificate_number')
      .eq('institution_id', me.institution_id),
  ])
  if (certErr) throw certErr

  const { data: snapshot, error: snapErr } = await supabase.rpc('build_document_branding_snapshot', {
    p_institution_id: me.institution_id,
    p_document_type: 'certificate',
  })
  if (snapErr) throw snapErr

  const toCreate = candidates.map((row) => ({
    id: row.enrollment_id,
    student_id: row.student_id,
    class_id: row.class_id,
  }))
  const totalConsidered = enrollmentIds?.length
    ? enrollmentIds.length
    : (eligibilityRows || []).length
  if (!toCreate.length) {
    return {
      generated: 0,
      skipped: totalConsidered,
      ineligible: (eligibilityRows || []).filter((r) => r?.eligible !== true).length,
      total_processed: totalConsidered,
      certificates: [],
    }
  }

  // Resolve class / course / diploma names for real program data on certificates
  const classIds = [...new Set(toCreate.map((e) => e.class_id).filter(Boolean))]
  const { data: classRows } = classIds.length
    ? await supabase
        .from('classes')
        .select('id, name, course_id, diploma_id, program_type')
        .in('id', classIds)
    : { data: [] }
  const classById = Object.fromEntries((classRows || []).map((c) => [c.id, c]))
  const courseIds = [...new Set((classRows || []).map((c) => c.course_id).filter(Boolean))]
  const diplomaIds = [...new Set((classRows || []).map((c) => c.diploma_id).filter(Boolean))]
  const [{ data: courses }, { data: diplomas }] = await Promise.all([
    courseIds.length
      ? supabase.from('courses').select('id, name').in('id', courseIds)
      : Promise.resolve({ data: [] }),
    diplomaIds.length
      ? supabase.from('diplomas').select('id, name').in('id', diplomaIds)
      : Promise.resolve({ data: [] }),
  ])
  const courseById = Object.fromEntries((courses || []).map((c) => [c.id, c]))
  const diplomaById = Object.fromEntries((diplomas || []).map((d) => [d.id, d]))

  const year = new Date().getFullYear()
  const existingNums = (existing || [])
    .map((c) => String(c.certificate_number || ''))
    .map((n) => {
      const m = n.match(new RegExp(`^CERT-${year}-(\\d+)$`, 'i'))
      return m ? Number(m[1]) : 0
    })
  let seq = Math.max(0, ...existingNums, (existing || []).length)

  const items = toCreate.map((enr) => {
    seq += 1
    const cls = classById[enr.class_id]
    const course = cls?.course_id ? courseById[cls.course_id] : null
    const diploma = cls?.diploma_id ? diplomaById[cls.diploma_id] : null
    const programName = diploma?.name || course?.name || cls?.name || null
    return {
      student_id: enr.student_id,
      class_id: enr.class_id,
      enrollment_id: enr.id,
      certificate_number: `CERT-${year}-${String(seq).padStart(5, '0')}`,
      template_snapshot: {
        ...(snapshot && typeof snapshot === 'object' ? snapshot : {}),
        class_id: enr.class_id,
        enrollment_id: enr.id,
        course_id: cls?.course_id || null,
        diploma_id: cls?.diploma_id || null,
        class_name: cls?.name || null,
        program_name: programName,
        course_name: course?.name || null,
        diploma_name: diploma?.name || null,
      },
    }
  })

  const created = items.length ? await generateCertificatesBatch(items) : []
  return {
    generated: created.length,
    skipped: Math.max(0, totalConsidered - created.length),
    ineligible: (eligibilityRows || []).filter((r) => r?.eligible !== true).length,
    total_processed: totalConsidered,
    certificates: created,
  }
}

/** Generate certificates for selected enrollment IDs (Report Center student picker). */
export const generateCertificatesForEnrollments = async (enrollmentIds) => {
  return autoGenerateCertificatesBatch({ enrollmentIds: enrollmentIds || [] })
}

export const getInstructorPaymentTransferLog = async (classId) => {
  const { data, error } = await supabase
    .from('instructor_settlements')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// --- Phase 2 Academic Ops ---

function mapExam(row) {
  if (!row) return null
  const passing = Number(row.passing_score)
  return {
    ...row,
    total_marks: Number(row.final_marks ?? row.total_marks ?? 0),
    passing_score: Number.isFinite(passing) ? passing : 50,
  }
}

function mapResult(row) {
  if (!row) return null
  return {
    ...row,
    score: Number(row.final_score ?? row.raw_score ?? 0),
    total_marks: Number(row.total_marks ?? 0) || undefined,
    submission_date: row.graded_at || row.created_at,
  }
}

export const getAssignments = async () => {
  const { data, error } = await supabase.from('assignments').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const createAssignment = async (data) => {
  const me = await getMyProfile()
  const { data: row, error } = await supabase
    .from('assignments')
    .insert({
      institution_id: me.institution_id,
      class_id: data.class_id,
      course_id: data.course_id || null,
      title: data.title,
      description: data.description || null,
      due_date: data.due_date || null,
      total_marks: Number(data.total_marks ?? 100),
      weight: Math.min(100, Math.max(0, Number(data.weight ?? 100) || 100)),
      counts_toward_grade: data.counts_toward_grade !== false,
      attachment_url: data.attachment_url || null,
      created_by: me.id,
    })
    .select()
    .single()
  if (error) throw error
  return row
}

export const updateAssignment = async (id, data) => {
  const updates: any = {}
  if (data.title !== undefined) updates.title = data.title
  if (data.description !== undefined) updates.description = data.description
  if (data.class_id !== undefined) updates.class_id = data.class_id
  if (data.course_id !== undefined) updates.course_id = data.course_id || null
  if (data.due_date !== undefined) updates.due_date = data.due_date
  if (data.total_marks !== undefined) updates.total_marks = Number(data.total_marks)
  if (data.weight !== undefined) {
    updates.weight = Math.min(100, Math.max(0, Number(data.weight) || 100))
  }
  if (data.counts_toward_grade !== undefined) {
    updates.counts_toward_grade = data.counts_toward_grade !== false
  }
  if (data.attachment_url !== undefined) updates.attachment_url = data.attachment_url
  const { data: row, error } = await supabase.from('assignments').update(updates).eq('id', id).select().single()
  if (error) throw error
  return row
}

export const deleteAssignment = async (id) => {
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) throw error
  return true
}

export const getAssignmentSubmissions = async () => {
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data || []).map((row) => ({
    ...row,
    grade: row.score,
    score: row.score,
  }))
}

export const createSubmission = async (data) => {
  const me = await getMyProfile()
  const canGrade = me?.role === 'admin' || me?.role === 'staff' || me?.role === 'instructor'
  const scoreRaw = canGrade ? (data.score ?? data.grade) : undefined
  const payload: any = {
    institution_id: me.institution_id,
    assignment_id: data.assignment_id,
    student_id: data.student_id || me.id,
    content: data.content || data.submission_content || null,
    file_url: data.file_url || data.attachment_url || null,
    submitted_at: data.submitted_at || data.submission_date || new Date().toISOString(),
  }
  if (canGrade && scoreRaw !== undefined && scoreRaw !== null && scoreRaw !== '') {
    payload.score = Number(scoreRaw)
  }
  if (canGrade && data.feedback !== undefined) payload.feedback = data.feedback
  if (canGrade && (data.graded_by || scoreRaw != null)) {
    payload.graded_by = data.graded_by || me.id
    payload.graded_at = data.graded_at || new Date().toISOString()
  }

  const { data: row, error } = await supabase
    .from('assignment_submissions')
    .upsert(payload, { onConflict: 'assignment_id,student_id' })
    .select()
    .single()
  if (error) throw error
  return row
}

export const gradeSubmission = async (submissionId, gradeData) => {
  const me = await getMyProfile()
  const scoreRaw = gradeData.score ?? gradeData.grade
  const { data: row, error } = await supabase
    .from('assignment_submissions')
    .update({
      score: scoreRaw != null && scoreRaw !== '' ? Number(scoreRaw) : null,
      feedback: gradeData.feedback ?? null,
      graded_by: me.id,
      graded_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
    .select()
    .single()
  if (error) throw error
  return row
}

export const getExams = async () => {
  const { data, error } = await supabase.from('exams').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapExam)
}

export const createExam = async (data) => {
  const me = await getMyProfile()
  const passingRaw = Number(data.passing_score ?? 50)
  const passing_score = Math.min(100, Math.max(0, Number.isFinite(passingRaw) ? passingRaw : 50))
  const { data: row, error } = await supabase
    .from('exams')
    .insert({
      institution_id: me.institution_id,
      class_id: data.class_id,
      course_id: data.course_id || null,
      title: data.title,
      description: data.description || null,
      // Manual grading only — online MCQ exams are disabled.
      marking_type: 'manual',
      final_marks: Number(data.final_marks ?? data.total_marks ?? 100),
      attendance_marks: Number(data.attendance_marks ?? 0),
      weight: Number(data.weight ?? 100),
      passing_score,
      open_time: data.open_time || new Date().toISOString(),
      close_time: data.close_time || new Date(Date.now() + 31536000000).toISOString(),
      is_active: Boolean(data.is_active),
      created_by: me.id,
    })
    .select()
    .single()
  if (error) throw error
  return mapExam(row)
}

export const updateExam = async (id, data) => {
  const updates: any = {}
  if (data.title !== undefined) updates.title = data.title
  if (data.description !== undefined) updates.description = data.description
  if (data.class_id !== undefined) updates.class_id = data.class_id
  if (data.course_id !== undefined) updates.course_id = data.course_id
  // Never allow flipping exams back to online MCQ from the client.
  if (data.marking_type !== undefined) updates.marking_type = 'manual'
  if (data.final_marks !== undefined) updates.final_marks = Number(data.final_marks)
  if (data.total_marks !== undefined) updates.final_marks = Number(data.total_marks)
  if (data.attendance_marks !== undefined) updates.attendance_marks = Number(data.attendance_marks)
  if (data.weight !== undefined) updates.weight = Number(data.weight)
  if (data.passing_score !== undefined) {
    const passingRaw = Number(data.passing_score)
    updates.passing_score = Math.min(100, Math.max(0, Number.isFinite(passingRaw) ? passingRaw : 50))
  }
  if (data.open_time !== undefined) updates.open_time = data.open_time
  if (data.close_time !== undefined) updates.close_time = data.close_time
  if (data.is_active !== undefined) updates.is_active = Boolean(data.is_active)
  const { data: row, error } = await supabase.from('exams').update(updates).eq('id', id).select().single()
  if (error) throw error
  return mapExam(row)
}

export const deleteExam = async (id) => {
  const { error } = await supabase.from('exams').delete().eq('id', id)
  if (error) throw error
  return true
}

export const getResults = async () => {
  const { data, error } = await supabase.from('exam_results').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapResult)
}

/** Fetch a single exam result by id (or by exam_id for the current user). */
export const getExamResultById = async (id) => {
  if (!id) return null
  const byId = await supabase.from('exam_results').select('*').eq('id', id).maybeSingle()
  if (byId.error) throw byId.error
  if (byId.data) return mapResult(byId.data)

  const me = await getMyProfile()
  const byExam = await supabase
    .from('exam_results')
    .select('*')
    .eq('exam_id', id)
    .eq('student_id', me.id)
    .maybeSingle()
  if (byExam.error) throw byExam.error
  return byExam.data ? mapResult(byExam.data) : null
}

export const checkResultExists = async (examId, studentId) => {
  const { data, error } = await supabase
    .from('exam_results')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw error
  return data ? mapResult(data) : null
}

export const createOrUpdateExamResult = async (data) => {
  const me = await getMyProfile()
  const raw = Number(data.raw_score ?? data.score ?? data.final_score ?? 0)
  const final = Number(data.final_score ?? data.score ?? raw)
  const payload = {
    institution_id: data.institution_id || me.institution_id,
    exam_id: data.exam_id,
    student_id: data.student_id,
    enrollment_id: data.enrollment_id || null,
    raw_score: raw,
    final_score: final,
    answers: data.answers || [],
    comments: data.comments || null,
    graded_by: me.id,
    graded_at: new Date().toISOString(),
  }
  const { data: row, error } = await supabase
    .from('exam_results')
    .upsert(payload, { onConflict: 'exam_id,student_id' })
    .select()
    .single()
  if (error) throw error
  return mapResult(row)
}

export const createResult = createOrUpdateExamResult
export const upsertResult = createOrUpdateExamResult

export const updateResult = async (id, data) => {
  const updates: any = {}
  if (data.raw_score !== undefined) updates.raw_score = Number(data.raw_score)
  if (data.final_score !== undefined) updates.final_score = Number(data.final_score)
  if (data.score !== undefined) {
    updates.raw_score = Number(data.score)
    updates.final_score = Number(data.score)
  }
  if (data.answers !== undefined) updates.answers = data.answers
  if (data.comments !== undefined) updates.comments = data.comments
  updates.graded_at = new Date().toISOString()
  const { data: row, error } = await supabase.from('exam_results').update(updates).eq('id', id).select().single()
  if (error) throw error
  return mapResult(row)
}

export const deleteResult = async (id) => {
  const { error } = await supabase.from('exam_results').delete().eq('id', id)
  if (error) throw error
  return true
}

export const getGradebookEntries = async () => {
  const { data, error } = await supabase.from('gradebook_entries').select('*').order('synced_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const finalizeGradebook = async (classId) => {
  const { data, error } = await supabase.rpc('finalize_gradebook', { p_class_id: classId })
  if (error) throw error
  return data
}

export const getTranscripts = async () => {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*, entries:transcript_entries(*)')
    .order('issued_at', { ascending: false })
  if (error) throw error
  return data || []
}

export const getTranscriptEntries = async () => {
  const { data, error } = await supabase.from('transcript_entries').select('*')
  if (error) throw error
  return data || []
}

export const getAllCertificates = async () => {
  const { data, error } = await supabase.from('certificates').select('*').order('issued_at', { ascending: false })
  if (error) throw error
  return enrichCertificates(data || [])
}

export const getCertificateById = async (id) => {
  const { data, error } = await supabase.from('certificates').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [enriched] = await enrichCertificates([data])
  return enriched || data
}

export const getCertificatesByStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('student_id', studentId)
    .order('issued_at', { ascending: false })
  if (error) throw error
  return enrichCertificates(data || [])
}

/** Attach student / class / course / diploma for certificate list & PDF. */
async function enrichCertificates(rows) {
  if (!rows?.length) return []
  const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))]
  const classIds = [...new Set(rows.map((r) => r.class_id).filter(Boolean))]

  const [{ data: profiles }, { data: classRows }] = await Promise.all([
    studentIds.length
      ? supabase.from('profiles').select('id, full_name, email').in('id', studentIds)
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase
          .from('classes')
          .select('id, name, course_id, diploma_id, program_type')
          .in('id', classIds)
      : Promise.resolve({ data: [] }),
  ])

  const courseIds = [...new Set((classRows || []).map((c) => c.course_id).filter(Boolean))]
  const diplomaIds = [...new Set((classRows || []).map((c) => c.diploma_id).filter(Boolean))]
  const [{ data: courses }, { data: diplomas }] = await Promise.all([
    courseIds.length
      ? supabase.from('courses').select('id, name').in('id', courseIds)
      : Promise.resolve({ data: [] }),
    diplomaIds.length
      ? supabase.from('diplomas').select('id, name').in('id', diplomaIds)
      : Promise.resolve({ data: [] }),
  ])

  const studentById = Object.fromEntries(
    (profiles || []).map((p) => [
      p.id,
      mapStudent(p),
    ]),
  )
  const courseById = Object.fromEntries((courses || []).map((c) => [c.id, c]))
  const diplomaById = Object.fromEntries((diplomas || []).map((d) => [d.id, d]))
  const classById = Object.fromEntries(
    (classRows || []).map((c) => [
      c.id,
      {
        ...c,
        course: c.course_id ? courseById[c.course_id] : null,
        diploma: c.diploma_id ? diplomaById[c.diploma_id] : null,
      },
    ]),
  )

  return rows.map((row) => {
    const cls = row.class_id ? classById[row.class_id] : null
    const snap = row.template_snapshot || {}
    const course =
      cls?.course ||
      (snap.course_id ? courseById[snap.course_id] : null) ||
      (snap.course_name ? { id: snap.course_id, name: snap.course_name } : null)
    const diploma =
      cls?.diploma ||
      (snap.diploma_id ? diplomaById[snap.diploma_id] : null) ||
      (snap.diploma_name ? { id: snap.diploma_id, name: snap.diploma_name } : null)
    const programFallback = snap.program_name
      ? { name: snap.program_name }
      : cls
        ? { name: cls.name }
        : null

    return {
      ...row,
      student: studentById[row.student_id] || row.student || null,
      class: cls || (snap.class_name ? { id: row.class_id, name: snap.class_name } : null),
      course: course || (!diploma ? programFallback : null),
      diploma: diploma || null,
      serial_number: row.certificate_number,
      date_issued: row.issued_at || row.date_issued || null,
    }
  })
}

export const getCertificateByStudentAndCourse = async (studentId, courseId) => {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('student_id', studentId)
    .contains('template_snapshot', { course_id: courseId })
    .maybeSingle()
  if (error) throw error
  return data
}

export const getCertificateByStudentAndDiploma = async (studentId, diplomaId) => {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('student_id', studentId)
    .contains('template_snapshot', { diploma_id: diplomaId })
    .maybeSingle()
  if (error) throw error
  return data
}

export const generateCertificatesBatch = async (items) => {
  const me = await getMyProfile()
  const rows = (items || []).map((item, i) => ({
    institution_id: me.institution_id,
    student_id: item.student_id,
    enrollment_id: item.enrollment_id || null,
    class_id: item.class_id || null,
    certificate_number: item.certificate_number || `CERT-${Date.now()}-${i}`,
    status: 'issued',
    issued_by: me.id,
    template_snapshot: item.template_snapshot || item || {},
  }))
  if (!rows.length) return []
  const { data, error } = await supabase.from('certificates').insert(rows).select()
  if (error) {
    const msg = String(error.message || error.code || '')
    if (/CERTIFICATE_ALREADY_ISSUED|uq_certificates_enrollment_issued|23505/i.test(msg)) {
      throw new Error('CERTIFICATE_ALREADY_ISSUED')
    }
    if (/CLASS_NOT_FINISHED/i.test(msg)) throw new Error('CLASS_NOT_FINISHED')
    if (/GRADES_INCOMPLETE/i.test(msg)) throw new Error('GRADES_INCOMPLETE')
    if (/BALANCE_OUTSTANDING/i.test(msg)) throw new Error('BALANCE_OUTSTANDING')
    if (/CERTIFICATE_ENROLLMENT_REQUIRED/i.test(msg)) throw new Error('CERTIFICATE_ENROLLMENT_REQUIRED')
    if (/INSTITUTION_SETTINGS_INCOMPLETE/i.test(msg)) throw new Error('INSTITUTION_SETTINGS_INCOMPLETE')
    throw error
  }
  return data || []
}

export const updateCertificateStatus = async (id, status) => {
  const { data, error } = await supabase
    .from('certificates')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteCertificate = async (id) => {
  const { error } = await supabase.from('certificates').delete().eq('id', id)
  if (error) throw error
  return true
}

export const verifyDocumentById = async (code) => {
  const { data, error } = await supabase.rpc('verify_credential', { p_code: code })
  if (error) throw error
  return data
}

export const verifyTranscriptCredential = async (code) => verifyDocumentById(code)

export const getNotifications = async () => []
export const markNotificationRead = async (_id = undefined) => true

function mapRegistrationInquiry(row) {
  if (!row) return null
  return {
    ...row,
    student_name: row.full_name,
    student_email: row.email,
    student_phone: row.phone,
    year: row.year_of_study,
    submitted_at: row.created_at,
  }
}

export const getGeneralRegistrations = async () => {
  const { data, error } = await supabase
    .from('registration_inquiries')
    .select('*, class:classes(id, name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((row) => ({
    ...mapRegistrationInquiry(row),
    class: row.class || null,
  }))
}

export const getPublicClassesBySubdomain = async (subdomain) => {
  const slug = String(subdomain || resolvePublicTenantSubdomain() || '').trim()
  if (!slug) return []
  const { data, error } = await supabase.rpc('get_public_classes', { p_subdomain: slug })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export const getPublicInstitutionBySubdomain = async (subdomain) => {
  const slug = String(subdomain || resolvePublicTenantSubdomain() || '').trim()
  if (!slug) return null
  const { data, error } = await supabase.rpc('get_public_institution', { p_subdomain: slug })
  if (error) throw error
  const raw = Array.isArray(data) ? data[0] : data
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw
}

/**
 * Option B — public form creates a pending registration inquiry only.
 * Admin/Staff approve later via approve-registration-inquiry edge function.
 */
export const submitGeneralRegistration = async (formData) => {
  const subdomain =
    String(formData.subdomain || resolvePublicTenantSubdomain() || '').trim()
  if (!subdomain) throw new Error('INSTITUTION_NOT_FOUND')

  const affiliateRaw = formData.affiliate_id
  const affiliateId =
    affiliateRaw && affiliateRaw !== 'none' ? affiliateRaw : null

  // Class is optional: skip enrollment until staff assigns one later.
  // Server still validates class belongs to this tenant + is active + in duration.
  const classRaw = formData.class_id
  const classId =
    classRaw && classRaw !== 'none' && classRaw !== '' ? classRaw : null

  const { data, error } = await supabase.rpc('submit_registration_inquiry', {
    p_subdomain: subdomain,
    p_full_name: formData.student_name || formData.full_name,
    p_email: formData.student_email || formData.email,
    p_phone: formData.student_phone || formData.phone || null,
    p_university: formData.university || null,
    p_faculty: formData.faculty || null,
    p_year_of_study: formData.year || formData.year_of_study || null,
    p_class_id: classId,
    p_affiliate_id: affiliateId,
    p_notes: formData.notes || null,
  })

  if (error) {
    const msg = String(error.message || 'REGISTRATION_FAILED')
    const code = msg.split(':')[0].trim()
    throw new Error(code || msg)
  }

  if (data?.id) {
    return {
      id: data.id,
      status: data.status || 'pending',
      institution_name: data.institution_name || null,
      pending: true,
    }
  }

  throw new Error('REGISTRATION_FAILED')
}

export const writeTenantAuditLog = async (action, entityType = null, entityId = null, metadata: any = {}) => {
  try {
    const { error } = await supabase.rpc('write_tenant_audit_log', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId != null ? String(entityId) : null,
      p_metadata: metadata || {},
    })
    if (error) console.warn('[writeTenantAuditLog]', error.message)
  } catch (err) {
    console.warn('[writeTenantAuditLog]', err)
  }
}

export const checkRegistrationDuplicates = async (email, phone) => {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return { emailExists: false, phoneExists: false, exists: false }

  // Tenant-scoped check via authenticated admin inbox OR public submit validation.
  // Public callers rely on RPC exceptions; authenticated staff can peek profiles.
  try {
    const me = await getMyProfile()
    if (!me?.institution_id) return { emailExists: false, phoneExists: false, exists: false }

    const { data: byEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('institution_id', me.institution_id)
      .ilike('email', normalized)
      .limit(1)

    let phoneExists = false
    if (phone) {
      const { data: byPhone } = await supabase
        .from('profiles')
        .select('id')
        .eq('institution_id', me.institution_id)
        .eq('phone', String(phone).trim())
        .limit(1)
      phoneExists = (byPhone || []).length > 0
    }

    const emailExists = (byEmail || []).length > 0
    return { emailExists, phoneExists, exists: emailExists || phoneExists }
  } catch {
    return { emailExists: false, phoneExists: false, exists: false }
  }
}

async function readFunctionPayload(data, error) {
  let payload = data
  if (error) {
    try {
      const ctx = error.context
      if (ctx && typeof ctx.json === 'function') payload = await ctx.json()
      else if (ctx && typeof ctx.text === 'function') {
        const text = await ctx.text()
        payload = text ? JSON.parse(text) : null
      }
    } catch {
      /* keep */
    }
  }
  return payload
}

export const requestPasswordReset = async ({ identifier, subdomain, redirectTo }) => {
  const { data, error } = await supabase.functions.invoke('request-password-reset', {
    body: {
      identifier: String(identifier || '').trim(),
      subdomain: String(subdomain || '').trim().toLowerCase() || undefined,
      redirect_to: redirectTo,
    },
  })
  const payload = await readFunctionPayload(data, error)
  if (payload?.error === 'SERVER_MISCONFIGURED' || payload?.error === 'RESEND_NOT_CONFIGURED') {
    throw new Error('EMAIL_NOT_CONFIGURED')
  }
  return { ok: true }
}

export const updateGeneralRegistration = async (id, updates) => {
  const me = await getMyProfile()
  if (!me || !['admin', 'staff'].includes(me.role)) throw new Error('FORBIDDEN')

  if (updates.status === 'rejected') {
    const { data, error } = await supabase.functions.invoke('reject-registration-inquiry', {
      body: {
        inquiry_id: id,
        rejection_reason: updates.rejection_reason || '',
      },
    })
    const payload = await readFunctionPayload(data, error)
    if (payload?.error) {
      throw new Error(String(payload.error).split(':')[0].trim())
    }
    if (!payload?.id) throw new Error(error?.message || 'UPDATE_FAILED')

    await writeTenantAuditLog('registration.rejected', 'registration_inquiry', id, {
      rejection_reason: updates.rejection_reason || null,
      emailed: !!payload.emailed,
    })

    const { data: row, error: fetchErr } = await supabase
      .from('registration_inquiries')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr
    return { ...mapRegistrationInquiry(row), emailed: !!payload.emailed }
  }

  const allowed: any = {}
  if (updates.status !== undefined) allowed.status = updates.status
  if (updates.rejection_reason !== undefined) allowed.rejection_reason = updates.rejection_reason
  if (updates.notes !== undefined) allowed.notes = updates.notes
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('registration_inquiries')
    .update(allowed)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error

  return mapRegistrationInquiry(data)
}

/**
 * Approve a public inquiry (Option B) via edge function — idempotent.
 * Sends welcome email with temp password when a new account is created.
 */
export const approveRegistrationInquiry = async (id) => {
  const me = await getMyProfile()
  if (!me || !['admin', 'staff'].includes(me.role)) throw new Error('FORBIDDEN')

  const { data, error } = await supabase.functions.invoke('approve-registration-inquiry', {
    body: { inquiry_id: id },
  })

  let payload = data
  if (error) {
    try {
      const ctx = error.context
      if (ctx && typeof ctx.json === 'function') payload = await ctx.json()
      else if (ctx && typeof ctx.text === 'function') {
        const text = await ctx.text()
        payload = text ? JSON.parse(text) : null
      }
    } catch {
      /* keep */
    }
  }

  if (payload?.error) {
    throw new Error(String(payload.error).split(':')[0].trim())
  }
  if (!payload?.email && !payload?.id) {
    throw new Error(error?.message || 'APPROVE_FAILED')
  }

  let emailed = false
  let emailSkipped = false
  let emailError = null

  // Welcome email only when a new password was issued (new account). Never on reject.
  if (payload.password && payload.email && !payload.already_approved) {
    try {
      const institution = await getMyInstitution()
      const loginUrl = getTenantLoginUrl(institution)
      const { sendWelcomeEmail } = await import('@/lib/emailjs')
      const emailResult = await sendWelcomeEmail({
        fullName: payload.name || 'Student',
        role: 'student',
        email: payload.email,
        password: payload.password,
        institutionName: institution?.name || 'Training Center',
        institutionEmail: institution?.email || undefined,
        loginUrl,
      })
      emailed = Boolean(emailResult.ok)
      emailSkipped = Boolean(emailResult.skipped)
      emailError = emailResult.ok ? null : emailResult.error || 'WELCOME_EMAIL_FAILED'
      if (!emailResult.ok) {
        console.warn('[approveRegistrationInquiry] welcome email failed', emailResult.error)
      }
    } catch (err) {
      console.warn('[approveRegistrationInquiry] welcome email error', err)
      emailError = 'WELCOME_EMAIL_FAILED'
    }
  }

  return {
    name: payload.name,
    email: payload.email,
    student_code: payload.email?.split('@')[0],
    password: payload.password || null,
    already_approved: !!payload.already_approved,
    emailed,
    email_skipped: emailSkipped,
    email_error: emailError,
  }
}

export const deleteRegistrationRecord = async (id) => {
  const { error } = await supabase.from('registration_inquiries').delete().eq('id', id)
  if (error) throw error
  await writeTenantAuditLog('registration.deleted', 'registration_inquiry', id, {})
  return true
}

export const getRegistrationForm = async () => null
export const submitRegistration = async (formData) => submitGeneralRegistration(formData)

export const getDocumentRequests = async () => []
export const createDocumentRequest = async (_data = undefined) => {
  throw notReady('Documents')
}
export const updateDocumentRequest = async (_id = undefined, _updates = undefined) => {
  throw notReady('Documents')
}

export { getSupabaseUrl }
