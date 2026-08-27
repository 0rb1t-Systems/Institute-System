import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Building2, Upload, Wallet, FileText, AlertCircle } from 'lucide-react'
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
import { isValidEmail, setAppCurrency } from '@/lib/utils'
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

const AssetUploadField = ({
  id,
  label,
  hint = '',
  value,
  onUrlChange,
  onFile,
  uploading,
}) => (
  <div className="sm:col-span-2 space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="flex flex-col sm:flex-row gap-3 items-start">
      <div className="h-20 w-28 shrink-0 rounded border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden p-1">
        {value ? (
          <img src={brandedImageSrc(value)} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[11px] text-slate-600 text-center px-1">No image</span>
        )}
      </div>
      <div className="flex-1 space-y-2 w-full">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer m-0">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 hover:bg-slate-800">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {value ? 'Replace' : 'Upload'}
            </span>
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
              className="h-8 text-slate-400 hover:text-red-300"
              onClick={() => onUrlChange('')}
              disabled={uploading}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          {value ? 'Image ready — save settings to apply.' : 'PNG, JPG, WebP, or SVG (max 2MB).'}
          {hint ? ` ${hint}` : ''}
        </p>
      </div>
    </div>
  </div>
)

const InstitutionSettingsForm = ({ onUpdated }) => {
  const { institution, refreshUser } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [logoSwatches, setLogoSwatches] = useState([])
  const [detectingColors, setDetectingColors] = useState(false)

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
      toast({ title: 'Validation', description: 'Institution name is required.', variant: 'destructive' })
      return
    }
    if (!form.email.trim() || !isValidEmail(form.email)) {
      toast({ title: 'Validation', description: 'A valid institution email is required.', variant: 'destructive' })
      return
    }
    if (!form.phone.trim()) {
      toast({ title: 'Validation', description: 'Institution phone is required.', variant: 'destructive' })
      return
    }
    if (!form.address.trim()) {
      toast({ title: 'Validation', description: 'Institution address is required.', variant: 'destructive' })
      return
    }
    const currency = String(form.currency || '').trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) {
      toast({ title: 'Validation', description: 'Currency must be a 3-letter code (e.g. USD).', variant: 'destructive' })
      return
    }
    const symbol = String(form.currency_symbol || '').trim()
    if (!symbol || symbol.length > 8) {
      toast({ title: 'Validation', description: 'Currency symbol is required (max 8 characters).', variant: 'destructive' })
      return
    }

    let serial
    try {
      serial = parseCertificateNumberStart(form.certificate_number_start)
    } catch {
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
      const landingHref = getTenantPortalUrl({ ...institution, subdomain: form.subdomain })
      toast({
        title: 'Success',
        description: `Settings saved. Public landing: ${landingHref}`,
      })
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
  const settingsComplete = isInstitutionSettingsComplete(institution)

  return (
    <div className="space-y-6">
      {!settingsComplete ? (
        <Alert className="bg-amber-950/40 border-amber-800 text-amber-100">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Complete Institution Settings (name, address, phone, and email) before issuing certificates,
            transcripts, or official invoices. These settings are the single source of truth for document branding.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-400" />
            <div>
              <CardTitle className="text-white text-base">Institution Branding</CardTitle>
              <CardDescription>
                These details appear on your dashboard, ID cards, certificates, transcripts, and invoices.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form id="institution-settings-form" onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="inst_name">Institution Name *</Label>
                <Input
                  id="inst_name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst_subdomain">Institution Subdomain</Label>
                <Input
                  id="inst_subdomain"
                  value={form.subdomain}
                  disabled
                  className="bg-slate-950 border-slate-800 font-mono text-slate-400"
                />
                <p className="text-xs text-slate-500">Set at provisioning. Dashboard URL: {dashboardUrl}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst_email">Institution Email *</Label>
                <Input
                  id="inst_email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst_phone">Institution Phone *</Label>
                <Input
                  id="inst_phone"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="inst_address">Institution Address *</Label>
                <Input
                  id="inst_address"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst_website">Website</Label>
                <Input
                  id="inst_website"
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  placeholder="https://…"
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inst_motto">Motto (optional)</Label>
                <Input
                  id="inst_motto"
                  value={form.motto}
                  onChange={(e) => setField('motto', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="inst_description">Institution Description</Label>
                <Textarea
                  id="inst_description"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  className="bg-slate-950 border-slate-800 min-h-[80px]"
                />
              </div>

              <AssetUploadField
                id="inst_logo"
                label="Logo"
                hint="Saved immediately to your public landing page. Brand colors are detected from the image."
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
                    toast({ title: 'Logo removed', description: 'Landing header, sign-in, and footer no longer show a logo.' })
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
                label="Stamp (optional)"
                hint="Official stamp/seal used on certificates and transcripts."
                value={form.seal_url}
                onUrlChange={(v) => setField('seal_url', v)}
                onFile={(e) => handleAssetFile(e, 'stamp', 'seal_url')}
                uploading={uploading === 'stamp'}
              />

              <AssetUploadField
                id="inst_signature"
                label="Director/Registrar Signature"
                hint="Signature image shown on official certificates."
                value={form.signature_url}
                onUrlChange={(v) => setField('signature_url', v)}
                onFile={(e) => handleAssetFile(e, 'signature', 'signature_url')}
                uploading={uploading === 'signature'}
              />

              <div className="sm:col-span-2">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="sig_left_title">Left Signatory Title</Label>
                <Input
                  id="sig_left_title"
                  value={form.signatory_left_title}
                  onChange={(e) => setField('signatory_left_title', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sig_left_name">Left Signatory Name</Label>
                <Input
                  id="sig_left_name"
                  value={form.signatory_left_name}
                  onChange={(e) => setField('signatory_left_name', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sig_right_title">Right Signatory Title</Label>
                <Input
                  id="sig_right_title"
                  value={form.signatory_right_title}
                  onChange={(e) => setField('signatory_right_title', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sig_right_name">Right Signatory Name</Label>
                <Input
                  id="sig_right_name"
                  value={form.signatory_right_name}
                  onChange={(e) => setField('signatory_right_name', e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-400" />
            <div>
              <CardTitle className="text-white text-base">Document Footer Text</CardTitle>
              <CardDescription>
                Applied to each institution&apos;s certificate, transcript, and invoice templates.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cert_footer">Certificate Footer Text</Label>
            <Textarea
              id="cert_footer"
              form="institution-settings-form"
              value={form.certificate_footer_text}
              onChange={(e) => setField('certificate_footer_text', e.target.value)}
              className="bg-slate-950 border-slate-800 min-h-[64px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tr_footer">Transcript Footer Text</Label>
            <Textarea
              id="tr_footer"
              form="institution-settings-form"
              value={form.transcript_footer_text}
              onChange={(e) => setField('transcript_footer_text', e.target.value)}
              className="bg-slate-950 border-slate-800 min-h-[64px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv_footer">Invoice Footer Text</Label>
            <Textarea
              id="inv_footer"
              form="institution-settings-form"
              value={form.invoice_footer_text}
              onChange={(e) => setField('invoice_footer_text', e.target.value)}
              className="bg-slate-950 border-slate-800 min-h-[64px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-400" />
            <div>
              <CardTitle className="text-white text-base">Certificate numbering</CardTitle>
              <CardDescription>
                Enter the starting number (example 001 or 002). Certificates are issued as CERT-001, CERT-002,
                and so on. Numbers never go backwards and two certificates cannot share the same number.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="cert_number_start">Certificate start number</Label>
          <div className="flex items-center gap-2 max-w-xs">
            <span className="font-mono text-slate-400 shrink-0">CERT-</span>
            <Input
              id="cert_number_start"
              form="institution-settings-form"
              value={form.certificate_number_start}
              onChange={(e) => setField('certificate_number_start', e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
              inputMode="numeric"
              placeholder="001"
              className="bg-slate-950 border-slate-800 font-mono"
            />
          </div>
          <p className="text-xs text-slate-500">
            Next certificate will be{' '}
            <span className="font-mono text-slate-300">
              {(() => {
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
              })()}
            </span>
            {institution?.certificate_number_last
              ? ` (already issued up to ${formatCertificateSerial(
                  institution.certificate_number_last,
                  institution.certificate_number_pad,
                )})`
              : ''}
            . If paper certificates already exist, set the start to the next unused number.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-400" />
            <div>
              <CardTitle className="text-white text-base">Student ID structure</CardTitle>
              <CardDescription>
                Example: brce002, DI0123, or 134855. The next student gets the next unused number. The first
                login password is this Student ID (then they can change it). IDs are at least 6 characters so
                login is accepted. IDs never go backwards and two students cannot share the same ID.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="student_id_sample">Student ID start (sample)</Label>
          <Input
            id="student_id_sample"
            form="institution-settings-form"
            value={form.student_id_sample}
            onChange={(e) =>
              setField('student_id_sample', e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 21))
            }
            placeholder={defaultStudentIdSample(form.name || institution?.name)}
            className="bg-slate-950 border-slate-800 font-mono max-w-xs"
          />
          <p className="text-xs text-slate-500">
            Next student ID will be{' '}
            <span className="font-mono text-slate-300">
              {nextStudentIdPreview(institution, form.student_id_sample)}
            </span>
            {institution?.student_id_last
              ? ` (already issued up to ${formatStudentIdSample(
                  institution.student_id_prefix || '',
                  institution.student_id_last,
                  institution.student_id_pad,
                )})`
              : ''}
            . If you do not change this, it defaults to your institution initials plus 123.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-400" />
            <div>
              <CardTitle className="text-white text-base">Financial Settings</CardTitle>
              <CardDescription>
                Institution-level money settings saved to your tenant. Used for registration fees,
                instructor earnings, affiliate commissions, invoices, and reports.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={form.currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger id="currency" className="bg-slate-950 border-slate-800">
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
              <p className="text-xs text-slate-500">ISO currency code used across payments and reports.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency_symbol">Currency Symbol</Label>
              <Input
                id="currency_symbol"
                value={form.currency_symbol}
                onChange={(e) => setField('currency_symbol', e.target.value)}
                maxLength={8}
                className="bg-slate-950 border-slate-800"
              />
              <p className="text-xs text-slate-500">Shown next to amounts (e.g. $, Sh.so).</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg_fee">Registration Fee Amount</Label>
              <Input
                id="reg_fee"
                type="number"
                min="0"
                step="0.01"
                form="institution-settings-form"
                value={form.registration_fee_amount}
                onChange={(e) => setField('registration_fee_amount', e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
              <p className="text-xs text-slate-500">
                Set to 0 if registration is free. Changing this affects future registrations only —
                existing payment records stay unchanged.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aff_rate">Affiliate Commission (%)</Label>
              <Input
                id="aff_rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                form="institution-settings-form"
                value={form.affiliate_commission_rate}
                onChange={(e) => setField('affiliate_commission_rate', e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
              <p className="text-xs text-slate-500">
                Applied to completed tuition payments from referred students when rate &gt; 0.
                Registration fees do not earn commission.
              </p>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="inst_rate">Instructor Commission (%)</Label>
              <Input
                id="inst_rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                form="institution-settings-form"
                value={form.default_instructor_commission_rate}
                onChange={(e) => setField('default_instructor_commission_rate', e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
              <p className="text-xs text-slate-500">
                Default for <strong className="text-slate-400">commission</strong> classes: applied to
                completed tuition payments for instructor earnings and withdrawable balance.
                Instructors with a <strong className="text-slate-400">unique commission</strong> (set
                on Instructors) keep their own % — this setting does not overwrite them.
                Classes can also use a <strong className="text-slate-400">fixed fee</strong> instead
                (set on the class or as an instructor default). Changing the default % updates
                remaining commission classes for future payments only — existing settlement records stay
                historically accurate.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 space-y-1 mt-4">
            <p>
              <span className="text-slate-500">Public landing:</span>{' '}
              <a
                href={getTenantPortalUrl({ ...institution, subdomain: form.subdomain })}
                target="_blank"
                rel="noreferrer"
                className="text-teal-400 hover:underline break-all"
              >
                {getTenantPortalUrl({ ...institution, subdomain: form.subdomain })}
              </a>
            </p>
            <p>
              <span className="text-slate-500">Login URL:</span> {loginUrl}
            </p>
            <p>
              <span className="text-slate-500">Dashboard URL:</span> {dashboardUrl}
            </p>
          </div>

          <Button
            type="submit"
            form="institution-settings-form"
            disabled={saving}
            className="mt-4"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save institution settings
          </Button>
        </CardContent>
      </Card>

      <GradingSystemSettings onUpdated={onUpdated} />
    </div>
  )
}

export default InstitutionSettingsForm
