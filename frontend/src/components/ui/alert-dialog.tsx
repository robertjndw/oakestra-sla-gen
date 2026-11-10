import * as React from "react"
import { cn } from "cn"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "slagen:fixed slagen:inset-0 slagen:z-50 slagen:bg-black/10 slagen:duration-100 slagen:supports-backdrop-filter:backdrop-blur-xs slagen:data-open:animate-in slagen:data-open:fade-in-0 slagen:data-closed:animate-out slagen:data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  size?: "default" | "sm"
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "slagen:group/alert-dialog-content slagen:fixed slagen:top-1/2 slagen:left-1/2 slagen:z-50 slagen:grid slagen:w-full slagen:-translate-x-1/2 slagen:-translate-y-1/2 slagen:gap-6 slagen:rounded-xl slagen:bg-popover slagen:p-6 slagen:text-popover-foreground slagen:ring-1 slagen:ring-foreground/10 slagen:duration-100 slagen:outline-none slagen:data-[size=default]:max-w-xs slagen:data-[size=sm]:max-w-xs slagen:data-[size=default]:sm:max-w-lg slagen:data-open:animate-in slagen:data-open:fade-in-0 slagen:data-open:zoom-in-95 slagen:data-closed:animate-out slagen:data-closed:fade-out-0 slagen:data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "slagen:grid slagen:grid-rows-[auto_1fr] slagen:place-items-center slagen:gap-1.5 slagen:text-center slagen:has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] slagen:has-data-[slot=alert-dialog-media]:gap-x-6 slagen:sm:group-data-[size=default]/alert-dialog-content:place-items-start slagen:sm:group-data-[size=default]/alert-dialog-content:text-left slagen:sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "slagen:flex slagen:flex-col-reverse slagen:gap-2 slagen:group-data-[size=sm]/alert-dialog-content:grid slagen:group-data-[size=sm]/alert-dialog-content:grid-cols-2 slagen:sm:flex-row slagen:sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "slagen:mb-2 slagen:inline-flex slagen:size-16 slagen:items-center slagen:justify-center slagen:rounded-md slagen:bg-muted slagen:sm:group-data-[size=default]/alert-dialog-content:row-span-2 slagen:*:[svg:not([class*='size-'])]:size-8",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        "slagen:font-heading slagen:text-lg slagen:font-medium slagen:sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        "slagen:text-sm slagen:text-balance slagen:text-muted-foreground slagen:md:text-pretty slagen:*:[a]:underline slagen:*:[a]:underline-offset-3 slagen:*:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Action
        data-slot="alert-dialog-action"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <Button variant={variant} size={size} asChild>
      <AlertDialogPrimitive.Cancel
        data-slot="alert-dialog-cancel"
        className={cn(className)}
        {...props}
      />
    </Button>
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
