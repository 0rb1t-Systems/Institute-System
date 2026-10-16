import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getMyTenantSubscription } from '@/lib/api'
import { supabase } from '@/lib/supabaseClient'
import {
  ENTITLEMENT_TRANSCRIPTS_CERTIFICATES,
  hasPlanEntitlement,
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
      const [subResult, entResult] = await Promise.all([
        getMyTenantSubscription().catch(() => null),
        supabase.rpc('tenant_has_entitlement', {
          p_key: ENTITLEMENT_TRANSCRIPTS_CERTIFICATES,
        }),
      ])
      setSubscription(subResult)
      const rpcOk = !entResult.error && entResult.data === true
      const fromSub = hasPlanEntitlement(subResult, ENTITLEMENT_TRANSCRIPTS_CERTIFICATES)
      setEntitlementMap({
        [ENTITLEMENT_TRANSCRIPTS_CERTIFICATES]: rpcOk || fromSub,
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

  return {
    loading,
    subscription,
    reload,
    hasEntitlement,
    canUseTranscriptsCertificates,
  }
}
