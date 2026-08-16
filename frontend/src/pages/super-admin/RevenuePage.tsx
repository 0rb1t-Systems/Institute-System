import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import StatCard from '@/components/StatCard'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, DollarSign, CreditCard, Building2 } from 'lucide-react'
import { getRevenueByTenant, listTenants } from '@/lib/superAdminApi'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const RevenuePage = () => {
  const [revenue, setRevenue] = useState(null)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [r, t] = await Promise.all([getRevenueByTenant(), listTenants()])
        setRevenue(r)
        setTenants(t)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const tenantName = useMemo(() => {
    const map: any = {}
    for (const t of tenants) map[t.id] = t.name
    return map
  }, [tenants])

  return (
    <AnimatedPage>
      <Helmet>
        <title>Revenue & Payments</title>
      </Helmet>

      <PageHeader
        title="Revenue & Payments"
        subtitle="Aggregated tenant payment volume. Individual student payment records are not listed."
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load revenue</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <StatCard
          title="Total volume"
          value={loading ? '…' : money(revenue?.total)}
          icon={<DollarSign className="h-4 w-4 text-emerald-400" />}
          description="Across all tenants"
        />
        <StatCard
          title="Payments"
          value={loading ? '…' : revenue?.count}
          icon={<CreditCard className="h-4 w-4 text-sky-400" />}
          description="Recorded transactions"
        />
        <StatCard
          title="Paying tenants"
          value={loading ? '…' : revenue?.byTenant?.length}
          icon={<Building2 className="h-4 w-4 text-blue-400" />}
          description="With at least one payment"
        />
      </div>

      <h2 className="text-sm font-semibold text-slate-200 mb-3">By tenant</h2>
      <div className="rounded-lg border border-slate-800 overflow-hidden mb-8">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead>Tenant</TableHead>
              <TableHead>Payments</TableHead>
              <TableHead className="text-right">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : !(revenue?.byTenant?.length) ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-slate-500 py-8">
                  No payments recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              revenue.byTenant.map((row) => (
                <TableRow key={row.institution_id} className="border-slate-800">
                  <TableCell className="text-slate-100">
                    {tenantName[row.institution_id] || 'Unknown tenant'}
                  </TableCell>
                  <TableCell className="text-slate-400">{row.count}</TableCell>
                  <TableCell className="text-right text-slate-200 font-medium">
                    {money(row.total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {revenue?.byMethod && Object.keys(revenue.byMethod).length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-200 mb-3">By method</h2>
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(revenue.byMethod).map(([method, amount]) => (
              <div key={method} className="text-sm">
                <p className="text-slate-500 capitalize">{method}</p>
                <p className="text-slate-100 font-medium">{money(amount)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </AnimatedPage>
  )
}

export default RevenuePage
