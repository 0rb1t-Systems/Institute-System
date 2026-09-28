import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import {
  getDashboardThemePolicy,
  setDashboardThemePolicy,
  type DashboardThemePolicy,
} from '@/lib/superAdminApi'

export type PlatformThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'tvetflow-platform-theme'

type PlatformThemeContextValue = {
  mode: PlatformThemeMode
  preference: PlatformThemeMode
  policy: DashboardThemePolicy
  /** Institution-saved theme when set (light/dark); null = not set */
  institutionTheme: PlatformThemeMode | null
  policyLoading: boolean
  /** True when theme cannot be toggled (global or institution force) */
  isForced: boolean
  setMode: (mode: PlatformThemeMode) => void
  toggle: () => void
  setPolicy: (policy: DashboardThemePolicy) => Promise<void>
  refreshPolicy: () => Promise<void>
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

function institutionThemeOf(institution: any): PlatformThemeMode | null {
  const t = institution?.dashboard_theme
  return t === 'light' || t === 'dark' ? t : null
}

function resolveMode(
  policy: DashboardThemePolicy,
  institutionTheme: PlatformThemeMode | null,
  preference: PlatformThemeMode,
  isSuperAdmin: boolean,
): PlatformThemeMode {
  // Global platform force always wins for everyone
  if (policy === 'light' || policy === 'dark') return policy
  // Tenant users: institution-saved theme when set
  if (!isSuperAdmin && institutionTheme) return institutionTheme
  return preference
}

export function PlatformThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, institution } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const institutionTheme = institutionThemeOf(institution)

  const [preference, setPreference] = useState<PlatformThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    return readStoredMode()
  })
  const [policy, setPolicyState] = useState<DashboardThemePolicy>('institution')
  const [policyLoading, setPolicyLoading] = useState(true)

  const mode = resolveMode(policy, institutionTheme, preference, Boolean(isSuperAdmin))
  const isForced =
    policy === 'light' ||
    policy === 'dark' ||
    (!isSuperAdmin && institutionTheme != null)

  useEffect(() => {
    applyMode(mode)
  }, [mode])

  useEffect(() => {
    if (isForced) return
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      /* ignore */
    }
  }, [preference, isForced])

  const refreshPolicy = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setPolicyState('institution')
        return
      }
      const v = await getDashboardThemePolicy()
      setPolicyState(v)
    } catch {
      /* keep prior policy on transient errors */
    } finally {
      setPolicyLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await refreshPolicy()
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshPolicy()
    })

    const onFocus = () => {
      void refreshPolicy()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      sub?.subscription?.unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshPolicy])

  const setMode = useCallback(
    (next: PlatformThemeMode) => {
      if (policy === 'light' || policy === 'dark') return
      if (!isSuperAdmin && institutionTheme) return
      setPreference(next)
    },
    [policy, isSuperAdmin, institutionTheme],
  )

  const toggle = useCallback(() => {
    if (policy === 'light' || policy === 'dark') return
    if (!isSuperAdmin && institutionTheme) return
    setPreference((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [policy, isSuperAdmin, institutionTheme])

  const setPolicy = useCallback(async (next: DashboardThemePolicy) => {
    const resolved = await setDashboardThemePolicy(next)
    setPolicyState(resolved)
    applyMode(resolveMode(resolved, institutionTheme, readStoredMode(), Boolean(isSuperAdmin)))
  }, [institutionTheme, isSuperAdmin])

  const value = useMemo(
    () => ({
      mode,
      preference,
      policy,
      institutionTheme,
      policyLoading,
      isForced,
      setMode,
      toggle,
      setPolicy,
      refreshPolicy,
    }),
    [
      mode,
      preference,
      policy,
      institutionTheme,
      policyLoading,
      isForced,
      setMode,
      toggle,
      setPolicy,
      refreshPolicy,
    ],
  )

  return <PlatformThemeContext.Provider value={value}>{children}</PlatformThemeContext.Provider>
}

export function usePlatformTheme() {
  const ctx = useContext(PlatformThemeContext)
  if (!ctx) {
    return {
      mode: 'light' as PlatformThemeMode,
      preference: 'light' as PlatformThemeMode,
      policy: 'institution' as DashboardThemePolicy,
      institutionTheme: null as PlatformThemeMode | null,
      policyLoading: false,
      isForced: false,
      setMode: () => {},
      toggle: () => {},
      setPolicy: async () => {},
      refreshPolicy: async () => {},
    }
  }
  return ctx
}
