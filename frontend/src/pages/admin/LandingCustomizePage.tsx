import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/contexts/AuthContext'
import { getMyInstitution, updateInstitution, uploadInstitutionAsset } from '@/lib/api'
import { getInstitutionDisplayName, getTenantPortalUrl, publishInstitutionBrand } from '@/lib/institution'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import LandingTemplatePicker, {
  emptyLandingCustomize,
  type LandingCustomizeValues,
} from '@/components/landing/LandingTemplatePicker'
import { getLandingTemplate } from '@/lib/landingTemplates'
import { normalizeHexColor } from '@/lib/logoBrandColors'
import { sanitizeLandingContent } from '@/lib/landingContent'

/**
 * Admin page — change landing template, logo, hero, headline, footer.
 */
const LandingCustomizePage = () => {
  const { institution: authInst, refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inst, setInst] = useState(null)
  const [landing, setLanding] = useState<LandingCustomizeValues>(() => emptyLandingCustomize('classic'))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await getMyInstitution()
        if (cancelled) return
        setInst(data)
        const meta = getLandingTemplate(data?.landing_template_id)
        setLanding({
          landing_template_id: meta.id,
          hero_headline: data?.hero_headline || meta.defaultHeadline,
          footer_text: data?.footer_text || '',
          description: data?.description || '',
          theme_primary: data?.theme_primary || meta.defaultPrimary,
          theme_accent: data?.theme_accent || meta.defaultAccent,
          theme_tertiary: data?.theme_tertiary || '',
          logoPreviewUrl: data?.logo_url || null,
          heroPreviewUrl: data?.hero_image_url || null,
          logoFile: null,
          heroFile: null,
          landing_content: sanitizeLandingContent(data?.landing_content),
        })
      } catch (err) {
        if (!cancelled) {
          setError(getUserMessage(err, { context: 'LandingCustomize', fallback: MESSAGES.UNEXPECTED }))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const baseInstitution = useMemo(
    () => ({
      name: inst?.name || authInst?.name || 'Institution',
      subdomain: inst?.subdomain || authInst?.subdomain,
      email: inst?.email,
      phone: inst?.phone,
      address: inst?.address,
      logo_url: landing.logoPreviewUrl || inst?.logo_url,
      description: landing.description || inst?.description,
      landing_content: landing.landing_content,
    }),
    [inst, authInst, landing.logoPreviewUrl, landing.description, landing.landing_content],
  )

  useEffect(() => {
    const url = String(authInst?.logo_url || '').trim()
    if (!url) return
    setLanding((prev) => {
      if (prev.logoFile) return prev
      if (prev.logoPreviewUrl === url) return prev
      return { ...prev, logoPreviewUrl: url }
    })
    setInst((prev) => (prev ? { ...prev, logo_url: url } : prev))
  }, [authInst?.logo_url])

  const landingPath = getTenantPortalUrl(inst || authInst)

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      let logo_url = landing.logoPreviewUrl
      let hero_image_url = landing.heroPreviewUrl

      if (landing.logoFile) {
        logo_url = await uploadInstitutionAsset(landing.logoFile, 'logo')
      } else {
        const fresh = await getMyInstitution()
        logo_url = fresh?.logo_url || landing.logoPreviewUrl
      }
      if (landing.heroFile) {
        hero_image_url = await uploadInstitutionAsset(landing.heroFile, 'hero')
      }

      const updated = await updateInstitution({
        landing_template_id: landing.landing_template_id,
        hero_headline: landing.hero_headline.trim() || null,
        footer_text: landing.footer_text.trim() || null,
        description: landing.description.trim() || null,
        theme_primary: normalizeHexColor(landing.theme_primary),
        theme_accent: normalizeHexColor(landing.theme_accent, '#D32F2F'),
        theme_tertiary: String(landing.theme_tertiary || '').trim()
          ? normalizeHexColor(landing.theme_tertiary, '#0EA5E9')
          : null,
        logo_url: logo_url || null,
        hero_image_url: hero_image_url || null,
        landing_content: landing.landing_content,
      })

      setInst(updated)
      setLanding((prev) => ({
        ...prev,
        logoFile: null,
        heroFile: null,
        logoPreviewUrl: updated?.logo_url || prev.logoPreviewUrl,
        heroPreviewUrl: updated?.hero_image_url || prev.heroPreviewUrl,
      }))
      await refreshUser?.()
      publishInstitutionBrand({
        id: updated?.id || inst?.id || authInst?.id,
        logo_url: updated?.logo_url || logo_url,
        name: updated?.name || inst?.name || authInst?.name,
      })
      setSuccess('Landing page updated. Open your public landing to review.')
    } catch (err) {
      setError(getUserMessage(err, { context: 'LandingCustomizeSave', fallback: MESSAGES.UNEXPECTED }))
    } finally {
      setSaving(false)
    }
  }

  const name = getInstitutionDisplayName(inst || authInst)

  return (
    <AnimatedPage>
      <Helmet>
        <title>Landing page — {name}</title>
      </Helmet>

      <PageHeader
        title="Landing page templates"
        subtitle="Choose a template, then fill About and Programs so each page has balanced, custom copy. Changes appear on your public institution portal."
      />

      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm" className="border-slate-700">
            <a href={landingPath} target="_blank" rel="noreferrer">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              View public landing
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/profile">Institution settings</Link>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-teal-800/50 bg-teal-950/40 text-teal-100">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-6">
            <LandingTemplatePicker
              baseInstitution={baseInstitution}
              values={landing}
              onChange={(patch) => setLanding((prev) => ({ ...prev, ...patch }))}
            />
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-teal-500 font-semibold text-[#04201c] hover:bg-teal-400"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save landing page
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}

export default LandingCustomizePage
