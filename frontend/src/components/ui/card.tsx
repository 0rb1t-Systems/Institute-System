import React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm',
      '[.tenant-shell_&]:rounded-[var(--ds-radius-xl,16px)] [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)] [.tenant-shell_&]:shadow-[var(--ds-shadow-card,0_1px_2px_#1F8A5B14,0_8px_24px_#1F8A5B0A)]',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      '[.tenant-shell_&]:text-[17px] [.tenant-shell_&]:font-bold [.tenant-shell_&]:tracking-[-0.01em] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)]',
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <p
    ref={ref}
    className={cn(
      'text-sm text-muted-foreground',
      '[.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]',
      className,
    )}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
