import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "slagen:flex slagen:flex-col slagen:gap-6 slagen:has-[>[data-slot=checkbox-group]]:gap-3 slagen:has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "slagen:mb-3 slagen:font-medium slagen:data-[variant=label]:text-sm slagen:data-[variant=legend]:text-base",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "slagen:group/field-group slagen:@container/field-group slagen:flex slagen:w-full slagen:flex-col slagen:gap-7 slagen:data-[slot=checkbox-group]:gap-3 slagen:*:data-[slot=field-group]:gap-4",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "slagen:group/field slagen:flex slagen:w-full slagen:gap-3 slagen:data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "slagen:flex-col slagen:*:w-full slagen:[&>[class~='slagen:sr-only']]:w-auto",
        horizontal:
          "slagen:flex-row slagen:items-center slagen:has-[>[data-slot=field-content]]:items-start slagen:*:data-[slot=field-label]:flex-auto slagen:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "slagen:flex-col slagen:*:w-full slagen:@md/field-group:flex-row slagen:@md/field-group:items-center slagen:@md/field-group:*:w-auto slagen:@md/field-group:has-[>[data-slot=field-content]]:items-start slagen:@md/field-group:*:data-[slot=field-label]:flex-auto slagen:[&>[class~='slagen:sr-only']]:w-auto slagen:@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "slagen:group/field-content slagen:flex slagen:flex-1 slagen:flex-col slagen:gap-1 slagen:leading-snug",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "slagen:group/field-label slagen:peer/field-label slagen:flex slagen:w-fit slagen:gap-2 slagen:leading-snug slagen:group-data-[disabled=true]/field:opacity-50 slagen:has-data-checked:border-primary/30 slagen:has-data-checked:bg-primary/5 slagen:has-[>[data-slot=field]]:rounded-md slagen:has-[>[data-slot=field]]:border slagen:has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 slagen:has-[>[data-slot=field]]:has-[:focus-visible]:border-ring slagen:has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 slagen:has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 slagen:*:data-[slot=field]:p-3 slagen:dark:has-data-checked:border-primary/20 slagen:dark:has-data-checked:bg-primary/10",
        "slagen:has-[>[data-slot=field]]:w-full slagen:has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "slagen:flex slagen:w-fit slagen:items-center slagen:gap-2 slagen:text-sm slagen:font-medium slagen:group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "slagen:text-left slagen:text-sm slagen:leading-normal slagen:font-normal slagen:text-muted-foreground slagen:group-has-data-horizontal/field:text-balance slagen:[[data-variant=legend]+&]:-mt-1.5",
        "slagen:last:mt-0 slagen:nth-last-2:-mt-1",
        "slagen:[&>a]:underline slagen:[&>a]:underline-offset-4 slagen:[&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "slagen:relative slagen:-my-2 slagen:h-5 slagen:text-sm slagen:group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="slagen:absolute slagen:inset-0 slagen:top-1/2" />
      {children && (
        <span
          className="slagen:relative slagen:mx-auto slagen:block slagen:w-fit slagen:bg-background slagen:px-2 slagen:text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="slagen:ml-4 slagen:flex slagen:list-disc slagen:flex-col slagen:gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("slagen:text-sm slagen:font-normal slagen:text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
