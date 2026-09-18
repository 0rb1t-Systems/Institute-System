import React from 'react';
import { cn } from '@/lib/utils';

const PageHeader = ({ title, subtitle, eyebrow, children, action }: any) => (
  <div className="mb-5 min-w-0 [.tenant-shell_&]:mb-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 max-w-full lg:flex-1 lg:pr-4">
        {eyebrow ? (
          <p
            className={cn(
              'mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
              'text-[var(--ds-accent,#1F8A5B)] font-data',
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            'text-xl font-bold tracking-tight text-white sm:text-2xl',
            '[overflow-wrap:normal] [word-break:keep-all]',
            '[.platform-shell_&]:text-[var(--pf-text)] [.tenant-shell_&]:text-[var(--ds-text-primary,var(--tenant-text))]',
            '[.tenant-shell_&]:text-[28px] [.tenant-shell_&]:leading-tight [.tenant-shell_&]:tracking-[-0.02em] sm:[.tenant-shell_&]:text-[30px]',
          )}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            className={cn(
              'mt-0.5 text-sm text-slate-400',
              '[overflow-wrap:normal] [word-break:keep-all]',
              '[.platform-shell_&]:text-[var(--pf-muted)] [.tenant-shell_&]:mt-1.5 [.tenant-shell_&]:text-[14px] [.tenant-shell_&]:text-[var(--ds-text-secondary,var(--tenant-muted))]',
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {children || action ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:max-w-[58%] lg:justify-end">
          {children || action}
        </div>
      ) : null}
    </div>
  </div>
);

export default PageHeader;
