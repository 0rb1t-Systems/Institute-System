import React, { useEffect, useMemo, useState } from 'react'
import { Check, ImagePlus, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import TenantLandingRenderer from '@/components/landing/TenantLandingRenderer'
import LogoBrandColorPicker from '@/components/admin/LogoBrandColorPicker'
import type { LandingInstitution } from '@/components/landing/types'
import {
  LANDING_TEMPLATES,
  getLandingTemplate,
  type LandingTemplateId,
} from '@/lib/landingTemplates'
import { extractLogoBrandPalette } from '@/lib/logoBrandColors'
import { brandedImageSrc } from '@/lib/institution'
import { uploadInstitutionAsset } from '@/lib/api'
import {
  EMPTY_LANDING_CONTENT,
  emptyLandingProgram,
  sanitizeLandingContent,
  type LandingContent,
  type LandingProgramIconId,
} from '@/lib/landingContent'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import { LANDING_PROGRAM_ICON_OPTIONS } from '@/components/landing/landingProgramIcons'
import { useToast } from '@/components/ui/use-toast'

export type LandingCustomizeValues = {
  landing_template_id: LandingTemplateId
  hero_headline: string
  footer_text: string
  description: string
  theme_primary: string
  theme_accent: string
  theme_tertiary: string
  social_whatsapp: string
  social_facebook: string
  social_tiktok: string
  logoPreviewUrl: string | null
  heroPreviewUrl: string | null
  logoFile: File | null
  heroFile: File | null
  programImageFiles: Record<number, File>
  landing_content: LandingContent
}

const titleCls = 'text-[var(--tenant-text)] [.platform-public_&]:text-[var(--pf-text)]'
const mutedCls = 'text-[var(--tenant-muted)] [.platform-public_&]:text-[var(--pf-muted)]'
const labelCls = 'text-[var(--tenant-text)] [.platform-public_&]:text-[var(--pf-text)]'
const cardCls =
  'rounded-2xl border border-[var(--tenant-line)] bg-[var(--tenant-surface)] [.platform-public_&]:border-[var(--pf-line)] [.platform-public_&]:bg-[var(--pf-surface)]'
const fieldCls =
  'border-[var(--tenant-line)] bg-[var(--tenant-bg)] text-[var(--tenant-text)] placeholder:text-[var(--tenant-muted)] [.platform-public_&]:border-[var(--pf-line)] [.platform-public_&]:bg-[var(--pf-bg)] [.platform-public_&]:text-[var(--pf-text)]'
const fileFieldCls = `${fieldCls} text-sm file:mr-3 file:rounded file:border-0 file:bg-teal-500/20 file:px-2 file:py-1 file:text-teal-700 [html[data-platform-theme='dark']_&]:file:text-teal-200`

type Props = {
  baseInstitution: LandingInstitution
  values: LandingCustomizeValues
  onChange: (patch: Partial<LandingCustomizeValues>) => void
  compact?: boolean
}

function fileToObjectUrl(file: File | null, prev: string | null) {
  if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
  if (!file) return null
  return URL.createObjectURL(file)
}

/**
 * Create / admin editor: large live design preview on top, then cards + branding fields.
 */
export default function LandingTemplatePicker({ baseInstitution, values, onChange }: Props) {
  const meta = getLandingTemplate(values.landing_template_id)
  const { toast } = useToast()
  const [logoSwatches, setLogoSwatches] = useState<string[]>([])
  const [detectingColors, setDetectingColors] = useState(false)
  const [uploadingProgram, setUploadingProgram] = useState<number | null>(null)
  const content = sanitizeLandingContent(values.landing_content)

  const setContent = (patch: Partial<LandingContent>) => {
    onChange({ landing_content: { ...content, ...patch } })
  }

  const previewInstitution: LandingInstitution = useMemo(() => {
    const landingContent = sanitizeLandingContent(values.landing_content)
    return {
      ...baseInstitution,
      landing_template_id: values.landing_template_id,
      hero_headline: values.hero_headline || null,
      footer_text: values.footer_text || null,
      description: values.description || baseInstitution.description || null,
      theme_primary: values.theme_primary || meta.defaultPrimary,
      theme_accent: values.theme_accent || meta.defaultAccent,
      theme_tertiary: values.theme_tertiary || null,
      social_whatsapp: values.social_whatsapp || baseInstitution.social_whatsapp || null,
      social_facebook: values.social_facebook || baseInstitution.social_facebook || null,
      social_tiktok: values.social_tiktok || baseInstitution.social_tiktok || null,
      logo_url: values.logoPreviewUrl || baseInstitution.logo_url || null,
      hero_image_url: values.heroPreviewUrl || null,
      landing_content: landingContent,
    }
  }, [baseInstitution, values, meta.defaultPrimary, meta.defaultAccent])

  useEffect(() => {
    return () => {
      if (values.logoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(values.logoPreviewUrl)
      if (values.heroPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(values.heroPreviewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const src = values.logoFile || values.logoPreviewUrl
    if (!src) {
      setLogoSwatches([])
      return
    }
    let cancelled = false
    extractLogoBrandPalette(src).then((palette) => {
      if (!cancelled && palette?.swatches?.length) setLogoSwatches(palette.swatches)
    })
    return () => {
      cancelled = true
    }
  }, [values.logoFile, values.logoPreviewUrl])

  const onLogo = (file: File | null) => {
    const url = fileToObjectUrl(file, values.logoPreviewUrl)
    onChange({ logoFile: file, logoPreviewUrl: url })
    if (!file) {
      setLogoSwatches([])
      return
    }
    setDetectingColors(true)
    extractLogoBrandPalette(file)
      .then((palette) => {
        if (!palette) return
        setLogoSwatches(palette.swatches)
        onChange({
          logoFile: file,
          logoPreviewUrl: url,
          theme_primary: palette.primary,
          theme_accent: palette.accent,
          theme_tertiary: palette.tertiary || '',
        })
      })
      .finally(() => setDetectingColors(false))
  }

  const onHero = (file: File | null) => {
    const url = fileToObjectUrl(file, values.heroPreviewUrl)
    onChange({ heroFile: file, heroPreviewUrl: url })
  }

  const selectTemplate = (id: LandingTemplateId) => {
    const t = getLandingTemplate(id)
    const keepBrand = Boolean(values.logoFile || values.logoPreviewUrl)
    onChange({
      landing_template_id: id,
      theme_primary: keepBrand ? values.theme_primary : t.defaultPrimary,
      theme_accent: keepBrand ? values.theme_accent : t.defaultAccent,
      theme_tertiary: keepBrand ? values.theme_tertiary : '',
      hero_headline: values.hero_headline?.trim() ? values.hero_headline : t.defaultHeadline,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`font-display text-xl font-bold sm:text-2xl ${titleCls}`}>Choose a landing template</h2>
        <p className={`mt-1 text-sm ${mutedCls}`}>
          Design preview updates at the top when you select a template. Upload your logo so branding appears live.
        </p>
      </div>

      {/* Large design preview on top */}
      <div className={`overflow-hidden shadow-2xl ${cardCls}`}>
        <div className="flex items-center justify-between border-b border-[var(--tenant-line)] px-4 py-2.5 [.platform-public_&]:border-[var(--pf-line)]">
          <p className={`text-xs font-medium ${mutedCls}`}>
            Design preview · <span className={titleCls}>{meta.name}</span>
          </p>
          <p className={`hidden text-[11px] sm:block ${mutedCls}`}>{meta.tagline}</p>
        </div>
        <div className="max-h-[38vh] overflow-y-auto">
          <div className="pointer-events-none select-none">
            <TenantLandingRenderer
              institution={previewInstitution}
              preview
              templateId={values.landing_template_id}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LANDING_TEMPLATES.map((t) => {
          const selected = values.landing_template_id === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTemplate(t.id)}
              className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                selected
                  ? 'border-teal-400/70 bg-teal-500/10 ring-2 ring-teal-400/40'
                  : 'border-[var(--tenant-line)] bg-[var(--tenant-bg)] hover:border-[color-mix(in_srgb,var(--tenant-text)_25%,transparent)] [.platform-public_&]:border-[var(--pf-line)] [.platform-public_&]:bg-[var(--pf-bg)]'
              }`}
            >
              <div
                className="mb-3 h-20 rounded-xl bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${t.defaultPrimary}aa, transparent 55%), url(${t.defaultHeroImage})`,
                }}
              />
              <p className={`text-sm font-semibold ${titleCls}`}>{t.name}</p>
              <p className={`mt-0.5 text-xs leading-snug ${mutedCls}`}>{t.tagline}</p>
              {selected && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-teal-400 text-[#04201c]">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className={`grid gap-5 p-5 lg:grid-cols-2 ${cardCls}`}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className={labelCls}>Institution logo *</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--tenant-bg)] ring-1 ring-[var(--tenant-line)] [.platform-public_&]:bg-[var(--pf-bg)] [.platform-public_&]:ring-[var(--pf-line)]">
                {previewInstitution.logo_url ? (
                  <img src={brandedImageSrc(previewInstitution.logo_url)} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Upload className={`h-5 w-5 ${mutedCls}`} />
                )}
              </div>
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className={fileFieldCls}
                  onChange={(e) => onLogo(e.target.files?.[0] || null)}
                />
                <p className={`mt-1 text-[11px] ${mutedCls}`}>
                  PNG, JPG, WebP or SVG · max 5MB. Brand colors are detected from the logo.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className={labelCls}>Hero image (optional)</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-xl bg-[var(--tenant-bg)] ring-1 ring-[var(--tenant-line)] [.platform-public_&]:bg-[var(--pf-bg)] [.platform-public_&]:ring-[var(--pf-line)]">
                {values.heroPreviewUrl ? (
                  <img src={values.heroPreviewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className={`h-5 w-5 ${mutedCls}`} />
                )}
              </div>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className={fileFieldCls}
                onChange={(e) => onHero(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <LogoBrandColorPicker
            primary={values.theme_primary || meta.defaultPrimary}
            accent={values.theme_accent || meta.defaultAccent}
            tertiary={values.theme_tertiary}
            swatches={logoSwatches}
            detecting={detectingColors}
            onPrimaryChange={(hex) => onChange({ theme_primary: hex })}
            onAccentChange={(hex) => onChange({ theme_accent: hex })}
            onTertiaryChange={(hex) => onChange({ theme_tertiary: hex })}
            primaryId="landing_theme_primary"
            accentId="landing_theme_accent"
            tertiaryId="landing_theme_tertiary"
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className={labelCls}>Hero headline</Label>
            <Input
              value={values.hero_headline}
              onChange={(e) => onChange({ hero_headline: e.target.value })}
              placeholder={meta.defaultHeadline}
              className={fieldCls}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Short description</Label>
            <Textarea
              value={values.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Quality education, professional training, and trusted credentials."
              className={`min-h-[72px] ${fieldCls}`}
            />
          </div>
          <div className="space-y-2">
            <Label className={labelCls}>Footer text</Label>
            <Textarea
              value={values.footer_text}
              onChange={(e) => onChange({ footer_text: e.target.value })}
              placeholder="Official public portal for verification and secure access."
              className={`min-h-[64px] ${fieldCls}`}
            />
          </div>
        </div>
      </div>

      <div className={`space-y-5 p-5 ${cardCls}`}>
        <div>
          <h3 className={`text-sm font-semibold ${titleCls}`}>About page</h3>
          <p className={`mt-1 text-xs ${mutedCls}`}>
            Optional. Leave blank to hide the About section on the public landing page.
          </p>
        </div>
        <div className="space-y-2">
          <Label className={labelCls}>About title</Label>
          <Input
            value={content.about_title}
            maxLength={80}
            onChange={(e) => setContent({ about_title: e.target.value })}
            placeholder={`About ${baseInstitution.name || 'our institution'}`}
            className={fieldCls}
          />
        </div>
        <div className="space-y-2">
          <Label className={labelCls}>About story</Label>
          <Textarea
            value={content.about_body}
            maxLength={4000}
            onChange={(e) => setContent({ about_body: e.target.value })}
            placeholder="Share your mission, history, and what makes this institution distinctive."
            className={`min-h-[120px] ${fieldCls}`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {content.about_highlights.slice(0, 4).map((h, i) => (
            <div key={i} className="space-y-2">
              <Label className={labelCls}>Highlight {i + 1}</Label>
              <Input
                value={h}
                maxLength={90}
                onChange={(e) => {
                  const next = [...content.about_highlights]
                  next[i] = e.target.value
                  setContent({ about_highlights: next })
                }}
                placeholder="e.g. Practical skills"
                className={fieldCls}
              />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-[var(--tenant-line)] bg-[var(--tenant-bg)] p-4 [.platform-public_&]:border-[var(--pf-line)] [.platform-public_&]:bg-[var(--pf-bg)]">
          <div>
            <p className={`text-sm font-semibold ${titleCls}`}>Social media icons</p>
            <p className={`mt-1 text-xs ${mutedCls}`}>
              Add your links. Animated icons appear on the About section, hero, and footer of every landing template. Leave blank to hide.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className={labelCls} htmlFor="landing_social_whatsapp">WhatsApp</Label>
              <Input
                id="landing_social_whatsapp"
                value={values.social_whatsapp || ''}
                onChange={(e) => onChange({ social_whatsapp: e.target.value })}
                placeholder="25261xxxxxxx or https://wa.me/..."
                className={fieldCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls} htmlFor="landing_social_facebook">Facebook</Label>
              <Input
                id="landing_social_facebook"
                value={values.social_facebook || ''}
                onChange={(e) => onChange({ social_facebook: e.target.value })}
                placeholder="https://facebook.com/yourpage"
                className={fieldCls}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelCls} htmlFor="landing_social_tiktok">TikTok</Label>
              <Input
                id="landing_social_tiktok"
                value={values.social_tiktok || ''}
                onChange={(e) => onChange({ social_tiktok: e.target.value })}
                placeholder="https://tiktok.com/@yourpage"
                className={fieldCls}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`space-y-5 p-5 ${cardCls}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-sm font-semibold ${titleCls}`}>Programs page</h3>
            <p className={`mt-1 text-xs ${mutedCls}`}>
              Optional. Add up to 8 programs with a photo and icon. Leave empty to hide Programs on the landing page.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[var(--tenant-line)] bg-transparent text-[var(--tenant-text)] [.platform-public_&]:border-[var(--pf-line)] [.platform-public_&]:text-[var(--pf-text)]"
            disabled={content.programs.length >= 8}
            onClick={() =>
              setContent({
                programs: [...content.programs, emptyLandingProgram()],
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          <Label className={labelCls}>Programs intro</Label>
          <Textarea
            value={content.programs_intro}
            maxLength={400}
            onChange={(e) => setContent({ programs_intro: e.target.value })}
            placeholder="A short introduction to what students can study."
            className={`min-h-[64px] ${fieldCls}`}
          />
        </div>
        <div className="space-y-3">
          {content.programs.map((p, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--tenant-line)] bg-[var(--tenant-bg)] p-3 [.platform-public_&]:border-[var(--pf-line)] [.platform-public_&]:bg-[var(--pf-bg)]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`text-xs font-medium ${mutedCls}`}>Program {i + 1}</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={`h-8 w-8 hover:text-red-500 ${mutedCls}`}
                  onClick={() =>
                    setContent({
                      programs: content.programs.filter((_, idx) => idx !== i),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
                <div className="space-y-2">
                  <div className="relative overflow-hidden rounded-lg border border-dashed border-[var(--tenant-line)] bg-[var(--tenant-surface)] aspect-[16/10] [.platform-public_&]:border-[var(--pf-line)] [.platform-public_&]:bg-[var(--pf-surface)]">
                    {p.image_url ? (
                      <img
                        src={brandedImageSrc(p.image_url)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className={`flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px] ${mutedCls}`}>
                        <ImagePlus className="h-5 w-5" />
                        Photo
                      </div>
                    )}
                    {uploadingProgram === i ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Label
                      htmlFor={`program-photo-${i}`}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--tenant-line)] px-2 py-1 text-[11px] font-medium text-[var(--tenant-text)] [.platform-public_&]:border-[var(--pf-line)] [.platform-public_&]:text-[var(--pf-text)]"
                    >
                      <Upload className="h-3 w-3" />
                      {p.image_url ? 'Replace' : 'Upload'}
                      <input
                        id={`program-photo-${i}`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploadingProgram !== null}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (!file) return
                          const prev = p.image_url
                          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
                          const preview = URL.createObjectURL(file)
                          const nextPrograms = content.programs.map((row, idx) =>
                            idx === i ? { ...row, image_url: preview } : row,
                          )
                          onChange({
                            landing_content: { ...content, programs: nextPrograms },
                            programImageFiles: { ...(values.programImageFiles || {}), [i]: file },
                          })
                          setUploadingProgram(i)
                          try {
                            const url = await uploadInstitutionAsset(file, 'program')
                            if (!url) throw new Error('UPLOAD_FAILED')
                            URL.revokeObjectURL(preview)
                            const saved = content.programs.map((row, idx) =>
                              idx === i ? { ...row, image_url: url } : row,
                            )
                            const pending = { ...(values.programImageFiles || {}) }
                            delete pending[i]
                            onChange({
                              landing_content: { ...content, programs: saved },
                              programImageFiles: pending,
                            })
                          } catch (err) {
                            toast({
                              title: 'Could not upload photo',
                              description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
                              variant: 'destructive',
                            })
                          } finally {
                            setUploadingProgram(null)
                          }
                        }}
                      />
                    </Label>
                    {p.image_url ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 px-2 text-[11px] ${mutedCls}`}
                        onClick={() => {
                          if (p.image_url.startsWith('blob:')) URL.revokeObjectURL(p.image_url)
                          const next = content.programs.map((row, idx) =>
                            idx === i ? { ...row, image_url: '' } : row,
                          )
                          const pending = { ...(values.programImageFiles || {}) }
                          delete pending[i]
                          onChange({
                            landing_content: { ...content, programs: next },
                            programImageFiles: pending,
                          })
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2 min-w-0">
                  <Input
                    value={p.title}
                    maxLength={80}
                    onChange={(e) => {
                      const next = content.programs.map((row, idx) =>
                        idx === i ? { ...row, title: e.target.value } : row,
                      )
                      setContent({ programs: next })
                    }}
                    placeholder="Program title"
                    className={`border-[var(--tenant-line)] bg-transparent ${titleCls}`}
                  />
                  <Textarea
                    value={p.description}
                    maxLength={280}
                    onChange={(e) => {
                      const next = content.programs.map((row, idx) =>
                        idx === i ? { ...row, description: e.target.value } : row,
                      )
                      setContent({ programs: next })
                    }}
                    placeholder="One or two sentences about this program."
                    className={`min-h-[64px] border-[var(--tenant-line)] bg-transparent ${titleCls}`}
                  />
                  <div>
                    <p className={`mb-1.5 text-[11px] ${mutedCls}`}>Icon (shown on the landing page)</p>
                    <div className="flex flex-wrap gap-1">
                      {LANDING_PROGRAM_ICON_OPTIONS.map(({ id, Icon }) => {
                        const active = p.icon === id
                        return (
                          <button
                            key={id}
                            type="button"
                            title={id}
                            onClick={() => {
                              const next = content.programs.map((row, idx) =>
                                idx === i
                                  ? { ...row, icon: (active ? '' : id) as LandingProgramIconId | '' }
                                  : row,
                              )
                              setContent({ programs: next })
                            }}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${
                              active
                                ? 'border-teal-500 bg-teal-500/15 text-teal-700 [html[data-platform-theme=\'dark\']_&]:text-teal-200'
                                : `border-transparent ${mutedCls} hover:border-[var(--tenant-line)]`
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function emptyLandingCustomize(templateId: LandingTemplateId = 'aurora'): LandingCustomizeValues {
  const t = getLandingTemplate(templateId)
  return {
    landing_template_id: t.id,
    hero_headline: t.defaultHeadline,
    footer_text: '',
    description: '',
    theme_primary: t.defaultPrimary,
    theme_accent: t.defaultAccent,
    theme_tertiary: '',
    social_whatsapp: '',
    social_facebook: '',
    social_tiktok: '',
    logoPreviewUrl: null,
    heroPreviewUrl: null,
    logoFile: null,
    heroFile: null,
    programImageFiles: {},
    landing_content: { ...EMPTY_LANDING_CONTENT },
  }
}
