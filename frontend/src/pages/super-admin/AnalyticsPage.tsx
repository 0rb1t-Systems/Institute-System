import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Building2, GraduationCap, Users, DollarSign } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { getPlatformStats } from '@/lib/superAdminApi'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[8px] border border-[var(--pf-line)] bg-[var(--pf-surface)] px-2.5 py-1.5 text-xs shadow-md">
      {label ? <p className="mb-0.5 font-medium text-[var(--pf-muted)]">{label}</p> : null}
      {payload.map((entry: any) => (
        <p key={String(entry.name)} className="font-semibold text-[var(--pf-text)]">
          {entry.name}: {Number(entry.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

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

  const lineData = useMemo(() => {
    const rows = stats?.studentGrowth || []
    return rows.map((row) => ({
      month: String(row.month || '').slice(5) || row.month,
      students: Number(row.count) || 0,
    }))
  }, [stats])

  const columnData = useMemo(() => {
    const rows = stats?.tenantGrowth || []
    return rows.map((row) => ({
      month: String(row.month || '').slice(5) || row.month,
      tenants: Number(row.count) || 0,
    }))
  }, [stats])

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

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tenants"
          value={v(stats?.tenants)}
          icon={<Building2 className="h-4 w-4" />}
          description={`${stats?.activeTenants ?? 0} active / ${stats?.suspendedTenants ?? 0} suspended`}
        />
        <StatCard
          title="Students (total)"
          value={v(stats?.studentsTotal)}
          icon={<GraduationCap className="h-4 w-4" />}
          description={`${stats?.studentsActive ?? 0} active`}
        />
        <StatCard
          title="Platform operators"
          value={v(stats?.users)}
          icon={<Users className="h-4 w-4" />}
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
          icon={<DollarSign className="h-4 w-4" />}
          description={`${stats?.paymentsCount ?? 0} payments`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)] p-4">
          <h2 className="mb-1 text-sm font-semibold text-[var(--pf-text)]">Student growth by month</h2>
          <p className="mb-3 text-[11px] text-[var(--pf-faint)]">New student accounts over time</p>
          <div className="h-[240px]">
            {loading ? (
              <p className="py-20 text-center text-sm text-[var(--pf-faint)]">Loading…</p>
            ) : lineData.length === 0 ? (
              <p className="py-20 text-center text-sm text-[var(--pf-faint)]">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--pf-line)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--pf-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--pf-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="students"
                    name="Students"
                    stroke="var(--pf-accent)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: 'var(--pf-accent)', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)] p-4">
          <h2 className="mb-1 text-sm font-semibold text-[var(--pf-text)]">Tenant growth by month</h2>
          <p className="mb-3 text-[11px] text-[var(--pf-faint)]">New institutions per month</p>
          <div className="h-[240px]">
            {loading ? (
              <p className="py-20 text-center text-sm text-[var(--pf-faint)]">Loading…</p>
            ) : columnData.length === 0 ? (
              <p className="py-20 text-center text-sm text-[var(--pf-faint)]">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={columnData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--pf-line)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--pf-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'var(--pf-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: 'color-mix(in srgb, var(--pf-accent) 12%, transparent)' }}
                  />
                  <Bar
                    dataKey="tenants"
                    name="Tenants"
                    fill="var(--pf-accent)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </AnimatedPage>
  )
}

export default AnalyticsPage
