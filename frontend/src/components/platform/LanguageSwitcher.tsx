import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { usePlatformLang, type PlatformLang } from '@/contexts/PlatformLangContext'
import { cn } from '@/lib/utils'

const OPTIONS: { id: PlatformLang; labelKey: 'langEn' | 'langSo'; short: string }[] = [
  { id: 'en', labelKey: 'langEn', short: 'EN' },
  { id: 'so', labelKey: 'langSo', short: 'SO' },
]

const LanguageSwitcher = ({ className = '' }: { className?: string }) => {
  const { lang, setLang, t } = usePlatformLang()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = OPTIONS.find((o) => o.id === lang) || OPTIONS[0]

  return (
    <div ref={rootRef} className={cn('relative hidden lg:block', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--pf-line)] bg-transparent px-2.5 text-[13px] font-semibold text-[var(--pf-text)] transition hover:bg-[var(--pf-hover)]"
      >
        <Globe className="h-3.5 w-3.5 text-[var(--pf-muted)]" />
        <span>{current.short}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-[var(--pf-muted)] transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.4rem)] z-40 min-w-[9.5rem] overflow-hidden rounded-xl border border-[var(--pf-line)] bg-[var(--pf-surface)] py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)]"
        >
          {OPTIONS.map((opt) => {
            const active = opt.id === lang
            return (
              <li key={opt.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition',
                    active
                      ? 'bg-[var(--pf-accent)]/10 font-semibold text-[var(--pf-accent)]'
                      : 'text-[var(--pf-text)] hover:bg-[var(--pf-hover)]'
                  )}
                  onClick={() => {
                    setLang(opt.id)
                    setOpen(false)
                  }}
                >
                  <span>{t(opt.labelKey)}</span>
                  <span className="text-[11px] text-[var(--pf-faint)]">{opt.short}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export default LanguageSwitcher
