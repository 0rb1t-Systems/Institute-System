import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import {
  listSupportTickets,
  createSupportTicket,
  updateSupportTicket,
  listTenants,
  getSystemSettings,
} from '@/lib/superAdminApi'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const SupportPage = () => {
  const { toast } = useToast()
  const [tickets, setTickets] = useState([])
  const [tenants, setTenants] = useState([])
  const [supportEmail, setSupportEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    message: '',
    priority: 'normal',
    requester_name: '',
    requester_email: '',
    institution_id: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [tix, t, settings] = await Promise.all([
        listSupportTickets(),
        listTenants(),
        getSystemSettings(),
      ])
      setTickets(tix)
      setTenants(t)
      setSupportEmail(
        typeof settings.support_email === 'string'
          ? settings.support_email
          : String(settings.support_email ?? ''),
      )
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

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) {
      toast({ title: 'Validation', description: 'Subject and message are required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await createSupportTicket({
        ...form,
        institution_id: form.institution_id || null,
      })
      toast({ title: 'Success', description: 'Support ticket created.' })
      setOpen(false)
      setForm({
        subject: '',
        message: '',
        priority: 'normal',
        requester_name: '',
        requester_email: '',
        institution_id: '',
      })
      await load()
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (ticket, status) => {
    try {
      const updated = await updateSupportTicket(ticket.id, { status })
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, ...updated } : t)))
      toast({ title: 'Success', description: `Ticket marked ${status}.` })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.UPDATE_FAILED }),
        variant: 'destructive',
      })
    }
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Support</title>
      </Helmet>

      <PageHeader
        title="Support"
        subtitle={
          supportEmail
            ? `Platform support inbox. Contact email: ${supportEmail}`
            : 'Platform support inbox for tenant and operator issues.'
        }
      >
        <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New ticket
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load tickets</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead>Subject</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                  No support tickets yet.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => (
                <TableRow key={t.id} className="border-slate-800">
                  <TableCell className="text-slate-100 max-w-[200px] truncate">{t.subject}</TableCell>
                  <TableCell className="text-slate-400 text-sm">
                    <div>{t.requester_name || '—'}</div>
                    <div className="text-xs text-slate-600">{t.requester_email || ''}</div>
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {t.institution_id ? tenantName[t.institution_id] || '—' : '—'}
                  </TableCell>
                  <TableCell className="capitalize text-slate-300">{t.priority}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 capitalize">
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {t.status !== 'in_progress' && t.status !== 'resolved' && t.status !== 'closed' && (
                      <Button variant="ghost" size="sm" onClick={() => setStatus(t, 'in_progress')}>
                        Start
                      </Button>
                    )}
                    {t.status !== 'resolved' && t.status !== 'closed' && (
                      <Button variant="ghost" size="sm" onClick={() => setStatus(t, 'resolved')}>
                        Resolve
                      </Button>
                    )}
                    {t.status !== 'closed' && (
                      <Button variant="ghost" size="sm" onClick={() => setStatus(t, 'closed')}>
                        Close
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>New support ticket</DialogTitle>
            <DialogDescription>Log an issue for tracking and audit.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <textarea
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className="w-full min-h-[100px] rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Requester name</Label>
                <Input
                  value={form.requester_name}
                  onChange={(e) => setForm((f) => ({ ...f, requester_name: e.target.value }))}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label>Requester email</Label>
                <Input
                  type="email"
                  value={form.requester_email}
                  onChange={(e) => setForm((f) => ({ ...f, requester_email: e.target.value }))}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full h-10 rounded-md bg-slate-950 border border-slate-800 px-3 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tenant (optional)</Label>
                <select
                  value={form.institution_id}
                  onChange={(e) => setForm((f) => ({ ...f, institution_id: e.target.value }))}
                  className="w-full h-10 rounded-md bg-slate-950 border border-slate-800 px-3 text-sm"
                >
                  <option value="">None</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  )
}

export default SupportPage
