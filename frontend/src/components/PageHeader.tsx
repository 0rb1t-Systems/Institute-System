import React from 'react';

const PageHeader = ({ title, subtitle, children, action }: any) => (
  <div className="mb-5 min-w-0">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl break-words [.platform-shell_&]:text-[var(--pf-text)] [.tenant-shell_&]:text-[var(--tenant-text)]">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-400 break-words [.platform-shell_&]:text-[var(--pf-muted)] [.tenant-shell_&]:text-[var(--tenant-muted)]">{subtitle}</p> : null}
      </div>
      {(children || action) ? (
        <div className="flex shrink-0 items-center gap-2">{children || action}</div>
      ) : null}
    </div>
  </div>
);

export default PageHeader;
