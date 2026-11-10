import * as React from "react"
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { ArrowDownIcon } from "lucide-react"

function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>
) {
  return <MessageScrollerPrimitive.Provider {...props} />
}

function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "slagen:group/message-scroller slagen:relative slagen:flex slagen:size-full slagen:min-h-0 slagen:flex-col slagen:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
  return (
    <MessageScrollerPrimitive.Viewport
      data-slot="message-scroller-viewport"
      className={cn(
        "slagen:size-full slagen:min-h-0 slagen:min-w-0 slagen:scroll-fade-b slagen:scrollbar-thin slagen:scrollbar-gutter-stable slagen:overflow-y-auto slagen:overscroll-contain slagen:contain-content slagen:data-autoscrolling:scrollbar-thumb-transparent slagen:data-autoscrolling:scrollbar-track-transparent slagen:data-pending-scroll:invisible",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn("slagen:flex slagen:h-max slagen:min-h-full slagen:flex-col slagen:gap-8", className)}
      {...props}
    />
  )
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn(
        "slagen:min-w-0 slagen:shrink-0 slagen:[contain-intrinsic-size:auto_10rem] slagen:[content-visibility:auto]",
        className
      )}
      {...props}
    />
  )
}

function MessageScrollerButton({
  direction = "end",
  className,
  children,
  render,
  variant = "secondary",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      className={cn(
        "slagen:absolute slagen:inset-s-1/2 slagen:-translate-x-1/2 slagen:border-border slagen:bg-background slagen:text-foreground slagen:transition-[translate,scale,opacity] slagen:duration-200 slagen:hover:bg-muted slagen:hover:text-foreground slagen:data-[active=false]:pointer-events-none slagen:data-[active=false]:scale-95 slagen:data-[active=false]:opacity-0 slagen:data-[active=false]:duration-400 slagen:data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] slagen:data-[active=true]:translate-y-0 slagen:data-[active=true]:scale-100 slagen:data-[active=true]:opacity-100 slagen:data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] slagen:data-[direction=end]:bottom-4 slagen:data-[direction=end]:data-[active=false]:translate-y-full slagen:data-[direction=start]:top-4 slagen:data-[direction=start]:data-[active=false]:-translate-y-full slagen:rtl:translate-x-1/2 slagen:data-[direction=start]:[&_svg]:rotate-180",
        className
      )}
      render={render ?? <Button variant={variant} size={size} />}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon
          />
          <span className="slagen:sr-only">
            {direction === "end" ? "Scroll to end" : "Scroll to start"}
          </span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  )
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
}
