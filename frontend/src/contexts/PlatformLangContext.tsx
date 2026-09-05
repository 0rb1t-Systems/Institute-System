import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type PlatformLang = 'en' | 'so'

const STORAGE_KEY = 'tvetflow-platform-lang'

const DICT = {
  en: {
    home: 'Home',
    features: 'Features',
    plans: 'Plans',
    plansFull: 'Plans & Subscriptions',
    support: 'Support',
    about: 'About',
    contact: 'Contact',
    verifyId: 'Verify ID',
    logIn: 'Log in',
    getStarted: 'Get Started',
    createInstitution: 'Create institution',
    product: 'Product',
    help: 'Help',
    privacy: 'Privacy',
    terms: 'Terms',
    heroBadge: 'For Training Centers & Institutes',
    heroTitleA: 'Run',
    heroTitleAccent: 'your institute.',
    heroTitleB: 'Grow your impact.',
    heroBody:
      'The all-in-one platform to manage students, classes, payments, attendance, exams, and certificates — built for training centers.',
    verifyIdentity: 'Verify Identity',
    trustedBy: 'Trusted by training centers across the region',
    secureReliable: 'Secure & Reliable',
    multiTenant: 'Multi-tenant',
    powerfulInsights: 'Powerful Insights',
    cloudBased: 'Cloud Based',
    langEn: 'English',
    langSo: 'Somali',
  },
  so: {
    home: 'Hoyga',
    features: 'Astaamaha',
    plans: 'Qorshayaasha',
    plansFull: 'Qorshayaasha & Rukhsadda',
    support: 'Taageero',
    about: 'Nagu saabsan',
    contact: 'Nala soo xiriir',
    verifyId: 'Xaqiiji aqoonsiga',
    logIn: 'Gal',
    getStarted: 'Bilow',
    createInstitution: 'Abuur machad',
    product: 'Alaabta',
    help: 'Caawimo',
    privacy: 'Asturnaanta',
    terms: 'Shuruudaha',
    heroBadge: 'Loogu talagalay xarumaha tababarka',
    heroTitleA: 'Maamul',
    heroTitleAccent: 'machadkaaga.',
    heroTitleB: 'Kordhi saamayntaada.',
    heroBody:
      'Platform dhammaystiran oo maamula ardayda, fasallada, lacagaha, imaanshaha, imtixaannada, iyo shahaadooyinka — loogu talagalay xarumaha tababarka.',
    verifyIdentity: 'Xaqiiji aqoonsiga',
    trustedBy: 'Waxaa aaminsan xarumaha tababarka gobolka',
    secureReliable: 'Ammaan & la isku hallayn karo',
    multiTenant: 'Multi-tenant',
    powerfulInsights: 'Warbixin awood leh',
    cloudBased: 'Cloud ku salaysan',
    langEn: 'English',
    langSo: 'Soomaali',
  },
} as const

export type PlatformLangKey = keyof typeof DICT.en

type PlatformLangContextValue = {
  lang: PlatformLang
  setLang: (lang: PlatformLang) => void
  t: (key: PlatformLangKey) => string
}

const PlatformLangContext = createContext<PlatformLangContextValue | null>(null)

function readStoredLang(): PlatformLang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'so' || v === 'en') return v
  } catch {
    /* ignore */
  }
  return 'en'
}

export function PlatformLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<PlatformLang>(() => {
    if (typeof window === 'undefined') return 'en'
    return readStoredLang()
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === 'so' ? 'so' : 'en'
  }, [lang])

  const setLang = useCallback((next: PlatformLang) => {
    setLangState(next)
  }, [])

  const t = useCallback(
    (key: PlatformLangKey) => DICT[lang][key] ?? DICT.en[key] ?? key,
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <PlatformLangContext.Provider value={value}>{children}</PlatformLangContext.Provider>
}

export function usePlatformLang() {
  const ctx = useContext(PlatformLangContext)
  if (!ctx) {
    return {
      lang: 'en' as PlatformLang,
      setLang: () => {},
      t: (key: PlatformLangKey) => DICT.en[key] ?? key,
    }
  }
  return ctx
}
