import React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }: any, ref: any) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        '[.tenant-shell_&]:h-10 [.tenant-shell_&]:rounded-[var(--ds-radius-md,8px)] [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)] [.tenant-shell_&]:placeholder:text-[var(--ds-text-tertiary,#8A978E)] [.tenant-shell_&]:focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)] [.tenant-shell_&]:focus-visible:ring-offset-0',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
