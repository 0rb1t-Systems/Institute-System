import React, { useEffect, useMemo, useState } from 'react'
import { Check, ImagePlus, Plus, Trash2, Upload } from 'lucide-react'
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
import {
  EMPTY_LANDING_CONTENT,
  sanitizeLandingContent,
  type LandingContent,
} from '@/lib/landingContent'

export type LandingCustomizeValues = {
  landing_template_id: LandingTemplateId
  hero_headline: string
  footer_text: string
  description: string
  theme_primary: string
  theme_accent: string
  theme_tertiary: string
  logoPreviewUrl: string | null
  heroPreviewUrl: string | null
  logoFile: File | null
  heroFile: File | null
  landing_content: LandingContent
}

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
  const [logoSwatches, setLogoSwatches] = useState<string[]>([])
  const [detectingColors, setDetectingColors] = useState(false)
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
        <h2 className="font-display text-xl font-bold text-white sm:text-2xl [.platform-public_&]:text-[var(--pf-text)]">Choose a landing template</h2>
        <p className="mt-1 text-sm text-slate-400 [.platform-public_&]:text-[var(--pf-muted)]">
          Design preview updates at the top when you select a template. Upload your logo so branding appears live.
        </p>
      </div>

      {/* Large design preview on top */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <p className="text-xs font-medium text-slate-300">
            Design preview · <span className="text-white">{meta.name}</span>
          </p>
          <p className="hidden text-[11px] text-slate-500 sm:block">{meta.tagline}</p>
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
                  : 'border-white/10 bg-black/20 hover:border-white/25'
              }`}
            >
              <div
                className="mb-3 h-20 rounded-xl bg-cover bg-center"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${t.defaultPrimary}aa, transparent 55%), url(${t.defaultHeroImage})`,
                }}
              />
              <p className="text-sm font-semibold text-white">{t.name}</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-400">{t.tagline}</p>
              {selected && (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-teal-400 text-[#04201c]">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 rounded-2xl border border-white/10 bg-black/25 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-200">Institution logo *</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
                {previewInstitution.logo_url ? (
                  <img src={previewInstitution.logo_url} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Upload className="h-5 w-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="border-white/10 bg-[#061512] text-sm file:mr-3 file:rounded file:border-0 file:bg-teal-500/20 file:px-2 file:py-1 file:text-teal-200"
                  onChange={(e) => onLogo(e.target.files?.[0] || null)}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  PNG, JPG, WebP or SVG · max 5MB. Brand colors are detected from the logo.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-200">Hero image (optional)</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15">
                {values.heroPreviewUrl ? (
                  <img src={values.heroPreviewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-5 w-5 text-slate-400" />
                )}
              </div>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="border-white/10 bg-[#061512] text-sm file:mr-3 file:rounded file:border-0 file:bg-teal-500/20 file:px-2 file:py-1 file:text-teal-200"
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
            <Label className="text-slate-200">Hero headline</Label>
            <Input
              value={values.hero_headline}
              onChange={(e) => onChange({ hero_headline: e.target.value })}
              placeholder={meta.defaultHeadline}
              className="border-white/10 bg-[#061512]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Short description</Label>
            <Textarea
              value={values.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Quality education, professional training, and trusted credentials."
              className="min-h-[72px] border-white/10 bg-[#061512]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Footer text</Label>
            <Textarea
              value={values.footer_text}
              onChange={(e) => onChange({ footer_text: e.target.value })}
              placeholder="Official public portal for verification and secure access."
              className="min-h-[64px] border-white/10 bg-[#061512]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-black/25 p-5">
        <div>
          <h3 className="text-sm font-semibold text-white">About page</h3>
          <p className="mt-1 text-xs text-slate-500">
            Optional. Leave blank to hide the About section on the public landing page.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-200">About title</Label>
          <Input
            value={content.about_title}
            maxLength={80}
            onChange={(e) => setContent({ about_title: e.target.value })}
            placeholder={`About ${baseInstitution.name || 'our institution'}`}
            className="border-white/10 bg-[#061512]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-200">About story</Label>
          <Textarea
            value={content.about_body}
            maxLength={4000}
            onChange={(e) => setContent({ about_body: e.target.value })}
            placeholder="Share your mission, history, and what makes this institution distinctive."
            className="min-h-[120px] border-white/10 bg-[#061512]"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {content.about_highlights.slice(0, 4).map((h, i) => (
            <div key={i} className="space-y-2">
              <Label className="text-slate-200">Highlight {i + 1}</Label>
              <Input
                value={h}
                maxLength={90}
                onChange={(e) => {
                  const next = [...content.about_highlights]
                  next[i] = e.target.value
                  setContent({ about_highlights: next })
                }}
                placeholder="e.g. Practical skills"
                className="border-white/10 bg-[#061512]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-black/25 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Programs page</h3>
            <p className="mt-1 text-xs text-slate-500">
              Optional. Add up to 8 programs. Leave empty to hide Programs on the landing page.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/15 bg-white/5 text-slate-200"
            disabled={content.programs.length >= 8}
            onClick={() =>
              setContent({
                programs: [...content.programs, { title: '', description: '' }],
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          <Label className="text-slate-200">Programs intro</Label>
          <Textarea
            value={content.programs_intro}
            maxLength={400}
            onChange={(e) => setContent({ programs_intro: e.target.value })}
            placeholder="A short introduction to what students can study."
            className="min-h-[64px] border-white/10 bg-[#061512]"
          />
        </div>
        <div className="space-y-3">
          {content.programs.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-white/10 bg-[#061512]/80 p-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
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
                  className="border-white/10 bg-transparent"
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
                  className="min-h-[64px] border-white/10 bg-transparent"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-slate-500 hover:text-red-300"
                onClick={() =>
                  setContent({
                    programs: content.programs.filter((_, idx) => idx !== i),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
    logoPreviewUrl: null,
    heroPreviewUrl: null,
    logoFile: null,
    heroFile: null,
    landing_content: { ...EMPTY_LANDING_CONTENT },
  }
}
