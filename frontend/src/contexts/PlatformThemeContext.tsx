import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react'

export type PlatformThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'tvetflow-platform-theme'

type PlatformThemeContextValue = {
  mode: PlatformThemeMode
  preference: PlatformThemeMode
  setMode: (mode: PlatformThemeMode) => void
  toggle: () => void
}

const PlatformThemeContext = createContext<PlatformThemeContextValue | null>(null)

function applyMode(mode: PlatformThemeMode) {
  document.documentElement.setAttribute('data-platform-theme', mode)
}

/** Platform marketing site is light-only (dark toggle removed). */
export function PlatformThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyMode('light')
    try {
      localStorage.setItem(STORAGE_KEY, 'light')
    } catch {
      /* ignore */
    }
  }, [])

  const setMode = useCallback((_next: PlatformThemeMode) => {
    applyMode('light')
  }, [])

  const toggle = useCallback(() => {
    applyMode('light')
  }, [])

  const value = useMemo(
    () => ({
      mode: 'light' as PlatformThemeMode,
      preference: 'light' as PlatformThemeMode,
      setMode,
      toggle,
    }),
    [setMode, toggle],
  )

  return <PlatformThemeContext.Provider value={value}>{children}</PlatformThemeContext.Provider>
}

export function usePlatformTheme() {
  const ctx = useContext(PlatformThemeContext)
  if (!ctx) {
    return {
      mode: 'light' as PlatformThemeMode,
      preference: 'light' as PlatformThemeMode,
      setMode: () => {},
      toggle: () => {},
    }
  }
  return ctx
}
