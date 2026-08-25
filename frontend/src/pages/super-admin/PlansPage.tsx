import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
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
import { AlertCircle, Loader2, Plus, LifeBuoy, Ticket } from 'lucide-react'
import {
  listPlans,
  upsertPlan,
  listSubscriptions,
  assignSubscription,
  listTenants,
} from '@/lib/superAdminApi'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const emptyPlan = {
  id: null,
  name: '',
  slug: '',
  description: '',
  price_monthly: 0,
  price_yearly: 0,
  max_students: '',
  features: '',
  is_active: true,
  sort_order: 0,
}

const PlansPage = () => {
  const { toast } = useToast()
  const [plans, setPlans] = useState([])
  const [subs, setSubs] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [planForm, setPlanForm] = useState(emptyPlan)
  const [subForm, setSubForm] = useState({
    institution_id: '',
    plan_id: '',
    status: 'active',
    billing_cycle: 'monthly',
    notes: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [p, s, t] = await Promise.all([listPlans(), listSubscriptions(), listTenants()])
      setPlans(p)
      setSubs(s)
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

  const openCreatePlan = () => {
    setPlanForm(emptyPlan)
    setPlanOpen(true)
  }

  const openEditPlan = (plan) => {
    setPlanForm({
      id: plan.id,
      name: plan.name || '',
      slug: plan.slug || '',
      description: plan.description || '',
      price_monthly: plan.price_monthly ?? 0,
      price_yearly: plan.price_yearly ?? 0,
      max_students: plan.max_students ?? '',
      features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
      is_active: plan.is_active !== false,
      sort_order: plan.sort_order ?? 0,
    })
    setPlanOpen(true)
  }

  const savePlan = async (e) => {
    e.preventDefault()
    if (!planForm.name.trim() || !planForm.slug.trim()) {
      toast({ title: 'Validation', description: 'Name and slug are required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await upsertPlan({
        ...planForm,
        features: planForm.features
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
      })
      toast({ title: 'Success', description: MESSAGES.SUCCESS.UPDATED })
      setPlanOpen(false)
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

  const saveSub = async (e) => {
    e.preventDefault()
    if (!subForm.institution_id || !subForm.plan_id) {
      toast({ title: 'Validation', description: 'Select a tenant and a plan.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await assignSubscription(subForm)
      toast({ title: 'Success', description: 'Subscription assigned.' })
      setSubOpen(false)
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

  return (
    <AnimatedPage>
      <Helmet>
        <title>Plans & Subscriptions</title>
      </Helmet>

      <PageHeader
        title="Plans & Subscriptions"
        subtitle="Manage platform plans and assign subscriptions to tenants manually. Online WaafiPay billing for platform plans is deferred."
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSubOpen(true)}>
            Assign subscription
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={openCreatePlan}>
            <Plus className="h-4 w-4 mr-2" />
            New plan
          </Button>
        </div>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load plans</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-full text-sm text-[var(--pf-muted)]">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="col-span-full text-sm text-[var(--pf-muted)]">No plans yet.</p>
        ) : (
          plans.map((plan) => (
            <Card
              key={plan.id}
              className="border-[var(--pf-line)] bg-[var(--pf-surface)] transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/35 hover:shadow-[0_14px_36px_rgba(6,21,18,0.14)]"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base text-[var(--pf-text)]">{plan.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      plan.is_active
                        ? 'border-emerald-700/60 text-emerald-500'
                        : 'border-[var(--pf-line)] text-[var(--pf-faint)]'
                    }
                  >
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardDescription className="text-[var(--pf-muted)]">{plan.description || '—'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between text-[var(--pf-text)]">
                  <span className="text-[var(--pf-muted)]">Monthly</span>
                  <span className="font-medium">${Number(plan.price_monthly).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-[var(--pf-text)]">
                  <span className="text-[var(--pf-muted)]">Yearly</span>
                  <span className="font-medium">${Number(plan.price_yearly).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-[var(--pf-muted)]">
                  <span>Max students</span>
                  <span>{plan.max_students ?? 'Unlimited'}</span>
                </div>
                <Button variant="ghost" size="sm" className="px-0 text-teal-600 hover:text-teal-500" onClick={() => openEditPlan(plan)}>
                  Edit plan
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-[var(--pf-text)]">Tenant subscriptions</h2>
      <div className="overflow-hidden rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)]">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead>Tenant</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : subs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                  No subscriptions assigned yet.
                </TableCell>
              </TableRow>
            ) : (
              subs.map((s) => (
                <TableRow key={s.id} className="border-slate-800">
                  <TableCell className="text-slate-100">
                    {tenantName[s.institution_id] || s.institution_id}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    {s.platform_plans?.name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-700 text-slate-300 capitalize">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-400 capitalize">{s.billing_cycle}</TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {s.started_at ? new Date(s.started_at).toLocaleDateString() : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Link
        to="/super-admin/support"
        className="mt-8 flex flex-col gap-3 rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-500/35 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/12 text-teal-600">
            <LifeBuoy className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-[var(--pf-text)]">Support</p>
            <p className="mt-0.5 text-sm text-[var(--pf-muted)]">
              Billing questions, plan disputes, and tenant tickets live on the Support inbox.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-600">
          <Ticket className="h-4 w-4" />
          Open Support
        </span>
      </Link>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{planForm.id ? 'Edit plan' : 'Create plan'}</DialogTitle>
            <DialogDescription>Pricing and limits for tenant subscriptions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={savePlan} className="space-y-3">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input
                value={planForm.slug}
                onChange={(e) => setPlanForm((f) => ({ ...f, slug: e.target.value }))}
                className="bg-slate-950 border-slate-800"
                disabled={Boolean(planForm.id)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={planForm.description}
                onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Monthly price</Label>
                <Input
                  type="number"
                  min="0"
                  value={planForm.price_monthly}
                  onChange={(e) => setPlanForm((f) => ({ ...f, price_monthly: e.target.value }))}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label>Yearly price</Label>
                <Input
                  type="number"
                  min="0"
                  value={planForm.price_yearly}
                  onChange={(e) => setPlanForm((f) => ({ ...f, price_yearly: e.target.value }))}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max students (blank = unlimited)</Label>
              <Input
                type="number"
                min="0"
                value={planForm.max_students}
                onChange={(e) => setPlanForm((f) => ({ ...f, max_students: e.target.value }))}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Features (one per line)</Label>
              <textarea
                value={planForm.features}
                onChange={(e) => setPlanForm((f) => ({ ...f, features: e.target.value }))}
                className="w-full min-h-[80px] rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={planForm.is_active}
                onChange={(e) => setPlanForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPlanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle>Assign subscription</DialogTitle>
            <DialogDescription>Link a tenant to a platform plan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveSub} className="space-y-3">
            <div className="space-y-2">
              <Label>Tenant *</Label>
              <select
                value={subForm.institution_id}
                onChange={(e) => setSubForm((f) => ({ ...f, institution_id: e.target.value }))}
                className="w-full h-10 rounded-md bg-slate-950 border border-slate-800 px-3 text-sm"
              >
                <option value="">Select tenant…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Plan *</Label>
              <select
                value={subForm.plan_id}
                onChange={(e) => setSubForm((f) => ({ ...f, plan_id: e.target.value }))}
                className="w-full h-10 rounded-md bg-slate-950 border border-slate-800 px-3 text-sm"
              >
                <option value="">Select plan…</option>
                {plans.filter((p) => p.is_active).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={subForm.status}
                  onChange={(e) => setSubForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full h-10 rounded-md bg-slate-950 border border-slate-800 px-3 text-sm"
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past due</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Billing</Label>
                <select
                  value={subForm.billing_cycle}
                  onChange={(e) => setSubForm((f) => ({ ...f, billing_cycle: e.target.value }))}
                  className="w-full h-10 rounded-md bg-slate-950 border border-slate-800 px-3 text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  )
}

export default PlansPage
