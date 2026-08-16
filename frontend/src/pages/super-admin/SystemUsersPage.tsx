import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
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
import { AlertCircle, Search } from 'lucide-react'
import { listPlatformUsers, listTenants, updateSystemUserStatus } from '@/lib/superAdminApi'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const SystemUsersPage = () => {
  const { toast } = useToast()
  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [u, t] = await Promise.all([listPlatformUsers(), listTenants()])
      setUsers(u)
      setTenants(t)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const tenantName = useMemo(() => {
    const map: any = {}
    for (const t of tenants) map[t.id] = t.name
    return map
  }, [tenants])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return users
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.role?.toLowerCase().includes(term) ||
        tenantName[u.institution_id]?.toLowerCase().includes(term),
    )
  }, [users, q, tenantName])

  const toggleSuspend = async (user) => {
    const next = user.status === 'suspended' ? 'approved' : 'suspended'
    const label = next === 'suspended' ? 'suspend' : 'approve'
    if (!window.confirm(`Are you sure you want to ${label} ${user.full_name || user.email}?`)) {
      return
    }
    setBusyId(user.id)
    try {
      const updated = await updateSystemUserStatus(user.id, next)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u)))
      toast({ title: 'Success', description: MESSAGES.SUCCESS.USER_UPDATED })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.UPDATE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Platform Users</title>
      </Helmet>

      <PageHeader
        title="Platform Users"
        subtitle="Tenant operators only (admins, staff, instructors). Students are shown as aggregates in Overview and Analytics."
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load users</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          className="pl-9 bg-slate-900 border-slate-800"
          placeholder="Search name, email, role, tenant…"
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
              <TableHead>Role</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Status</TableHead>
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
                  No platform users found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id} className="border-slate-800">
                  <TableCell className="text-slate-100">{u.full_name}</TableCell>
                  <TableCell className="text-slate-400">{u.email}</TableCell>
                  <TableCell className="capitalize text-slate-300">{u.role}</TableCell>
                  <TableCell className="text-slate-400">
                    {tenantName[u.institution_id] || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === u.id}
                      onClick={() => toggleSuspend(u)}
                    >
                      {u.status === 'suspended' ? 'Approve' : 'Suspend'}
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

export default SystemUsersPage
