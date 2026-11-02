import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "slagen:group/input-group slagen:relative slagen:flex slagen:h-9 slagen:w-full slagen:min-w-0 slagen:items-center slagen:rounded-md slagen:border slagen:border-input slagen:shadow-xs slagen:transition-[color,box-shadow] slagen:outline-none slagen:in-data-[slot=combobox-content]:focus-within:border-inherit slagen:in-data-[slot=combobox-content]:focus-within:ring-0 slagen:has-[[data-slot=input-group-control]:focus-visible]:border-ring slagen:has-[[data-slot=input-group-control]:focus-visible]:ring-3 slagen:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 slagen:has-[[data-slot][aria-invalid=true]]:border-destructive slagen:has-[[data-slot][aria-invalid=true]]:ring-3 slagen:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 slagen:has-[>[data-align=block-end]]:h-auto slagen:has-[>[data-align=block-end]]:flex-col slagen:has-[>[data-align=block-start]]:h-auto slagen:has-[>[data-align=block-start]]:flex-col slagen:has-[>textarea]:h-auto slagen:dark:bg-input/30 slagen:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 slagen:has-[>[data-align=block-end]]:[&>input]:pt-3 slagen:has-[>[data-align=block-start]]:[&>input]:pb-3 slagen:has-[>[data-align=inline-end]]:[&>input]:pr-1.5 slagen:has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "slagen:flex slagen:h-auto slagen:cursor-text slagen:items-center slagen:justify-center slagen:gap-2 slagen:py-1.5 slagen:text-sm slagen:font-medium slagen:text-muted-foreground slagen:select-none slagen:group-data-[disabled=true]/input-group:opacity-50 slagen:[&>kbd]:rounded-[calc(var(--radius)-5px)] slagen:[&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "slagen:order-first slagen:pl-2 slagen:has-[>button]:-ml-1 slagen:has-[>kbd]:ml-[-0.15rem]",
        "inline-end":
          "slagen:order-last slagen:pr-2 slagen:has-[>button]:-mr-1 slagen:has-[>kbd]:mr-[-0.15rem]",
        "block-start":
          "slagen:order-first slagen:w-full slagen:justify-start slagen:px-2.5 slagen:pt-2 slagen:group-has-[>input]/input-group:pt-2 slagen:[[class~='slagen:border-b']]:pb-2",
        "block-end":
          "slagen:order-last slagen:w-full slagen:justify-start slagen:px-2.5 slagen:pb-2 slagen:group-has-[>input]/input-group:pb-2 slagen:[[class~='slagen:border-t']]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "slagen:flex slagen:items-center slagen:gap-2 slagen:text-sm slagen:shadow-none",
  {
    variants: {
      size: {
        xs: "slagen:h-6 slagen:gap-1 slagen:rounded-[calc(var(--radius)-5px)] slagen:px-1.5 slagen:[&>svg:not([class*='size-'])]:size-3.5",
        sm: "",
        "icon-xs":
          "slagen:size-6 slagen:rounded-[calc(var(--radius)-5px)] slagen:p-0 slagen:has-[>svg]:p-0",
        "icon-sm": "slagen:size-8 slagen:p-0 slagen:has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "slagen:flex slagen:items-center slagen:gap-2 slagen:text-sm slagen:text-muted-foreground slagen:[&_svg]:pointer-events-none slagen:[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "slagen:flex-1 slagen:rounded-none slagen:border-0 slagen:bg-transparent slagen:shadow-none slagen:ring-0 slagen:focus-visible:ring-0 slagen:aria-invalid:ring-0 slagen:dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "slagen:flex-1 slagen:resize-none slagen:rounded-none slagen:border-0 slagen:bg-transparent slagen:py-2 slagen:shadow-none slagen:ring-0 slagen:focus-visible:ring-0 slagen:aria-invalid:ring-0 slagen:dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
