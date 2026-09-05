import React, { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Loader2, AlertCircle, Plus, Trash2, Upload, ImageIcon } from 'lucide-react'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { getSystemSettings, saveSiteCms, uploadPlatformAsset } from '@/lib/superAdminApi'
import {
  PLATFORM_PHOTO_DEFAULTS,
  type PlatformPhotoKey,
  type SiteTrustedItem,
} from '@/lib/platformMedia'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const PHOTO_FIELDS: { key: PlatformPhotoKey; label: string; hint: string }[] = [
  { key: 'hero', label: 'Home hero', hint: 'Landing page hero (desktop + mobile mockup)' },
  { key: 'workshop', label: 'Workshop', hint: 'Home + Features gallery' },
  { key: 'classroom', label: 'Classroom', hint: 'Home + Features' },
  { key: 'students', label: 'Students', hint: 'Home gallery' },
  { key: 'operations', label: 'Operations desk', hint: 'Home + Features' },
  { key: 'lecture', label: 'Lecture / credentials', hint: 'Features page' },
  { key: 'about', label: 'About hero', hint: 'About page' },
  { key: 'workshopAlt', label: 'Workshop (alt)', hint: 'Optional alternate' },
  { key: 'login', label: 'Login side image', hint: 'Platform /login left panel (optional)' },
]

function newTrustedId() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

const SiteCmsPage = () => {
  const { toast } = useToast()
  const [trusted, setTrusted] = useState<SiteTrustedItem[]>([])
  const [photos, setPhotos] = useState<Record<PlatformPhotoKey, string | null>>({
    ...PLATFORM_PHOTO_DEFAULTS,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    ;(async () => {
      try {
        const s = await getSystemSettings()
        const t = Array.isArray(s.site_trusted) ? s.site_trusted : []
        setTrusted(
          t
            .map((row: any, i: number) => {
              const logo_url = typeof row?.logo_url === 'string' ? row.logo_url.trim() : ''
              if (!logo_url) return null
              return {
                id: String(row?.id || `t-${i}`),
                name: String(row?.name || '').trim() || null,
                logo_url,
              }
            })
            .filter(Boolean) as SiteTrustedItem[]
        )
        const p = s.site_photos && typeof s.site_photos === 'object' ? s.site_photos : {}
        setPhotos({
          ...PLATFORM_PHOTO_DEFAULTS,
          ...Object.fromEntries(
            Object.entries(PLATFORM_PHOTO_DEFAULTS).map(([k, fallback]) => {
              const v = p[k]
              if (typeof v === 'string' && v.trim()) return [k, v.trim()]
              if (k === 'login' && (v === null || v === '')) return [k, null]
              return [k, fallback]
            })
          ),
        } as Record<PlatformPhotoKey, string | null>)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const pickFile = (key: string) => fileRefs.current[key]?.click()

  const onUpload = async (key: string, file: File | undefined, apply: (url: string) => void) => {
    if (!file) return
    setUploading(key)
    try {
      const url = await uploadPlatformAsset(file, key)
      if (!url) throw new Error('UPLOAD_FAILED')
      apply(url)
      toast({ title: 'Uploaded', description: 'Image is ready. Click Save to publish.' })
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setUploading(null)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const cleanTrusted = trusted
        .filter((row) => typeof row.logo_url === 'string' && row.logo_url.trim())
        .map((row) => ({
          id: row.id || newTrustedId(),
          name: row.name || null,
          logo_url: row.logo_url.trim(),
        }))
      await saveSiteCms(cleanTrusted, photos)
      setTrusted(cleanTrusted)
      toast({ title: 'Success', description: 'Logos published on the public landing.' })
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Site CMS</title>
      </Helmet>

      <PageHeader
        title="Site CMS"
        subtitle="Manage Trusted-by logos and photos on the public platform site. Uploads go to platform storage; Save publishes them."
        action={
          <Button onClick={handleSave} disabled={saving || !!uploading} className="bg-indigo-600 hover:bg-indigo-500">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & publish'}
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load Site CMS</AlertTitle>
          <AlertDescription>{getUserMessage(error, { fallback: MESSAGES.LOAD_FAILED })}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6">
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base text-white">Trusted by</CardTitle>
              <CardDescription>
                Upload partner logos only. After Save, they replace the text row on the home page.
              </CardDescription>
            </div>
            <div>
              <input
                ref={(el) => {
                  fileRefs.current['trusted-add'] = el
                }}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  const id = newTrustedId()
                  void onUpload(`trusted-${id}`, file, (url) => {
                    setTrusted((prev) => [...prev, { id, name: null, logo_url: url }])
                  })
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-700"
                disabled={!!uploading}
                onClick={() => pickFile('trusted-add')}
              >
                {uploading === 'trusted-add' || (uploading?.startsWith('trusted-') && !trusted.some((t) => `trusted-${t.id}` === uploading)) ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Upload logo
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {trusted.length === 0 ? (
              <p className="text-sm text-slate-400">No logos yet. Click Upload logo, then Save &amp; publish.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trusted.map((row) => (
                  <div
                    key={row.id}
                    className="relative rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1 z-10 h-8 w-8 text-slate-400 hover:text-red-400"
                      onClick={() => setTrusted((prev) => prev.filter((item) => item.id !== row.id))}
                      aria-label="Remove logo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="flex aspect-[3/2] items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                      <img
                        src={row.logo_url}
                        alt=""
                        className="max-h-full max-w-full object-contain p-3"
                      />
                    </div>
                    <input
                      ref={(el) => {
                        fileRefs.current[`trusted-${row.id}`] = el
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        void onUpload(`trusted-${row.id}`, file, (url) => {
                          setTrusted((prev) =>
                            prev.map((item) => (item.id === row.id ? { ...item, logo_url: url } : item))
                          )
                        })
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full border-slate-700"
                      disabled={uploading === `trusted-${row.id}`}
                      onClick={() => pickFile(`trusted-${row.id}`)}
                    >
                      {uploading === `trusted-${row.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          Replace
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-base text-white">Site photos</CardTitle>
            <CardDescription>
              Replace Unsplash defaults used on Home, Features, About, and the platform login page.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PHOTO_FIELDS.map((field) => {
              const url = photos[field.key]
              const busy = uploading === `photo-${field.key}`
              return (
                <div key={field.key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                    {url ? (
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white">{field.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{field.hint}</p>
                  <input
                    ref={(el) => {
                      fileRefs.current[`photo-${field.key}`] = el
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      void onUpload(`photo-${field.key}`, file, (nextUrl) => {
                        setPhotos((prev) => ({ ...prev, [field.key]: nextUrl }))
                      })
                    }}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-slate-700"
                      disabled={busy}
                      onClick={() => pickFile(`photo-${field.key}`)}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Upload'}
                    </Button>
                    {field.key === 'login' && url ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-slate-400"
                        onClick={() => setPhotos((prev) => ({ ...prev, login: null }))}
                      >
                        Clear
                      </Button>
                    ) : null}
                    {field.key !== 'login' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-slate-400"
                        onClick={() =>
                          setPhotos((prev) => ({
                            ...prev,
                            [field.key]: PLATFORM_PHOTO_DEFAULTS[field.key],
                          }))
                        }
                      >
                        Reset
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  )
}

export default SiteCmsPage
