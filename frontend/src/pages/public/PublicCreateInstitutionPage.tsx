import React, { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { publicProvisionTenant } from '@/lib/publicTenantApi'
import { isValidEmail } from '@/lib/utils'
import { MESSAGES } from '@/lib/messages'
import { getUserMessage } from '@/lib/mapError'
import LandingTemplatePicker, {
  emptyLandingCustomize,
  type LandingCustomizeValues,
} from '@/components/landing/LandingTemplatePicker'
import type { LandingInstitution } from '@/components/landing/types'
import { getLandingTemplate } from '@/lib/landingTemplates'

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

async function fileToDataUrl(file: File | null): Promise<string | null> {
  if (!file) return null
  if (file.size > 5 * 1024 * 1024) throw new Error('FILE_TOO_LARGE')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'))
    reader.readAsDataURL(file)
  })
}

/**
 * Public self-service: admin → institution → landing template → create.
 */
const PublicCreateInstitutionPage = () => {
  const [form, setForm] = useState(empty)
  const [slugTouched, setSlugTouched] = useState(false)
  const [step, setStep] = useState<'admin' | 'institution' | 'template'>('admin')
  const [landing, setLanding] = useState<LandingCustomizeValues>(() => emptyLandingCustomize('aurora'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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

  const previewBase: LandingInstitution = useMemo(
    () => ({
      name: form.institution_name.trim() || 'Your Institution',
      subdomain: form.institution_slug.trim() || 'demo',
      email: form.institution_email.trim() || null,
      phone: form.institution_phone.trim() || null,
      address: form.institution_address.trim() || null,
      description: landing.description || null,
    }),
    [form, landing.description],
  )

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
    setStep('institution')
  }

  const handleInstitutionContinue = (e) => {
    e.preventDefault()
    setError('')
    const v = validateInstitution()
    if (v) {
      setError(v)
      return
    }
    const meta = getLandingTemplate(landing.landing_template_id)
    setLanding((prev) => ({
      ...prev,
      description:
        prev.description ||
        `${form.institution_name.trim()} is dedicated to quality education, professional training, and trusted credentials.`,
      hero_headline: prev.hero_headline || meta.defaultHeadline,
      theme_primary: prev.theme_primary || meta.defaultPrimary,
      theme_accent: prev.theme_accent || meta.defaultAccent,
    }))
    setStep('template')
  }

  const handleCreate = async () => {
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
      setStep('institution')
      return
    }
    if (!landing.logoFile && !landing.logoPreviewUrl) {
      setError('Please upload your institution logo — it appears on the landing page and official documents.')
      return
    }

    setSaving(true)
    try {
      const [logo_data_url, hero_data_url] = await Promise.all([
        fileToDataUrl(landing.logoFile),
        fileToDataUrl(landing.heroFile),
      ])

      const result = await publicProvisionTenant({
        institution_name: form.institution_name.trim(),
        institution_slug: form.institution_slug.trim().toLowerCase(),
        institution_email: form.institution_email.trim().toLowerCase(),
        institution_phone: form.institution_phone.trim(),
        institution_address: form.institution_address.trim(),
        admin_full_name: form.admin_full_name.trim(),
        admin_email: form.admin_email.trim().toLowerCase(),
        password: form.password,
        landing_template_id: landing.landing_template_id,
        hero_headline: landing.hero_headline.trim() || null,
        footer_text: landing.footer_text.trim() || null,
        description: landing.description.trim() || null,
        theme_primary: landing.theme_primary || null,
        theme_accent: landing.theme_accent || null,
        logo_data_url,
        hero_data_url,
      })

      const slug = String(result?.institution_slug || form.institution_slug)
        .trim()
        .toLowerCase()

      navigate(`/?tenant=${encodeURIComponent(slug)}`, { replace: true })
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg === 'FILE_TOO_LARGE') {
        setError('Logo or hero image is too large. Please use files under 5MB.')
      } else {
        setError(getUserMessage(err, { context: 'PublicCreateInstitution', fallback: MESSAGES.UNEXPECTED }))
      }
    } finally {
      setSaving(false)
    }
  }

  const title =
    step === 'admin'
      ? 'Create institution admin · TvetFlow'
      : step === 'institution'
        ? 'Create institution · TvetFlow'
        : 'Choose landing template · TvetFlow'

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061512] font-sans text-[#e8f2ef]">
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgba(45,140,120,0.22),transparent_50%),linear-gradient(180deg,#061512,#0a2420)]" />
      </div>

      <div className={`relative z-10 mx-auto px-4 py-10 sm:py-14 ${step === 'template' ? 'max-w-5xl' : 'max-w-lg'}`}>
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

        <div className="mb-6 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[#5f857c]">
          <span className={step === 'admin' ? 'text-teal-300' : ''}>1. Admin</span>
          <span>·</span>
          <span className={step === 'institution' ? 'text-teal-300' : ''}>2. Institution</span>
          <span>·</span>
          <span className={step === 'template' ? 'text-teal-300' : ''}>3. Landing template</span>
        </div>

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
                  This is the only account you create on TvetFlow. After this, you will set up your institution and landing page.
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
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => setField('password', e.target.value)}
                        className="border-white/10 bg-[#061512] pr-10"
                        autoComplete="new-password"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm password *</Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={form.confirm_password}
                        onChange={(e) => setField('confirm_password', e.target.value)}
                        className="border-white/10 bg-[#061512] pr-10"
                        autoComplete="new-password"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="h-11 w-full bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.form>
          )}

          {step === 'institution' && (
            <motion.form
              key="institution"
              onSubmit={handleInstitutionContinue}
              className="space-y-5"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.28 }}
            >
              <div>
                <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                  Create your institution
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#8fb5aa]">
                  Admin: <span className="text-[#d7ebe4]">{form.admin_email}</span> — next you will choose a landing template.
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
                  onClick={() => setStep('admin')}
                >
                  Back
                </Button>
                <Button type="submit" className="h-11 flex-1 bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400">
                  Continue to templates
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.form>
          )}

          {step === 'template' && (
            <motion.div
              key="template"
              className="space-y-6"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.28 }}
            >
              <LandingTemplatePicker
                baseInstitution={previewBase}
                values={landing}
                onChange={(patch) => setLanding((prev) => ({ ...prev, ...patch }))}
                compact
              />

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-transparent text-[#c5ddd6] hover:bg-white/5"
                  disabled={saving}
                  onClick={() => setStep('institution')}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleCreate}
                  className="h-11 flex-1 bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    'Create institution'
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default PublicCreateInstitutionPage
