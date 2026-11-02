import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "slagen:group/button slagen:inline-flex slagen:shrink-0 slagen:items-center slagen:justify-center slagen:rounded-md slagen:border slagen:border-transparent slagen:bg-clip-padding slagen:text-sm slagen:font-medium slagen:whitespace-nowrap slagen:transition-all slagen:outline-none slagen:select-none slagen:focus-visible:border-ring slagen:focus-visible:ring-3 slagen:focus-visible:ring-ring/50 slagen:active:not-aria-[haspopup]:translate-y-px slagen:disabled:pointer-events-none slagen:disabled:opacity-50 slagen:aria-invalid:border-destructive slagen:aria-invalid:ring-3 slagen:aria-invalid:ring-destructive/20 slagen:dark:aria-invalid:border-destructive/50 slagen:dark:aria-invalid:ring-destructive/40 slagen:[&_svg]:pointer-events-none slagen:[&_svg]:shrink-0 slagen:[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "slagen:bg-primary slagen:text-primary-foreground slagen:hover:bg-primary/80",
        outline:
          "slagen:border-border slagen:bg-background slagen:shadow-xs slagen:hover:bg-muted slagen:hover:text-foreground slagen:aria-expanded:bg-muted slagen:aria-expanded:text-foreground slagen:dark:border-input slagen:dark:bg-input/30 slagen:dark:hover:bg-input/50",
        secondary:
          "slagen:bg-secondary slagen:text-secondary-foreground slagen:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] slagen:aria-expanded:bg-secondary slagen:aria-expanded:text-secondary-foreground",
        ghost:
          "slagen:hover:bg-muted slagen:hover:text-foreground slagen:aria-expanded:bg-muted slagen:aria-expanded:text-foreground slagen:dark:hover:bg-muted/50",
        destructive:
          "slagen:bg-destructive/10 slagen:text-destructive slagen:hover:bg-destructive/20 slagen:focus-visible:border-destructive/40 slagen:focus-visible:ring-destructive/20 slagen:dark:bg-destructive/20 slagen:dark:hover:bg-destructive/30 slagen:dark:focus-visible:ring-destructive/40",
        link: "slagen:text-primary slagen:underline-offset-4 slagen:hover:underline",
      },
      size: {
        default:
          "slagen:h-9 slagen:gap-1.5 slagen:px-2.5 slagen:in-data-[slot=button-group]:rounded-md slagen:has-data-[icon=inline-end]:pr-2 slagen:has-data-[icon=inline-start]:pl-2",
        xs: "slagen:h-6 slagen:gap-1 slagen:rounded-[min(calc(var(--radius)*0.8),8px)] slagen:px-2 slagen:text-xs slagen:in-data-[slot=button-group]:rounded-md slagen:has-data-[icon=inline-end]:pr-1.5 slagen:has-data-[icon=inline-start]:pl-1.5 slagen:[&_svg:not([class*='size-'])]:size-3",
        sm: "slagen:h-8 slagen:gap-1 slagen:rounded-[min(calc(var(--radius)*0.8),10px)] slagen:px-2.5 slagen:in-data-[slot=button-group]:rounded-md slagen:has-data-[icon=inline-end]:pr-1.5 slagen:has-data-[icon=inline-start]:pl-1.5",
        lg: "slagen:h-10 slagen:gap-1.5 slagen:px-2.5 slagen:has-data-[icon=inline-end]:pr-2 slagen:has-data-[icon=inline-start]:pl-2",
        icon: "slagen:size-9",
        "icon-xs":
          "slagen:size-6 slagen:rounded-[min(calc(var(--radius)*0.8),8px)] slagen:in-data-[slot=button-group]:rounded-md slagen:[&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "slagen:size-8 slagen:rounded-[min(calc(var(--radius)*0.8),10px)] slagen:in-data-[slot=button-group]:rounded-md",
        "icon-lg": "slagen:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
