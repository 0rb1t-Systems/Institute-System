import React, { useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, GraduationCap, ArrowLeft } from 'lucide-react'
import { publicProvisionTenant } from '@/lib/publicTenantApi'
import { isValidEmail } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
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
  password: '',
  confirm_password: '',
}

function toSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Public self-service: create a new institution + first admin, then sign in.
 */
const PublicCreateInstitutionPage = () => {
  const [form, setForm] = useState(empty)
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

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
      !form.password.trim() ||
      !form.confirm_password.trim()
    ) {
      return 'Please complete all required fields.'
    }
    if (!isValidEmail(form.institution_email) || !isValidEmail(form.admin_email)) {
      return MESSAGES.VALIDATION.EMAIL
    }
    if (form.password.length < 8) {
      return MESSAGES.VALIDATION.PASSWORD_MIN
    }
    if (form.password !== form.confirm_password) {
      return 'Passwords do not match.'
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
      const result = await publicProvisionTenant({
        institution_name: form.institution_name.trim(),
        institution_slug: form.institution_slug.trim().toLowerCase(),
        institution_email: form.institution_email.trim().toLowerCase(),
        institution_phone: form.institution_phone.trim(),
        institution_address: form.institution_address.trim(),
        admin_full_name: form.admin_full_name.trim(),
        admin_email: form.admin_email.trim().toLowerCase(),
        password: form.password,
      })

      setSuccess(result)

      // Auto sign-in so the new admin lands on their dashboard
      const { user, error: loginError } = await login(
        form.admin_email.trim().toLowerCase(),
        form.password,
      )
      if (loginError || !user) {
        // Account exists — they can sign in manually
        return
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(getUserMessage(err, { context: 'PublicCreateInstitution', fallback: MESSAGES.UNEXPECTED }))
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Helmet>
          <title>Institution Created</title>
        </Helmet>
        <Card className="w-full max-w-md bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle className="text-lg text-white">Institution created</CardTitle>
            </div>
            <CardDescription>
              {success.institution_name} is ready. Sign in with your admin email to open the portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
              <span>Slug</span>
              <span className="text-slate-100 font-mono">{success.institution_slug}</span>
              <span>Admin</span>
              <span className="text-slate-100">{success.admin?.email}</span>
            </div>
            <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-500">
              <Link to={`/login?tenant=${encodeURIComponent(success.institution_slug || '')}`}>
                Go to sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4">
      <Helmet>
        <title>Create Institution</title>
      </Helmet>

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white break-words">Create your institution</h1>
              <p className="text-sm text-slate-400">Self-service signup — your admin account is created in one step.</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-slate-300 self-start shrink-0">
            <Link to="/login">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Sign in
            </Link>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Institution</CardTitle>
              <CardDescription>Public profile for your training center.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="institution_name">Institution Name *</Label>
                <Input
                  id="institution_name"
                  value={form.institution_name}
                  onChange={(e) => setField('institution_name', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution_slug">Slug / Subdomain *</Label>
                <Input
                  id="institution_slug"
                  value={form.institution_slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setField('institution_slug', toSlug(e.target.value))
                  }}
                  className="bg-slate-950 border-slate-800 font-mono"
                  placeholder="e.g. horizon"
                  disabled={saving}
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
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution_phone">Phone *</Label>
                <Input
                  id="institution_phone"
                  value={form.institution_phone}
                  onChange={(e) => setField('institution_phone', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  disabled={saving}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="institution_address">Address *</Label>
                <Textarea
                  id="institution_address"
                  value={form.institution_address}
                  onChange={(e) => setField('institution_address', e.target.value)}
                  className="bg-slate-950 border-slate-800 min-h-[80px]"
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Your admin account</CardTitle>
              <CardDescription>You will sign in with this email after signup.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="admin_full_name">Full Name *</Label>
                <Input
                  id="admin_full_name"
                  value={form.admin_full_name}
                  onChange={(e) => setField('admin_full_name', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  disabled={saving}
                />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="admin_email">Admin Email *</Label>
                <Input
                  id="admin_email"
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => setField('admin_email', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  autoComplete="new-password"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password *</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={form.confirm_password}
                  onChange={(e) => setField('confirm_password', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  autoComplete="new-password"
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3 items-center">
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create institution'
              )}
            </Button>
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PublicCreateInstitutionPage
