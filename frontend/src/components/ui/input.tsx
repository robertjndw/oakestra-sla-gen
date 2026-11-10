import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "slagen:h-9 slagen:w-full slagen:min-w-0 slagen:rounded-md slagen:border slagen:border-input slagen:bg-transparent slagen:px-2.5 slagen:py-1 slagen:text-base slagen:shadow-xs slagen:transition-[color,box-shadow] slagen:outline-none slagen:file:inline-flex slagen:file:h-7 slagen:file:border-0 slagen:file:bg-transparent slagen:file:text-sm slagen:file:font-medium slagen:file:text-foreground slagen:placeholder:text-muted-foreground slagen:focus-visible:border-ring slagen:focus-visible:ring-3 slagen:focus-visible:ring-ring/50 slagen:disabled:pointer-events-none slagen:disabled:cursor-not-allowed slagen:disabled:opacity-50 slagen:aria-invalid:border-destructive slagen:aria-invalid:ring-3 slagen:aria-invalid:ring-destructive/20 slagen:md:text-sm slagen:dark:bg-input/30 slagen:dark:aria-invalid:border-destructive/50 slagen:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
