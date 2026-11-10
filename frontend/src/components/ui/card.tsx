import * as React from "react"
import { cn } from "cn"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "slagen:group/card slagen:flex slagen:flex-col slagen:gap-(--card-spacing) slagen:overflow-hidden slagen:rounded-xl slagen:bg-card slagen:py-(--card-spacing) slagen:text-sm slagen:text-card-foreground slagen:ring-1 slagen:ring-border slagen:[--card-spacing:--spacing(6)] slagen:has-[>img:first-child]:pt-0 slagen:data-[size=sm]:[--card-spacing:--spacing(4)] slagen:*:[img:first-child]:rounded-t-xl slagen:*:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "slagen:group/card-header slagen:@container/card-header slagen:grid slagen:auto-rows-min slagen:items-start slagen:gap-1 slagen:rounded-t-xl slagen:px-(--card-spacing) slagen:has-data-[slot=card-action]:grid-cols-[1fr_auto] slagen:has-data-[slot=card-description]:grid-rows-[auto_auto] slagen:[[class~='slagen:border-b']]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "slagen:font-heading slagen:text-base slagen:leading-normal slagen:font-medium slagen:group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("slagen:text-sm slagen:text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "slagen:col-start-2 slagen:row-span-2 slagen:row-start-1 slagen:self-start slagen:justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("slagen:flex slagen:flex-col slagen:gap-3 slagen:px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "slagen:flex slagen:items-center slagen:rounded-b-xl slagen:px-(--card-spacing) slagen:[[class~='slagen:border-t']]:pt-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
