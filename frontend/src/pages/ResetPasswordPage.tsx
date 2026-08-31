import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MIN_CHOSEN_PASSWORD_LENGTH } from '@/lib/institution'

const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    let cancelled = false
    let settled = false

    const markReady = () => {
      if (cancelled || settled) return
      settled = true
      setReady(true)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        markReady()
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady()
    })

    const timer = window.setTimeout(() => {
      if (!cancelled && !settled) setInvalid(true)
    }, 8000)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < MIN_CHOSEN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_CHOSEN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSaving(true)
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password })
      if (updErr) throw updErr
      await supabase.auth.signOut()
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch {
      setError(MESSAGES.AUTH.RESET_PASSWORD_INVALID)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="platform-public relative flex min-h-screen items-center justify-center p-4">
      <Helmet>
        <title>Set new password · TvetFlow</title>
      </Helmet>
      <Card className="relative z-10 w-full max-w-md border-[var(--pf-line)] bg-[var(--pf-surface)] shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold text-[var(--pf-text)]">Set a new password</CardTitle>
          <CardDescription className="text-[var(--pf-muted)]">
            Choose a password of at least 8 characters that you have not used on this portal before.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invalid && !ready ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{MESSAGES.AUTH.RESET_PASSWORD_INVALID}</AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : !ready ? (
            <div className="flex items-center justify-center py-8 text-[var(--pf-muted)]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking reset link…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={MIN_CHOSEN_PASSWORD_LENGTH}
                    className="pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-teal-400 hover:bg-white/10 hover:text-teal-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={MIN_CHOSEN_PASSWORD_LENGTH}
                    className="pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-1.5 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-teal-400 hover:bg-white/10 hover:text-teal-300"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ResetPasswordPage
