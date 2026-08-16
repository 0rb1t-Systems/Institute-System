import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Building2, GraduationCap, Users, DollarSign } from 'lucide-react'
import { getPlatformStats } from '@/lib/superAdminApi'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const AnalyticsPage = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        setStats(await getPlatformStats())
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const v = (n) => (loading ? '…' : n)

  return (
    <AnimatedPage>
      <Helmet>
        <title>Analytics</title>
      </Helmet>

      <PageHeader
        title="Analytics"
        subtitle="Institution-level aggregates — students, operators, growth, and payment volume. Totals only; no individual records."
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load analytics</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Tenants"
          value={v(stats?.tenants)}
          icon={<Building2 className="h-4 w-4 text-blue-400" />}
          description={`${stats?.activeTenants ?? 0} active / ${stats?.suspendedTenants ?? 0} suspended`}
        />
        <StatCard
          title="Students (total)"
          value={v(stats?.studentsTotal)}
          icon={<GraduationCap className="h-4 w-4 text-violet-400" />}
          description={`${stats?.studentsActive ?? 0} active`}
        />
        <StatCard
          title="Platform operators"
          value={v(stats?.users)}
          icon={<Users className="h-4 w-4 text-sky-400" />}
          description={`${stats?.byRole?.admin ?? 0} admins · ${stats?.byRole?.staff ?? 0} staff · ${stats?.byRole?.instructor ?? 0} instructors`}
        />
        <StatCard
          title="Payment volume"
          value={v(
            stats?.revenueTotal != null
              ? Number(stats.revenueTotal).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              : undefined,
          )}
          icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
          description={`${stats?.paymentsCount ?? 0} payments`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Student growth by month</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !(stats?.studentGrowth?.length) ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.studentGrowth.map((row) => (
                <li key={row.month} className="flex items-center gap-3 text-sm">
                  <span className="w-20 font-mono text-xs text-slate-500">{row.month}</span>
                  <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-violet-500/80"
                      style={{
                        width: `${Math.min(100, (row.count / Math.max(...stats.studentGrowth.map((r) => r.count), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-slate-200">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Tenant growth by month</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !(stats?.tenantGrowth?.length) ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.tenantGrowth.map((row) => (
                <li key={row.month} className="flex items-center gap-3 text-sm">
                  <span className="w-20 font-mono text-xs text-slate-500">{row.month}</span>
                  <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500/80"
                      style={{
                        width: `${Math.min(100, (row.count / Math.max(...stats.tenantGrowth.map((r) => r.count), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-slate-200">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AnimatedPage>
  )
}

export default AnalyticsPage
