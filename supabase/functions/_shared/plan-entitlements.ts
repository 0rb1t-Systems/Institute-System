/**
 * Plan entitlement checks for Edge Functions (service-role safe).
 * Mirrors public.tenant_has_entitlement for a known institution_id.
 */
export const ENTITLEMENT_EMAIL_SUPPORT = 'email_support'
export const ENTITLEMENT_TRANSCRIPTS_CERTIFICATES = 'transcripts_certificates'

/** True when the institution has an active/trial plan granting `key`. */
export async function institutionHasEntitlement(
  // deno-lint-ignore no-explicit-any
  admin: any,
  institutionId: string | null | undefined,
  key: string,
): Promise<boolean> {
  const id = String(institutionId || '').trim()
  const k = String(key || '').trim()
  if (!id || !k) return false

  const { data, error } = await admin
    .from('tenant_subscriptions')
    .select('status, platform_plans ( entitlements )')
    .eq('institution_id', id)
    .in('status', ['active', 'trial'])
    .limit(5)

  if (error || !data?.length) return false

  for (const row of data) {
    const plan = Array.isArray(row.platform_plans) ? row.platform_plans[0] : row.platform_plans
    const entitlements = plan?.entitlements
    if (entitlements && typeof entitlements === 'object' && entitlements[k] === true) {
      return true
    }
  }
  return false
}
