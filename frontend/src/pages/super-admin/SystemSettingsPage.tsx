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
import { getSystemSettings, savePlatformSettings } from '@/lib/superAdminApi'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'

const SystemSettingsPage = () => {
  const { toast } = useToast()
  const [platformName, setPlatformName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [maintenance, setMaintenance] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        const s = await getSystemSettings()
        setPlatformName(typeof s.platform_name === 'string' ? s.platform_name : String(s.platform_name ?? ''))
        setSupportEmail(typeof s.support_email === 'string' ? s.support_email : String(s.support_email ?? ''))
        setMaintenance(Boolean(s.maintenance_mode))
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
