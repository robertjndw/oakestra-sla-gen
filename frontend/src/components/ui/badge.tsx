import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "slagen:group/badge slagen:inline-flex slagen:h-5 slagen:w-fit slagen:shrink-0 slagen:items-center slagen:justify-center slagen:gap-1 slagen:overflow-hidden slagen:rounded-md slagen:border slagen:border-transparent slagen:px-2 slagen:py-0.5 slagen:text-xs slagen:font-medium slagen:whitespace-nowrap slagen:transition-all slagen:focus-visible:border-ring slagen:focus-visible:ring-[3px] slagen:focus-visible:ring-ring/50 slagen:has-data-[icon=inline-end]:pr-1.5 slagen:has-data-[icon=inline-start]:pl-1.5 slagen:aria-invalid:border-destructive slagen:aria-invalid:ring-destructive/20 slagen:dark:aria-invalid:ring-destructive/40 slagen:[&>svg]:pointer-events-none slagen:[&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "slagen:bg-primary slagen:text-primary-foreground slagen:[a]:hover:bg-primary/80",
        secondary:
          "slagen:bg-secondary slagen:text-secondary-foreground slagen:[a]:hover:bg-secondary/80",
        destructive:
          "slagen:bg-destructive/10 slagen:text-destructive slagen:focus-visible:ring-destructive/20 slagen:dark:bg-destructive/20 slagen:dark:focus-visible:ring-destructive/40 slagen:[a]:hover:bg-destructive/20",
        outline:
          "slagen:border-border slagen:text-foreground slagen:[a]:hover:bg-muted slagen:[a]:hover:text-muted-foreground",
        ghost:
          "slagen:hover:bg-muted slagen:hover:text-muted-foreground slagen:dark:hover:bg-muted/50",
        link: "slagen:text-primary slagen:underline-offset-4 slagen:hover:underline",
        success: "slagen:bg-accent slagen:text-accent-foreground",
        warning: "slagen:bg-amber-soft slagen:text-amber",
        danger: "slagen:bg-rust-soft slagen:text-rust",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
