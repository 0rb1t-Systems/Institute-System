import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { usePlatformTheme } from '@/contexts/PlatformThemeContext'

const ThemeToggle = ({ className = '' }: { className?: string }) => {
  const { mode, toggle } = usePlatformTheme()
  const isLight = mode === 'light'

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--pf-line)] text-[var(--pf-muted)] transition hover:border-[var(--pf-accent)]/40 hover:text-[var(--pf-text)] ${className}`}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Dark mode' : 'Light mode'}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}

export default ThemeToggle
