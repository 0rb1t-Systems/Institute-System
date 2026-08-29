import { cn } from '@/lib/utils'

/** Equal-width Settings sections with icon + title + hint. */
export const settingsPrimaryListClass =
  'grid w-full grid-cols-1 gap-0 rounded-none border-0 bg-transparent p-0 h-auto divide-y sm:divide-y-0 sm:divide-x divide-[var(--tenant-line)]'

export const settingsPrimaryTriggerClass =
  'settings-group-link group inline-flex h-auto min-h-[4.5rem] min-w-0 items-center justify-start gap-3 rounded-none px-3 py-3 text-left font-medium text-[var(--tenant-muted)] shadow-none hover:bg-[var(--tenant-bg-2)] hover:text-[var(--tenant-text)] data-[state=active]:bg-[var(--brand-primary,#002147)] data-[state=active]:text-[var(--brand-on-primary,#fff)] data-[state=active]:shadow-none sm:justify-start sm:rounded-xl sm:px-2.5 lg:px-3'

/** Nested tools (Profile / Brand / Templates / Builder). */
export const settingsSubListClass =
  'flex w-full h-auto min-h-0 flex-nowrap justify-start gap-0 overflow-x-auto rounded-none border-0 bg-transparent p-0'

export const settingsSubTriggerClass =
  'settings-subtab inline-flex h-auto shrink-0 items-center gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-[var(--tenant-muted)] shadow-none hover:text-[var(--tenant-text)] data-[state=active]:border-[var(--brand-primary,#4f46e5)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--brand-primary,#4f46e5)] data-[state=active]:shadow-none'

export const settingsShellClass = cn(
  'overflow-hidden rounded-2xl border border-[var(--tenant-line)] bg-[var(--tenant-surface)]',
)
