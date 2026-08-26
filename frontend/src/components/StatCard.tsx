import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const StatCard = ({ title, value, icon, description }) => (
  <Card
    className={cn(
      'h-full border-slate-800 bg-slate-900/50 transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:shadow-[0_12px_32px_rgba(0,0,0,0.28)]',
      '[.platform-shell_&]:bg-[var(--pf-surface)] [.platform-shell_&]:border-[var(--pf-line)] [.platform-shell_&]:hover:border-teal-500/35',
      '[.tenant-shell_&]:bg-[var(--tenant-surface)] [.tenant-shell_&]:border-[var(--tenant-line)] [.tenant-shell_&]:hover:border-[color-mix(in_srgb,var(--brand-primary)_35%,transparent)] [.tenant-shell_&]:hover:shadow-[0_14px_36px_color-mix(in_srgb,var(--brand-primary)_12%,transparent)]',
    )}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-300 [.platform-shell_&]:text-[var(--pf-muted)] [.tenant-shell_&]:text-[var(--tenant-muted)]">{title}</CardTitle>
      <div className="rounded-md bg-white/5 p-1.5 text-primary [.platform-shell_&]:bg-teal-500/10 [.tenant-shell_&]:bg-[color-mix(in_srgb,var(--brand-primary)_12%,transparent)] [.tenant-shell_&]:text-[var(--brand-primary)]">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold text-white [.platform-shell_&]:text-[var(--pf-text)] [.tenant-shell_&]:text-[var(--tenant-text)]">{value}</div>
      {description ? <p className="mt-1 text-xs text-slate-400 [.platform-shell_&]:text-[var(--pf-faint)] [.tenant-shell_&]:text-[var(--tenant-muted)]">{description}</p> : null}
    </CardContent>
  </Card>
);

export default StatCard;
