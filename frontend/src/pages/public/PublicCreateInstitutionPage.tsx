import React, { useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react'
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
 * Public self-service: institution admin first, then create institution form.
 */
const PublicCreateInstitutionPage = () => {
  const [form, setForm] = useState(empty)
  const [slugTouched, setSlugTouched] = useState(false)
  const [step, setStep] = useState('admin')
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

  const validateAdmin = () => {
    if (!form.admin_full_name.trim() || !form.admin_email.trim() || !form.password.trim() || !form.confirm_password.trim()) {
      return 'Please complete all admin fields.'
    }
    if (!isValidEmail(form.admin_email)) {
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

  const validateInstitution = () => {
    if (
      !form.institution_name.trim() ||
      !form.institution_slug.trim() ||
      !form.institution_email.trim() ||
      !form.institution_phone.trim() ||
      !form.institution_address.trim()
    ) {
      return 'Please complete all institution fields.'
    }
    if (!isValidEmail(form.institution_email)) {
      return MESSAGES.VALIDATION.EMAIL
    }
    return null
  }

  const handleAdminContinue = (e) => {
    e.preventDefault()
    setError('')
    const v = validateAdmin()
    if (v) {
      setError(v)
      return
    }
    setStep('ready')
  }

  const handleSubmitInstitution = async (e) => {
    e.preventDefault()
    setError('')
    const adminErr = validateAdmin()
    if (adminErr) {
      setError(adminErr)
      setStep('admin')
      return
    }
    const v = validateInstitution()
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

      const { user, error: loginError } = await login(
        form.admin_email.trim().toLowerCase(),
        form.password,
      )
      if (loginError || !user) {
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
      <div className="flex min-h-screen items-center justify-center bg-[#061512] p-4 font-sans text-[#e8f2ef]">
        <Helmet>
          <title>Institution created · TvetFlow</title>
        </Helmet>
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a2420]/90 p-6 backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-teal-300">
            <CheckCircle2 className="h-5 w-5" />
            <h1 className="font-display text-lg font-semibold text-white">Institution created</h1>
          </div>
          <p className="text-sm text-[#8fb5aa]">
            {success.institution_name} is ready. Sign in with your admin email if you were not redirected.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-[#6f968c]">
            <span>Slug</span>
            <span className="font-mono text-[#e8f2ef]">{success.institution_slug}</span>
            <span>Admin</span>
            <span className="text-[#e8f2ef]">{success.admin?.email}</span>
          </div>
          <Button asChild className="mt-6 w-full bg-teal-500 text-[#04201c] hover:bg-teal-400">
            <Link to={`/login?tenant=${encodeURIComponent(success.institution_slug || '')}`}>
              Go to sign in
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061512] font-sans text-[#e8f2ef]">
      <Helmet>
        <title>
          {step === 'admin'
            ? 'Create institution admin · TvetFlow'
            : step === 'ready'
              ? 'Create institution · TvetFlow'
              : 'Institution details · TvetFlow'}
        </title>
      </Helmet>

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgba(45,140,120,0.22),transparent_50%),linear-gradient(180deg,#061512,#0a2420)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-lg px-4 py-10 sm:py-14">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-white">
            Tvet<span className="text-teal-300">Flow</span>
          </Link>
          <Button asChild variant="ghost" size="sm" className="text-[#8fb5aa] hover:bg-white/5 hover:text-white">
            <Link to="/login">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Sign in
            </Link>
          </Button>
        </div>

        <p className="mb-6 text-xs uppercase tracking-[0.16em] text-[#5f857c]">
          Institution admin only
        </p>

        {error && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AnimatePresence mode="wait">
          {step === 'admin' && (
            <motion.form
              key="admin"
              onSubmit={handleAdminContinue}
              className="space-y-5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.28 }}
            >
              <div>
                <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                  Create your admin account
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#8fb5aa]">
                  This is the only account you create on TvetFlow. After this, you will set up your institution.
                </p>
              </div>

              <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-5">
                <div className="space-y-2">
                  <Label htmlFor="admin_full_name">Full name *</Label>
                  <Input
                    id="admin_full_name"
                    value={form.admin_full_name}
                    onChange={(e) => setField('admin_full_name', e.target.value)}
                    className="border-white/10 bg-[#061512]"
                    disabled={saving}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_email">Admin email *</Label>
                  <Input
                    id="admin_email"
                    type="email"
                    value={form.admin_email}
                    onChange={(e) => setField('admin_email', e.target.value)}
                    className="border-white/10 bg-[#061512]"
                    disabled={saving}
                    autoComplete="email"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                      className="border-white/10 bg-[#061512]"
                      autoComplete="new-password"
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm password *</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={form.confirm_password}
                      onChange={(e) => setField('confirm_password', e.target.value)}
                      className="border-white/10 bg-[#061512]"
                      autoComplete="new-password"
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="h-11 w-full bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.form>
          )}

          {step === 'ready' && (
            <motion.div
              key="ready"
              className="space-y-6"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.28 }}
            >
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs text-teal-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Admin details ready
                </div>
                <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                  Next: create your institution
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#8fb5aa]">
                  Signed as <span className="text-[#d7ebe4]">{form.admin_email}</span>. Open the institution form when you are ready.
                </p>
              </div>

              <Button
                type="button"
                className="h-12 w-full bg-teal-500 text-base font-semibold text-[#04201c] hover:bg-teal-400"
                onClick={() => {
                  setError('')
                  setStep('institution')
                }}
              >
                Create institution
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <button
                type="button"
                className="text-sm text-[#6f968c] underline-offset-2 hover:text-[#a8cfc4] hover:underline"
                onClick={() => setStep('admin')}
              >
                Edit admin details
              </button>
            </motion.div>
          )}

          {step === 'institution' && (
            <motion.form
              key="institution"
              onSubmit={handleSubmitInstitution}
              className="space-y-5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.28 }}
            >
              <div>
                <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                  Institution details
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#8fb5aa]">
                  Name, contact, and subdomain for your training center.
                </p>
              </div>

              <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-5">
                <div className="space-y-2">
                  <Label htmlFor="institution_name">Institution name *</Label>
                  <Input
                    id="institution_name"
                    value={form.institution_name}
                    onChange={(e) => setField('institution_name', e.target.value)}
                    className="border-white/10 bg-[#061512]"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="institution_slug">Slug / subdomain *</Label>
                  <Input
                    id="institution_slug"
                    value={form.institution_slug}
                    onChange={(e) => {
                      setSlugTouched(true)
                      setField('institution_slug', toSlug(e.target.value))
                    }}
                    className="border-white/10 bg-[#061512] font-mono"
                    placeholder="e.g. mcc"
                    disabled={saving}
                  />
                  <p className="text-xs text-[#5f857c]">Used as your institution link: ?tenant={form.institution_slug || 'slug'}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="institution_email">Institution email *</Label>
                    <Input
                      id="institution_email"
                      type="email"
                      value={form.institution_email}
                      onChange={(e) => setField('institution_email', e.target.value)}
                      className="border-white/10 bg-[#061512]"
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="institution_phone">Phone *</Label>
                    <Input
                      id="institution_phone"
                      value={form.institution_phone}
                      onChange={(e) => setField('institution_phone', e.target.value)}
                      className="border-white/10 bg-[#061512]"
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="institution_address">Address *</Label>
                  <Textarea
                    id="institution_address"
                    value={form.institution_address}
                    onChange={(e) => setField('institution_address', e.target.value)}
                    className="min-h-[80px] border-white/10 bg-[#061512]"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-transparent text-[#c5ddd6] hover:bg-white/5"
                  disabled={saving}
                  onClick={() => setStep('ready')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-11 flex-1 bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Finish & open portal'
                  )}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default PublicCreateInstitutionPage
