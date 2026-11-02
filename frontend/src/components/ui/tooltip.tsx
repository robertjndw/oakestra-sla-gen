import * as React from "react"
import { cn } from "cn"
import { Tooltip as TooltipPrimitive } from "radix-ui"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "slagen:z-50 slagen:inline-flex slagen:w-fit slagen:max-w-xs slagen:origin-(--radix-tooltip-content-transform-origin) slagen:items-center slagen:gap-1.5 slagen:rounded-md slagen:bg-foreground slagen:px-3 slagen:py-1.5 slagen:text-xs slagen:text-background slagen:has-data-[slot=kbd]:pr-1.5 slagen:data-[side=bottom]:slide-in-from-top-2 slagen:data-[side=left]:slide-in-from-right-2 slagen:data-[side=right]:slide-in-from-left-2 slagen:data-[side=top]:slide-in-from-bottom-2 slagen:**:data-[slot=kbd]:relative slagen:**:data-[slot=kbd]:isolate slagen:**:data-[slot=kbd]:z-50 slagen:**:data-[slot=kbd]:rounded-sm slagen:data-[state=delayed-open]:animate-in slagen:data-[state=delayed-open]:fade-in-0 slagen:data-[state=delayed-open]:zoom-in-95 slagen:data-open:animate-in slagen:data-open:fade-in-0 slagen:data-open:zoom-in-95 slagen:data-closed:animate-out slagen:data-closed:fade-out-0 slagen:data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="slagen:z-50 slagen:size-2.5 slagen:translate-y-[calc(-50%_-_2px)] slagen:rotate-45 slagen:rounded-[2px] slagen:bg-foreground slagen:fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
