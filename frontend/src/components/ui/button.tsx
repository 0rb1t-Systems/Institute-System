import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [.tenant-shell_&]:rounded-[var(--ds-radius-md,8px)] [.tenant-shell_&]:focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 [.tenant-shell_&]:bg-[var(--ds-primary,#0B3D2E)] [.tenant-shell_&]:text-[var(--ds-text-on-primary,#fff)] [.tenant-shell_&]:hover:bg-[var(--ds-primary-hover,#082E22)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 [.tenant-shell_&]:bg-[var(--ds-danger,#DC2626)] [.tenant-shell_&]:hover:bg-[var(--ds-danger-hover,#B91C1C)]",
        outline:
          "border border-input bg-background hover:bg-slate-800 hover:text-slate-100 [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:text-[var(--ds-text-primary,#122018)] [.tenant-shell_&]:hover:bg-[var(--ds-surface-muted,#F7FAF8)] [.tenant-shell_&]:hover:text-[var(--ds-text-primary,#122018)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 [.tenant-shell_&]:bg-[var(--ds-primary-soft,#ECFDF5)] [.tenant-shell_&]:text-[var(--ds-primary,#0B3D2E)] [.tenant-shell_&]:hover:bg-[var(--ds-primary-muted,#D1FAE5)]",
        ghost:
          "hover:bg-slate-800 hover:text-slate-100 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)] [.tenant-shell_&]:hover:bg-[var(--ds-surface-muted,#F7FAF8)] [.tenant-shell_&]:hover:text-[var(--ds-text-primary,#122018)]",
        link: "text-primary underline-offset-4 hover:underline [.tenant-shell_&]:text-[var(--ds-primary,#0B3D2E)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }: any, ref: any) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
