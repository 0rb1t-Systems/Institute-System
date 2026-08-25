import React, { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react'
import ThemeToggle from '@/components/platform/ThemeToggle'
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
import { getAppRootDomain, getTenantPortalUrl, usesTenantSubdomainHosts } from '@/lib/institution'
import { normalizeHexColor } from '@/lib/logoBrandColors'

const CREATE_STEPS = [
  { id: 'admin' as const, n: 1, label: '1. Admin account', short: 'Admin' },
  { id: 'institution' as const, n: 2, label: '2. Institution setup', short: 'Institution' },
  { id: 'template' as const, n: 3, label: '3. Landing template', short: 'Template' },
]

const GOLD = '#E8C547'

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
      theme_tertiary: prev.theme_tertiary || '',
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
        theme_primary: normalizeHexColor(landing.theme_primary),
        theme_accent: normalizeHexColor(landing.theme_accent, '#D32F2F'),
        theme_tertiary: String(landing.theme_tertiary || '').trim()
          ? normalizeHexColor(landing.theme_tertiary, '#0EA5E9')
          : null,
        logo_data_url,
        hero_data_url,
      })

      const slug = String(result?.institution_slug || form.institution_slug)
        .trim()
        .toLowerCase()

      // Production custom domain → https://{slug}.tvetflow.online
      // Local / no root domain → /?tenant=slug fallback
      window.location.replace(getTenantPortalUrl({ subdomain: slug }))
      return
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

  const fieldClass =
    'border-[var(--pf-line)] bg-[var(--pf-bg)] text-[var(--pf-text)] placeholder:text-[var(--pf-faint)]'

  return (
    <div className="platform-public relative min-h-screen overflow-x-hidden font-sans">
      <Helmet>
        <title>{title}</title>
      </Helmet>

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgba(45,140,120,0.18),transparent_50%)]" />
      </div>

      <div className={`relative z-10 mx-auto px-4 py-10 sm:py-14 ${step === 'template' ? 'max-w-5xl' : 'max-w-xl'}`}>
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg font-bold tracking-tight text-[var(--pf-text)]">
            Tvet<span className="text-teal-500">Flow</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="text-[var(--pf-muted)] hover:bg-[var(--pf-hover)] hover:text-[var(--pf-text)]">
              <Link to="/login">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
        </div>

        <div className="mb-10">
          <div className="flex items-center px-1 sm:px-6">
            {CREATE_STEPS.map((item, i) => {
              const idx = step === 'admin' ? 0 : step === 'institution' ? 1 : 2
              const active = i === idx
              const done = i < idx
              const clickable = done
              return (
                <React.Fragment key={item.id}>
                  {i > 0 ? (
                    <div
                      className="mx-1 h-px min-w-[1.5rem] flex-1 sm:mx-2"
                      style={{ backgroundColor: done || active ? `${GOLD}66` : 'rgba(148,163,184,0.28)' }}
                    />
                  ) : null}
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => clickable && setStep(item.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-[box-shadow,border-color,color,background] duration-300 disabled:cursor-default"
                    style={
                      active
                        ? {
                            borderColor: GOLD,
                            color: GOLD,
                            backgroundColor: 'rgba(232,197,71,0.08)',
                            boxShadow: `0 0 0 4px rgba(232,197,71,0.12), 0 0 22px rgba(232,197,71,0.4)`,
                          }
                        : done
                          ? { borderColor: `${GOLD}99`, color: GOLD, backgroundColor: 'transparent' }
                          : { borderColor: 'rgba(148,163,184,0.35)', color: 'rgb(148,163,184)', backgroundColor: 'transparent' }
                    }
                    aria-current={active ? 'step' : undefined}
                  >
                    {item.n}
                  </button>
                </React.Fragment>
              )
            })}
          </div>
          <div className="mt-3 grid grid-cols-3 text-center">
            {CREATE_STEPS.map((item, i) => {
              const idx = step === 'admin' ? 0 : step === 'institution' ? 1 : 2
              const active = i === idx
              const done = i < idx
              return (
                <p
                  key={item.id}
                  className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] sm:px-1 sm:text-[11px] sm:tracking-[0.12em]"
                  style={{ color: active || done ? GOLD : 'rgb(148,163,184)' }}
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </p>
              )
            })}
          </div>
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
                className="space-y-6"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <div>
                  <h1 className="font-display text-2xl font-bold text-[var(--pf-text)] sm:text-3xl">
                    Create your admin account
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--pf-muted)]">
                    This is the only account you create on TvetFlow. After this, you will set up your institution and landing page.
                  </p>
                </div>

                <div className="space-y-4 rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 shadow-sm">
                  <div className="space-y-2">
                    <Label htmlFor="admin_full_name" className="text-[var(--pf-text)]">Full name</Label>
                    <Input
                      id="admin_full_name"
                      value={form.admin_full_name}
                      onChange={(e) => setField('admin_full_name', e.target.value)}
                      className={fieldClass}
                      disabled={saving}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_email" className="text-[var(--pf-text)]">Email</Label>
                    <Input
                      id="admin_email"
                      type="email"
                      value={form.admin_email}
                      onChange={(e) => setField('admin_email', e.target.value)}
                      className={fieldClass}
                      disabled={saving}
                      autoComplete="email"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-[var(--pf-text)]">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(e) => setField('password', e.target.value)}
                          className={`${fieldClass} pr-10`}
                          autoComplete="new-password"
                          disabled={saving}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--pf-faint)] hover:text-[var(--pf-text)]"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password" className="text-[var(--pf-text)]">Confirm</Label>
                      <div className="relative">
                        <Input
                          id="confirm_password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={form.confirm_password}
                          onChange={(e) => setField('confirm_password', e.target.value)}
                          className={`${fieldClass} pr-10`}
                          autoComplete="new-password"
                          disabled={saving}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[var(--pf-faint)] hover:text-[var(--pf-text)]"
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
                  <p className="text-xs text-[var(--pf-faint)]">At least 8 characters.</p>
                </div>

                <Button type="submit" className="h-11 w-full bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </motion.form>
            )}

            {step === 'institution' && (
              <motion.form
                key="institution"
                onSubmit={handleInstitutionContinue}
                className="space-y-6"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <div>
                  <h1 className="font-display text-2xl font-bold text-[var(--pf-text)] sm:text-3xl">
                    Create your institution
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--pf-muted)]">
                    Admin: <span className="text-[var(--pf-text)]">{form.admin_email}</span> — next you will choose a landing template.
                  </p>
                </div>

                <div className="space-y-4 rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 shadow-sm">
                  <div className="space-y-2">
                    <Label htmlFor="institution_name" className="text-[var(--pf-text)]">Institution name</Label>
                    <Input
                      id="institution_name"
                      value={form.institution_name}
                      onChange={(e) => setField('institution_name', e.target.value)}
                      className={fieldClass}
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="institution_slug" className="text-[var(--pf-text)]">Public slug</Label>
                    <Input
                      id="institution_slug"
                      value={form.institution_slug}
                      onChange={(e) => {
                        setSlugTouched(true)
                        setField('institution_slug', toSlug(e.target.value))
                      }}
                      className={`${fieldClass} font-mono`}
                      placeholder="e.g. mcc"
                      disabled={saving}
                    />
                    <p className="text-xs text-[var(--pf-faint)]">
                      {usesTenantSubdomainHosts()
                        ? `Link: https://${form.institution_slug || 'slug'}.${getAppRootDomain()}`
                        : `Link: ?tenant=${form.institution_slug || 'slug'}`}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="institution_email" className="text-[var(--pf-text)]">Email</Label>
                      <Input
                        id="institution_email"
                        type="email"
                        value={form.institution_email}
                        onChange={(e) => setField('institution_email', e.target.value)}
                        className={fieldClass}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="institution_phone" className="text-[var(--pf-text)]">Phone</Label>
                      <Input
                        id="institution_phone"
                        value={form.institution_phone}
                        onChange={(e) => setField('institution_phone', e.target.value)}
                        className={fieldClass}
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="institution_address" className="text-[var(--pf-text)]">Address</Label>
                    <Textarea
                      id="institution_address"
                      value={form.institution_address}
                      onChange={(e) => setField('institution_address', e.target.value)}
                      className={`min-h-[80px] ${fieldClass}`}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]"
                    disabled={saving}
                    onClick={() => setStep('admin')}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="h-11 flex-1 bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90">
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
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
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
                    className="border-[var(--pf-line)] bg-transparent text-[var(--pf-text)] hover:bg-[var(--pf-hover)]"
                    disabled={saving}
                    onClick={() => setStep('institution')}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={handleCreate}
                    className="h-11 flex-1 bg-[var(--pf-accent)] font-semibold text-[var(--pf-accent-fg)] hover:opacity-90"
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
