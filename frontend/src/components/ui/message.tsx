import * as React from "react"
import { cn } from "cn"

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("slagen:flex slagen:min-w-0 slagen:flex-col slagen:gap-2", className)}
      {...props}
    />
  )
}

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "slagen:group/message slagen:relative slagen:flex slagen:w-full slagen:min-w-0 slagen:gap-2 slagen:text-sm slagen:data-[align=end]:flex-row-reverse",
        className
      )}
      {...props}
    />
  )
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn(
        "slagen:flex slagen:w-fit slagen:min-w-8 slagen:shrink-0 slagen:items-center slagen:justify-center slagen:self-end slagen:overflow-hidden slagen:rounded-full slagen:bg-muted slagen:group-has-data-[slot=message-footer]/message:-translate-y-8",
        className
      )}
      {...props}
    />
  )
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "slagen:flex slagen:w-full slagen:min-w-0 slagen:flex-col slagen:gap-2.5 slagen:wrap-break-word slagen:group-data-[align=end]/message:*:data-slot:self-end",
        className
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "slagen:flex slagen:max-w-full slagen:min-w-0 slagen:items-center slagen:px-3 slagen:text-xs slagen:font-medium slagen:text-muted-foreground slagen:group-has-data-[variant=ghost]/message:px-0",
        className
      )}
      {...props}
    />
  )
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "slagen:flex slagen:max-w-full slagen:min-w-0 slagen:items-center slagen:px-3 slagen:text-xs slagen:font-medium slagen:text-muted-foreground slagen:group-has-data-[variant=ghost]/message:px-0 slagen:group-data-[align=end]/message:justify-end",
        className
      )}
      {...props}
    />
  )
}

export {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
}
