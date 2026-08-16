/**
 * Tenant branding helpers — never hardcode academy names or hosts.
 */

export type InstitutionBrand = {
  id?: string
  name?: string | null
  subdomain?: string | null
  logo_url?: string | null
  description?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  website?: string | null
  motto?: string | null
  theme_primary?: string | null
  theme_accent?: string | null
  status?: string | null
  affiliate_commission_rate?: number | null
  registration_fee_amount?: number | null
  default_instructor_commission_rate?: number | null
  currency?: string | null
  currency_symbol?: string | null
  signatory_left_title?: string | null
  signatory_right_title?: string | null
  signatory_left_name?: string | null
  signatory_right_name?: string | null
  /** Optional stamp/seal image */
  seal_url?: string | null
  /** Director/Registrar signature image */
  signature_url?: string | null
  certificate_footer_text?: string | null
  transcript_footer_text?: string | null
  invoice_footer_text?: string | null
  settings_completed_at?: string | null
} | null | undefined

const DEFAULT_PRIMARY = '#002147'
const DEFAULT_ACCENT = '#D32F2F'
const DEFAULT_LEFT_TITLE = 'Academic Registrar'
const DEFAULT_RIGHT_TITLE = 'Principal'

/** Root domain for tenant URLs, e.g. trainhub.com → https://{subdomain}.trainhub.com */
export function getAppRootDomain(): string {
  const fromEnv = String(import.meta.env.VITE_APP_ROOT_DOMAIN || '').trim().replace(/^https?:\/\//i, '')
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname
    // localhost / IP → keep current origin host for dev
    if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return host + (window.location.port ? `:${window.location.port}` : '')
    }
    // strip leading subdomain for multi-level hosts when possible
    const parts = host.split('.')
    if (parts.length >= 3) return parts.slice(-2).join('.')
    return host
  }
  return 'localhost:3000'
}

export function getInstitutionDisplayName(institution?: InstitutionBrand, fallback = 'Training Center'): string {
  const name = String(institution?.name || '').trim()
  return name || fallback
}

export function getInstitutionPrimary(institution?: InstitutionBrand): string {
  return String(institution?.theme_primary || '').trim() || DEFAULT_PRIMARY
}

export function getInstitutionAccent(institution?: InstitutionBrand): string {
  return String(institution?.theme_accent || '').trim() || DEFAULT_ACCENT
}

/**
 * Public tenant base URL.
 * Production: https://{subdomain}.{rootDomain}
 * Localhost: current origin (subdomain routing not available in local Vite).
 */
export function getTenantBaseUrl(institution?: InstitutionBrand): string {
  const subdomain = String(institution?.subdomain || '').trim().toLowerCase()
  const root = getAppRootDomain()
  const isLocal =
    root.startsWith('localhost') ||
    root.startsWith('127.0.0.1') ||
    /^\d+\.\d+\.\d+\.\d+/.test(root)

  if (typeof window !== 'undefined' && isLocal) {
    return window.location.origin
  }

  if (subdomain && root) {
    const protocol =
      typeof window !== 'undefined' && window.location.protocol === 'http:' ? 'http' : 'https'
    return `${protocol}://${subdomain}.${root}`
  }

  if (typeof window !== 'undefined') return window.location.origin
  return `https://${root}`
}

export function getTenantLoginUrl(institution?: InstitutionBrand): string {
  return `${getTenantBaseUrl(institution)}/login`
}

/**
 * Public verification URLs for QR codes.
 * - certificate / verify → document check by verification_code
 * - credential → identity check page; optional student/staff code as ?id=
 */
export function getVerificationUrl(
  pathOrId: string,
  institution?: InstitutionBrand,
  kind: 'credential' | 'certificate' | 'verify' = 'verify',
): string {
  const base = getTenantBaseUrl(institution)
  const id = String(pathOrId || '').replace(/^\//, '').trim()
  if (kind === 'certificate') return `${base}/verify-certificate/${encodeURIComponent(id)}`
  if (kind === 'credential') {
    const params = new URLSearchParams()
    if (id && id !== 'unknown' && id !== '---') params.set('id', id)
    const tenant =
      String(institution?.subdomain || '').trim().toLowerCase() ||
      resolvePublicTenantSubdomain() ||
      ''
    if (tenant) params.set('tenant', tenant)
    const qs = params.toString()
    return qs ? `${base}/verify-credential?${qs}` : `${base}/verify-credential`
  }
  return `${base}/verify/${encodeURIComponent(id)}`
}

/**
 * Resolve tenant subdomain for public (anon) pages.
 * Priority: ?tenant= / ?subdomain= → hostname label → VITE_DEFAULT_TENANT_SUBDOMAIN.
 */
export function resolvePublicTenantSubdomain(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = String(params.get('tenant') || params.get('subdomain') || '')
      .trim()
      .toLowerCase()
    if (fromQuery) return fromQuery

    const host = window.location.hostname
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const parts = host.split('.')
      if (parts.length >= 3) return parts[0].toLowerCase()
    }
  }
  return String(import.meta.env.VITE_DEFAULT_TENANT_SUBDOMAIN || '').trim().toLowerCase()
}

export function getSignatoryLeftTitle(institution?: InstitutionBrand): string {
  return String(institution?.signatory_left_title || '').trim() || DEFAULT_LEFT_TITLE
}

export function getSignatoryRightTitle(institution?: InstitutionBrand): string {
  return String(institution?.signatory_right_title || '').trim() || DEFAULT_RIGHT_TITLE
}

export function getSignatoryLeftName(institution?: InstitutionBrand): string {
  return String(institution?.signatory_left_name || '').trim()
}

export function getSignatoryRightName(institution?: InstitutionBrand): string {
  return String(institution?.signatory_right_name || '').trim()
}

export function getRegistrationFeeAmount(institution?: InstitutionBrand): number {
  const n = Number(institution?.registration_fee_amount)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function getAffiliateCommissionRate(institution?: InstitutionBrand): number {
  const n = Number(institution?.affiliate_commission_rate)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Fraction 0–1 from institution settings (used as default when creating classes). */
export function getDefaultInstructorCommissionRate(institution?: InstitutionBrand): number {
  const n = Number(institution?.default_instructor_commission_rate)
  if (Number.isFinite(n) && n >= 0 && n <= 1) return n
  return 0
}

/** ISO 4217 currency code from Institution Settings (default USD). */
export function getInstitutionCurrency(institution?: InstitutionBrand): string {
  const code = String(institution?.currency || 'USD').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'USD'
}

/** Display symbol from Institution Settings (e.g. $, Sh.so). */
export function getInstitutionCurrencySymbol(institution?: InstitutionBrand): string {
  const sym = String(institution?.currency_symbol || '').trim()
  if (sym) return sym.slice(0, 8)
  const code = getInstitutionCurrency(institution)
  if (code === 'USD') return '$'
  if (code === 'EUR') return '€'
  if (code === 'GBP') return '£'
  return code
}

/** Display helper: fraction → percent without float noise (e.g. 0.07 → 7). */
export function rateToPercent(rate: number | null | undefined, digits = 2): number {
  const n = Number(rate)
  if (!Number.isFinite(n)) return 0
  const factor = 10 ** digits
  return Math.round(n * 100 * factor) / factor
}

export function getInstitutionContactLine(institution?: InstitutionBrand): string {
  const parts = [
    institution?.address,
    institution?.phone,
    institution?.email,
    institution?.website,
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  return parts.join(' · ') || getTenantBaseUrl(institution).replace(/^https?:\/\//, '')
}

/** Required branding fields before official documents may be issued. */
export function isInstitutionSettingsComplete(institution?: InstitutionBrand): boolean {
  if (!institution) return false
  if (institution.settings_completed_at) {
    return (
      Boolean(String(institution.name || '').trim()) &&
      Boolean(String(institution.email || '').trim()) &&
      Boolean(String(institution.phone || '').trim()) &&
      Boolean(String(institution.address || '').trim())
    )
  }
  return false
}

/**
 * Prefer frozen template_snapshot.branding for issued documents;
 * fall back to live Institution Settings for drafts/previews.
 */
export function resolveDocumentBranding(
  institution?: InstitutionBrand,
  templateSnapshot?: { branding?: Record<string, unknown> } | null,
): InstitutionBrand {
  const snap = templateSnapshot?.branding
  if (snap && typeof snap === 'object') {
    return { ...(institution || {}), ...snap } as InstitutionBrand
  }
  return institution
}

export function getCertificateFooterText(institution?: InstitutionBrand): string {
  return String(institution?.certificate_footer_text || '').trim()
}

export function getTranscriptFooterText(institution?: InstitutionBrand): string {
  return String(institution?.transcript_footer_text || '').trim()
}

export function getInvoiceFooterText(institution?: InstitutionBrand): string {
  const custom = String(institution?.invoice_footer_text || '').trim()
  if (custom) return custom
  const name = getInstitutionDisplayName(institution)
  return `Thank you for your business. Please make payments payable to ${name}.`
}

export function splitInstitutionName(name: string): { title: string; subtitle: string } {
  const full = String(name || '').trim()
  if (!full) return { title: 'Training Center', subtitle: '' }
  const words = full.split(/\s+/)
  if (words.length <= 2) return { title: full, subtitle: '' }
  return {
    title: words.slice(0, 2).join(' '),
    subtitle: words.slice(2).join(' '),
  }
}
