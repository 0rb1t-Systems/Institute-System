import { cn } from '@/lib/utils'

/** Equal-width Settings sections with icon + title + hint. */
export const settingsPrimaryListClass =
  'grid w-full grid-cols-1 gap-0 rounded-none border-0 bg-transparent p-0 h-auto divide-y sm:divide-y-0 sm:divide-x divide-[var(--ds-border,var(--tenant-line))]'

export const settingsPrimaryTriggerClass =
  'settings-group-link group inline-flex h-auto min-h-[4.5rem] min-w-0 items-center justify-start gap-3 rounded-none px-3 py-3 text-left font-medium text-[var(--ds-text-secondary,var(--tenant-muted))] shadow-none hover:bg-[var(--ds-surface-muted,#F7FAF8)] hover:text-[var(--ds-text-primary,var(--tenant-text))] data-[state=active]:bg-[var(--ds-primary-soft,#ECFDF5)] data-[state=active]:text-[var(--ds-primary,#1F8A5B)] data-[state=active]:shadow-none sm:justify-start sm:rounded-xl sm:px-2.5 lg:px-3'

/** Nested tools (Profile / Brand / Templates / Builder). */
export const settingsSubListClass =
  'flex w-full h-auto min-h-0 flex-nowrap justify-start gap-0 overflow-x-auto rounded-none border-0 bg-transparent p-0'

export const settingsSubTriggerClass =
  'settings-subtab inline-flex h-auto shrink-0 items-center gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-[var(--ds-text-secondary,var(--tenant-muted))] shadow-none hover:text-[var(--ds-text-primary,var(--tenant-text))] data-[state=active]:border-[var(--ds-primary,#1F8A5B)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--ds-primary,#1F8A5B)] data-[state=active]:shadow-none'

export const settingsShellClass = cn(
  'overflow-hidden rounded-[var(--ds-radius-xl,16px)] border border-[var(--ds-border,var(--tenant-line))] bg-[var(--ds-surface,var(--tenant-surface))] shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)]',
)
