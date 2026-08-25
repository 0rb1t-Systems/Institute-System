import React from 'react'
import { motion } from 'framer-motion'
import { GraduationCap, BookOpen, Users, DollarSign } from 'lucide-react'

/** Public mock of an institution admin console — never shows platform/operator roles. */
const DashboardPreview = () => {
  const cards = [
    { label: 'Students', value: '186', icon: GraduationCap },
    { label: 'Classes', value: '12', icon: BookOpen },
    { label: 'Staff', value: '9', icon: Users },
    { label: 'Fees', value: '$4.2k', icon: DollarSign },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--pf-line)] bg-[var(--pf-surface)] shadow-[0_24px_60px_rgba(6,21,18,0.28)]">
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
  )
}

export default DashboardPreview
