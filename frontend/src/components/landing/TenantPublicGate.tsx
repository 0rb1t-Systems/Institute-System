import React from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { isLikelyCustomTenantHost, resolvePublicTenantSubdomain } from '@/lib/institution'
import TenantHomePage from '@/pages/public/TenantHomePage'
import type { TenantLandingPage } from '@/lib/tenantLandingRoutes'

/**
 * When a tenant is present (query, subdomain host, or custom domain), render the
 * institution site page. Otherwise fall through to the platform page.
 */
export default function TenantPublicGate({
  page,
  platform,
  redirectIfNoTenant = false,
}: {
  page: Exclude<TenantLandingPage, 'home'>
  platform: React.ReactNode
  /** When true and no tenant, send visitors home (used for /programs). */
  redirectIfNoTenant?: boolean
}) {
  const [searchParams] = useSearchParams()
  const tenant =
    searchParams.get('tenant') ||
    searchParams.get('subdomain') ||
    resolvePublicTenantSubdomain()
  const onCustomHost = isLikelyCustomTenantHost()

  if (tenant || onCustomHost) {
    return <TenantHomePage subdomain={tenant || undefined} page={page} />
  }

  if (redirectIfNoTenant) {
    return <Navigate to="/" replace />
  }

  return <>{platform}</>
}
