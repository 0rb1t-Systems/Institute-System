import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Building2,
  AlertCircle,
  Plus,
  GraduationCap,
  Award,
  Wallet,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  getSuperAdminOverview,
  type SuperAdminOverviewPeriod,
} from '@/lib/superAdminApi'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import { cn } from '@/lib/utils'

const PIE_COLORS = [
  'var(--pf-accent)',
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#a78bfa',
  '#fbbf24',
]

type InstitutionRow = {
  id: string
  name: string
  subdomain?: string
  students?: number
}

const PERIODS: { id: SuperAdminOverviewPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'this_month', label: 'Month' },
  { id: '90d', label: '90D' },
]

const fmt = (n?: number | null) =>
  n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString()

const Segmented = ({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) => (
  <div className="inline-flex flex-wrap gap-0.5 rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-bg)] p-0.5">
    {options.map((opt) => (
      <button
        key={opt.id}
        type="button"
        onClick={() => onChange(opt.id)}
        className={cn(
          'rounded-[8px] px-2.5 py-1 text-[11px] font-semibold transition',
          value === opt.id
            ? 'bg-[var(--pf-accent)] text-[var(--pf-accent-fg)] shadow-[0_4px_10px_color-mix(in_srgb,var(--pf-accent)_30%,transparent)]'
            : 'text-[var(--pf-muted)] hover:text-[var(--pf-text)]',
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
)

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[8px] border border-[var(--pf-line)] bg-[var(--pf-surface)] px-2.5 py-1.5 text-xs shadow-md">
      {label ? <p className="mb-0.5 font-medium text-[var(--pf-muted)]">{label}</p> : null}
      {payload.map((entry: any) => (
        <p key={entry.name} className="font-semibold text-[var(--pf-text)]">
          {entry.name}: {Number(entry.value).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

const SuperAdminDashboardPage = () => {
  const [period, setPeriod] = useState<SuperAdminOverviewPeriod>('30d')
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const ov = await getSuperAdminOverview(period)
        if (!cancelled) setOverview(ov)
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [period])

  const institutions: InstitutionRow[] = overview?.institutions || []
  const kpis = overview?.kpis || {}
  const growth = overview?.growth || {}

  const pieData = useMemo(() => {
    const rows = (growth?.students || []) as { month: string; count: number }[]
    return rows
      .map((r, i) => ({
        name: String(r.month || ''),
        short: String(r.month || '').slice(5) || String(r.month || '—'),
        value: Number(r.count) || 0,
        fill: PIE_COLORS[i % PIE_COLORS.length],
      }))
      .filter((r) => r.value > 0)
  }, [growth])

  const pieTotal = useMemo(
    () => pieData.reduce((sum, r) => sum + r.value, 0),
    [pieData],
  )

  const columnData = useMemo(() => {
    return [...institutions]
      .map((i) => ({
        name: i.subdomain || (i.name?.length > 10 ? `${i.name.slice(0, 8)}…` : i.name) || '—',
        fullName: i.name || 'Institution',
        students: Number(i.students) || 0,
      }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 6)
  }, [institutions])

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

  const v = (n: number | undefined) => (loading ? '…' : fmt(n))

  const moneyFmt = (n?: number | null) =>
    n == null || Number.isNaN(Number(n))
      ? '—'
      : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  const kpiItems = [
    {
      title: 'Institutions',
      value: v(kpis.institutions_total),
      hint: `${fmt(kpis.institutions_active)} active`,
      icon: Building2,
      to: '/super-admin/tenants',
    },
    {
      title: 'Students',
      value: v(kpis.students_total),
      hint: `${fmt(kpis.students_period)} new`,
      icon: GraduationCap,
      to: '/super-admin/analytics',
    },
    {
      title: 'Certificates',
      value: v(kpis.certificates_total),
      hint: `${fmt(kpis.certificates_period)} period`,
      icon: Award,
      to: '/super-admin/analytics',
    },
    {
      title: 'Plan revenue',
      value: loading ? '…' : moneyFmt(kpis.platform_subscription_revenue_period),
      hint: `${fmt(kpis.platform_subscription_payments_period)} WaafiPay`,
      icon: Wallet,
      to: '/super-admin/plans',
    },
  ]

  return (
    <AnimatedPage>
      <Helmet>
        <title>Overview — Super Admin</title>
      </Helmet>

      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--pf-text)]">
              Overview
            </h1>
            <p className="mt-1.5 text-sm text-[var(--pf-muted)]">
              Platform health at a glance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented
              options={PERIODS}
              value={period}
              onChange={(id) => setPeriod(id as SuperAdminOverviewPeriod)}
            />
            <Button
              asChild
              size="sm"
              className="h-8 rounded-[10px] bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] shadow-[0_8px_18px_color-mix(in_srgb,var(--pf-accent)_32%,transparent)] hover:opacity-95"
            >
              <Link to="/super-admin/tenants/create">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create
              </Link>
            </Button>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.title}
                to={item.to}
                className="group rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] px-4 py-4 transition hover:border-[var(--pf-accent)]/50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-muted)]">
                    {item.title}
                  </span>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--pf-hover)] text-[var(--pf-accent)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-3 font-display text-[1.85rem] font-extrabold leading-none tabular-nums tracking-tight text-[var(--pf-text)]">
                  {item.value}
                </p>
                <p className="mt-2 text-[11px] text-[var(--pf-faint)]">{item.hint}</p>
              </Link>
            )
          })}
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--pf-text)]">Student growth</h2>
            <p className="mb-5 text-[11px] text-[var(--pf-faint)]">New students by month (90 days)</p>
            <div className="flex min-h-[240px] flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-7">
              {loading ? (
                <p className="w-full py-20 text-center text-sm text-[var(--pf-faint)]">Loading…</p>
              ) : pieData.length === 0 ? (
                <p className="w-full py-20 text-center text-sm text-[var(--pf-faint)]">No growth data yet.</p>
              ) : (
                <>
                  <div className="h-[200px] w-[200px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const row = payload[0].payload
                            const pct = pieTotal > 0 ? Math.round((row.value / pieTotal) * 100) : 0
                            return (
                              <div className="rounded-[8px] border border-[var(--pf-line)] bg-[var(--pf-surface)] px-2.5 py-1.5 text-xs shadow-md">
                                <p className="font-medium text-[var(--pf-muted)]">{row.name}</p>
                                <p className="font-semibold text-[var(--pf-text)]">
                                  {fmt(row.value)} students · {pct}%
                                </p>
                              </div>
                            )
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex w-full min-w-0 flex-1 flex-col gap-3">
                    {pieData.map((row) => {
                      const pct = pieTotal > 0 ? Math.round((row.value / pieTotal) * 100) : 0
                      return (
                        <li key={row.name} className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: row.fill }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--pf-text)]">
                            {row.short}
                          </span>
                          <span className="shrink-0 text-right text-[12px] tabular-nums text-[var(--pf-muted)]">
                            {fmt(row.value)}
                          </span>
                          <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--pf-text)]">
                            {pct}%
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5">
            <h2 className="mb-1 text-sm font-semibold text-[var(--pf-text)]">Students by institution</h2>
            <p className="mb-5 text-[11px] text-[var(--pf-faint)]">Top institutions by enrollment</p>
            <div className="h-[240px]">
              {loading ? (
                <p className="py-20 text-center text-sm text-[var(--pf-faint)]">Loading…</p>
              ) : columnData.length === 0 ? (
                <p className="py-20 text-center text-sm text-[var(--pf-faint)]">No student data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={columnData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                    <CartesianGrid stroke="var(--pf-line)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--pf-muted)', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
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
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || _}
                    />
                    <Bar
                      dataKey="students"
                      name="Students"
                      fill="var(--pf-accent)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={44}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </div>
    </AnimatedPage>
  )
}

export default SuperAdminDashboardPage
