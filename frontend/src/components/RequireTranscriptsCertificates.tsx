import React from 'react'
import { Loader2 } from 'lucide-react'
import AnimatedPage from '@/components/AnimatedPage'
import PlanUpgradeNotice from '@/components/PlanUpgradeNotice'
import { usePlanEntitlements } from '@/hooks/usePlanEntitlements'

/** Blocks certificate/transcript routes when the tenant plan lacks the entitlement. */
export default function RequireTranscriptsCertificates({
  children,
  fallbackTo = '/plans',
}: {
  children: React.ReactNode
  fallbackTo?: string
}) {
  const { canUseTranscriptsCertificates, loading } = usePlanEntitlements()

  if (loading) {
    return (
      <AnimatedPage>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--ds-accent,#1F8A5B)]" />
        </div>
      </AnimatedPage>
    )
  }

  if (!canUseTranscriptsCertificates) {
    return (
      <AnimatedPage>
        <div className="mx-auto max-w-xl p-6">
          <PlanUpgradeNotice />
          <p className="mt-4 text-center text-sm text-[var(--ds-text-secondary,#5B6B61)]">
            <a href={fallbackTo} className="font-medium text-[var(--ds-primary,#1F8A5B)] underline">
              Go to plans
            </a>
          </p>
        </div>
      </AnimatedPage>
    )
  }

  return <>{children}</>
}
