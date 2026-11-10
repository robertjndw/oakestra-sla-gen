import * as React from "react"
import { cn } from "cn"
import { Popover as PopoverPrimitive } from "radix-ui"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "slagen:z-50 slagen:flex slagen:w-72 slagen:origin-(--radix-popover-content-transform-origin) slagen:flex-col slagen:gap-4 slagen:rounded-md slagen:bg-popover slagen:p-4 slagen:text-sm slagen:text-popover-foreground slagen:shadow-md slagen:ring-1 slagen:ring-foreground/10 slagen:outline-hidden slagen:duration-100 slagen:data-[side=bottom]:slide-in-from-top-2 slagen:data-[side=left]:slide-in-from-right-2 slagen:data-[side=right]:slide-in-from-left-2 slagen:data-[side=top]:slide-in-from-bottom-2 slagen:data-open:animate-in slagen:data-open:fade-in-0 slagen:data-open:zoom-in-95 slagen:data-closed:animate-out slagen:data-closed:fade-out-0 slagen:data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("slagen:flex slagen:flex-col slagen:gap-1 slagen:text-sm", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("slagen:font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("slagen:text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
