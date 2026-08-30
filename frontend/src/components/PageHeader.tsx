import React from 'react';

const PageHeader = ({ title, subtitle, children, action }: any) => (
  <div className="mb-5 min-w-0">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 max-w-full lg:flex-1 lg:pr-4">
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl [overflow-wrap:normal] [word-break:keep-all] [.platform-shell_&]:text-[var(--pf-text)] [.tenant-shell_&]:text-[var(--tenant-text)]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-slate-400 [overflow-wrap:normal] [word-break:keep-all] [.platform-shell_&]:text-[var(--pf-muted)] [.tenant-shell_&]:text-[var(--tenant-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {(children || action) ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:max-w-[58%] lg:justify-end">
          {children || action}
        </div>
      ) : null}
    </div>
  </div>
);

export default PageHeader;
