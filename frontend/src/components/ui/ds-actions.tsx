import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Amanah Design System — shared icon stroke for Lucide outline glyphs */
export const DS_ICON_STROKE = 1.75

const toneClass = {
  muted: 'text-[var(--ds-text-tertiary,#8A978E)] hover:text-[var(--ds-text-primary,#122018)]',
  secondary: 'text-[var(--ds-text-secondary,#5B6B61)] hover:text-[var(--ds-text-primary,#122018)]',
  primary: 'text-[var(--ds-primary,#0B3D2E)] hover:text-[var(--ds-primary,#0B3D2E)]',
  info: 'text-[var(--ds-info,#2563EB)] hover:text-[var(--ds-info,#2563EB)]',
  warning: 'text-[var(--ds-warning,#C2410C)] hover:text-[var(--ds-warning,#C2410C)]',
  danger: 'text-[var(--ds-danger,#DC2626)] hover:bg-[var(--ds-danger-bg,#FEF2F2)] hover:text-[var(--ds-danger,#DC2626)]',
} as const

type Tone = keyof typeof toneClass

type DsIconButtonProps = React.ComponentProps<typeof Button> & {
  tone?: Tone
  /** `ghost` = Students table bare icons; `outline` = Classes/Instructors bordered 34px */
  chrome?: 'ghost' | 'outline'
}

/**
 * Amanah row/card icon control.
 * Outline chrome matches Button / Icon + Classes action tiles in design-system.pen.
 */
export const DsIconButton = React.forwardRef<HTMLButtonElement, DsIconButtonProps>(
  ({ className, tone = 'secondary', chrome = 'ghost', children, ...props }, ref) => {
    const isOutline = chrome === 'outline'
    return (
      <Button
        ref={ref}
        type="button"
        variant={isOutline ? 'outline' : 'ghost'}
        size="icon"
        className={cn(
          isOutline
            ? 'h-[34px] w-[34px] shrink-0 rounded-[var(--ds-radius-md,8px)] border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] p-0 hover:bg-[var(--ds-surface-muted,#F7FAF8)]'
            : 'h-8 w-8 shrink-0',
          toneClass[tone],
          className,
        )}
        {...props}
      >
        {children}
      </Button>
    )
  },
)
DsIconButton.displayName = 'DsIconButton'

type DsOutlineActionProps = React.ComponentProps<typeof Button> & {
  tone?: 'secondary' | 'warning' | 'primary'
}

/** Outline text+icon control (e.g. Deactivate, $ Pay, Credit card). */
export const DsOutlineAction = React.forwardRef<HTMLButtonElement, DsOutlineActionProps>(
  ({ className, tone = 'secondary', children, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-8 gap-1.5 rounded-[var(--ds-radius-md,8px)] border-[var(--ds-border,#DDE5DF)] bg-[var(--ds-surface,#fff)] px-3 text-[12px] font-semibold',
        tone === 'warning' && 'text-[var(--ds-warning,#C2410C)] hover:bg-[var(--ds-warning-bg,#FFF7ED)] hover:text-[var(--ds-warning,#C2410C)]',
        tone === 'primary' && 'text-[var(--ds-primary,#0B3D2E)] hover:bg-[var(--ds-primary-soft,#ECFDF5)] hover:text-[var(--ds-primary,#0B3D2E)]',
        tone === 'secondary' && 'text-[var(--ds-text-primary,#122018)] hover:bg-[var(--ds-surface-muted,#F7FAF8)]',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  ),
)
DsOutlineAction.displayName = 'DsOutlineAction'

/** Soft mint action (Amanah Ghost / Filters / Finance Pay). */
export const DsSoftAction = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="secondary"
      size="sm"
      className={cn(
        'h-8 gap-1.5 rounded-[var(--ds-radius-md,8px)] bg-[var(--ds-primary-soft,#ECFDF5)] px-3 text-[13px] font-medium text-[var(--ds-primary,#0B3D2E)] hover:bg-[var(--ds-primary-muted,#D1FAE5)] hover:text-[var(--ds-primary,#0B3D2E)]',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  ),
)
DsSoftAction.displayName = 'DsSoftAction'

/** Primary filled action (Roster, Add student) — Amanah primary #0B3D2E. */
export const DsPrimaryAction = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, children, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      size="sm"
      className={cn(
        'h-8 gap-1.5 rounded-[var(--ds-radius-md,8px)] bg-[var(--ds-primary,#0B3D2E)] px-3.5 text-[12px] font-semibold text-[var(--ds-text-on-primary,#fff)] hover:bg-[var(--ds-primary-hover,#082E22)]',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  ),
)
DsPrimaryAction.displayName = 'DsPrimaryAction'
