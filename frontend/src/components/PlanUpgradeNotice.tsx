import React from 'react'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

/** Shown when a tenant hits an Enterprise-only surface on a lower plan. */
export default function PlanUpgradeNotice({
  feature = 'Transcripts & Certificates',
}: {
  feature?: string
}) {
  return (
    <Alert className="border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface-muted,#F7FAF8)]">
      <Lock className="h-4 w-4 text-[var(--ds-primary,#1F8A5B)]" />
      <AlertTitle className="text-[var(--ds-text-primary,#122018)]">
        {feature} is on Enterprise
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3 text-[var(--ds-text-secondary,#5B6B61)]">
        <p>
          Upgrade to the Enterprise plan to unlock {feature.toLowerCase()}. Your admin can upgrade
          from Plans &amp; Subscriptions.
        </p>
        <Button
          asChild
          size="sm"
          className="bg-[var(--ds-primary,#0B3D2E)] text-[#fff] hover:opacity-90 [.tenant-shell_&]:bg-[var(--ds-primary,#0B3D2E)] [.tenant-shell_&]:text-[#fff] [.tenant-shell_&]:hover:bg-[var(--ds-primary-hover,#082E22)]"
        >
          <Link to="/plans" className="text-[#fff] hover:text-[#fff]">
            View plans
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
