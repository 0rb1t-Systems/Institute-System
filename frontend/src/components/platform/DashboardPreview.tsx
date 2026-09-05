import React from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, BookOpen, Users, TrendingUp } from 'lucide-react'

const WHATSAPP_HREF = 'https://wa.me/252614554731'

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M17.47 14.38c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.41.12-.54.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.46h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3 0 1.36.98 2.67 1.12 2.85.14.18 1.93 2.95 4.67 4.14.65.28 1.16.45 1.56.58.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32z" />
    <path d="M12.04 2C6.5 2 2 6.48 2 12c0 1.77.46 3.45 1.27 4.9L2 22l5.24-1.37A9.96 9.96 0 0 0 12.04 22C17.56 22 22 17.52 22 12S17.56 2 12.04 2zm0 18.15c-1.63 0-3.16-.48-4.44-1.3l-.32-.2-3.11.82.83-3.03-.21-.33A8.13 8.13 0 0 1 3.9 12c0-4.47 3.66-8.1 8.14-8.1 4.47 0 8.13 3.63 8.13 8.1 0 4.47-3.66 8.15-8.13 8.15z" />
  </svg>
)

const CHART_POINTS = [
  { x: 8, y: 78 },
  { x: 32, y: 58 },
  { x: 56, y: 64 },
  { x: 80, y: 42 },
  { x: 104, y: 48 },
  { x: 128, y: 28 },
  { x: 152, y: 36 },
  { x: 176, y: 18 },
]

/** Public mock of an institution admin console — never shows platform/operator roles. */
const DashboardPreview = () => {
  const cards = [
    { label: 'Total Students', value: '1,248', icon: GraduationCap, tone: 'text-teal-600' },
    { label: 'Active Classes', value: '36', icon: BookOpen, tone: 'text-sky-600' },
    { label: 'Staff', value: '28', icon: Users, tone: 'text-violet-600' },
    { label: 'Revenue', value: '$12.4k', icon: TrendingUp, tone: 'text-amber-600' },
  ]

  const linePath = CHART_POINTS.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')

  return (
    <div className="platform-preview-bob relative mx-auto min-w-0 max-w-full">
      {/* Desktop frame */}
      <div className="overflow-hidden rounded-2xl border border-[var(--pf-line)] bg-[var(--pf-surface)] shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-2 border-b border-[var(--pf-line)] bg-[var(--pf-bg-2)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
          <span className="ml-2 min-w-0 truncate text-[11px] text-[var(--pf-faint)]">
            Horizon Institute · Dashboard
          </span>
        </div>
        <div className="grid grid-cols-[5rem_1fr] sm:grid-cols-[7.5rem_1fr]">
          <aside className="border-r border-white/10 bg-[#0f172a] px-2 py-4 text-white">
            <p className="truncate px-2 font-display text-[11px] font-bold">Horizon</p>
            <div className="mt-4 space-y-1">
              {['Dashboard', 'Students', 'Classes', 'Finance', 'Reports'].map((item, i) => (
                <div
                  key={item}
                  className={`rounded-md px-2 py-1.5 text-[10px] ${
                    i === 0 ? 'bg-teal-500 font-medium text-white' : 'text-slate-400'
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          </aside>
          <div className="bg-[var(--pf-bg-2)] p-3 sm:p-4">
            <p className="text-[10px] font-medium text-[var(--pf-faint)]">Overview</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {cards.map((card, i) => {
                const Icon = card.icon
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.06, duration: 0.35 }}
                    className="rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[9px] text-[var(--pf-muted)] sm:text-[10px]">{card.label}</span>
                      <Icon className={`h-3 w-3 shrink-0 ${card.tone}`} />
                    </div>
                    <p className="mt-1 font-display text-base font-semibold text-[var(--pf-text)] sm:text-lg">
                      {card.value}
                    </p>
                  </motion.div>
                )
              })}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-3 rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3"
            >
              <p className="text-[10px] font-medium text-[var(--pf-muted)]">Attendance Overview</p>
              <svg viewBox="0 0 184 96" className="mt-2 h-16 w-full sm:h-20" aria-hidden>
                <line x1="0" y1="24" x2="184" y2="24" stroke="currentColor" strokeWidth="1" className="text-[var(--pf-line)]" />
                <line x1="0" y1="48" x2="184" y2="48" stroke="currentColor" strokeWidth="1" className="text-[var(--pf-line)]" />
                <line x1="0" y1="72" x2="184" y2="72" stroke="currentColor" strokeWidth="1" className="text-[var(--pf-line)]" />
                <path d={linePath} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {CHART_POINTS.map((p) => (
                  <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r="3" fill="#0d9488" />
                ))}
              </svg>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Phone mockup */}
      <motion.div
        initial={{ opacity: 0, x: -12, y: 16 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.35, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="absolute -bottom-4 -left-2 z-10 hidden w-[7.25rem] overflow-hidden rounded-[1.15rem] border-[3px] border-[#0f172a] bg-[var(--pf-surface)] shadow-[0_16px_40px_rgba(15,23,42,0.18)] sm:block sm:w-[8.25rem]"
        aria-hidden
      >
        <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-[#0f172a]/80" />
        <div className="space-y-2 p-2.5 pt-3">
          <p className="text-[8px] font-semibold text-[var(--pf-text)]">Today</p>
          {[
            { label: 'Students', value: '1.2k' },
            { label: 'Present', value: '94%' },
            { label: 'Classes', value: '8' },
          ].map((row) => (
            <div key={row.label} className="rounded-md border border-[var(--pf-line)] bg-[var(--pf-bg-2)] px-2 py-1.5">
              <p className="text-[7px] text-[var(--pf-muted)]">{row.label}</p>
              <p className="font-display text-[11px] font-bold text-[var(--pf-text)]">{row.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <a
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="absolute bottom-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center"
      >
        <span className="wa-ripple pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/50" />
        <span className="wa-ripple wa-ripple-delay pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/35" />
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_14px_rgba(37,211,102,0.45)] ring-2 ring-white/25 transition hover:scale-105 hover:bg-[#1ebe57]">
          <WhatsAppIcon className="h-[17px] w-[17px]" />
        </span>
      </a>
    </div>
  )
}

export default DashboardPreview
