"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "slagen:peer slagen:group/switch slagen:relative slagen:inline-flex slagen:shrink-0 slagen:items-center slagen:rounded-full slagen:border slagen:border-transparent slagen:shadow-xs slagen:transition-all slagen:outline-none slagen:group-has-[:focus-visible]/field-label:border-transparent slagen:group-has-[:focus-visible]/field-label:ring-0 slagen:after:absolute slagen:after:-inset-x-3 slagen:after:-inset-y-2 slagen:focus-visible:border-ring slagen:focus-visible:ring-3 slagen:focus-visible:ring-ring/50 slagen:aria-invalid:border-destructive slagen:aria-invalid:ring-3 slagen:aria-invalid:ring-destructive/20 slagen:data-[size=default]:h-[18.4px] slagen:data-[size=default]:w-[32px] slagen:data-[size=sm]:h-[14px] slagen:data-[size=sm]:w-[24px] slagen:dark:aria-invalid:border-destructive/50 slagen:dark:aria-invalid:ring-destructive/40 slagen:data-checked:bg-primary slagen:data-unchecked:bg-input slagen:dark:data-unchecked:bg-input/80 slagen:data-disabled:cursor-not-allowed slagen:data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="slagen:pointer-events-none slagen:block slagen:rounded-full slagen:bg-background slagen:ring-0 slagen:transition-transform slagen:group-data-[size=default]/switch:size-4 slagen:group-data-[size=sm]/switch:size-3 slagen:group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] slagen:group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] slagen:dark:data-checked:bg-primary-foreground slagen:group-data-[size=default]/switch:data-unchecked:translate-x-0 slagen:group-data-[size=sm]/switch:data-unchecked:translate-x-0 slagen:dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
