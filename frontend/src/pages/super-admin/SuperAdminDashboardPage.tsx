import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Building2,
  AlertCircle,
  Plus,
  Activity,
  Ticket,
  CreditCard,
  DollarSign,
  Clock,
  ShieldOff,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import {
  getPlatformStats,
  listAuditLogs,
  listSubscriptions,
  listTenants,
} from '@/lib/superAdminApi'
import { formatCurrency } from '@/lib/utils'
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

const STATUS_EVENTS = new Set(['tenant.suspended', 'tenant.activated'])
const SUBSCRIPTION_EVENTS = new Set(['subscription.assigned', 'plan.created', 'plan.updated'])

const actionLabel = (action) => {
  const map = {
    'tenant.created': 'Tenant created',
    'tenant.updated': 'Tenant updated',
    'tenant.suspended': 'Tenant suspended',
    'tenant.activated': 'Tenant activated',
    'subscription.assigned': 'Subscription changed',
    'plan.created': 'Plan created',
    'plan.updated': 'Plan updated',
  }
  return map[action] || action
}

const actionTone = (action) => {
  if (action === 'tenant.suspended') return 'text-amber-300'
  if (action === 'tenant.activated' || action === 'tenant.created') return 'text-emerald-300'
  if (SUBSCRIPTION_EVENTS.has(action)) return 'text-sky-300'
  return 'text-slate-300'
}

const SuperAdminDashboardPage = () => {
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [s, l, subs, t] = await Promise.all([
          getPlatformStats(),
          listAuditLogs(40),
          listSubscriptions(),
          listTenants(),
        ])
        if (!cancelled) {
          setStats(s)
          setLogs(l)
          setSubscriptions(subs)
          setTenants(t)
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
    const overdueSubs = subscriptions.filter(
      (s) => s.status === 'past_due' || s.status === 'expired',
    )
    return {
      activeSubscriptions: activeSubs.length,
      overdueSubscriptions: overdueSubs.length,
    }
  }, [subscriptions])

  const activity = useMemo(() => {
    const tenantLogs = logs.filter((log) => TENANT_ACTIVITY_ACTIONS.has(log.action))
    return {
      recent: tenantLogs.slice(0, 8),
      statusEvents: tenantLogs.filter((log) => STATUS_EVENTS.has(log.action)).slice(0, 6),
      subscriptionEvents: tenantLogs
        .filter((log) => SUBSCRIPTION_EVENTS.has(log.action))
        .slice(0, 6),
      newTenants: tenants.slice(0, 6),
    }
  }, [logs, tenants])

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
  const money = (n) => (loading ? '…' : formatCurrency(n ?? 0))

  return (
    <AnimatedPage>
      <Helmet>
        <title>Overview — Super Admin</title>
      </Helmet>

      <PageHeader
        title="Overview"
        subtitle="SaaS platform health — tenants, subscriptions, revenue, and operations."
      >
        <Button asChild className="bg-indigo-600 hover:bg-indigo-500">
          <Link to="/super-admin/tenants/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Link>
        </Button>
      </PageHeader>

      {/* Top summary — tenant health */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Tenant health
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Tenants"
            value={v(stats?.tenants)}
            icon={<Building2 className="h-4 w-4 text-blue-400" />}
            description="All institutions"
          />
          <StatCard
            title="Active Tenants"
            value={v(stats?.activeTenants)}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            description="Currently operational"
          />
          <StatCard
            title="Suspended Tenants"
            value={v(stats?.suspendedTenants)}
            icon={<ShieldOff className="h-4 w-4 text-amber-400" />}
            description="Access restricted"
          />
          <Link to="/super-admin/support" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
            <StatCard
              title="Pending Requests"
              value={v(stats?.openTickets)}
              icon={<Ticket className="h-4 w-4 text-rose-400" />}
              description="Open support tickets"
            />
          </Link>
        </div>
      </section>

      {/* Business summary */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Business summary
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/super-admin/plans" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
            <StatCard
              title="Active Subscriptions"
              value={v(business.activeSubscriptions)}
              icon={<CreditCard className="h-4 w-4 text-sky-400" />}
              description="Active & trial plans"
            />
          </Link>
          <Link to="/super-admin/revenue" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
            <StatCard
              title="Platform Revenue"
              value={money(stats?.revenueTotal)}
              icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
              description={`${stats?.paymentsCount ?? 0} payments recorded`}
            />
          </Link>
          <Link to="/super-admin/plans" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
            <StatCard
              title="Overdue Subscriptions"
              value={v(business.overdueSubscriptions)}
              icon={<Clock className="h-4 w-4 text-amber-400" />}
              description="Past due or expired"
            />
          </Link>
        </div>
      </section>

      {/* Activity */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Activity
          </h2>
          <Button asChild variant="ghost" size="sm" className="text-slate-400 h-8">
            <Link to="/super-admin/audit-logs">View all audit logs</Link>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent tenant activity */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Recent Tenant Activity</h3>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : activity.recent.length === 0 ? (
              <p className="text-sm text-slate-500">No tenant activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.recent.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm border-b border-slate-800/80 pb-2 last:border-0"
                  >
                    <span className={`font-medium ${actionTone(log.action)}`}>
                      {actionLabel(log.action)}
                      {log.metadata?.name ? (
                        <span className="text-slate-500 font-normal"> · {log.metadata.name}</span>
                      ) : null}
                    </span>
                    <span className="text-slate-500 text-xs shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Newly created tenants */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-200">Newly Created Tenants</h3>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-slate-400 h-7 px-2">
                <Link to="/super-admin/tenants">All tenants</Link>
              </Button>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : activity.newTenants.length === 0 ? (
              <p className="text-sm text-slate-500">No tenants yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.newTenants.map((tenant) => (
                  <li
                    key={tenant.id}
                    className="flex items-center justify-between gap-3 text-sm border-b border-slate-800/80 pb-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/super-admin/tenants/${tenant.id}`}
                        className="text-slate-200 font-medium hover:text-white truncate block"
                      >
                        {tenant.name}
                      </Link>
                      <p className="text-xs text-slate-500 truncate">
                        {tenant.subdomain}
                        {tenant.created_at
                          ? ` · ${new Date(tenant.created_at).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        tenant.status === 'active'
                          ? 'border-emerald-700/60 text-emerald-300 bg-emerald-950/40'
                          : 'border-amber-700/60 text-amber-300 bg-amber-950/40'
                      }
                    >
                      {tenant.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Activation / suspension */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldOff className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Activation & Suspension Events
              </h3>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : activity.statusEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No activation or suspension events yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.statusEvents.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm border-b border-slate-800/80 pb-2 last:border-0"
                  >
                    <span className={`font-medium ${actionTone(log.action)}`}>
                      {actionLabel(log.action)}
                      {log.metadata?.name ? (
                        <span className="text-slate-500 font-normal"> · {log.metadata.name}</span>
                      ) : null}
                    </span>
                    <span className="text-slate-500 text-xs shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Subscription changes */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-200">Subscription Changes</h3>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-slate-400 h-7 px-2">
                <Link to="/super-admin/plans">Plans</Link>
              </Button>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : activity.subscriptionEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No subscription changes yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.subscriptionEvents.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm border-b border-slate-800/80 pb-2 last:border-0"
                  >
                    <span className={`font-medium ${actionTone(log.action)}`}>
                      {actionLabel(log.action)}
                      {log.metadata?.status ? (
                        <span className="text-slate-500 font-normal"> · {log.metadata.status}</span>
                      ) : log.metadata?.name ? (
                        <span className="text-slate-500 font-normal"> · {log.metadata.name}</span>
                      ) : null}
                    </span>
                    <span className="text-slate-500 text-xs shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Student counts and growth charts live on{' '}
          <Link to="/super-admin/analytics" className="text-slate-400 underline-offset-2 hover:underline">
            Analytics
          </Link>
          . Tenant admin accounts are managed under{' '}
          <Link to="/super-admin/tenant-admins" className="text-slate-400 underline-offset-2 hover:underline">
            Tenant Admins
          </Link>
          ; staff/instructor issues are handled via{' '}
          <Link to="/super-admin/support" className="text-slate-400 underline-offset-2 hover:underline">
            Support
          </Link>
          .
        </p>
      </section>
    </AnimatedPage>
  )
}

export default SuperAdminDashboardPage
