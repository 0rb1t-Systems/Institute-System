/**
 * Super Admin (platform) API — never uses service_role on the client.
 * Cross-tenant destructive mutations go through Edge Functions;
 * reads/updates use RLS + is_super_admin(); audit via write_audit_log RPC.
 */
import { supabase } from '@/lib/supabaseClient'
import { sendWelcomeEmail } from '@/lib/emailjs'
import { getTenantLoginUrl } from '@/lib/institution'

async function getAccessToken() {
  let {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('UNAUTHORIZED')

  const { data: refreshed, error } = await supabase.auth.refreshSession()
  if (!error && refreshed.session?.access_token) {
    session = refreshed.session
  }
  return session.access_token
}

async function parseInvokeError(error, result) {
  let payload = result
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

function friendlyInvokeError(payload, error) {
  const msg = String(payload?.error || error?.message || '').trim()
  if (!msg) return 'UNEXPECTED'
  const lower = msg.toLowerCase()
  if (lower.includes('already in use') || lower.includes('slug')) return msg
  if (lower.includes('already exists') || lower.includes('email')) return msg
  if (lower.includes('required fields') || lower.includes('complete all')) return msg
  if (lower.includes('confirmation') || lower.includes('does not match')) return msg
  if (lower.includes('unable to delete') || lower.includes('tenant was not deleted')) return msg
  if (lower.includes('permission') || lower.includes('forbidden')) return 'FORBIDDEN'
  if (lower.includes('session') || lower.includes('sign in') || lower.includes('unauthorized')) {
    return 'SESSION_EXPIRED'
  }
  if (payload?.error && !lower.includes('jwt') && !lower.includes('rls') && !lower.includes('sql')) {
    return payload.error
  }
  return 'UNEXPECTED'
}

export async function writeAuditLog(action, entityType = null, entityId = null, metadata: any = {}) {
  const { data, error } = await supabase.rpc('write_audit_log', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId == null ? null : String(entityId),
    p_metadata: metadata,
  })
  if (error) throw error
  return data
}

export async function listTenants() {
  const { data, error } = await supabase
    .from('institutions')
    .select('id, name, subdomain, email, phone, address, status, logo_url, description, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTenant(id) {
  const { data, error } = await supabase
    .from('institutions')
    .select('id, name, subdomain, email, phone, address, status, logo_url, description, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateTenant(id, updates) {
  const allowed: any = {}
  if (updates.name !== undefined) allowed.name = updates.name
  if (updates.email !== undefined) allowed.email = updates.email
  if (updates.phone !== undefined) allowed.phone = updates.phone
  if (updates.address !== undefined) allowed.address = updates.address
  if (updates.status !== undefined) allowed.status = updates.status
  if (updates.description !== undefined) allowed.description = updates.description

  const { data, error } = await supabase
    .from('institutions')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  const action =
    updates.status === 'suspended'
      ? 'tenant.suspended'
      : updates.status === 'active'
        ? 'tenant.activated'
        : 'tenant.updated'

  try {
    await writeAuditLog(action, 'institution', id, {
      fields: Object.keys(allowed),
      status: data.status,
      name: data.name,
    })
  } catch {
    /* non-blocking — mutation already succeeded under RLS */
  }

  return data
}

export async function deleteTenant(institutionId, confirmationName) {
  const token = await getAccessToken()
  const { data: result, error } = await supabase.functions.invoke('delete-tenant', {
    headers: { Authorization: `Bearer ${token}` },
    body: {
      institution_id: institutionId,
      confirmation_name: confirmationName,
    },
  })

  const payload = await parseInvokeError(error, result)
  if (payload?.ok) return payload
  throw new Error(friendlyInvokeError(payload, error))
}

export async function getTenantAdmins(institutionId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, status, created_at, institution_id')
    .eq('institution_id', institutionId)
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

/** All Tenant Admins across institutions (not students). */
export async function listAllTenantAdmins() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, status, created_at, institution_id')
    .eq('role', 'admin')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Platform staff users only — excludes students and super_admin.
 * Students appear only as aggregates in Analytics (not Overview).
 */
export async function listPlatformUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, status, created_at, institution_id')
    .in('role', ['admin', 'staff', 'instructor'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/** @deprecated Use listPlatformUsers — kept for any residual imports */
export async function listSystemUsers() {
  return listPlatformUsers()
}

export async function listAuditLogs(limit = 100) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getSystemSettings() {
  const { data, error } = await supabase.from('system_settings').select('key, value, updated_at')
  if (error) throw error
  const map: any = {}
  for (const row of data || []) map[row.key] = row.value
  return map
}

export async function updateSystemSetting(key, value) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('system_settings')
    .update({ value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    .eq('key', key)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function savePlatformSettings(settings) {
  const entries = Object.entries(settings)
  await Promise.all(entries.map(([key, value]) => updateSystemSetting(key, value)))
  try {
    await writeAuditLog('settings.updated', 'system_settings', null, {
      keys: entries.map(([k]) => k),
    })
  } catch {
    /* non-blocking */
  }
}

const MAX_PLATFORM_ASSET_BYTES = 5 * 1024 * 1024
const PLATFORM_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])

/** Upload a marketing asset for the public platform site (super_admin only). */
export async function uploadPlatformAsset(file: File, kind = 'trusted') {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('UNAUTHORIZED')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError) throw profileError
  if (profile?.role !== 'super_admin') throw new Error('FORBIDDEN')

  if (!file) throw new Error('MISSING_FILE')
  if (file.size > MAX_PLATFORM_ASSET_BYTES) throw new Error('FILE_TOO_LARGE')
  const mime = String(file.type || '').toLowerCase()
  if (mime && !PLATFORM_IMAGE_MIME.has(mime)) throw new Error('INVALID_FILE_TYPE')

  const assetKind = String(kind || 'trusted')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40) || 'asset'
  const ext = String(file.name || 'png').split('.').pop()?.toLowerCase() || 'png'
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext) ? ext : 'png'
  const path = `site/${assetKind}-${Date.now()}.${safeExt}`

  const { error } = await supabase.storage.from('platform-assets').upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: mime || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
  })
  if (error) throw error

  const { data } = supabase.storage.from('platform-assets').getPublicUrl(path)
  return data?.publicUrl || null
}

export async function saveSiteCms(trusted, photos) {
  await savePlatformSettings({
    site_trusted: trusted,
    site_photos: photos,
  })
}

export async function getPlatformAnalytics() {
  const { data, error } = await supabase.rpc('get_platform_analytics')
  if (error) throw error
  return data || {}
}

export async function getPlatformStats() {
  const analytics = await getPlatformAnalytics()
  return {
    tenants: analytics.tenants_total ?? 0,
    activeTenants: analytics.tenants_active ?? 0,
    suspendedTenants: analytics.tenants_suspended ?? 0,
    users: analytics.platform_users ?? 0,
    studentsTotal: analytics.students_total ?? 0,
    studentsActive: analytics.students_active ?? 0,
    revenueTotal: Number(analytics.revenue_total ?? 0),
    openTickets: analytics.open_tickets ?? 0,
    byRole: {
      admin: analytics.admins ?? 0,
      staff: analytics.staff ?? 0,
      instructor: analytics.instructors ?? 0,
      student: analytics.students_total ?? 0,
    },
    studentGrowth: analytics.student_growth || [],
    tenantGrowth: analytics.tenant_growth || [],
    paymentsCount: analytics.payments_count ?? 0,
  }
}

/** Aggregated revenue by tenant — no student PII. */
export async function getRevenueByTenant() {
  const { data, error } = await supabase
    .from('payments')
    .select('institution_id, amount, method, paid_at')
    .order('paid_at', { ascending: false })
    .limit(5000)
  if (error) throw error

  const byTenant: any = {}
  let total = 0
  const byMethod: any = {}
  for (const p of data || []) {
    const amt = Number(p.amount) || 0
    total += amt
    if (!byTenant[p.institution_id]) {
      byTenant[p.institution_id] = { institution_id: p.institution_id, total: 0, count: 0 }
    }
    byTenant[p.institution_id].total += amt
    byTenant[p.institution_id].count += 1
    byMethod[p.method] = (byMethod[p.method] || 0) + amt
  }

  return {
    total,
    count: (data || []).length,
    byTenant: Object.values(byTenant).sort((a: any, b: any) => b.total - a.total),
    byMethod,
    recent: (data || []).slice(0, 50).map((p) => ({
      institution_id: p.institution_id,
      amount: Number(p.amount),
      method: p.method,
      paid_at: p.paid_at,
    })),
  }
}

export async function listPlans() {
  const { data, error } = await supabase
    .from('platform_plans')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function upsertPlan(plan) {
  const payload = {
    name: plan.name?.trim(),
    slug: plan.slug?.trim()?.toLowerCase(),
    description: plan.description?.trim() || null,
    price_monthly: Number(plan.price_monthly) || 0,
    price_yearly: Number(plan.price_yearly) || 0,
    max_students: plan.max_students === '' || plan.max_students == null ? null : Number(plan.max_students),
    features: Array.isArray(plan.features) ? plan.features : [],
    is_active: plan.is_active !== false,
    sort_order: Number(plan.sort_order) || 0,
    updated_at: new Date().toISOString(),
  }

  let result
  if (plan.id) {
    const { data, error } = await supabase
      .from('platform_plans')
      .update(payload)
      .eq('id', plan.id)
      .select()
      .single()
    if (error) throw error
    result = data
    await writeAuditLog('plan.updated', 'platform_plan', plan.id, { name: result.name }).catch(() => {})
  } else {
    const { data, error } = await supabase.from('platform_plans').insert(payload).select().single()
    if (error) throw error
    result = data
    await writeAuditLog('plan.created', 'platform_plan', result.id, { name: result.name }).catch(() => {})
  }
  return result
}

export async function listSubscriptions() {
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select(
      'id, institution_id, plan_id, status, billing_cycle, started_at, ends_at, notes, created_at, platform_plans(id, name, slug, price_monthly)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function assignSubscription({ institution_id, plan_id, status, billing_cycle, notes }) {
  const payload = {
    institution_id,
    plan_id,
    status: status || 'active',
    billing_cycle: billing_cycle || 'monthly',
    notes: notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .upsert(payload, { onConflict: 'institution_id' })
    .select()
    .single()
  if (error) throw error

  await writeAuditLog('subscription.assigned', 'tenant_subscription', data.id, {
    institution_id,
    plan_id,
    status: data.status,
  }).catch(() => {})

  return data
}

export async function listSupportTickets() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return data || []
}

export async function createSupportTicket(ticket) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const payload = {
    subject: ticket.subject?.trim(),
    message: ticket.message?.trim(),
    priority: ticket.priority || 'normal',
    status: 'open',
    requester_name: ticket.requester_name?.trim() || null,
    requester_email: ticket.requester_email?.trim()?.toLowerCase() || null,
    institution_id: ticket.institution_id || null,
    updated_by: user?.id ?? null,
  }

  const { data, error } = await supabase.from('support_tickets').insert(payload).select().single()
  if (error) throw error

  await writeAuditLog('support.ticket_created', 'support_ticket', data.id, {
    subject: data.subject,
    priority: data.priority,
  }).catch(() => {})

  return data
}

export async function updateSupportTicket(id, updates) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const allowed: any = {
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  }
  if (updates.status !== undefined) allowed.status = updates.status
  if (updates.priority !== undefined) allowed.priority = updates.priority
  if (updates.resolution_notes !== undefined) allowed.resolution_notes = updates.resolution_notes

  const { data, error } = await supabase
    .from('support_tickets')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  await writeAuditLog('support.ticket_updated', 'support_ticket', id, {
    status: data.status,
    priority: data.priority,
  }).catch(() => {})

  return data
}

export async function updateOwnProfile({ full_name, phone }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('UNAUTHORIZED')

  const updates: any = {}
  if (full_name !== undefined) updates.full_name = full_name.trim()
  if (phone !== undefined) updates.phone = phone?.trim() || null

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .eq('role', 'super_admin')
    .select()
    .single()
  if (error) throw error

  await writeAuditLog('profile.updated', 'profile', user.id, {
    fields: Object.keys(updates),
  }).catch(() => {})

  return data
}

/**
 * Change Super Admin password via Supabase Auth only.
 * Never stores passwords in tables, logs, or API responses.
 */
export async function changeOwnPassword({ currentPassword, newPassword }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) throw new Error('UNAUTHORIZED')

  if (!currentPassword || !newPassword) {
    throw new Error('Current and new passwords are required.')
  }
  if (newPassword.length < 8) {
    throw new Error('Password must contain at least 8 characters.')
  }
  if (currentPassword === newPassword) {
    throw new Error('New password must be different from the current password.')
  }

  // Verify current password without persisting it
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyErr) {
    throw new Error('Incorrect current password.')
  }

  const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword })
  if (pwErr) throw pwErr

  await writeAuditLog('profile.password_changed', 'profile', user.id, {}).catch(() => {})

  return { ok: true }
}

export async function provisionTenant(form) {
  const token = await getAccessToken()
  const { data: result, error } = await supabase.functions.invoke('provision-tenant', {
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  const payload = await parseInvokeError(error, result)

  if (payload?.ok && payload?.institution_id) {
    let emailed = false
    let emailError = null
    try {
      const loginUrl = getTenantLoginUrl({
        subdomain: payload.institution_slug,
        name: payload.institution_name,
      })
      const emailResult = await sendWelcomeEmail({
        fullName: payload.admin?.full_name,
        role: 'admin',
        email: payload.admin?.email,
        password: payload.admin?.password,
        institutionName: payload.institution_name,
        loginUrl,
      })
      emailed = Boolean(emailResult.ok)
      if (!emailResult.ok) emailError = 'WELCOME_EMAIL_FAILED'
    } catch {
      emailError = 'WELCOME_EMAIL_FAILED'
    }

    return { ...payload, emailed, email_error: emailError }
  }

  throw new Error(friendlyInvokeError(payload, error))
}

export async function createTenantAdmin(form) {
  const token = await getAccessToken()
  const { data: result, error } = await supabase.functions.invoke('create-tenant-admin', {
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  const payload = await parseInvokeError(error, result)

  if (payload?.ok && payload?.id) {
    let emailed = false
    try {
      let subdomain = payload.institution_slug || form.institution_slug || ''
      if (!subdomain && form.institution_id) {
        const { data: inst } = await supabase
          .from('institutions')
          .select('subdomain, name')
          .eq('id', form.institution_id)
          .maybeSingle()
        subdomain = inst?.subdomain || ''
        if (!payload.institution_name && inst?.name) payload.institution_name = inst.name
      }
      const loginUrl = getTenantLoginUrl({
        subdomain,
        name: payload.institution_name,
      })
      const emailResult = await sendWelcomeEmail({
        fullName: payload.full_name,
        role: 'admin',
        email: payload.email,
        password: payload.password,
        institutionName: payload.institution_name,
        loginUrl,
      })
      emailed = Boolean(emailResult.ok)
    } catch {
      emailed = false
    }
    return { ...payload, emailed }
  }

  throw new Error(friendlyInvokeError(payload, error))
}

export async function updateSystemUserStatus(userId, status) {
  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('id, role, status, full_name, email')
    .eq('id', userId)
    .single()
  if (readErr) throw readErr

  if (!['admin', 'staff', 'instructor'].includes(existing.role)) {
    throw new Error('FORBIDDEN')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId)
    .in('role', ['admin', 'staff', 'instructor'])
    .select()
    .single()
  if (error) throw error

  await writeAuditLog(
    status === 'suspended' ? 'user.suspended' : 'user.approved',
    'profile',
    userId,
    { role: data.role, email: data.email, previous_status: existing.status },
  ).catch(() => {})

  return data
}
