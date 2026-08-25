import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Building2, AlertCircle, Plus, Ticket, CreditCard, CheckCircle2 } from 'lucide-react'
import {
  getPlatformStats,
  listAuditLogs,
  listSubscriptions,
} from '@/lib/superAdminApi'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const TENANT_ACTIVITY_ACTIONS = new Set([
  'tenant.created',
  'tenant.updated',
  'tenant.suspended',
  'tenant.activated',
  'subscription.assigned',
  'plan.created',
  'plan.updated',
])

const actionLabel = (action) => {
  const map = {
    'tenant.created': 'Tenant created',
    'tenant.updated': 'Tenant updated',
    'tenant.suspended': 'Tenant suspended',
    'tenant.activated': 'Tenant activated',
    'subscription.assigned': 'Subscription assigned',
    'plan.created': 'Plan created',
    'plan.updated': 'Plan updated',
  }
  return map[action] || action
}

const SuperAdminDashboardPage = () => {
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [s, l, subs] = await Promise.all([
          getPlatformStats(),
          listAuditLogs(40),
          listSubscriptions(),
        ])
        if (!cancelled) {
          setStats(s)
          setLogs(l)
          setSubscriptions(subs)
        }
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const business = useMemo(() => {
    const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial')
    return { activeSubscriptions: activeSubs.length }
  }, [subscriptions])

  const recent = useMemo(
    () => logs.filter((log) => TENANT_ACTIVITY_ACTIONS.has(log.action)).slice(0, 6),
    [logs],
  )

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load dashboard</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { context: 'SuperAdminDashboard', fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const v = (n) => (loading ? '…' : n)

  const health = [
    { title: 'Tenants', value: v(stats?.tenants), icon: Building2, to: '/super-admin/tenants' },
    { title: 'Active', value: v(stats?.activeTenants), icon: CheckCircle2, to: '/super-admin/tenants' },
    { title: 'Plans', value: v(business.activeSubscriptions), icon: CreditCard, to: '/super-admin/plans' },
    { title: 'Tickets', value: v(stats?.openTickets), icon: Ticket, to: '/super-admin/support' },
  ]

  return (
    <AnimatedPage>
      <Helmet>
        <title>Overview — Super Admin</title>
      </Helmet>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-lg font-semibold text-[var(--pf-text)] sm:text-xl">Overview</h1>
        <Button asChild size="sm" className="h-9 bg-[var(--pf-accent)] text-[var(--pf-accent-fg)] hover:opacity-90">
          <Link to="/super-admin/tenants/create">
            <Plus className="mr-1.5 h-4 w-4" />
            Create Tenant
          </Link>
        </Button>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-medium text-[var(--pf-faint)]">Tenant health</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {health.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.title}
                to={item.to}
                className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3.5 transition-colors hover:border-teal-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-[var(--pf-muted)]">{item.title}</span>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                </div>
                <p className="mt-2 font-display text-2xl font-semibold leading-none text-[var(--pf-text)]">
                  {item.value}
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium text-[var(--pf-faint)]">Recent activity</h2>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[var(--pf-muted)]">
            <Link to="/super-admin/audit-logs">All logs</Link>
          </Button>
        </div>
        <div className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-4">
          {loading ? (
            <p className="text-sm text-[var(--pf-faint)]">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-[var(--pf-faint)]">No tenant activity yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {recent.map((log) => (
                <li key={log.id} className="text-sm text-[var(--pf-muted)]">
                  <span className="text-[var(--pf-text)]">{actionLabel(log.action)}</span>
                  {log.metadata?.name ? ` · ${log.metadata.name}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AnimatedPage>
  )
}

export default SuperAdminDashboardPage
