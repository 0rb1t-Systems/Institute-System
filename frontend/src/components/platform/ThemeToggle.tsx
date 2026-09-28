import React from 'react'
import { Moon, Sun, Lock } from 'lucide-react'
import { usePlatformTheme } from '@/contexts/PlatformThemeContext'

const ThemeToggle = ({
  className = '',
  variant = 'platform',
}: {
  className?: string
  variant?: 'platform' | 'brand'
}) => {
  const { mode, toggle, isForced, policy, institutionTheme } = usePlatformTheme()
  const isLight = mode === 'light'
  const title = isForced
    ? policy === 'light' || policy === 'dark'
      ? `Theme locked to ${policy} by platform`
      : institutionTheme
        ? `Theme set by institution (${institutionTheme})`
        : 'Theme locked'
    : isLight
      ? 'Dark mode'
      : 'Light mode'

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isForced}
      className={
        variant === 'brand'
          ? `inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`
          : `inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--pf-line)] text-[var(--pf-muted)] transition hover:border-[var(--pf-accent)]/40 hover:text-[var(--pf-text)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--pf-line)] ${className}`
      }
      style={
        variant === 'brand'
          ? {
              borderColor: 'color-mix(in srgb, var(--brand-primary, #002147) 32%, var(--tenant-line, transparent))',
              color: 'var(--tenant-text, var(--brand-primary, #002147))',
              backgroundColor: 'color-mix(in srgb, var(--brand-primary, #002147) 12%, var(--tenant-surface, #fff))',
            }
          : undefined
      }
      aria-label={title}
      title={title}
    >
      {isForced ? (
        <Lock className="h-3.5 w-3.5" />
      ) : isLight ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  )
}

export default ThemeToggle
