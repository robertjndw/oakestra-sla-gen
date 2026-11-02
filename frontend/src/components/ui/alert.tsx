import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "slagen:group/alert slagen:relative slagen:grid slagen:w-full slagen:gap-0.5 slagen:rounded-lg slagen:border slagen:px-4 slagen:py-3 slagen:text-left slagen:text-sm slagen:has-data-[slot=alert-action]:relative slagen:has-data-[slot=alert-action]:pr-18 slagen:has-[>svg]:grid-cols-[auto_1fr] slagen:has-[>svg]:gap-x-2.5 slagen:*:[svg]:row-span-2 slagen:*:[svg]:translate-y-0.5 slagen:*:[svg]:text-current slagen:*:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "slagen:bg-card slagen:text-card-foreground",
        destructive:
          "slagen:bg-card slagen:text-destructive slagen:*:data-[slot=alert-description]:text-destructive/90 slagen:*:[svg]:text-current",
        warning:
          "slagen:border-transparent slagen:bg-amber-soft slagen:text-foreground slagen:*:data-[slot=alert-description]:text-foreground/80 slagen:*:[svg]:text-amber",
        danger:
          "slagen:border-transparent slagen:bg-rust-soft slagen:text-rust slagen:*:data-[slot=alert-description]:text-rust/90 slagen:*:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "slagen:font-medium slagen:group-has-[>svg]/alert:col-start-2 slagen:[&_a]:underline slagen:[&_a]:underline-offset-3 slagen:[&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "slagen:text-sm slagen:text-balance slagen:text-muted-foreground slagen:md:text-pretty slagen:[&_a]:underline slagen:[&_a]:underline-offset-3 slagen:[&_a]:hover:text-foreground slagen:[&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("slagen:absolute slagen:top-2.5 slagen:right-3", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
