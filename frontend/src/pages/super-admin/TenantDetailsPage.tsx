import React, { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, ArrowLeft, Loader2, Pencil, Trash2, UserPlus } from 'lucide-react'
import {
  getTenant,
  getTenantAdmins,
  updateTenant,
  createTenantAdmin,
  deleteTenant,
} from '@/lib/superAdminApi'
import { isValidEmail } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import { notify } from '@/lib/notify'

const TenantDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [tenant, setTenant] = useState(null)
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    temporary_password: '',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    description: '',
  })

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [t, a] = await Promise.all([getTenant(id), getTenantAdmins(id)])
      if (!t) throw new Error('NOT_FOUND')
      setTenant(t)
      setAdmins(a)
      setEditForm({
        name: t.name || '',
        email: t.email || '',
        phone: t.phone || '',
        address: t.address || '',
        description: t.description || '',
      })
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const toggleStatus = async () => {
    if (!tenant) return
    const next = tenant.status === 'suspended' ? 'active' : 'suspended'
    const label = next === 'suspended' ? 'suspend' : 'activate'
    if (!window.confirm(`Are you sure you want to ${label} “${tenant.name}”?`)) return

    setSavingStatus(true)
    try {
      const updated = await updateTenant(tenant.id, { status: next })
      setTenant(updated)
      toast({
        title: 'Success',
        description: next === 'suspended' ? 'Tenant suspended.' : 'Tenant activated.',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.UPDATE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSavingStatus(false)
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) {
      toast({ title: 'Validation', description: 'Institution name is required.', variant: 'destructive' })
      return
    }
    if (editForm.email && !isValidEmail(editForm.email)) {
      toast({ title: 'Validation', description: MESSAGES.VALIDATION.EMAIL, variant: 'destructive' })
      return
    }
    setSavingEdit(true)
    try {
      const updated = await updateTenant(id, {
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        description: editForm.description.trim() || null,
      })
      setTenant(updated)
      setEditOpen(false)
      toast({ title: 'Success', description: 'Tenant information updated.' })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.UPDATE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (e) => {
    e?.preventDefault?.()
    if (!tenant) return
    const typed = String(confirmName || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const expected = String(tenant.name || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!typed || typed !== expected) {
      toast({
        title: 'Confirmation required',
        description: 'Type the exact tenant name to confirm permanent deletion.',
        variant: 'destructive',
      })
      return
    }
    setDeleting(true)
    try {
      await deleteTenant(tenant.id, typed)
      toast({ title: 'Tenant deleted', description: `${tenant.name} was permanently removed.` })
      navigate('/super-admin/tenants', { replace: true })
    } catch (err) {
      notify.error(err, {
        context: 'TenantDetailsPage - deleteTenant',
        fallback: MESSAGES.DELETE_FAILED,
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateAdmin = async (e) => {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim() || !form.temporary_password.trim()) {
      toast({ title: 'Validation', description: 'Please complete all required fields.', variant: 'destructive' })
      return
    }
    if (!isValidEmail(form.email)) {
      toast({ title: 'Validation', description: MESSAGES.VALIDATION.EMAIL, variant: 'destructive' })
      return
    }
    if (form.temporary_password.length < 8) {
      toast({ title: 'Validation', description: MESSAGES.VALIDATION.PASSWORD_MIN, variant: 'destructive' })
      return
    }

    setCreating(true)
    try {
      const result = await createTenantAdmin({
        institution_id: id,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        temporary_password: form.temporary_password,
      })
      toast({
        title: 'Success',
        description: 'Tenant Admin account created successfully.',
      })
      if (!result.emailed) {
        toast({
          title: 'Email notice',
          description: MESSAGES.DOMAIN.EMAIL_SEND_FAILED,
          variant: 'destructive',
        })
      }
      setDialogOpen(false)
      setForm({ full_name: '', email: '', temporary_password: '' })
      await load()
    } catch (err) {
      notify.error(err, {
        context: 'TenantDetailsPage - createAdmin',
        fallback: MESSAGES.SAVE_FAILED,
      })
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !tenant) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Tenant not found</AlertTitle>
        <AlertDescription>
          {getUserMessage(error, { fallback: MESSAGES.NOT_FOUND })}
        </AlertDescription>
      </Alert>
    )
  }

  const normalizeTenantName = (value) =>
    String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const nameMatches = normalizeTenantName(confirmName) === normalizeTenantName(tenant.name)

  return (
    <AnimatedPage>
      <Helmet>
        <title>{tenant.name} — Tenant</title>
      </Helmet>

      <PageHeader title={tenant.name} subtitle={`Slug: ${tenant.subdomain}`}>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/super-admin/tenants">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={savingStatus}
            onClick={toggleStatus}
            className={
              tenant.status === 'suspended'
                ? 'border-emerald-700 text-emerald-400'
                : 'border-amber-700 text-amber-400'
            }
          >
            {savingStatus ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : tenant.status === 'suspended' ? (
              'Activate'
            ) : (
              'Suspend'
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-red-800 text-red-400 hover:bg-red-950/40"
            onClick={() => {
              setConfirmName('')
              setDeleteOpen(true)
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Institution profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Status</span>
              <Badge
                variant="outline"
                className={
                  tenant.status === 'active'
                    ? 'border-emerald-700 text-emerald-400'
                    : 'border-amber-700 text-amber-400'
                }
              >
                {tenant.status}
              </Badge>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-200">{tenant.email || '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Phone</span>
              <span className="text-slate-200">{tenant.phone || '—'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">Address</span>
              <span className="text-slate-200">{tenant.address || '—'}</span>
            </div>
            {tenant.description ? (
              <div className="flex flex-col gap-1">
                <span className="text-slate-500">Description</span>
                <span className="text-slate-200">{tenant.description}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Created</span>
              <span className="text-slate-400">
                {tenant.created_at ? new Date(tenant.created_at).toLocaleString() : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-white text-base">Tenant Admin Management</CardTitle>
              <CardDescription>Administrators linked to this institution only.</CardDescription>
            </div>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500" onClick={() => setDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />
              Add Admin
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-slate-500 text-center py-6">
                      No admins found.
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((a) => (
                    <TableRow key={a.id} className="border-slate-800">
                      <TableCell className="text-slate-100">{a.full_name}</TableCell>
                      <TableCell className="text-slate-400">{a.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                          {a.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add Admin */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Add Tenant Admin</DialogTitle>
            <DialogDescription>
              Creates an admin account bound to this institution only.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password *</Label>
              <Input
                value={form.temporary_password}
                onChange={(e) => setForm((f) => ({ ...f, temporary_password: e.target.value }))}
                className="bg-slate-950 border-slate-800"
                autoComplete="new-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="bg-indigo-600 hover:bg-indigo-500">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Admin'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit tenant */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit tenant</DialogTitle>
            <DialogDescription>Update institution contact and profile information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="space-y-2">
              <Label>Institution name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full min-h-[80px] rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit} className="bg-indigo-600 hover:bg-indigo-500">
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Protected delete — requires exact tenant name */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(v) => {
          if (!deleting) {
            setDeleteOpen(v)
            if (!v) setConfirmName('')
          }
        }}
      >
        <DialogContent className="bg-slate-900 border-red-900/50 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete tenant permanently</DialogTitle>
            <DialogDescription className="text-slate-400">
              This action cannot be undone. All tenant data — users, students, classes, payments,
              and related records — will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive" className="border-red-800 bg-red-950/40">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Permanent data loss</AlertTitle>
            <AlertDescription>
              Type the exact tenant name <strong className="text-red-200">{tenant.name}</strong> to
              confirm. A simple confirmation is not enough.
            </AlertDescription>
          </Alert>
          <form onSubmit={handleDelete} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm_tenant_name">Tenant name confirmation</Label>
              <Input
                id="confirm_tenant_name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={tenant.name}
                className="bg-slate-950 border-slate-800"
                autoComplete="off"
                disabled={deleting}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  setDeleteOpen(false)
                  setConfirmName('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={deleting || !nameMatches}
                onClick={handleDelete}
                className="bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete permanently'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  )
}

export default TenantDetailsPage
