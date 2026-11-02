import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "slagen:flex slagen:w-full slagen:min-w-0 slagen:flex-1 slagen:flex-col slagen:items-center slagen:justify-center slagen:gap-4 slagen:rounded-lg slagen:border-dashed slagen:p-12 slagen:text-center slagen:text-balance",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("slagen:flex slagen:max-w-sm slagen:flex-col slagen:items-center slagen:gap-2", className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "slagen:mb-2 slagen:flex slagen:shrink-0 slagen:items-center slagen:justify-center slagen:[&_svg]:pointer-events-none slagen:[&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "slagen:bg-transparent",
        icon: "slagen:flex slagen:size-10 slagen:shrink-0 slagen:items-center slagen:justify-center slagen:rounded-lg slagen:bg-muted slagen:text-foreground slagen:[&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn(
        "slagen:font-heading slagen:text-lg slagen:font-medium slagen:tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "slagen:text-sm/relaxed slagen:text-muted-foreground slagen:[&>a]:underline slagen:[&>a]:underline-offset-4 slagen:[&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "slagen:flex slagen:w-full slagen:max-w-sm slagen:min-w-0 slagen:flex-col slagen:items-center slagen:gap-4 slagen:text-sm slagen:text-balance",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
