import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [.tenant-shell_&]:rounded-[var(--ds-radius-sm,6px)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 [.tenant-shell_&]:bg-[var(--ds-primary,#1F8A5B)] [.tenant-shell_&]:text-[var(--ds-text-on-primary,#fff)]",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 [.tenant-shell_&]:bg-[var(--ds-primary-soft,#ECFDF5)] [.tenant-shell_&]:text-[var(--ds-primary,#1F8A5B)]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 [.tenant-shell_&]:bg-[var(--ds-danger-bg,#FEF2F2)] [.tenant-shell_&]:text-[var(--ds-danger,#DC2626)]",
        outline: "text-foreground [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]",
        success:
          "border-transparent bg-[var(--ds-success-bg,#ECFDF5)] text-[var(--ds-success,#059669)]",
        warning:
          "border-transparent bg-[var(--ds-warning-bg,#FFF7ED)] text-[var(--ds-warning,#C2410C)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }: any) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
