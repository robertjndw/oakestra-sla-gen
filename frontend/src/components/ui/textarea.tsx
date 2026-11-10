import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "slagen:flex slagen:field-sizing-content slagen:min-h-16 slagen:w-full slagen:rounded-md slagen:border slagen:border-input slagen:bg-transparent slagen:px-2.5 slagen:py-2 slagen:text-base slagen:shadow-xs slagen:transition-[color,box-shadow] slagen:outline-none slagen:placeholder:text-muted-foreground slagen:focus-visible:border-ring slagen:focus-visible:ring-3 slagen:focus-visible:ring-ring/50 slagen:disabled:cursor-not-allowed slagen:disabled:opacity-50 slagen:aria-invalid:border-destructive slagen:aria-invalid:ring-3 slagen:aria-invalid:ring-destructive/20 slagen:md:text-sm slagen:dark:bg-input/30 slagen:dark:aria-invalid:border-destructive/50 slagen:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
