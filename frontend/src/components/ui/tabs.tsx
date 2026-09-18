import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-auto min-h-10 max-w-full flex-wrap items-center justify-start gap-1 rounded-md bg-muted p-1 text-muted-foreground sm:justify-center",
      "[.tenant-shell_&]:gap-1 [.tenant-shell_&]:rounded-[var(--ds-radius-md,8px)] [.tenant-shell_&]:border [.tenant-shell_&]:border-[var(--ds-border,#DDE5DF)] [.tenant-shell_&]:bg-[var(--ds-surface,#fff)] [.tenant-shell_&]:p-1 [.tenant-shell_&]:text-[var(--ds-text-secondary,#5B6B61)]",
      className
    )}
    {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      "[.tenant-shell_&]:rounded-[var(--ds-radius-sm,6px)] [.tenant-shell_&]:focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)] [.tenant-shell_&]:data-[state=active]:bg-[var(--ds-primary-soft,#ECFDF5)] [.tenant-shell_&]:data-[state=active]:text-[var(--ds-primary,#1F8A5B)] [.tenant-shell_&]:data-[state=active]:shadow-none",
      className
    )}
    {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }: any, ref: any) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "[.tenant-shell_&]:focus-visible:ring-[var(--ds-focus-ring,#1F8A5B)]",
      className
    )}
    {...props} />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
