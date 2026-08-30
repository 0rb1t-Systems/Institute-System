import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  Upload,
  AlertCircle,
  Building2,
  Palette,
  FileText,
  Hash,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { updateInstitution, uploadInstitutionAsset } from '@/lib/api'
import {
  brandedImageSrc,
  getTenantBaseUrl,
  getTenantLoginUrl,
  getTenantPortalUrl,
  publishInstitutionBrand,
  rateToPercent,
  getInstitutionCurrency,
  getInstitutionCurrencySymbol,
  isInstitutionSettingsComplete,
  formatCertificateSerial,
  formatCertificateDigits,
  parseCertificateNumberStart,
  nextCertificateSerialPreview,
  defaultStudentIdSample,
  formatStudentIdSample,
  parseStudentIdSample,
  nextStudentIdPreview,
} from '@/lib/institution'
import { cn, isValidEmail, setAppCurrency } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import GradingSystemSettings from '@/components/admin/GradingSystemSettings'
import LogoBrandColorPicker from '@/components/admin/LogoBrandColorPicker'
import { extractLogoBrandPalette, normalizeHexColor } from '@/lib/logoBrandColors'
const CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', label: 'USD — US Dollar' },
  { code: 'SOS', symbol: 'Sh.so', label: 'SOS — Somali Shilling' },
  { code: 'EUR', symbol: '€', label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP — British Pound' },
  { code: 'KES', symbol: 'KSh', label: 'KES — Kenyan Shilling' },
  { code: 'ETB', symbol: 'Br', label: 'ETB — Ethiopian Birr' },
]

const inputCls = 'bg-[var(--tenant-bg-2)] border-[var(--tenant-line)] text-[var(--tenant-text)] h-9'
const empty = {
  name: '',
  logo_url: '',
  seal_url: '',
  signature_url: '',
  description: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  motto: '',
  theme_primary: '#002147',
  theme_accent: '#D32F2F',
  theme_tertiary: '',
  subdomain: '',
  currency: 'USD',
  currency_symbol: '$',
  affiliate_commission_rate: '0',
  registration_fee_amount: '0',
  default_instructor_commission_rate: '0',
  signatory_left_title: 'Academic Registrar',
  signatory_right_title: 'Principal',
  signatory_left_name: '',
  signatory_right_name: '',
  certificate_footer_text: '',
  transcript_footer_text: '',
  invoice_footer_text: '',
  certificate_number_start: '001',
  student_id_sample: '',
}

const Field = ({ label, htmlFor, hint, className, children }) => (
  <div className={cn('space-y-1.5', className)}>
    {label ? (
      <Label htmlFor={htmlFor} className="text-[var(--tenant-text)] text-[13px]">
        {label}
      </Label>
    ) : null}
    {children}
    {hint ? <p className="text-[11px] text-[var(--tenant-muted)] leading-snug">{hint}</p> : null}
  </div>
)

const AssetUploadField = ({ id, label, hint = '', value, onUrlChange, onFile, uploading }) => (
  <Field label={label} htmlFor={id} hint={hint}>
    <div className="flex items-center gap-3 rounded-lg border border-[var(--tenant-line)] bg-[var(--tenant-bg-2)] p-2.5">
      <div className="h-12 w-12 shrink-0 rounded-md border border-[var(--tenant-line)] bg-[var(--tenant-surface)] flex items-center justify-center overflow-hidden">
        {value ? (
          <img src={brandedImageSrc(value)} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[9px] text-[var(--tenant-muted)]">None</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Label
          htmlFor={id}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--tenant-text)] cursor-pointer m-0 rounded-md border border-[var(--tenant-line)] px-2.5 py-1.5 hover:bg-[var(--tenant-bg)]"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {value ? 'Replace' : 'Upload'}
          <input
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onFile}
            disabled={uploading}
          />
        </Label>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[var(--tenant-muted)] hover:text-red-600"
            onClick={() => onUrlChange('')}
            disabled={uploading}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  </Field>
)

const SECTION_FOCUS = {
  profile: 'inst_name',
  brand: 'inst_logo',
  ids: 'cert_number_start',
  finance: 'currency',
  documents: 'sig_left_title',
}

const SectionBlock = ({ id, icon: Icon, title, children }) => (
  <section id={id} className="scroll-mt-6 border-b border-[var(--tenant-line)] p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-[var(--brand-primary,#4f46e5)]" />
      <h3 className="text-sm font-semibold text-[var(--tenant-text)]">{title}</h3>
    </div>
    {children}
  </section>
)

const InstitutionSettingsForm = ({ onUpdated, section: controlledSection }) => {
  const { institution, refreshUser } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [logoSwatches, setLogoSwatches] = useState([])
  const [detectingColors, setDetectingColors] = useState(false)
  const isGrading = controlledSection === 'grading'
  const goSection = (next) => {
    const el = document.getElementById(SECTION_FOCUS[next] || next)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus?.()
  }

  useEffect(() => {
    if (!institution) return
    const currency = getInstitutionCurrency(institution)
    const symbol = getInstitutionCurrencySymbol(institution)
    setForm({
      name: institution.name || '',
      logo_url: institution.logo_url || '',
      seal_url: institution.seal_url || '',
      signature_url: institution.signature_url || '',
      description: institution.description || '',
      email: institution.email || '',
      phone: institution.phone || '',
      address: institution.address || '',
      website: institution.website || '',
      motto: institution.motto || '',
      theme_primary: institution.theme_primary || '#002147',
      theme_accent: institution.theme_accent || '#D32F2F',
      theme_tertiary: institution.theme_tertiary || '',
      subdomain: institution.subdomain || '',
      currency,
      currency_symbol: symbol,
      affiliate_commission_rate: String(rateToPercent(institution.affiliate_commission_rate)),
      registration_fee_amount: String(institution.registration_fee_amount ?? 0),
      default_instructor_commission_rate: String(
        rateToPercent(institution.default_instructor_commission_rate),
      ),
      signatory_left_title: institution.signatory_left_title || 'Academic Registrar',
      signatory_right_title: institution.signatory_right_title || 'Principal',
      signatory_left_name: institution.signatory_left_name || '',
      signatory_right_name: institution.signatory_right_name || '',
      certificate_footer_text: institution.certificate_footer_text || '',
      transcript_footer_text: institution.transcript_footer_text || '',
      invoice_footer_text: institution.invoice_footer_text || '',
      certificate_number_start: formatCertificateDigits(
        institution.certificate_number_start,
        institution.certificate_number_pad,
      ),
      student_id_sample:
        institution.student_id_prefix != null
          ? formatStudentIdSample(
              institution.student_id_prefix,
              institution.student_id_start,
              institution.student_id_pad,
            )
          : defaultStudentIdSample(institution.name),
    })
    setAppCurrency(currency, symbol)
    if (institution.logo_url) {
      extractLogoBrandPalette(institution.logo_url).then((palette) => {
        if (palette?.swatches?.length) setLogoSwatches(palette.swatches)
      })
    } else {
      setLogoSwatches([])
    }
  }, [institution])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleCurrencyChange = (code) => {
    const option = CURRENCY_OPTIONS.find((o) => o.code === code)
    setForm((prev) => ({
      ...prev,
      currency: code,
      currency_symbol: option?.symbol || prev.currency_symbol || code,
    }))
  }

  const handleAssetFile = async (e, kind, field) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(kind)
    try {
      const url = await uploadInstitutionAsset(file, kind)
      if (kind === 'logo') {
        setDetectingColors(true)
        const palette = await extractLogoBrandPalette(file)
        const theme_primary = palette?.primary || form.theme_primary
        const theme_accent = palette?.accent || form.theme_accent
        const theme_tertiary = palette?.tertiary || ''
        setForm((prev) => ({
          ...prev,
          logo_url: url,
          theme_primary,
          theme_accent,
          theme_tertiary,
        }))
        setLogoSwatches(palette?.swatches || [])
        const saved = await updateInstitution({
          logo_url: url,
          theme_primary: normalizeHexColor(theme_primary),
          theme_accent: normalizeHexColor(theme_accent, '#D32F2F'),
          theme_tertiary: String(theme_tertiary || '').trim()
            ? normalizeHexColor(theme_tertiary, '#0EA5E9')
            : null,
        })
        await refreshUser?.()
        onUpdated?.(saved)
        publishInstitutionBrand({
          id: saved?.id || institution?.id,
          logo_url: url,
          name: saved?.name || institution?.name,
        })
        toast({
          title: 'Logo saved',
          description: 'Landing header, sign-in, and footer now use this logo.',
        })
      } else {
        setField(field, url)
        toast({ title: 'Success', description: 'File uploaded. Save settings to apply.' })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setUploading(null)
      setDetectingColors(false)
      e.target.value = ''
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      goSection('profile')
      toast({ title: 'Validation', description: 'Institution name is required.', variant: 'destructive' })
      return
    }
    if (!form.email.trim() || !isValidEmail(form.email)) {
      goSection('profile')
      toast({ title: 'Validation', description: 'A valid institution email is required.', variant: 'destructive' })
      return
    }
    if (!form.phone.trim()) {
      goSection('profile')
      toast({ title: 'Validation', description: 'Institution phone is required.', variant: 'destructive' })
      return
    }
    if (!form.address.trim()) {
      goSection('profile')
      toast({ title: 'Validation', description: 'Institution address is required.', variant: 'destructive' })
      return
    }
    const currency = String(form.currency || '').trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) {
      goSection('finance')
      toast({ title: 'Validation', description: 'Currency must be a 3-letter code (e.g. USD).', variant: 'destructive' })
      return
    }
    const symbol = String(form.currency_symbol || '').trim()
    if (!symbol || symbol.length > 8) {
      goSection('finance')
      toast({ title: 'Validation', description: 'Currency symbol is required (max 8 characters).', variant: 'destructive' })
      return
    }

    let serial
    try {
      serial = parseCertificateNumberStart(form.certificate_number_start)
    } catch {
      goSection('ids')
      toast({
        title: 'Validation',
        description: 'Certificate start must be a number like 0001.',
        variant: 'destructive',
      })
      return
    }

    let studentId
    try {
      studentId = parseStudentIdSample(
        form.student_id_sample || defaultStudentIdSample(form.name || institution?.name),
      )
    } catch {
      goSection('ids')
      toast({
        title: 'Validation',
        description: 'Student ID must look like brce002, DI0123, or 134855.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const updated = await updateInstitution({
        name: form.name.trim(),
        logo_url: form.logo_url.trim() || null,
        seal_url: form.seal_url.trim() || null,
        signature_url: form.signature_url.trim() || null,
        description: form.description.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        website: form.website.trim() || null,
        motto: form.motto.trim() || null,
        theme_primary: normalizeHexColor(form.theme_primary),
        theme_accent: normalizeHexColor(form.theme_accent, '#D32F2F'),
        theme_tertiary: String(form.theme_tertiary || '').trim()
          ? normalizeHexColor(form.theme_tertiary, '#0EA5E9')
          : null,
        currency,
        currency_symbol: symbol,
        affiliate_commission_rate: Math.min(1, Math.max(0, Number(form.affiliate_commission_rate || 0) / 100)),
        registration_fee_amount: Number(form.registration_fee_amount || 0),
        default_instructor_commission_rate: Math.min(
          1,
          Math.max(0, Number(form.default_instructor_commission_rate || 0) / 100),
        ),
        signatory_left_title: form.signatory_left_title,
        signatory_right_title: form.signatory_right_title,
        signatory_left_name: form.signatory_left_name,
        signatory_right_name: form.signatory_right_name,
        certificate_footer_text: form.certificate_footer_text,
        transcript_footer_text: form.transcript_footer_text,
        invoice_footer_text: form.invoice_footer_text,
        certificate_number_start: serial.start,
        certificate_number_pad: serial.pad,
        student_id_prefix: studentId.prefix,
        student_id_start: studentId.start,
        student_id_pad: studentId.pad,
      })
      setAppCurrency(currency, symbol)
      await refreshUser?.()
      onUpdated?.(updated)
      publishInstitutionBrand({
        id: updated?.id || institution?.id,
        logo_url: updated?.logo_url ?? form.logo_url,
        name: updated?.name || form.name,
      })
      toast({ title: 'Saved', description: 'Institution settings updated.' })
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

  const dashboardUrl = getTenantBaseUrl({ ...institution, subdomain: form.subdomain })
  const loginUrl = getTenantLoginUrl({ ...institution, subdomain: form.subdomain })
  const landingUrl = getTenantPortalUrl({ ...institution, subdomain: form.subdomain })
  const settingsComplete = isInstitutionSettingsComplete(institution)

  const certNext = useMemo(() => {
    try {
      const parsed = parseCertificateNumberStart(form.certificate_number_start)
      return nextCertificateSerialPreview({
        ...institution,
        certificate_number_start: parsed.start,
        certificate_number_pad: parsed.pad,
      })
    } catch {
      return nextCertificateSerialPreview(institution)
    }
  }, [form.certificate_number_start, institution])

  const studentNext = nextStudentIdPreview(institution, form.student_id_sample)

  if (isGrading) {
    return (
      <div className="p-4 sm:p-5">
        <GradingSystemSettings onUpdated={onUpdated} />
      </div>
    )
  }

  return (
    <div>
      {!settingsComplete ? (
        <Alert className="mx-4 mt-4 bg-amber-50 border-amber-200 text-amber-900 py-2.5 [html[data-platform-theme='dark']_&]:bg-amber-950/40 [html[data-platform-theme='dark']_&]:border-amber-800 [html[data-platform-theme='dark']_&]:text-amber-100">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Add name, address, phone, and email before issuing certificates, transcripts, or invoices.
          </AlertDescription>
        </Alert>
      ) : null}

      <form id="institution-settings-form" onSubmit={handleSave} className="space-y-0">
        <SectionBlock id="settings-profile" icon={Building2} title="Profile">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Institution name *" htmlFor="inst_name" className="sm:col-span-2">
                <Input
                  id="inst_name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Email *" htmlFor="inst_email">
                <Input
                  id="inst_email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone *" htmlFor="inst_phone">
                <Input
                  id="inst_phone"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Address *" htmlFor="inst_address" className="sm:col-span-2">
                <Input
                  id="inst_address"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Website" htmlFor="inst_website">
                <Input
                  id="inst_website"
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  placeholder="https://"
                  className={inputCls}
                />
              </Field>
              <Field label="Motto" htmlFor="inst_motto">
                <Input
                  id="inst_motto"
                  value={form.motto}
                  onChange={(e) => setField('motto', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Subdomain" htmlFor="inst_subdomain">
                <Input
                  id="inst_subdomain"
                  value={form.subdomain}
                  disabled
                  className={cn(inputCls, 'font-mono text-[var(--tenant-muted)]')}
                />
              </Field>
              <Field label="Short description" htmlFor="inst_description" className="sm:col-span-2">
                <Textarea
                  id="inst_description"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  className="bg-[var(--tenant-bg-2)] border-[var(--tenant-line)] text-[var(--tenant-text)] min-h-[72px]"
                />
              </Field>
            </div>
            <div className="mt-4 rounded-lg border border-[var(--tenant-line)] bg-[var(--tenant-bg-2)] px-3 py-2.5 text-[11px] text-[var(--tenant-muted)] space-y-1">
              <p>
                <span className="text-[var(--tenant-muted)]">Landing</span>{' '}
                <a href={landingUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:underline break-all">
                  {landingUrl}
                </a>
              </p>
              <p>
                <span className="text-[var(--tenant-muted)]">Login</span> {loginUrl}
              </p>
              <p>
                <span className="text-[var(--tenant-muted)]">Dashboard</span> {dashboardUrl}
              </p>
            </div>
        </SectionBlock>

        <SectionBlock id="settings-brand" icon={Palette} title="Branding">
            <div className="grid gap-4 sm:grid-cols-3">
              <AssetUploadField
                id="inst_logo"
                label="Logo"
                hint="Saves immediately. Colors are taken from the image."
                value={form.logo_url}
                onUrlChange={async (v) => {
                  setField('logo_url', v)
                  if (!v) setLogoSwatches([])
                  if (v) return
                  try {
                    const saved = await updateInstitution({ logo_url: null })
                    await refreshUser?.()
                    onUpdated?.(saved)
                    publishInstitutionBrand({
                      id: saved?.id || institution?.id,
                      logo_url: '',
                      name: saved?.name || institution?.name,
                    })
                    toast({ title: 'Logo removed' })
                  } catch (err) {
                    toast({
                      title: 'Error',
                      description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
                      variant: 'destructive',
                    })
                  }
                }}
                onFile={(e) => handleAssetFile(e, 'logo', 'logo_url')}
                uploading={uploading === 'logo'}
              />
              <AssetUploadField
                id="inst_stamp"
                label="Stamp"
                hint="Used on certificates and transcripts."
                value={form.seal_url}
                onUrlChange={(v) => setField('seal_url', v)}
                onFile={(e) => handleAssetFile(e, 'stamp', 'seal_url')}
                uploading={uploading === 'stamp'}
              />
              <AssetUploadField
                id="inst_signature"
                label="Signature"
                hint="Director / registrar on certificates."
                value={form.signature_url}
                onUrlChange={(v) => setField('signature_url', v)}
                onFile={(e) => handleAssetFile(e, 'signature', 'signature_url')}
                uploading={uploading === 'signature'}
              />
            </div>
            <LogoBrandColorPicker
              primary={form.theme_primary}
              accent={form.theme_accent}
              tertiary={form.theme_tertiary}
              swatches={logoSwatches}
              detecting={detectingColors}
              onPrimaryChange={(hex) => setField('theme_primary', hex)}
              onAccentChange={(hex) => setField('theme_accent', hex)}
              onTertiaryChange={(hex) => setField('theme_tertiary', hex)}
            />
        </SectionBlock>

        <SectionBlock id="settings-ids" icon={Hash} title="IDs">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label="Certificate start"
                htmlFor="cert_number_start"
                hint={`Next: ${certNext}${
                  institution?.certificate_number_last
                    ? ` · last issued ${formatCertificateSerial(
                        institution.certificate_number_last,
                        institution.certificate_number_pad,
                      )}`
                    : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[var(--tenant-muted)] shrink-0 text-sm">CERT-</span>
                  <Input
                    id="cert_number_start"
                    value={form.certificate_number_start}
                    onChange={(e) =>
                      setField('certificate_number_start', e.target.value.replace(/[^\d]/g, '').slice(0, 9))
                    }
                    inputMode="numeric"
                    placeholder="001"
                    className={cn(inputCls, 'font-mono')}
                  />
                </div>
              </Field>
              <Field
                label="Student ID start"
                htmlFor="student_id_sample"
                hint={`Next: ${studentNext}${
                  institution?.student_id_last
                    ? ` · last issued ${formatStudentIdSample(
                        institution.student_id_prefix || '',
                        institution.student_id_last,
                        institution.student_id_pad,
                      )}`
                    : ''
                }. First password = this ID (min 6 characters).`}
              >
                <Input
                  id="student_id_sample"
                  value={form.student_id_sample}
                  onChange={(e) =>
                    setField('student_id_sample', e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 21))
                  }
                  placeholder={defaultStudentIdSample(form.name || institution?.name)}
                  className={cn(inputCls, 'font-mono')}
                />
              </Field>
            </div>
        </SectionBlock>

        <SectionBlock id="settings-finance" icon={Wallet} title="Finance">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Currency" htmlFor="currency">
                <Select value={form.currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger id="currency" className={inputCls}>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.code} value={opt.code}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Symbol" htmlFor="currency_symbol">
                <Input
                  id="currency_symbol"
                  value={form.currency_symbol}
                  onChange={(e) => setField('currency_symbol', e.target.value)}
                  maxLength={8}
                  className={inputCls}
                />
              </Field>
              <Field label="Registration fee" htmlFor="reg_fee" hint="0 = free. Applies to new registrations only.">
                <Input
                  id="reg_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.registration_fee_amount}
                  onChange={(e) => setField('registration_fee_amount', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Affiliate commission %" htmlFor="aff_rate" hint="On completed tuition from referred students.">
                <Input
                  id="aff_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.affiliate_commission_rate}
                  onChange={(e) => setField('affiliate_commission_rate', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field
                label="Instructor commission %"
                htmlFor="inst_rate"
                className="sm:col-span-2"
                hint="Default for commission classes. Unique instructor rates and class fixed fees are not overwritten."
              >
                <Input
                  id="inst_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.default_instructor_commission_rate}
                  onChange={(e) => setField('default_instructor_commission_rate', e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
        </SectionBlock>

        <SectionBlock id="settings-documents" icon={FileText} title="Signatories & footers">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-[var(--tenant-muted)] mb-3">Signatories</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Left title" htmlFor="sig_left_title">
                  <Input
                    id="sig_left_title"
                    value={form.signatory_left_title}
                    onChange={(e) => setField('signatory_left_title', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Left name" htmlFor="sig_left_name">
                  <Input
                    id="sig_left_name"
                    value={form.signatory_left_name}
                    onChange={(e) => setField('signatory_left_name', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Right title" htmlFor="sig_right_title">
                  <Input
                    id="sig_right_title"
                    value={form.signatory_right_title}
                    onChange={(e) => setField('signatory_right_title', e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Right name" htmlFor="sig_right_name">
                  <Input
                    id="sig_right_name"
                    value={form.signatory_right_name}
                    onChange={(e) => setField('signatory_right_name', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--tenant-muted)] mb-3">Footer lines</p>
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label="Certificate" htmlFor="cert_footer">
                  <Textarea
                    id="cert_footer"
                    value={form.certificate_footer_text}
                    onChange={(e) => setField('certificate_footer_text', e.target.value)}
                    className="bg-[var(--tenant-bg-2)] border-[var(--tenant-line)] text-[var(--tenant-text)] min-h-[72px]"
                  />
                </Field>
                <Field label="Transcript" htmlFor="tr_footer">
                  <Textarea
                    id="tr_footer"
                    value={form.transcript_footer_text}
                    onChange={(e) => setField('transcript_footer_text', e.target.value)}
                    className="bg-[var(--tenant-bg-2)] border-[var(--tenant-line)] text-[var(--tenant-text)] min-h-[72px]"
                  />
                </Field>
                <Field label="Invoice" htmlFor="inv_footer">
                  <Textarea
                    id="inv_footer"
                    value={form.invoice_footer_text}
                    onChange={(e) => setField('invoice_footer_text', e.target.value)}
                    className="bg-[var(--tenant-bg-2)] border-[var(--tenant-line)] text-[var(--tenant-text)] min-h-[72px]"
                  />
                </Field>
              </div>
            </div>
          </div>
        </SectionBlock>
      </form>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--tenant-line)] px-4 py-3">
        <p className="text-xs text-[var(--tenant-muted)] hidden sm:block">
          Saves institution profile, branding, IDs, finance, and document text.
        </p>
        <Button type="submit" form="institution-settings-form" disabled={saving} className="ml-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save settings
        </Button>
      </div>
    </div>
  )
}

export default InstitutionSettingsForm
