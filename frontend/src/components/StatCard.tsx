import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE_WRAP = {
  info: 'bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)]',
  corporate: 'bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)]',
  primary: 'bg-[var(--ds-primary-soft,#ECFDF5)] text-[var(--ds-primary,#1F8A5B)]',
  warning: 'bg-[var(--ds-warning-bg,#FFF7ED)] text-[var(--ds-warning,#C2410C)]',
  danger: 'bg-[var(--ds-danger-bg,#FEF2F2)] text-[var(--ds-danger,#DC2626)]',
  default:
    'bg-white/5 text-primary [.platform-shell_&]:bg-teal-500/10 [.tenant-shell_&]:bg-[var(--ds-primary-soft,#ECFDF5)] [.tenant-shell_&]:text-[var(--ds-primary,#1F8A5B)]',
};

const TONE_DESC = {
  muted: 'text-slate-400 [.platform-shell_&]:text-[var(--pf-faint)] [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]',
  accent: 'text-[var(--ds-primary,#1F8A5B)]',
  warning: 'text-[var(--ds-warning,#C2410C)]',
  danger: 'text-[var(--ds-danger,#DC2626)]',
  secondary: 'text-[var(--ds-text-secondary,#5B6B61)]',
};

/**
 * KPI metric card — tenant styles follow design-system.pen Metric (light + dark --ds-*).
 * Platform shells keep existing contrast treatment.
 */
const StatCard = ({
  title,
  value,
  icon,
  description = null,
  tone = 'default',
  descriptionTone = 'muted',
  trendIcon = null,
}: {
  title: React.ReactNode
  value: React.ReactNode
  icon?: React.ReactNode
  description?: React.ReactNode
  tone?: keyof typeof TONE_WRAP | string
  descriptionTone?: keyof typeof TONE_DESC | string
  trendIcon?: React.ReactNode
}) => (
  <Card
    className={cn(
      'h-full overflow-hidden border-slate-800 bg-slate-900/50 transition-colors duration-200',
      'hover:border-slate-700 hover:shadow-[0_12px_32px_rgba(0,0,0,0.28)]',
      '[.platform-shell_&]:bg-[var(--pf-surface)] [.platform-shell_&]:border-[var(--pf-line)] [.platform-shell_&]:hover:border-teal-500/35',
      '[.tenant-shell_&]:rounded-[var(--ds-radius-xl,16px)] [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)]',
      '[.tenant-shell_&]:shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)] [.tenant-shell_&]:hover:border-[var(--ds-border-strong,#C5D0C8)]',
    )}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-0 [.tenant-shell_&]:pb-3">
      <CardTitle className="text-sm font-medium text-slate-300 [.platform-shell_&]:text-[var(--pf-muted)] [.tenant-shell_&]:text-[12px] [.tenant-shell_&]:font-semibold [.tenant-shell_&]:leading-none [.tenant-shell_&]:tracking-normal [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]">
        {title}
      </CardTitle>
      <div
        className={cn(
          'rounded-md p-1.5',
          '[.tenant-shell_&]:flex [.tenant-shell_&]:h-10 [.tenant-shell_&]:w-10 [.tenant-shell_&]:shrink-0 [.tenant-shell_&]:items-center [.tenant-shell_&]:justify-center [.tenant-shell_&]:rounded-[var(--ds-radius-lg,12px)] [.tenant-shell_&]:p-0',
          TONE_WRAP[tone] || TONE_WRAP.default,
        )}
      >
        {icon}
      </div>
    </CardHeader>
    <CardContent className="p-5 pt-2 [.tenant-shell_&]:pb-5 [.tenant-shell_&]:pt-0">
      <div className="text-2xl font-bold text-white [.platform-shell_&]:text-[var(--pf-text)] [.tenant-shell_&]:text-[28px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:leading-none [.tenant-shell_&]:tracking-normal [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]">
        {value}
      </div>
      {description ? (
        <div
          className={cn(
            'mt-1 flex items-center gap-1.5 text-xs',
            '[.tenant-shell_&]:mt-3 [.tenant-shell_&]:border-t [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:pt-3 [.tenant-shell_&]:text-[12px] [.tenant-shell_&]:font-medium [.tenant-shell_&]:leading-snug',
            TONE_DESC[descriptionTone] || TONE_DESC.muted,
          )}
        >
          {trendIcon}
          <span className="truncate">{description}</span>
        </div>
      ) : null}
    </CardContent>
  </Card>
);

export default StatCard;
