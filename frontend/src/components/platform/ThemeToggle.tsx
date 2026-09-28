import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { usePlatformTheme } from '@/contexts/PlatformThemeContext'

const ThemeToggle = ({
  className = '',
  variant = 'platform',
}: {
  className?: string
  variant?: 'platform' | 'brand'
}) => {
  const { mode, toggle } = usePlatformTheme()
  const isLight = mode === 'light'
  const title = isLight ? 'Dark mode' : 'Light mode'

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        variant === 'brand'
          ? `inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${className}`
          : `inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] text-[var(--pf-muted)] shadow-sm transition hover:border-[var(--pf-accent)]/50 hover:text-[var(--pf-text)] ${className}`
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
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}

export default ThemeToggle
