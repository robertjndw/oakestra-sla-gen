import * as React from "react"
import { cn } from "cn"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("slagen:relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="slagen:size-full slagen:rounded-[inherit] slagen:transition-[color,box-shadow] slagen:outline-none slagen:focus-visible:ring-[3px] slagen:focus-visible:ring-ring/50 slagen:focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "slagen:flex slagen:touch-none slagen:p-px slagen:transition-colors slagen:select-none slagen:data-horizontal:h-2.5 slagen:data-horizontal:flex-col slagen:data-horizontal:border-t slagen:data-horizontal:border-t-transparent slagen:data-vertical:h-full slagen:data-vertical:w-2.5 slagen:data-vertical:border-l slagen:data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="slagen:relative slagen:flex-1 slagen:rounded-full slagen:bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
