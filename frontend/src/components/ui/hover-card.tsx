"use client"

import * as React from "react"
import { cn } from "cn"
import { HoverCard as HoverCardPrimitive } from "radix-ui"

function HoverCard({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  )
}

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal data-slot="hover-card-portal">
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "slagen:z-50 slagen:w-64 slagen:origin-(--radix-hover-card-content-transform-origin) slagen:rounded-lg slagen:bg-popover slagen:p-4 slagen:text-sm slagen:text-popover-foreground slagen:shadow-md slagen:ring-1 slagen:ring-foreground/10 slagen:outline-hidden slagen:duration-100 slagen:data-[side=bottom]:slide-in-from-top-2 slagen:data-[side=left]:slide-in-from-right-2 slagen:data-[side=right]:slide-in-from-left-2 slagen:data-[side=top]:slide-in-from-bottom-2 slagen:data-open:animate-in slagen:data-open:fade-in-0 slagen:data-open:zoom-in-95 slagen:data-closed:animate-out slagen:data-closed:fade-out-0 slagen:data-closed:zoom-out-95",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}

export { HoverCard, HoverCardTrigger, HoverCardContent }
