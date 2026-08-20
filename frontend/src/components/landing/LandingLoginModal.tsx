import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, LogIn, Mail, ShieldCheck, X } from 'lucide-react'
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
  /** Extra note under the title (e.g. template save flow). */
  subtitle?: string
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
  subtitle = 'Secure access for this institution only.',
  onIdentifier,
  onPassword,
  onClose,
  onSubmit,
}: Props) {
  const [showPassword, setShowPassword] = useState(false)
  const brand = institutionName?.trim() || 'Institution'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#020617]/75 backdrop-blur-[6px]"
            aria-label="Close sign in"
            onClick={onClose}
          />

          {/* Ambient brand glow behind the card */}
          <div
            className="pointer-events-none absolute h-72 w-72 rounded-full blur-[100px] opacity-40"
            style={{ backgroundColor: primary }}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tenant-login-title"
            className="relative w-full max-w-[420px] overflow-hidden rounded-[1.35rem] border border-white/10 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.85)]"
            style={{
              background:
                'linear-gradient(165deg, rgba(15,28,52,0.98) 0%, rgba(8,16,34,0.99) 55%, rgba(6,12,26,1) 100%)',
            }}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            {/* Top brand accent */}
            <div
              className="h-1 w-full"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${primary} 35%, ${primary} 65%, transparent 100%)`,
              }}
            />

            {/* Soft inner highlight */}
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full opacity-25 blur-3xl"
              style={{ backgroundColor: primary }}
              aria-hidden
            />

            <button
              type="button"
              onClick={onClose}
              className="absolute right-3.5 top-4 z-10 rounded-xl p-2 text-slate-400 transition hover:bg-white/8 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-8">
              {/* Brand header */}
              <div className="mb-7 flex flex-col items-center text-center">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="relative mb-4"
                >
                  <div
                    className="absolute inset-0 rounded-2xl opacity-50 blur-xl"
                    style={{ backgroundColor: primary }}
                    aria-hidden
                  />
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      className="relative h-16 w-16 rounded-2xl border border-white/15 bg-white object-contain p-1.5 shadow-lg"
                    />
                  ) : (
                    <div
                      className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lg ring-1 ring-white/20"
                      style={{ backgroundColor: primary }}
                    >
                      {brandInitial(brand)}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="font-display text-[1.35rem] font-bold leading-tight tracking-tight text-white sm:text-[1.5rem]">
                    {brand}
                  </p>
                  <p id="tenant-login-title" className="mt-1.5 text-sm font-medium text-slate-300">
                    Sign in to your portal
                  </p>
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck className="h-3 w-3" style={{ color: primary }} />
                    {subtitle}
                  </p>
                </motion.div>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                {loginError && (
                  <Alert
                    variant="destructive"
                    className="border-red-500/30 bg-red-950/40 text-red-100"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tenant-login-id" className="text-[13px] font-medium text-slate-300">
                    Email or Student ID
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="tenant-login-id"
                      value={identifier}
                      onChange={(e) => onIdentifier(e.target.value)}
                      placeholder="you@email.com or Student ID"
                      className="h-11 rounded-xl border-white/10 bg-white/[0.97] pl-10 text-slate-900 placeholder:text-slate-400 shadow-inner focus-visible:ring-2"
                      style={
                        {
                          ['--tw-ring-color' as string]: primary,
                        } as React.CSSProperties
                      }
                      disabled={signingIn}
                      autoComplete="username"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tenant-login-pw" className="text-[13px] font-medium text-slate-300">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="tenant-login-pw"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => onPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="h-11 rounded-xl border-white/10 bg-white/[0.97] pl-10 pr-11 text-slate-900 placeholder:text-slate-400 shadow-inner focus-visible:ring-2"
                      style={
                        {
                          ['--tw-ring-color' as string]: primary,
                        } as React.CSSProperties
                      }
                      disabled={signingIn}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="mt-1 h-11 w-full rounded-xl text-[15px] font-semibold text-white shadow-lg transition hover:brightness-110 hover:shadow-xl active:scale-[0.99]"
                  style={{
                    backgroundColor: primary,
                    boxShadow: `0 12px 28px -10px ${primary}99`,
                  }}
                  disabled={signingIn}
                >
                  {signingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <LogIn className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
                Use the email or student ID issued by {brand}.
              </p>
            </div>
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
