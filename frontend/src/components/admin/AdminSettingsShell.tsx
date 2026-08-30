import React from 'react'
import { Link } from 'react-router-dom'
import { Building2, GraduationCap, FileText, LayoutTemplate } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  settingsPrimaryListClass,
  settingsPrimaryTriggerClass,
  settingsShellClass,
} from '@/components/admin/settingsNav'

export const SETTINGS_GROUPS = [
  {
    id: 'institution',
    to: '/admin/settings?group=institution',
    icon: Building2,
    title: 'Institution',
    hint: 'Profile, branding, IDs, finance',
  },
  {
    id: 'academic',
    to: '/admin/settings?group=academic',
    icon: GraduationCap,
    title: 'Academic',
    hint: 'Grading & Transcripts',
  },
  {
    id: 'documents',
    to: '/admin/settings?group=documents',
    icon: FileText,
    title: 'Documents',
    hint: 'Certificates & Invoices',
  },
  {
    id: 'landing',
    to: '/admin/landing',
    icon: LayoutTemplate,
    title: 'Landing Page',
    hint: 'Templates, design & customization',
  },
] as const

export type SettingsGroupId = (typeof SETTINGS_GROUPS)[number]['id']

export function resolveSettingsGroup(pathname: string, groupParam: string | null): SettingsGroupId {
  if (pathname.startsWith('/admin/landing')) return 'landing'
  if (groupParam === 'academic' || groupParam === 'documents' || groupParam === 'institution') {
    return groupParam
  }
  return 'institution'
}

export function AdminSettingsGroupNav({ active }: { active: SettingsGroupId }) {
  return (
    <nav className={cn(settingsPrimaryListClass, 'sm:grid-cols-2 lg:grid-cols-4')} aria-label="Institution settings">
      {SETTINGS_GROUPS.map(({ id, to, icon: Icon, title, hint }) => {
        const isActive = id === active
        return (
          <Link
            key={id}
            to={to}
            className={cn(settingsPrimaryTriggerClass, 'whitespace-normal')}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-5 w-5 shrink-0 text-[var(--tenant-muted)] group-data-[state=active]:text-[var(--brand-on-primary,#fff)]" />
            <span className="min-w-0 text-left">
              <span className="block text-sm font-semibold leading-tight text-[var(--tenant-text)] group-data-[state=active]:text-[var(--brand-on-primary,#fff)]">
                {title}
              </span>
              <span className="mt-0.5 block text-[11px] font-normal leading-snug text-[var(--tenant-muted)] group-data-[state=active]:text-[var(--brand-on-primary,#fff)]/80">
                {hint}
              </span>
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminSettingsShell({
  active,
  children,
}: {
  active: SettingsGroupId
  children: React.ReactNode
}) {
  return (
    <div className={settingsShellClass}>
      <div className="p-1.5 sm:p-2">
        <AdminSettingsGroupNav active={active} />
      </div>
      <div className="border-t border-[var(--tenant-line)]">{children}</div>
    </div>
  )
}
