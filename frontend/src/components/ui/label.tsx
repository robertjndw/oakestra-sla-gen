import * as React from "react"
import { cn } from "cn"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "slagen:flex slagen:items-center slagen:gap-2 slagen:text-sm slagen:leading-none slagen:font-medium slagen:select-none slagen:group-data-[disabled=true]:pointer-events-none slagen:group-data-[disabled=true]:opacity-50 slagen:peer-disabled:cursor-not-allowed slagen:peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
