/** Platform plan entitlement keys (machine-readable on platform_plans.entitlements). */
export const ENTITLEMENT_TRANSCRIPTS_CERTIFICATES = 'transcripts_certificates' as const
/** Product email (welcome + class broadcast). Enterprise only — Starter $39 does not include. */
export const ENTITLEMENT_EMAIL_SUPPORT = 'email_support' as const

export type PlanEntitlementKey =
  | typeof ENTITLEMENT_TRANSCRIPTS_CERTIFICATES
  | typeof ENTITLEMENT_EMAIL_SUPPORT
  | string

type PlanShape = {
  slug?: string | null
  entitlements?: Record<string, unknown> | null
} | null | undefined

type SubscriptionShape = {
  status?: string | null
  platform_plans?: PlanShape | PlanShape[] | null
} | null | undefined

function planFromSubscription(sub: SubscriptionShape): PlanShape {
  if (!sub) return null
  const p = sub.platform_plans
  if (Array.isArray(p)) return p[0] ?? null
  return p ?? null
}

/** True when subscription is usable and plan grants the entitlement key. */
export function hasPlanEntitlement(
  sub: SubscriptionShape,
  key: PlanEntitlementKey,
): boolean {
  if (!sub || !key) return false
  const status = String(sub.status || '').toLowerCase()
  if (status !== 'active' && status !== 'trial') return false
  const plan = planFromSubscription(sub)
  const entitlements = plan?.entitlements
  if (!entitlements || typeof entitlements !== 'object') return false
  return entitlements[key] === true
}

export function planSlug(sub: SubscriptionShape): string | null {
  const slug = planFromSubscription(sub)?.slug
  return slug ? String(slug) : null
}
