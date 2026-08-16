import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Search, UserPlus } from 'lucide-react'
import { listAllTenantAdmins, listTenants } from '@/lib/superAdminApi'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const TenantAdminsPage = () => {
  const [admins, setAdmins] = useState([])
  const [tenants, setTenants] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [a, t] = await Promise.all([listAllTenantAdmins(), listTenants()])
        setAdmins(a)
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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return admins
    return admins.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        tenantName[u.institution_id]?.toLowerCase().includes(term),
    )
  }, [admins, q, tenantName])

  return (
    <AnimatedPage>
      <Helmet>
        <title>Tenant Admins</title>
      </Helmet>

      <PageHeader
        title="Tenant Admins"
        subtitle="Institution administrators across all tenants."
      >
        <Button asChild className="bg-indigo-600 hover:bg-indigo-500">
          <Link to="/super-admin/tenants">
            <UserPlus className="h-4 w-4 mr-2" />
            Manage via tenant
          </Link>
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load tenant admins</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          className="pl-9 bg-slate-900 border-slate-800"
          placeholder="Search name, email, or tenant…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                  No tenant admins found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow key={a.id} className="border-slate-800">
                  <TableCell className="text-slate-100">{a.full_name}</TableCell>
                  <TableCell className="text-slate-400">{a.email}</TableCell>
                  <TableCell className="text-slate-400">
                    {tenantName[a.institution_id] || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.institution_id ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/super-admin/tenants/${a.institution_id}`}>View tenant</Link>
                      </Button>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AnimatedPage>
  )
}

export default TenantAdminsPage
