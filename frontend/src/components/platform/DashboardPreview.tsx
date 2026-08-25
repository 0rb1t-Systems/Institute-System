import React from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, BookOpen, Users, DollarSign } from 'lucide-react'

const WHATSAPP_HREF = 'https://wa.me/252614554731'

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
    <path d="M17.47 14.38c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.41.12-.54.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.46h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3 0 1.36.98 2.67 1.12 2.85.14.18 1.93 2.95 4.67 4.14.65.28 1.16.45 1.56.58.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32z" />
    <path d="M12.04 2C6.5 2 2 6.48 2 12c0 1.77.46 3.45 1.27 4.9L2 22l5.24-1.37A9.96 9.96 0 0 0 12.04 22C17.56 22 22 17.52 22 12S17.56 2 12.04 2zm0 18.15c-1.63 0-3.16-.48-4.44-1.3l-.32-.2-3.11.82.83-3.03-.21-.33A8.13 8.13 0 0 1 3.9 12c0-4.47 3.66-8.1 8.14-8.1 4.47 0 8.13 3.63 8.13 8.1 0 4.47-3.66 8.15-8.13 8.15z" />
  </svg>
)

/** Public mock of an institution admin console — never shows platform/operator roles. */
const DashboardPreview = () => {
  const cards = [
    { label: 'Students', value: '186', icon: GraduationCap },
    { label: 'Classes', value: '12', icon: BookOpen },
    { label: 'Staff', value: '9', icon: Users },
    { label: 'Fees', value: '$4.2k', icon: DollarSign },
  ]

  return (
    <div className="platform-preview-bob relative">
      <div className="overflow-hidden rounded-2xl border border-[var(--pf-line)] bg-[var(--pf-surface)] shadow-[0_24px_60px_rgba(6,21,18,0.28)]">
      <div className="flex items-center gap-2 border-b border-[var(--pf-line)] px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-[#c45c4a]" />
        <span className="h-2 w-2 rounded-full bg-[#c9a227]" />
        <span className="h-2 w-2 rounded-full bg-[#2d8c78]" />
        <span className="ml-2 text-[11px] text-[var(--pf-faint)]">Horizon Institute · Dashboard</span>
      </div>
      <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[112px_1fr]">
        <aside className="border-r border-[var(--pf-line)] bg-[var(--pf-bg)] px-2 py-4">
          <p className="truncate px-2 font-display text-[11px] font-bold text-[var(--pf-text)]">Horizon</p>
          <div className="mt-4 space-y-1">
            {['Dashboard', 'Students', 'Classes', 'Finance'].map((item, i) => (
              <div
                key={item}
                className={`rounded-md px-2 py-1.5 text-[10px] ${
                  i === 0 ? 'bg-teal-500/15 font-medium text-teal-600' : 'text-[var(--pf-muted)]'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </aside>
        <div className="bg-[var(--pf-bg-2)] p-3 sm:p-4">
          <p className="text-[10px] font-medium text-[var(--pf-faint)]">This month</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {cards.map((card, i) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.07, duration: 0.4 }}
                  className="rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--pf-muted)]">{card.label}</span>
                    <Icon className="h-3 w-3 text-teal-500" />
                  </div>
                  <p className="mt-1 font-display text-lg font-semibold text-[var(--pf-text)]">
                    {card.value}
                  </p>
                </motion.div>
              )
            })}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.45 }}
            className="mt-3 rounded-lg border border-[var(--pf-line)] bg-[var(--pf-surface)] p-3"
          >
            <p className="text-[10px] font-medium text-[var(--pf-muted)]">Recent activity</p>
            <ul className="mt-2 space-y-1.5 text-[10px] text-[var(--pf-faint)]">
              <li>Student enrolled · Amina Hassan</li>
              <li>Attendance marked · Welding Level 2</li>
              <li>Fee recorded · Registration</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
      <a
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="absolute bottom-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center"
      >
        <span className="wa-ripple pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/50" />
        <span className="wa-ripple wa-ripple-delay pointer-events-none absolute inset-0 rounded-full bg-[#25D366]/35" />
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_0_16px_6px_rgba(37,211,102,0.45)] ring-2 ring-white/25 transition hover:scale-105 hover:bg-[#1ebe57]">
          <WhatsAppIcon className="h-[17px] w-[17px]" />
        </span>
      </a>
    </div>
  )
}

export default DashboardPreview
