import React, { useState } from 'react'
import { Helmet } from 'react-helmet'
import { useNavigate, Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, ArrowLeft, Copy } from 'lucide-react'
import { provisionTenant } from '@/lib/superAdminApi'
import { isValidEmail } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { MESSAGES } from '@/lib/messages'
import { getUserMessage } from '@/lib/mapError'

const empty = {
  institution_name: '',
  institution_slug: '',
  institution_email: '',
  institution_phone: '',
  institution_address: '',
  admin_full_name: '',
  admin_email: '',
  temporary_password: '',
}

function toSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const CreateTenantPage = () => {
  const [form, setForm] = useState(empty)
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'institution_name' && !slugTouched) {
        next.institution_slug = toSlug(value)
      }
      return next
    })
  }

  const validate = () => {
    if (
      !form.institution_name.trim() ||
      !form.institution_slug.trim() ||
      !form.institution_email.trim() ||
      !form.institution_phone.trim() ||
      !form.institution_address.trim() ||
      !form.admin_full_name.trim() ||
      !form.admin_email.trim() ||
      !form.temporary_password.trim()
    ) {
      return 'Please complete all required fields.'
    }
    if (!isValidEmail(form.institution_email) || !isValidEmail(form.admin_email)) {
      return MESSAGES.VALIDATION.EMAIL
    }
    if (form.temporary_password.length < 8) {
      return MESSAGES.VALIDATION.PASSWORD_MIN
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const v = validate()
    if (v) {
      setError(v)
      return
    }

    setSaving(true)
    try {
      const result = await provisionTenant({
        institution_name: form.institution_name.trim(),
        institution_slug: form.institution_slug.trim().toLowerCase(),
        institution_email: form.institution_email.trim().toLowerCase(),
        institution_phone: form.institution_phone.trim(),
        institution_address: form.institution_address.trim(),
        admin_full_name: form.admin_full_name.trim(),
        admin_email: form.admin_email.trim().toLowerCase(),
        temporary_password: form.temporary_password,
      })

      setSuccess(result)
      toast({
        title: 'Success',
        description: 'Tenant created successfully.',
      })
      if (result.email_error) {
        toast({
          title: 'Email notice',
          description: MESSAGES.DOMAIN.EMAIL_SEND_FAILED,
          variant: 'destructive',
        })
      }
    } catch (err) {
      setError(getUserMessage(err, { context: 'CreateTenantPage', fallback: MESSAGES.UNEXPECTED }))
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <AnimatedPage>
        <Helmet>
          <title>Tenant Created</title>
        </Helmet>
        <PageHeader title="Tenant created" subtitle="Provisioning completed successfully." />
        <Card className="max-w-xl bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle className="text-lg text-white">Tenant created successfully.</CardTitle>
            </div>
            <CardDescription>
              Tenant Admin account created successfully.
              {success.emailed ? ' Login credentials were sent by email.' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <span>Institution</span>
              <span className="text-slate-100">{success.institution_name}</span>
              <span>Slug</span>
              <span className="text-slate-100 font-mono">{success.institution_slug}</span>
              <span>Admin</span>
              <span className="text-slate-100">{success.admin?.full_name}</span>
              <span>Admin email</span>
              <span className="text-slate-100">{success.admin?.email}</span>
            </div>
            {success.admin?.password && (
              <div className="flex items-center justify-between rounded-md bg-slate-950 border border-slate-800 px-3 py-2">
                <div>
                  <p className="text-xs text-slate-500">Temporary password</p>
                  <p className="font-mono text-slate-200">{success.admin.password}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(success.admin.password)
                    toast({ title: 'Copied', description: 'Password copied to clipboard.' })
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                className="bg-indigo-600 hover:bg-indigo-500"
                onClick={() => navigate(`/super-admin/tenants/${success.institution_id}`)}
              >
                View tenant
              </Button>
              <Button variant="outline" onClick={() => navigate('/super-admin/tenants')}>
                Back to list
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Create Tenant</title>
      </Helmet>

      <PageHeader
        title="Create Tenant"
        subtitle="Provision a new institution and its Tenant Admin in one step."
      >
        <Button asChild variant="ghost" size="sm">
          <Link to="/super-admin/tenants">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Institution</CardTitle>
            <CardDescription>Profile for the new tenant organization.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="institution_name">Institution Name *</Label>
              <Input
                id="institution_name"
                value={form.institution_name}
                onChange={(e) => setField('institution_name', e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution_slug">Institution Slug / Subdomain *</Label>
              <Input
                id="institution_slug"
                value={form.institution_slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setField('institution_slug', toSlug(e.target.value))
                }}
                className="bg-slate-950 border-slate-800 font-mono"
                placeholder="e.g. horizon"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution_email">Institution Email *</Label>
              <Input
                id="institution_email"
                type="email"
                value={form.institution_email}
                onChange={(e) => setField('institution_email', e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution_phone">Institution Phone *</Label>
              <Input
                id="institution_phone"
                value={form.institution_phone}
                onChange={(e) => setField('institution_phone', e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="institution_address">Institution Address *</Label>
              <Textarea
                id="institution_address"
                value={form.institution_address}
                onChange={(e) => setField('institution_address', e.target.value)}
                className="bg-slate-950 border-slate-800 min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Tenant Admin</CardTitle>
            <CardDescription>
              First administrator for this institution. Credentials will be emailed.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="admin_full_name">Admin Full Name *</Label>
              <Input
                id="admin_full_name"
                value={form.admin_full_name}
                onChange={(e) => setField('admin_full_name', e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_email">Admin Email *</Label>
              <Input
                id="admin_email"
                type="email"
                value={form.admin_email}
                onChange={(e) => setField('admin_email', e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temporary_password">Temporary Password *</Label>
              <Input
                id="temporary_password"
                type="text"
                value={form.temporary_password}
                onChange={(e) => setField('temporary_password', e.target.value)}
                className="bg-slate-950 border-slate-800"
                autoComplete="new-password"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Tenant'
            )}
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </AnimatedPage>
  )
}

export default CreateTenantPage
