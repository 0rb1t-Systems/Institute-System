import React, { useEffect, useMemo } from 'react'
import { Check, ImagePlus, Upload } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import TenantLandingRenderer from '@/components/landing/TenantLandingRenderer'
import type { LandingInstitution } from '@/components/landing/types'
import {
  LANDING_TEMPLATES,
  getLandingTemplate,
  type LandingTemplateId,
} from '@/lib/landingTemplates'

export type LandingCustomizeValues = {
  landing_template_id: LandingTemplateId
  hero_headline: string
  footer_text: string
  description: string
  theme_primary: string
  theme_accent: string
  logoPreviewUrl: string | null
  heroPreviewUrl: string | null
  logoFile: File | null
  heroFile: File | null
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

  const previewInstitution: LandingInstitution = useMemo(
    () => ({
      ...baseInstitution,
      landing_template_id: values.landing_template_id,
      hero_headline: values.hero_headline || null,
      footer_text: values.footer_text || null,
      description: values.description || baseInstitution.description || null,
      theme_primary: values.theme_primary || meta.defaultPrimary,
      theme_accent: values.theme_accent || meta.defaultAccent,
      logo_url: values.logoPreviewUrl || baseInstitution.logo_url || null,
      hero_image_url: values.heroPreviewUrl || null,
    }),
    [baseInstitution, values, meta.defaultPrimary, meta.defaultAccent],
  )

  useEffect(() => {
    return () => {
      if (values.logoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(values.logoPreviewUrl)
      if (values.heroPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(values.heroPreviewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onLogo = (file: File | null) => {
    const url = fileToObjectUrl(file, values.logoPreviewUrl)
    onChange({ logoFile: file, logoPreviewUrl: url })
  }

  const onHero = (file: File | null) => {
    const url = fileToObjectUrl(file, values.heroPreviewUrl)
    onChange({ heroFile: file, heroPreviewUrl: url })
  }

  const selectTemplate = (id: LandingTemplateId) => {
    const t = getLandingTemplate(id)
    onChange({
      landing_template_id: id,
      theme_primary: t.defaultPrimary,
      theme_accent: t.defaultAccent,
      hero_headline: values.hero_headline?.trim() ? values.hero_headline : t.defaultHeadline,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-white sm:text-2xl">Choose a landing template</h2>
        <p className="mt-1 text-sm text-slate-400">
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
                <p className="mt-1 text-[11px] text-slate-500">PNG, JPG, WebP or SVG · max 5MB</p>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-200">Primary color</Label>
              <Input
                type="color"
                value={values.theme_primary || meta.defaultPrimary}
                onChange={(e) => onChange({ theme_primary: e.target.value })}
                className="h-10 cursor-pointer border-white/10 bg-[#061512] p-1"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Accent color</Label>
              <Input
                type="color"
                value={values.theme_accent || meta.defaultAccent}
                onChange={(e) => onChange({ theme_accent: e.target.value })}
                className="h-10 cursor-pointer border-white/10 bg-[#061512] p-1"
              />
            </div>
          </div>
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
    logoPreviewUrl: null,
    heroPreviewUrl: null,
    logoFile: null,
    heroFile: null,
  }
}
