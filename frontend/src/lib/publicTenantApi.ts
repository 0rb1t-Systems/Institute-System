/**
 * Public self-service tenant (institution) provisioning — no auth required.
 */
import { supabase } from '@/lib/supabaseClient'
import { getUserMessage } from '@/lib/mapError'

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

function friendlyError(payload, error) {
  const code = String(payload?.error || payload?.code || '').trim()
  const known = {
    EMAIL_EXISTS: 'An account with this email already exists. Please use a different email or sign in.',
    EMAIL_IN_USE: 'An account with this email already exists. Please use a different email or sign in.',
    USER_ACCOUNT_EXISTS: 'An account with this email already exists. Please use a different email or sign in.',
    INSTITUTION_SLUG_EXISTS: 'That institution slug is already in use. Please choose another.',
    VALIDATION: 'Please check your details and try again.',
    FORBIDDEN: 'You do not have permission to perform this action.',
  }
  if (code && known[code]) return known[code]
  // Prefer safe mapped message; never pass raw Edge/DB text through
  return getUserMessage(
    { message: code || error?.message, code },
    { fallback: { description: 'Unable to create institution. Please try again.' } }
  )
}

/**
 * Create a new institution + first admin via public self-service.
 * @param {object} form
 */
export async function publicProvisionTenant(form) {
  const { data: result, error } = await supabase.functions.invoke('public-provision-tenant', {
    body: {
      institution_name: form.institution_name,
      institution_slug: form.institution_slug,
      institution_email: form.institution_email,
      institution_phone: form.institution_phone,
      institution_address: form.institution_address,
      admin_full_name: form.admin_full_name,
      admin_email: form.admin_email,
      password: form.password,
    },
  })

  const payload = await parseInvokeError(error, result)

  if (payload?.ok && payload?.institution_id) {
    return payload
  }

  throw new Error(friendlyError(payload, error))
}
