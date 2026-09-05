import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type PlatformThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'tvetflow-platform-theme'

type PlatformThemeContextValue = {
  mode: PlatformThemeMode
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
  const [mode, setModeState] = useState<PlatformThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    const initial = readStoredMode()
    applyMode(initial)
    return initial
  })

  useEffect(() => {
    applyMode(mode)
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  const setMode = useCallback((next: PlatformThemeMode) => {
    setModeState(next)
  }, [])

  const toggle = useCallback(() => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(() => ({ mode, setMode, toggle }), [mode, setMode, toggle])

  return <PlatformThemeContext.Provider value={value}>{children}</PlatformThemeContext.Provider>
}

export function usePlatformTheme() {
  const ctx = useContext(PlatformThemeContext)
  if (!ctx) {
    return {
      mode: 'light' as PlatformThemeMode,
      setMode: () => {},
      toggle: () => {},
    }
  }
  return ctx
}
