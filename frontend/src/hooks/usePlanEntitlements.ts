import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getMyTenantSubscription } from '@/lib/api'
import { supabase } from '@/lib/supabaseClient'
import {
  ENTITLEMENT_EMAIL_SUPPORT,
  ENTITLEMENT_TRANSCRIPTS_CERTIFICATES,
  hasPlanEntitlement,
  planSlug,
  type PlanEntitlementKey,
} from '@/lib/planEntitlements'

/**
 * Loads current tenant plan entitlements via RPC (works for all tenant roles)
 * plus subscription row for upgrade messaging when readable.
 */
export function usePlanEntitlements() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || null
  const isSuperAdmin = user?.role === 'super_admin'

  const [subscription, setSubscription] = useState<any>(null)
  const [entitlementMap, setEntitlementMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(Boolean(institutionId) && !isSuperAdmin)

  const reload = useCallback(async () => {
    if (!institutionId || isSuperAdmin) {
      setSubscription(null)
      setEntitlementMap({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [subResult, certResult, emailResult] = await Promise.all([
        getMyTenantSubscription().catch(() => null),
        supabase.rpc('tenant_has_entitlement', {
          p_key: ENTITLEMENT_TRANSCRIPTS_CERTIFICATES,
        }),
        supabase.rpc('tenant_has_entitlement', {
          p_key: ENTITLEMENT_EMAIL_SUPPORT,
        }),
      ])
      setSubscription(subResult)
      // Prefer server RPC when it succeeds (deny-by-default for Starter).
      // Only fall back to subscription row if the RPC errored (e.g. older DB).
      const isStarter = planSlug(subResult) === 'starter'
      const certOk =
        !isStarter &&
        (certResult.error
          ? hasPlanEntitlement(subResult, ENTITLEMENT_TRANSCRIPTS_CERTIFICATES)
          : certResult.data === true)
      const emailOk =
        !isStarter &&
        (emailResult.error
          ? hasPlanEntitlement(subResult, ENTITLEMENT_EMAIL_SUPPORT)
          : emailResult.data === true)
      setEntitlementMap({
        [ENTITLEMENT_TRANSCRIPTS_CERTIFICATES]: certOk,
        [ENTITLEMENT_EMAIL_SUPPORT]: emailOk,
      })
    } catch {
      setSubscription(null)
      setEntitlementMap({})
    } finally {
      setLoading(false)
    }
  }, [institutionId, isSuperAdmin])

  useEffect(() => {
    reload()
  }, [reload])

  const hasEntitlement = useCallback(
    (key: PlanEntitlementKey) => Boolean(entitlementMap[key]),
    [entitlementMap],
  )

  const canUseTranscriptsCertificates =
    isSuperAdmin || Boolean(entitlementMap[ENTITLEMENT_TRANSCRIPTS_CERTIFICATES])
  const canUseEmailSupport =
    isSuperAdmin || Boolean(entitlementMap[ENTITLEMENT_EMAIL_SUPPORT])

  return {
    loading,
    subscription,
    reload,
    hasEntitlement,
    canUseTranscriptsCertificates,
    canUseEmailSupport,
  }
}
