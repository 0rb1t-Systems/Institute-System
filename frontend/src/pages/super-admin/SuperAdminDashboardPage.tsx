import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  AlertCircle,
  Plus,
  GraduationCap,
  Award,
  Activity,
  Search,
  Mail,
  Palette,
  ChevronRight,
} from 'lucide-react'
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
import {
  getSuperAdminOverview,
  listAuditLogs,
  type SuperAdminOverviewPeriod,
} from '@/lib/superAdminApi'
import { usePlatformTheme } from '@/contexts/PlatformThemeContext'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import { cn } from '@/lib/utils'

type RankMetric = 'students' | 'activity' | 'certificates' | 'registrations'

type InstitutionRow = {
  id: string
  name: string
  subdomain?: string
  status?: string
  students?: number
  courses?: number
  certificates?: number
  certificates_period?: number
  registrations?: number
  registrations_period?: number
  activity_score?: number
}

const PERIODS: { id: SuperAdminOverviewPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'this_month', label: 'Month' },
  { id: '90d', label: '90D' },
]

const RANK_TABS: { id: RankMetric; label: string }[] = [
  { id: 'students', label: 'Students' },
  { id: 'activity', label: 'Activity' },
  { id: 'certificates', label: 'Certs' },
  { id: 'registrations', label: 'Regs' },
]

const TENANT_ACTIVITY_ACTIONS = new Set([
  'tenant.created',
  'tenant.updated',
  'tenant.suspended',
  'tenant.activated',
  'subscription.assigned',
  'plan.created',
  'plan.updated',
  'settings.theme_policy',
  'settings.updated',
])

const actionLabel = (action: string) => {
  const map: Record<string, string> = {
    'tenant.created': 'Institution created',
    'tenant.updated': 'Institution updated',
    'tenant.suspended': 'Institution suspended',
    'tenant.activated': 'Institution activated',
    'subscription.assigned': 'Subscription assigned',
    'plan.created': 'Plan created',
    'plan.updated': 'Plan updated',
    'settings.theme_policy': 'Theme policy updated',
    'settings.updated': 'Settings updated',
  }
  return map[action] || action
}

const fmt = (n?: number | null) =>
  n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString()

const rankValue = (row: InstitutionRow, metric: RankMetric) => {
  if (metric === 'students') return Number(row.students) || 0
  if (metric === 'certificates') return Number(row.certificates_period ?? row.certificates) || 0
  if (metric === 'registrations') return Number(row.registrations_period ?? row.registrations) || 0
  return Number(row.activity_score) || 0
}

const emailjsConfigured = () =>
  Boolean(
    import.meta.env.VITE_EMAILJS_SERVICE_ID &&
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID &&
      import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  )

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
  const { policy, mode } = usePlatformTheme()
  const [period, setPeriod] = useState<SuperAdminOverviewPeriod>('30d')
  const [rankMetric, setRankMetric] = useState<RankMetric>('students')
  const [overview, setOverview] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 6

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [ov, l] = await Promise.all([getSuperAdminOverview(period), listAuditLogs(30)])
        if (!cancelled) {
          setOverview(ov)
          setLogs(l)
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
  }, [period])

  const institutions: InstitutionRow[] = overview?.institutions || []
  const kpis = overview?.kpis || {}
  const attention = overview?.attention || []
  const growth = overview?.growth || {}

  const lineData = useMemo(() => {
    const rows = (growth?.students || []) as { month: string; count: number }[]
    return rows.map((r) => ({
      month: String(r.month || '').slice(5) || r.month,
      students: Number(r.count) || 0,
    }))
  }, [growth])

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

  const ranked = useMemo(() => {
    return [...institutions]
      .sort((a, b) => rankValue(b, rankMetric) - rankValue(a, rankMetric))
      .slice(0, 6)
  }, [institutions, rankMetric])

  const recent = useMemo(
    () => logs.filter((log) => TENANT_ACTIVITY_ACTIONS.has(log.action)).slice(0, 5),
    [logs],
  )

  const filteredInstitutions = useMemo(() => {
    const term = q.trim().toLowerCase()
    const rows = !term
      ? institutions
      : institutions.filter(
          (t) =>
            t.name?.toLowerCase().includes(term) ||
            t.subdomain?.toLowerCase().includes(term),
        )
    return [...rows].sort((a, b) => (b.students || 0) - (a.students || 0))
  }, [institutions, q])

  const pageCount = Math.max(1, Math.ceil(filteredInstitutions.length / pageSize))
  const paged = filteredInstitutions.slice(page * pageSize, page * pageSize + pageSize)

  useEffect(() => {
    setPage(0)
  }, [q, period])

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
      title: 'Activity',
      value: v(kpis.activity_period),
      hint: `${fmt(kpis.registrations_period)} regs`,
      icon: Activity,
      to: '/super-admin/audit-logs',
    },
  ]

  const themeLabel =
    policy === 'light' ? 'Light' : policy === 'dark' ? 'Dark' : `Choice · ${mode}`

  return (
    <AnimatedPage>
      <Helmet>
        <title>Overview — Super Admin</title>
      </Helmet>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--pf-text)]">
            Overview
          </h1>
          <p className="mt-1 text-sm text-[var(--pf-muted)]">
            Platform health at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <section className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {kpiItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.title}
              to={item.to}
              className="group rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)] px-3.5 py-3 transition hover:border-[var(--pf-accent)]/50 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pf-muted)]">
                  {item.title}
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--pf-hover)] text-[var(--pf-accent)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 font-display text-[1.75rem] font-extrabold leading-none tabular-nums tracking-tight text-[var(--pf-text)]">
                {item.value}
              </p>
              <p className="mt-1.5 text-[11px] text-[var(--pf-faint)]">{item.hint}</p>
            </Link>
          )
        })}
      </section>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3.5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--pf-text)]">Student growth</h2>
          <p className="mb-3 text-[11px] text-[var(--pf-faint)]">New students by month (90 days)</p>
          <div className="h-[200px]">
            {loading ? (
              <p className="py-16 text-center text-sm text-[var(--pf-faint)]">Loading…</p>
            ) : lineData.length === 0 ? (
              <p className="py-16 text-center text-sm text-[var(--pf-faint)]">No growth data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
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

        <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3.5">
          <h2 className="mb-1 text-sm font-semibold text-[var(--pf-text)]">Students by institution</h2>
          <p className="mb-3 text-[11px] text-[var(--pf-faint)]">Top institutions by enrollment</p>
          <div className="h-[200px]">
            {loading ? (
              <p className="py-16 text-center text-sm text-[var(--pf-faint)]">Loading…</p>
            ) : columnData.length === 0 ? (
              <p className="py-16 text-center text-sm text-[var(--pf-faint)]">No student data yet.</p>
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

      <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--pf-line)] px-3.5 py-2.5">
            <h2 className="text-sm font-semibold text-[var(--pf-text)]">Institution ranking</h2>
            <Segmented
              options={RANK_TABS}
              value={rankMetric}
              onChange={(id) => setRankMetric(id as RankMetric)}
            />
          </div>
          <div className="p-2">
            {loading ? (
              <p className="px-2 py-6 text-sm text-[var(--pf-faint)]">Loading…</p>
            ) : ranked.length === 0 ? (
              <p className="px-2 py-6 text-sm text-[var(--pf-faint)]">No institutions yet.</p>
            ) : (
              <ol>
                {ranked.map((row, idx) => {
                  const value = rankValue(row, rankMetric)
                  const max = Math.max(rankValue(ranked[0], rankMetric), 1)
                  const pct = value > 0 ? Math.min(100, (value / max) * 100) : 0
                  return (
                    <li key={row.id}>
                      <Link
                        to={`/super-admin/tenants/${row.id}`}
                        className="flex items-center gap-3 rounded-[8px] px-2 py-2 transition hover:bg-[var(--pf-hover)]"
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums',
                            idx === 0
                              ? 'bg-[var(--pf-accent)] text-[var(--pf-accent-fg)]'
                              : 'bg-[var(--pf-bg)] text-[var(--pf-muted)]',
                          )}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-[var(--pf-text)]">
                              {row.name}
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--pf-text)]">
                              {fmt(value)}
                            </span>
                          </div>
                          {pct > 0 ? (
                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--pf-bg)]">
                              <div
                                className="h-full rounded-full bg-[var(--pf-accent)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--pf-text)]">Needs attention</h2>
              <span className="text-[11px] font-semibold tabular-nums text-[var(--pf-faint)]">
                {attention.length}
              </span>
            </div>
            {loading ? (
              <p className="text-sm text-[var(--pf-faint)]">Loading…</p>
            ) : attention.length === 0 ? (
              <p className="text-sm text-[var(--pf-faint)]">All clear.</p>
            ) : (
              <ul className="space-y-1.5">
                {attention.slice(0, 5).map((item: any) => (
                  <li key={`${item.id}-${item.reason}`}>
                    <Link
                      to={`/super-admin/tenants/${item.id}`}
                      className="flex flex-col gap-1 rounded-[8px] px-1.5 py-1.5 text-sm hover:bg-[var(--pf-hover)] sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--pf-text)]" title={item.name}>
                        {item.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="w-fit shrink-0 border-[var(--pf-line)] text-[10px] text-[var(--pf-muted)]"
                      >
                        {item.label}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--pf-text)]">Communication</h2>
              <Link to="/super-admin/settings" className="text-[11px] font-medium text-[var(--pf-muted)] hover:text-[var(--pf-text)]">
                Settings
              </Link>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--pf-accent)]" />
                  <span className="truncate text-sm text-[var(--pf-text)]">Resend</span>
                </div>
                <span className="text-[10px] font-medium text-[var(--pf-faint)]">Not tracked</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--pf-accent)]" />
                  <span className="truncate text-sm text-[var(--pf-text)]">EmailJS</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-semibold',
                    emailjsConfigured() ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {emailjsConfigured() ? 'Configured' : 'Missing'}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-[8px] border border-[var(--pf-line)] bg-[var(--pf-bg)] px-2.5 py-2">
              <Palette className="h-3.5 w-3.5 text-[var(--pf-accent)]" />
              <span className="text-[11px] text-[var(--pf-muted)]">Theme</span>
              <span className="text-[11px] font-semibold text-[var(--pf-text)]">{themeLabel}</span>
              <Link
                to="/super-admin/settings"
                className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--pf-muted)] hover:text-[var(--pf-text)]"
              >
                Edit <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--pf-text)]">Recent</h2>
              <Link to="/super-admin/audit-logs" className="text-[11px] font-medium text-[var(--pf-muted)] hover:text-[var(--pf-text)]">
                Logs
              </Link>
            </div>
            {loading ? (
              <p className="text-sm text-[var(--pf-faint)]">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-[var(--pf-faint)]">No recent events.</p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((log) => (
                  <li key={log.id} className="truncate text-[13px] text-[var(--pf-muted)]">
                    <span className="font-medium text-[var(--pf-text)]">{actionLabel(log.action)}</span>
                    {log.metadata?.name ? ` · ${log.metadata.name}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-[10px] border border-[var(--pf-line)] bg-[var(--pf-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--pf-line)] px-3.5 py-2.5">
          <h2 className="text-sm font-semibold text-[var(--pf-text)]">Institutions</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pf-faint)]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="h-8 w-44 border-[var(--pf-line)] bg-[var(--pf-bg)] pl-8 text-sm"
              />
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[var(--pf-muted)]">
              <Link to="/super-admin/tenants">All</Link>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Courses</TableHead>
                <TableHead className="text-right">Activity</TableHead>
                <TableHead className="text-right">Certs</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-[var(--pf-faint)]">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-[var(--pf-faint)]">
                    No institutions match.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        to={`/super-admin/tenants/${row.id}`}
                        className="font-medium text-[var(--pf-text)] hover:underline"
                      >
                        {row.name}
                      </Link>
                      <div className="text-[11px] text-[var(--pf-faint)]">{row.subdomain}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.students)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.courses)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.activity_score)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.certificates)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-[var(--pf-line)] text-[10px]',
                          row.status === 'active' ? 'text-emerald-600' : 'text-amber-600',
                        )}
                      >
                        {row.status || '—'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-[var(--pf-line)] px-3.5 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-[var(--pf-line)]"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <span className="text-[11px] text-[var(--pf-faint)]">
              {page + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-[var(--pf-line)]"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </section>
    </AnimatedPage>
  )
}

export default SuperAdminDashboardPage
