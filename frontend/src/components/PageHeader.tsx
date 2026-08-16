import React from 'react';

const PageHeader = ({ title, subtitle, children, action }: any) => (
  <div className="mb-6 min-w-0">
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl lg:text-3xl break-words">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-400 sm:text-base break-words">{subtitle}</p> : null}
      </div>
      {(children || action) ? (
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{children || action}</div>
      ) : null}
    </div>
  </div>
);

export default PageHeader;
