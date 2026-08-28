import { cn } from '@/lib/utils'

/** Equal-width Settings sections with icon + title + hint. */
export const settingsPrimaryListClass =
  'grid w-full grid-cols-1 sm:grid-cols-5 gap-0 rounded-none border-0 bg-transparent p-0 h-auto divide-y sm:divide-y-0 sm:divide-x divide-slate-800'

export const settingsPrimaryTriggerClass =
  'group inline-flex h-auto min-h-[4.5rem] min-w-0 items-center justify-start gap-3 rounded-none px-3 py-3 text-left font-medium text-slate-300 shadow-none hover:bg-slate-800/60 hover:text-white data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-none sm:justify-start sm:rounded-xl sm:px-2.5 lg:px-3'

/** Nested tools (Profile / Brand / Templates / Builder). */
export const settingsSubListClass =
  'flex w-full h-auto min-h-0 flex-nowrap justify-start gap-0 overflow-x-auto rounded-none border-0 bg-transparent p-0'

export const settingsSubTriggerClass =
  'inline-flex h-auto shrink-0 items-center gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-slate-400 shadow-none hover:text-white data-[state=active]:border-indigo-400 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none'

export const settingsShellClass = cn(
  'overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70',
)
