import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "slagen:group/tabs slagen:flex slagen:gap-2 slagen:data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "slagen:group/tabs-list slagen:inline-flex slagen:w-fit slagen:items-center slagen:justify-center slagen:rounded-lg slagen:p-[3px] slagen:text-muted-foreground slagen:group-data-horizontal/tabs:h-9 slagen:group-data-vertical/tabs:h-fit slagen:group-data-vertical/tabs:flex-col slagen:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "slagen:bg-muted",
        line: "slagen:gap-1 slagen:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "slagen:relative slagen:inline-flex slagen:h-[calc(100%-1px)] slagen:flex-1 slagen:items-center slagen:justify-center slagen:gap-1.5 slagen:rounded-md slagen:border slagen:border-transparent slagen:px-2 slagen:py-1 slagen:text-sm slagen:font-medium slagen:whitespace-nowrap slagen:text-foreground/60 slagen:transition-all slagen:group-data-vertical/tabs:w-full slagen:group-data-vertical/tabs:justify-start slagen:hover:text-foreground slagen:focus-visible:border-ring slagen:focus-visible:ring-[3px] slagen:focus-visible:ring-ring/50 slagen:focus-visible:outline-1 slagen:focus-visible:outline-ring slagen:disabled:pointer-events-none slagen:disabled:opacity-50 slagen:has-data-[icon=inline-end]:pr-1.5 slagen:has-data-[icon=inline-start]:pl-1.5 slagen:dark:text-muted-foreground slagen:dark:hover:text-foreground slagen:group-data-[variant=default]/tabs-list:data-active:shadow-sm slagen:group-data-[variant=line]/tabs-list:data-active:shadow-none slagen:[&_svg]:pointer-events-none slagen:[&_svg]:shrink-0 slagen:[&_svg:not([class*='size-'])]:size-4",
        "slagen:group-data-[variant=line]/tabs-list:bg-transparent slagen:group-data-[variant=line]/tabs-list:data-active:bg-transparent slagen:dark:group-data-[variant=line]/tabs-list:data-active:border-transparent slagen:dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "slagen:data-active:bg-background slagen:data-active:text-foreground slagen:dark:data-active:border-input slagen:dark:data-active:bg-input/30 slagen:dark:data-active:text-foreground",
        "slagen:after:absolute slagen:after:bg-foreground slagen:after:opacity-0 slagen:after:transition-opacity slagen:group-data-horizontal/tabs:after:inset-x-0 slagen:group-data-horizontal/tabs:after:bottom-[-5px] slagen:group-data-horizontal/tabs:after:h-0.5 slagen:group-data-vertical/tabs:after:inset-y-0 slagen:group-data-vertical/tabs:after:-right-1 slagen:group-data-vertical/tabs:after:w-0.5 slagen:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("slagen:flex-1 slagen:text-sm slagen:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
