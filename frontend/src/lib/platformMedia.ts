import { supabase } from '@/lib/supabaseClient'

/** Documentary photo defaults for the public platform site. */
export const PLATFORM_PHOTO_DEFAULTS = {
  hero: '/platform/hero-dashboard.jpg',
  workshop:
    'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1600&q=80',
  classroom:
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1600&q=80',
  students:
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80',
  operations:
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80',
  workshopAlt:
    'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1600&q=80',
  lecture:
    'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=80',
  about:
    'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1600&q=80',
  login: null as string | null,
} as const

export type PlatformPhotoKey = keyof typeof PLATFORM_PHOTO_DEFAULTS

export type SiteTrustedItem = {
  id: string
  /** Optional alt text only — landing shows logos, not names. */
  name?: string | null
  logo_url: string
}

export type SiteCmsData = {
  trusted: SiteTrustedItem[]
  photos: Record<PlatformPhotoKey, string | null>
}

/** @deprecated Prefer resolvePlatformPhotos() from CMS — kept for static fallbacks. */
export const PLATFORM_PHOTOS = { ...PLATFORM_PHOTO_DEFAULTS }

const PHOTO_KEYS = Object.keys(PLATFORM_PHOTO_DEFAULTS) as PlatformPhotoKey[]

function normalizePhotos(raw: unknown): Record<PlatformPhotoKey, string | null> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out = { ...PLATFORM_PHOTO_DEFAULTS } as Record<PlatformPhotoKey, string | null>
  for (const key of PHOTO_KEYS) {
    const v = src[key]
    if (typeof v === 'string' && v.trim()) out[key] = v.trim()
    else if (v === null && key === 'login') out[key] = null
  }
  return out
}

function normalizeTrusted(raw: unknown): SiteTrustedItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, i) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const logo_url =
        typeof row.logo_url === 'string' && row.logo_url.trim() ? row.logo_url.trim() : ''
      if (!logo_url) return null
      const name = String(row.name || '').trim()
      return {
        id: String(row.id || `t-${i}`),
        name: name || null,
        logo_url,
      } satisfies SiteTrustedItem
    })
    .filter(Boolean) as SiteTrustedItem[]
}

export function resolvePlatformPhotos(photos?: Partial<Record<PlatformPhotoKey, string | null>> | null) {
  return normalizePhotos(photos)
}

/** Public marketing CMS (Trusted logos + site photos). Safe for anon. */
export async function getPublicSiteCms(): Promise<SiteCmsData> {
  const { data, error } = await supabase.rpc('get_public_site_cms')
  if (error) throw error
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  return {
    trusted: normalizeTrusted(payload.trusted),
    photos: normalizePhotos(payload.photos),
  }
}
