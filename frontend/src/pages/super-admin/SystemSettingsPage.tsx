import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

      <form onSubmit={handleSave} className="max-w-xl">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Platform</CardTitle>
            <CardDescription>Visible branding and operational flags.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Platform name</Label>
              <Input
                id="platform_name"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support_email">Support email</Label>
              <Input
                id="support_email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="bg-slate-950 border-slate-800"
              />
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={maintenance}
                onChange={(e) => setMaintenance(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950"
              />
              Maintenance mode
            </label>
            <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save settings'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </AnimatedPage>
  )
}

export default SystemSettingsPage
