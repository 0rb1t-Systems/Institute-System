import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import LogoBrandColorPicker from '@/components/admin/LogoBrandColorPicker'
import {
  getSystemSettings,
  getPlatformDashboardBrand,
  savePlatformSettings,
  savePlatformDashboardBrand,
  type DashboardThemePolicy,
  type PlatformDashboardBrandSettings,
} from '@/lib/superAdminApi'
import { usePlatformTheme } from '@/contexts/PlatformThemeContext'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import { cn } from '@/lib/utils'
import {
  PLATFORM_BRAND_EVENT,
  applyPlatformBrandCss,
  normalizeHexColor,
  normalizePlatformDashboardBrand,
} from '@/lib/logoBrandColors'

const THEME_OPTIONS: { id: DashboardThemePolicy; title: string; description: string }[] = [
  {
    id: 'light',
    title: 'Light',
    description: 'Force Light Mode for all institution dashboards.',
  },
  {
    id: 'dark',
    title: 'Dark',
    description: 'Force Dark Mode for all institution dashboards.',
  },
  {
    id: 'institution',
    title: 'Institution choice',
    description: 'Each institution can have Light or Dark set (and saved) on its tenant page.',
  },
]

const DEFAULT_BRAND: PlatformDashboardBrandSettings = {
  primary: '#0F172A',
  accent: '#EAB308',
  tertiary: '',
}

const SystemSettingsPage = () => {
  const { toast } = useToast()
  const { policy, setPolicy, refreshPolicy, setMode, mode } = usePlatformTheme()
  const [platformName, setPlatformName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [maintenance, setMaintenance] = useState(false)
  const [themeDraft, setThemeDraft] = useState<DashboardThemePolicy>('institution')
  const [brandDraft, setBrandDraft] = useState<PlatformDashboardBrandSettings>(DEFAULT_BRAND)
  const [brandSaved, setBrandSaved] = useState<PlatformDashboardBrandSettings>(DEFAULT_BRAND)
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [s, brand] = await Promise.all([getSystemSettings(), getPlatformDashboardBrand()])
        setPlatformName(typeof s.platform_name === 'string' ? s.platform_name : String(s.platform_name ?? ''))
        setSupportEmail(typeof s.support_email === 'string' ? s.support_email : String(s.support_email ?? ''))
        setMaintenance(Boolean(s.maintenance_mode))
        const normalized = normalizePlatformDashboardBrand(brand)
        setBrandDraft(normalized)
        setBrandSaved(normalized)
        applyPlatformBrandCss(normalized)
        await refreshPolicy()
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshPolicy])

  useEffect(() => {
    setThemeDraft(policy)
  }, [policy])

  useEffect(() => {
    setPreviewMode(mode === 'dark' ? 'dark' : 'light')
  }, [mode])

  const setBrandField = (key: keyof PlatformDashboardBrandSettings, value: string) => {
    setBrandDraft((prev) => {
      const next = { ...prev, [key]: value }
      applyPlatformBrandCss(normalizePlatformDashboardBrand(next))
      return next
    })
  }

  const brandDirty =
    normalizeHexColor(brandDraft.primary, DEFAULT_BRAND.primary) !==
      normalizeHexColor(brandSaved.primary, DEFAULT_BRAND.primary) ||
    normalizeHexColor(brandDraft.accent, DEFAULT_BRAND.accent) !==
      normalizeHexColor(brandSaved.accent, DEFAULT_BRAND.accent) ||
    String(brandDraft.tertiary || '').trim().toUpperCase() !==
      String(brandSaved.tertiary || '').trim().toUpperCase()

  const modeDirty = themeDraft === 'institution' && previewMode !== mode
  const themeDirty = themeDraft !== policy || brandDirty || modeDirty

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await savePlatformSettings({
        platform_name: platformName,
        support_email: supportEmail,
        maintenance_mode: maintenance,
      })
      toast({ title: 'Success', description: MESSAGES.SUCCESS.UPDATED })
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

  const handleSaveTheme = async () => {
    setSavingTheme(true)
    try {
      const normalized = normalizePlatformDashboardBrand(brandDraft)
      await setPolicy(themeDraft)
      const saved = await savePlatformDashboardBrand(normalized)
      setBrandDraft(saved)
      setBrandSaved(saved)
      applyPlatformBrandCss(saved)
      window.dispatchEvent(new CustomEvent(PLATFORM_BRAND_EVENT, { detail: saved }))
      if (themeDraft === 'institution') {
        setMode(previewMode)
      }
      toast({
        title: 'Dashboard theme saved',
        description:
          themeDraft === 'institution'
            ? 'Colors saved. Institutions can still choose their own light/dark mode.'
            : `Colors saved. All dashboards are forced to ${themeDraft} mode.`,
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.SAVE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSavingTheme(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--pf-accent)]" />
      </div>
    )
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Platform Settings</title>
      </Helmet>

      <PageHeader
        title="Platform Settings"
        subtitle="Platform-wide configuration for the System Owner."
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load settings</AlertTitle>
          <AlertDescription>
            {getUserMessage(error, { fallback: MESSAGES.LOAD_FAILED })}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid max-w-3xl gap-4">
        <Card className="border-[var(--pf-line)] bg-[var(--pf-surface)]">
          <CardHeader>
            <CardTitle className="text-base text-[var(--pf-text)]">Dashboard theme</CardTitle>
            <CardDescription className="text-[var(--pf-muted)]">
              Pick dashboard colors freely, choose Light / Dark, and control whether institutions
              can override mode. Saved in <code className="text-[11px]">system_settings</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--pf-text)]">Mode policy</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setThemeDraft(opt.id)}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left transition',
                      themeDraft === opt.id
                        ? 'border-[var(--pf-accent)] bg-[var(--pf-hover)]'
                        : 'border-[var(--pf-line)] hover:border-[var(--pf-accent)]/40',
                    )}
                  >
                    <p className="text-sm font-semibold text-[var(--pf-text)]">{opt.title}</p>
                    <p className="mt-1 text-[11px] leading-snug text-[var(--pf-muted)]">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {themeDraft === 'institution' ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--pf-text)]">Your dashboard mode</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      { id: 'light' as const, title: 'Light', description: 'Bright Super Admin workspace.' },
                      { id: 'dark' as const, title: 'Dark', description: 'Low-glare Super Admin workspace.' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setPreviewMode(opt.id)
                        setMode(opt.id)
                      }}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-left transition',
                        previewMode === opt.id
                          ? 'border-[var(--pf-accent)] bg-[var(--pf-hover)]'
                          : 'border-[var(--pf-line)] hover:border-[var(--pf-accent)]/40',
                      )}
                    >
                      <p className="text-sm font-semibold text-[var(--pf-text)]">{opt.title}</p>
                      <p className="mt-1 text-[11px] leading-snug text-[var(--pf-muted)]">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-[var(--pf-text)]">Dashboard colors</p>
                <p className="mt-0.5 text-[11px] text-[var(--pf-muted)]">
                  Secondary color drives buttons and accents. Use the color chip or paste any hex.
                </p>
              </div>
              <LogoBrandColorPicker
                primary={brandDraft.primary}
                accent={brandDraft.accent}
                tertiary={brandDraft.tertiary}
                onPrimaryChange={(hex) => setBrandField('primary', hex)}
                onAccentChange={(hex) => setBrandField('accent', hex)}
                onTertiaryChange={(hex) => setBrandField('tertiary', hex)}
                primaryId="platform_theme_primary"
                accentId="platform_theme_accent"
                tertiaryId="platform_theme_tertiary"
                showLogoHint={false}
              />
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--pf-line)] bg-[var(--pf-bg)] px-3 py-2.5">
                <span className="text-[11px] text-[var(--pf-muted)]">Preview</span>
                <span
                  className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-semibold"
                  style={{
                    backgroundColor: normalizeHexColor(brandDraft.accent, DEFAULT_BRAND.accent),
                    color: '#0F172A',
                  }}
                >
                  Accent button
                </span>
                <span
                  className="inline-block h-7 w-7 rounded-md border border-[var(--pf-line)]"
                  style={{ backgroundColor: normalizeHexColor(brandDraft.primary, DEFAULT_BRAND.primary) }}
                  title="Primary"
                />
                {String(brandDraft.tertiary || '').trim() ? (
                  <span
                    className="inline-block h-7 w-7 rounded-md border border-[var(--pf-line)]"
                    style={{
                      backgroundColor: normalizeHexColor(brandDraft.tertiary, '#38BDF8'),
                    }}
                    title="Third"
                  />
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                disabled={savingTheme || !themeDirty}
                onClick={handleSaveTheme}
                className="bg-[var(--pf-accent)] text-[var(--pf-accent-fg)] hover:opacity-90"
              >
                {savingTheme ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save dashboard theme'}
              </Button>
              <span className="text-[11px] text-[var(--pf-faint)]">
                Policy: {policy} · Mode: {mode}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--pf-line)] bg-[var(--pf-surface)]">
          <CardHeader>
            <CardTitle className="text-base text-[var(--pf-text)]">Landing & branding</CardTitle>
            <CardDescription className="text-[var(--pf-muted)]">
              Manage the public TvetFlow marketing site appearance without rebuilding it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm" className="border-[var(--pf-line)]">
              <Link to="/super-admin/site-cms">Open Site CMS</Link>
            </Button>
          </CardContent>
        </Card>

        <form onSubmit={handleSave}>
          <Card className="border-[var(--pf-line)] bg-[var(--pf-surface)]">
            <CardHeader>
              <CardTitle className="text-base text-[var(--pf-text)]">Platform</CardTitle>
              <CardDescription className="text-[var(--pf-muted)]">
                Visible branding and operational flags.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platform_name">Platform name</Label>
                <Input
                  id="platform_name"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="border-[var(--pf-line)] bg-[var(--pf-bg)]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support_email">Support email</Label>
                <Input
                  id="support_email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="border-[var(--pf-line)] bg-[var(--pf-bg)]"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-3 text-sm text-[var(--pf-muted)]">
                <input
                  type="checkbox"
                  checked={maintenance}
                  onChange={(e) => setMaintenance(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--pf-line)]"
                />
                Maintenance mode
              </label>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[var(--pf-accent)] text-[var(--pf-accent-fg)] hover:opacity-90"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save settings'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </AnimatedPage>
  )
}

export default SystemSettingsPage
