import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import AnimatedPage from '@/components/AnimatedPage'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Loader2, Lock, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { updateOwnProfile, changeOwnPassword } from '@/lib/superAdminApi'
import { useToast } from '@/components/ui/use-toast'
import { getUserMessage } from '@/lib/mapError'
import { MESSAGES } from '@/lib/messages'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'

const SuperAdminProfilePage = () => {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [tab, setTab] = useState('profile') // profile | security

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (user) {
      setFullName(user.name || user.full_name || '')
      setPhone(user.phone || '')
    }
  }, [user])

  const saveProfile = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast({ title: 'Validation', description: 'Full name is required.', variant: 'destructive' })
      return
    }
    setSavingProfile(true)
    try {
      await updateOwnProfile({ full_name: fullName, phone })
      if (refreshUser) await refreshUser()
      toast({ title: 'Success', description: MESSAGES.SUCCESS.PROFILE_UPDATED })
    } catch (err) {
      toast({
        title: 'Error',
        description: getUserMessage(err, { fallback: MESSAGES.UPDATE_FAILED }),
        variant: 'destructive',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword || !newPassword) {
      toast({
        title: 'Validation',
        description: 'Current and new passwords are required.',
        variant: 'destructive',
      })
      return
    }
    if (newPassword.length < 8) {
      toast({
        title: 'Validation',
        description: MESSAGES.VALIDATION.PASSWORD_MIN,
        variant: 'destructive',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Validation',
        description: 'New password and confirmation do not match.',
        variant: 'destructive',
      })
      return
    }

    setSavingPassword(true)
    try {
      await changeOwnPassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast({ title: 'Success', description: 'Password changed successfully.' })
    } catch (err) {
      notify.error(err, {
        context: 'SuperAdminProfilePage - changePassword',
        fallback: MESSAGES.UPDATE_FAILED,
      })
    } finally {
      setSavingPassword(false)
    }
  }

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Not signed in</AlertTitle>
        <AlertDescription>Please sign in again.</AlertDescription>
      </Alert>
    )
  }

  return (
    <AnimatedPage>
      <Helmet>
        <title>Profile — Super Admin</title>
      </Helmet>

      <PageHeader
        title="Profile"
        subtitle="Update your account details and security settings."
      />

      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === 'profile' ? 'default' : 'outline'}
          size="sm"
          className={cn(tab === 'profile' && 'bg-indigo-600 hover:bg-indigo-500')}
          onClick={() => setTab('profile')}
        >
          <User className="h-4 w-4 mr-1" />
          Profile
        </Button>
        <Button
          variant={tab === 'security' ? 'default' : 'outline'}
          size="sm"
          className={cn(tab === 'security' && 'bg-indigo-600 hover:bg-indigo-500')}
          onClick={() => setTab('security')}
        >
          <Lock className="h-4 w-4 mr-1" />
          Security
        </Button>
      </div>

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="max-w-xl">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Account information</CardTitle>
              <CardDescription>Visible name and contact details for the System Owner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email || ''}
                  disabled
                  className="bg-slate-950 border-slate-800 opacity-70"
                />
                <p className="text-xs text-slate-500">Email is managed by authentication and cannot be changed here.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <Button type="submit" disabled={savingProfile} className="bg-indigo-600 hover:bg-indigo-500">
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save profile'}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}

      {tab === 'security' && (
        <form onSubmit={savePassword} className="max-w-xl">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Change password</CardTitle>
              <CardDescription>
                Passwords are updated through Supabase Auth only and are never stored in application tables.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current password</Label>
                <Input
                  id="current_password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm new password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800"
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={savingPassword} className="bg-indigo-600 hover:bg-indigo-500">
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </AnimatedPage>
  )
}

export default SuperAdminProfilePage
