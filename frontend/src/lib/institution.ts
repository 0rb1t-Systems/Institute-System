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
  theme_tertiary?: string | null
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
  certificate_number_start?: number | null
  certificate_number_pad?: number | null
  certificate_number_last?: number | null
  student_id_prefix?: string | null
  student_id_start?: number | null
  student_id_pad?: number | null
  student_id_last?: number | null
  transcript_footer_text?: string | null
  invoice_footer_text?: string | null
  settings_completed_at?: string | null
  landing_template_id?: string | null
  hero_image_url?: string | null
  hero_headline?: string | null
  footer_text?: string | null
  social_whatsapp?: string | null
  social_facebook?: string | null
  social_tiktok?: string | null
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

/** Public logo URL from settings (supports a few field names from RPC/API). */
export function institutionLogoUrl(
  institutionOrUrl?: InstitutionBrand | string | null,
): string {
  if (typeof institutionOrUrl === 'string') return String(institutionOrUrl || '').trim()
  const row = institutionOrUrl as { logo_url?: string | null; logo?: string | null; logoUrl?: string | null } | null
  return String(row?.logo_url || row?.logo || row?.logoUrl || '').trim()
}

/** True when settings has a usable institution logo URL. */
export function hasInstitutionLogo(
  institutionOrUrl?: InstitutionBrand | string | null,
): boolean {
  return Boolean(institutionLogoUrl(institutionOrUrl))
}

/** Timestamp baked into storage filenames: `{id}/logo-{Date.now()}.png`. */
export function logoUrlVersion(url?: string | null): number {
  const m = String(url || '').match(/-(\d{10,})\.[a-z0-9]+(?:\?|$)/i)
  return m ? Number(m[1]) : 0
}

/**
 * Prefer the incoming logo (settings upload) over a stale cached URL.
 * Filename timestamps win; a just-published URL still wins even without a stamp.
 * Empty `incoming` only clears when `incomingAt` is set (explicit publish/remove).
 */
export function pickLiveLogoUrl(
  current?: string | null,
  incoming?: string | null,
  incomingAt?: number | null,
): string {
  if (incoming === undefined) return institutionLogoUrl(current)
  if (incoming === null || incoming === '') {
    if (incomingAt) return ''
    return institutionLogoUrl(current)
  }
  const next = institutionLogoUrl(incoming)
  const prev = institutionLogoUrl(current)
  if (!next) return prev
  if (!prev) return next
  if (prev === next) return next
  const nextV = logoUrlVersion(next)
  const prevV = logoUrlVersion(prev)
  if (nextV > prevV) return next
  if (prevV > nextV) {
    const recent = Boolean(incomingAt) && Date.now() - Number(incomingAt) < 15 * 60 * 1000
    return recent ? next : prev
  }
  return next
}

/** Combine server + in-memory logos without treating a missing URL as a delete. */
export function coalesceLogoUrl(a?: string | null, b?: string | null): string {
  const A = institutionLogoUrl(a)
  const B = institutionLogoUrl(b)
  if (!A) return B
  if (!B) return A
  return pickLiveLogoUrl(A, B)
}

/** Keep the newer uploaded logo when two URLs disagree (stale auth vs fresh public). */
export function preferNewerLogoUrl(
  a?: string | null,
  b?: string | null,
): string {
  return pickLiveLogoUrl(a, b)
}

const BRAND_SYNC_KEY = 'tvetflow_institution_brand'
const BRAND_SYNC_EVENT = 'tvetflow-institution-brand'
const BRAND_SYNC_CHANNEL = 'tvetflow-institution-brand'

export type InstitutionBrandPatch = {
  id?: string | null
  logo_url?: string | null
  name?: string | null
  at?: number
}

export function readPublishedInstitutionBrand(): InstitutionBrandPatch | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(BRAND_SYNC_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as InstitutionBrandPatch
  } catch {
    return null
  }
}

type Brandable = {
  id?: unknown
  logo_url?: string | null
  name?: string | null
}

/** Apply a settings save onto an institution row (header / login / footer). */
export function applyBrandPatch<T extends Brandable>(
  prev: T | null | undefined,
  patch: InstitutionBrandPatch | null | undefined,
): T | null | undefined {
  if (!prev || !patch) return prev
  if (patch.id && prev.id != null && String(patch.id) !== String(prev.id)) return prev
  const next = { ...prev }
  if (patch.logo_url !== undefined) {
    const cleared = patch.logo_url === '' || patch.logo_url === null
    next.logo_url = cleared ? patch.logo_url : pickLiveLogoUrl(prev.logo_url, patch.logo_url, patch.at)
  }
  if (patch.name) next.name = patch.name
  return next
}

export function mergeInstitutionWithPublishedBrand<T extends Brandable>(inst: T | null): T | null {
  if (!inst) return inst
  return (applyBrandPatch(inst, readPublishedInstitutionBrand()) as T) || inst
}

/** Same-browser tabs: settings save → landing/login pick up the new logo immediately. */
export function publishInstitutionBrand(patch: InstitutionBrandPatch): void {
  if (typeof window === 'undefined') return
  const payload: InstitutionBrandPatch = { ...patch, at: Date.now() }
  try {
    localStorage.setItem(BRAND_SYNC_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new CustomEvent(BRAND_SYNC_EVENT, { detail: payload }))
  try {
    const ch = new BroadcastChannel(BRAND_SYNC_CHANNEL)
    ch.postMessage(payload)
    ch.close()
  } catch {
    /* unsupported */
  }
}

export function subscribeInstitutionBrand(
  onBrand: (patch: InstitutionBrandPatch) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const apply = (raw: unknown) => {
    if (!raw || typeof raw !== 'object') return
    onBrand(raw as InstitutionBrandPatch)
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key !== BRAND_SYNC_KEY || !e.newValue) return
    try {
      apply(JSON.parse(e.newValue))
    } catch {
      /* ignore */
    }
  }
  const onCustom = (e: Event) => apply((e as CustomEvent).detail)
  window.addEventListener('storage', onStorage)
  window.addEventListener(BRAND_SYNC_EVENT, onCustom)
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(BRAND_SYNC_CHANNEL)
    channel.onmessage = (e) => apply(e.data)
  } catch {
    channel = null
  }
  const stored = readPublishedInstitutionBrand()
  if (stored) {
    queueMicrotask(() => apply(stored))
  }
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(BRAND_SYNC_EVENT, onCustom)
    try {
      channel?.close()
    } catch {
      /* ignore */
    }
  }
}

/** Display URL so a replaced logo is not stuck behind CDN/browser cache. */
export function brandedImageSrc(url?: string | null): string {
  const src = String(url || '').trim()
  if (!src || src.startsWith('blob:') || src.startsWith('data:')) return src
  const [base, existing] = src.split('?')
  const stamp = base.match(/-(\d{10,})\.[a-z0-9]+$/i)?.[1]
  const published = readPublishedInstitutionBrand()
  const publishedSame =
    published?.logo_url && institutionLogoUrl(published.logo_url).split('?')[0] === base
  const v =
    (publishedSame && published?.at ? String(published.at) : '') ||
    stamp ||
    base.replace(/^.*\//, '').slice(-24)
  const params = new URLSearchParams(existing || '')
  params.set('v', v)
  return `${base}?${params.toString()}`
}

/**
 * Brand title for printed documents: show institution name ONLY when there is no logo.
 * Logo and plain name must never appear together (logo often already includes the name).
 */
export function getDocumentInstitutionTitle(
  institution?: InstitutionBrand,
  fallback = 'Training Center',
): string {
  if (hasInstitutionLogo(institution)) return ''
  return getInstitutionDisplayName(institution, fallback)
}

function clampSocial(value?: string | null): string {
  return String(value || '').trim().slice(0, 500)
}

function withHttps(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url.replace(/^\/+/, '')}`
}

/** WhatsApp chat URL from a full link or phone number. */
export function normalizeWhatsAppHref(value?: string | null): string {
  const raw = clampSocial(value)
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || /^wa\.me\//i.test(raw)) return withHttps(raw)
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length >= 8 && digits.length <= 15) return `https://wa.me/${digits}`
  return ''
}

export function normalizeHttpHref(value?: string | null, hostHint?: string): string {
  const raw = clampSocial(value)
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (hostHint === 'www.tiktok.com' && !raw.includes('.')) {
    return `https://www.tiktok.com/@${raw.replace(/^@/, '')}`
  }
  if (hostHint && !raw.includes('.')) return `https://${hostHint}/${raw.replace(/^@/, '')}`
  return withHttps(raw)
}

export type InstitutionSocialLink = {
  id: 'whatsapp' | 'facebook' | 'tiktok'
  label: string
  href: string
}

export function institutionSocialLinks(
  institution?: InstitutionBrand | {
    social_whatsapp?: string | null
    social_facebook?: string | null
    social_tiktok?: string | null
  },
): InstitutionSocialLink[] {
  const row = institution || {}
  const items: InstitutionSocialLink[] = []
  const wa = normalizeWhatsAppHref(row.social_whatsapp)
  const fb = normalizeHttpHref(row.social_facebook, 'facebook.com')
  const tt = normalizeHttpHref(row.social_tiktok, 'www.tiktok.com')
  if (wa) items.push({ id: 'whatsapp', label: 'WhatsApp', href: wa })
  if (fb) items.push({ id: 'facebook', label: 'Facebook', href: fb })
  if (tt) items.push({ id: 'tiktok', label: 'TikTok', href: tt })
  return items
}

export function getInstitutionPrimary(institution?: InstitutionBrand): string {
  return String(institution?.theme_primary || '').trim() || DEFAULT_PRIMARY
}

export function getInstitutionAccent(institution?: InstitutionBrand): string {
  return String(institution?.theme_accent || '').trim() || DEFAULT_ACCENT
}

export function getInstitutionTertiary(institution?: InstitutionBrand): string {
  return String(institution?.theme_tertiary || '').trim()
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

/**
 * Tenant login URL for emails and share links.
 * Production: https://{sub}.{root}/login
 * Local / no root: https://origin/login?tenant={sub}
 */
export function getTenantLoginUrl(institution?: InstitutionBrand): string {
  const subdomain = String(institution?.subdomain || '').trim().toLowerCase()
  if (usesTenantSubdomainHosts() && subdomain) {
    return `${getTenantBaseUrl({ subdomain })}/login`
  }
  if (subdomain) {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : `https://${getAppRootDomain()}`
    return `${origin}/login?tenant=${encodeURIComponent(subdomain)}`
  }
  if (typeof window !== 'undefined') return `${window.location.origin}/login`
  return '/login'
}

const LAST_TENANT_KEY = 'tvetflow_last_tenant'

/** Remember active tenant for post-logout return to institution landing. */
export function rememberTenantSubdomain(subdomain?: string | null): void {
  if (typeof window === 'undefined') return
  const s = String(subdomain || '').trim().toLowerCase()
  if (s) sessionStorage.setItem(LAST_TENANT_KEY, s)
  else sessionStorage.removeItem(LAST_TENANT_KEY)
}

export function getRememberedTenantSubdomain(): string {
  if (typeof window === 'undefined') return ''
  return String(sessionStorage.getItem(LAST_TENANT_KEY) || '').trim().toLowerCase()
}

/** True when production custom domain hosts tenants as {slug}.{root}. */
export function usesTenantSubdomainHosts(): boolean {
  const root = String(import.meta.env.VITE_APP_ROOT_DOMAIN || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .toLowerCase()
  if (!root) return false
  if (root.startsWith('localhost') || root.startsWith('127.0.0.1')) return false
  return true
}

/** True when the browser is already on this tenant's subdomain host. */
export function isOnTenantHost(subdomain?: string | null): boolean {
  if (typeof window === 'undefined') return false
  const sub = String(subdomain || '').trim().toLowerCase()
  if (!sub || !usesTenantSubdomainHosts()) return false
  const root = getAppRootDomain().toLowerCase()
  return window.location.hostname.toLowerCase() === `${sub}.${root}`
}

/**
 * Public institution portal URL (prefer subdomain on custom domain).
 * Localhost / no root domain → same origin with ?tenant=slug.
 */
export function getTenantPortalUrl(institution?: InstitutionBrand): string {
  const subdomain = String(institution?.subdomain || '').trim().toLowerCase()
  if (!subdomain) {
    if (typeof window !== 'undefined') return window.location.origin
    return '/'
  }
  if (usesTenantSubdomainHosts()) {
    return getTenantBaseUrl({ subdomain })
  }
  const origin =
    typeof window !== 'undefined' ? window.location.origin : `https://${getAppRootDomain()}`
  return `${origin}/?tenant=${encodeURIComponent(subdomain)}`
}

/**
 * Where to send users after logout / “view landing”.
 * Custom domain → https://{sub}.{root} (or "/" if already there).
 * Local / Vercel-only → /?tenant=slug (query fallback).
 */
export function getTenantLandingPath(
  institution?: InstitutionBrand,
  role?: string | null,
): string {
  if (role === 'super_admin') return '/login'
  const subdomain =
    String(institution?.subdomain || '').trim().toLowerCase() || getRememberedTenantSubdomain()
  if (!subdomain) return '/login'
  if (usesTenantSubdomainHosts()) {
    if (isOnTenantHost(subdomain)) return '/'
    return getTenantBaseUrl({ subdomain })
  }
  return `/?tenant=${encodeURIComponent(subdomain)}`
}

/** Hard-navigate when landing is on another subdomain; otherwise use React Router. */
export function goToTenantLanding(
  institution?: InstitutionBrand,
  role?: string | null,
  navigate?: (to: string, opts?: { replace?: boolean }) => void,
  replace = true,
): void {
  const to = getTenantLandingPath(institution, role)
  if (/^https?:\/\//i.test(to)) {
    window.location.assign(to)
    return
  }
  if (navigate) navigate(to, { replace })
  else window.location.assign(to)
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
    // Query tenant only when not already on a dedicated tenant host URL
    if (!usesTenantSubdomainHosts()) {
      const tenant =
        String(institution?.subdomain || '').trim().toLowerCase() ||
        resolvePublicTenantSubdomain() ||
        ''
      if (tenant) params.set('tenant', tenant)
    }
    const qs = params.toString()
    return qs ? `${base}/verify-credential?${qs}` : `${base}/verify-credential`
  }
  return `${base}/verify/${encodeURIComponent(id)}`
}

/** Hosts that are the platform itself — never treat the first DNS label as a tenant. */
function isPlatformDeploymentHost(host: string): boolean {
  const h = host.toLowerCase()
  if (
    h.endsWith('.vercel.app') ||
    h.endsWith('.netlify.app') ||
    h.endsWith('.pages.dev') ||
    h.endsWith('.web.app')
  ) {
    return true
  }
  const root = String(import.meta.env.VITE_APP_ROOT_DOMAIN || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .toLowerCase()
  if (root && (h === root || h === `www.${root}`)) return true
  return false
}

/**
 * Resolve tenant subdomain for public (anon) pages.
 * Priority: ?tenant= / ?subdomain= → hostname label (custom domain only) → VITE_DEFAULT_TENANT_SUBDOMAIN.
 *
 * On Vercel/Netlify apex hosts (e.g. institute-system.vercel.app), hostname is NOT a tenant —
 * use ?tenant=slug or a real custom domain like brce.yourdomain.com.
 */
export function resolvePublicTenantSubdomain(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = String(params.get('tenant') || params.get('subdomain') || '')
      .trim()
      .toLowerCase()
    if (fromQuery) return fromQuery

    const host = window.location.hostname
    if (
      host &&
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      !/^\d+\.\d+\.\d+\.\d+$/.test(host) &&
      !isPlatformDeploymentHost(host)
    ) {
      const root = String(import.meta.env.VITE_APP_ROOT_DOMAIN || '')
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/$/, '')
        .toLowerCase()
      if (root && host.toLowerCase().endsWith(`.${root}`)) {
        const sub = host.slice(0, -(root.length + 1)).toLowerCase()
        if (sub && !sub.includes('.')) return sub
      } else if (!root) {
        const parts = host.split('.')
        if (parts.length >= 3) return parts[0].toLowerCase()
      }
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

export function formatCertificateSerial(n?: number | null, pad = 4): string {
  const v = Math.max(1, Math.floor(Number(n) || 1))
  const width = Math.min(9, Math.max(1, Math.floor(Number(pad) || 4)))
  return String(v).padStart(Math.max(width, String(v).length), '0')
}

export function parseCertificateNumberStart(raw: string): { start: number; pad: number } {
  const digits = String(raw || '').replace(/\D/g, '')
  const start = Math.max(1, Math.floor(Number(digits || '1')))
  if (!Number.isFinite(start) || start > 999999999) {
    throw new Error('INVALID_CERTIFICATE_START')
  }
  const pad = Math.min(9, Math.max(4, digits.length || 4))
  return { start, pad }
}

export function nextCertificateSerialPreview(institution?: InstitutionBrand): string {
  const start = Math.max(1, Math.floor(Number(institution?.certificate_number_start) || 1))
  const last = Math.max(0, Math.floor(Number(institution?.certificate_number_last) || 0))
  const pad = Math.min(9, Math.max(1, Math.floor(Number(institution?.certificate_number_pad) || 4)))
  return formatCertificateSerial(Math.max(last, start - 1) + 1, pad)
}

export function institutionNameInitials(name?: string | null): string {
  const words = String(name || '')
    .replace(/[^A-Za-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return 'ST'
  let out = words.map((w) => w[0]).join('').toUpperCase()
  if (out.length < 2) out = words[0].slice(0, 2).toUpperCase()
  return (out || 'ST').slice(0, 4)
}

export function formatStudentIdSample(prefix: string, n: number, pad = 3): string {
  const serial = String(Math.max(1, Math.floor(Number(n) || 1)))
  const width = Math.min(9, Math.max(1, Math.floor(Number(pad) || 3)))
  return `${prefix || ''}${serial.padStart(Math.max(width, serial.length), '0')}`
}

export function defaultStudentIdSample(institutionName?: string | null): string {
  return formatStudentIdSample(institutionNameInitials(institutionName), 123, 3)
}

export function parseStudentIdSample(raw: string): { prefix: string; start: number; pad: number } {
  const sample = String(raw || '').trim()
  const m = sample.match(/^([A-Za-z]{0,12})(\d{1,9})$/)
  if (!m) throw new Error('INVALID_STUDENT_ID_SAMPLE')
  const prefix = m[1]
  const start = Math.floor(Number(m[2]))
  if (!Number.isFinite(start) || start < 1) throw new Error('INVALID_STUDENT_ID_SAMPLE')
  return { prefix, start, pad: m[2].length }
}

export function nextStudentIdPreview(institution?: InstitutionBrand, sample?: string): string {
  let prefix = institution?.student_id_prefix
  let start = Math.max(1, Math.floor(Number(institution?.student_id_start) || 123))
  let pad = Math.min(9, Math.max(1, Math.floor(Number(institution?.student_id_pad) || 3)))
  if (sample != null && String(sample).trim()) {
    try {
      const parsed = parseStudentIdSample(sample)
      prefix = parsed.prefix
      start = parsed.start
      pad = parsed.pad
    } catch {
      /* keep institution values */
    }
  } else if (prefix == null) {
    prefix = institutionNameInitials(institution?.name)
    start = 123
    pad = 3
  }
  const last = Math.max(0, Math.floor(Number(institution?.student_id_last) || 0))
  return formatStudentIdSample(prefix || '', Math.max(last, start - 1) + 1, pad)
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
