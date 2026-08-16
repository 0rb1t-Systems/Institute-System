import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Plus, Search, Building2 } from 'lucide-react'
import { listTenants } from '@/lib/superAdminApi'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const TenantsPage = () => {
  const [tenants, setTenants] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setTenants(await listTenants())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return tenants
    return tenants.filter(
      (t) =>
        t.name?.toLowerCase().includes(term) ||
        t.subdomain?.toLowerCase().includes(term) ||
        t.email?.toLowerCase().includes(term),
    )
  }, [tenants, q])

  return (
    <AnimatedPage>
      <Helmet>
        <title>Tenants</title>
      </Helmet>

      <PageHeader
        title="Tenants"
        subtitle="View, create, and manage all institutions on the platform."
      >
        <Button asChild className="bg-indigo-600 hover:bg-indigo-500">
          <Link to="/super-admin/tenants/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Link>
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load tenants</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { context: 'TenantsPage', fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          className="pl-9 bg-slate-900 border-slate-800"
          placeholder="Search by name, slug, or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead>Institution</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-slate-500 text-center py-10">
                  Loading tenants…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-slate-500 text-center py-10">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No tenants found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id} className="border-slate-800">
                  <TableCell className="font-medium text-slate-100">{t.name}</TableCell>
                  <TableCell className="text-slate-400 font-mono text-xs">{t.subdomain}</TableCell>
                  <TableCell className="text-slate-400">{t.email || '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        t.status === 'active'
                          ? 'border-emerald-700 text-emerald-400'
                          : 'border-amber-700 text-amber-400'
                      }
                    >
                      {t.status || 'active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/super-admin/tenants/${t.id}`}>Details</Link>
                    </Button>
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

export default TenantsPage
