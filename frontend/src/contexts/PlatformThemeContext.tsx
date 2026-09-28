import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type PlatformThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'tvetflow-platform-theme'

type PlatformThemeContextValue = {
  mode: PlatformThemeMode
  preference: PlatformThemeMode
  setMode: (mode: PlatformThemeMode) => void
  toggle: () => void
}

const PlatformThemeContext = createContext<PlatformThemeContextValue | null>(null)

function readStoredMode(): PlatformThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    return 'light'
  } catch {
    return 'light'
  }
}

function applyMode(mode: PlatformThemeMode) {
  document.documentElement.setAttribute('data-platform-theme', mode)
}

export function PlatformThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<PlatformThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    return readStoredMode()
  })

  useEffect(() => {
    applyMode(preference)
  }, [preference])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      /* ignore */
    }
  }, [preference])

  const setMode = useCallback((next: PlatformThemeMode) => {
    setPreference(next)
  }, [])

  const toggle = useCallback(() => {
    setPreference((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(
    () => ({
      mode: preference,
      preference,
      setMode,
      toggle,
    }),
    [preference, setMode, toggle],
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
