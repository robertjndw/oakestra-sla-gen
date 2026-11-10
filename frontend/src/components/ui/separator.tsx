"use client"

import * as React from "react"
import { cn } from "cn"
import { Separator as SeparatorPrimitive } from "radix-ui"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "slagen:shrink-0 slagen:bg-border slagen:data-horizontal:h-px slagen:data-horizontal:w-full slagen:data-vertical:w-px slagen:data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
