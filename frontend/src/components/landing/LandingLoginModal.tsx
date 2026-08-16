import React from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Loader2, LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { brandInitial } from '@/components/landing/types'

type Props = {
  open: boolean
  institutionName: string
  logoUrl?: string | null
  primary: string
  identifier: string
  password: string
  loginError: string
  signingIn: boolean
  onIdentifier: (v: string) => void
  onPassword: (v: string) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export default function LandingLoginModal({
  open,
  institutionName,
  logoUrl,
  primary,
  identifier,
  password,
  loginError,
  signingIn,
  onIdentifier,
  onPassword,
  onClose,
  onSubmit,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close sign in"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tenant-login-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#0c1a32] p-6 shadow-2xl"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-5 flex items-center gap-3 pr-8">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-11 w-11 rounded-full bg-white/10 object-contain p-1" />
              ) : (
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white"
                  style={{ backgroundColor: primary }}
                >
                  {brandInitial(institutionName)}
                </div>
              )}
              <div>
                <p id="tenant-login-title" className="font-display text-lg font-semibold text-white">
                  Sign in
                </p>
                <p className="text-xs text-slate-400">Only this institution’s accounts.</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {loginError && (
                <Alert variant="destructive" className="border-red-900/50 bg-red-950/50 text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="tenant-login-id" className="text-slate-200">
                  Email or Student ID
                </Label>
                <Input
                  id="tenant-login-id"
                  value={identifier}
                  onChange={(e) => onIdentifier(e.target.value)}
                  className="border-white/10 bg-white/95 text-slate-900"
                  disabled={signingIn}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-login-pw" className="text-slate-200">
                  Password
                </Label>
                <Input
                  id="tenant-login-pw"
                  type="password"
                  value={password}
                  onChange={(e) => onPassword(e.target.value)}
                  className="border-white/10 bg-white/95 text-slate-900"
                  disabled={signingIn}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full rounded-lg text-white hover:opacity-90"
                style={{ backgroundColor: primary }}
                disabled={signingIn}
              >
                {signingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <LogIn className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function LandingFooterCustomizeLink({
  href,
  className = '',
  children = 'Change template',
}: {
  href?: string | null
  className?: string
  children?: React.ReactNode
}) {
  if (!href) return null
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}
