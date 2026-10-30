import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import type { ComponentProps } from "react";
import { readRaw, writeRaw } from "@/lib/storage";
import { cn } from "@/lib/utils";

// The library persists through localStorage, which throws in private windows or with site
// data blocked. A split that is not remembered beats a crashed app.
const safeStorage = {
  getItem: (key: string) => readRaw("local", key),
  setItem: (key: string, value: string) => void writeRaw("local", key, value),
};

function ResizablePanelGroup({
  id,
  className,
  ...props
}: Omit<ComponentProps<typeof Group>, "id" | "defaultLayout" | "onLayoutChanged"> & { id: string }) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id,
    storage: safeStorage,
    onlySaveAfterUserInteractions: true,
  });
  return (
    <Group
      id={id}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className={cn("min-h-0 flex-1", className)}
      {...props}
    />
  );
}

// The class lands on the library's inner wrapper, a plain block. A single stretched grid row
// gives the pane a definite height, so its own scroll area and pinned composer still work.
function ResizablePanel({ className, ...props }: ComponentProps<typeof Panel>) {
  return <Panel className={cn("grid grid-rows-[minmax(0,1fr)]", className)} {...props} />;
}

function ResizableHandle({ className, ...props }: ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        // The 1px line is the divider; the ::after widens the grab area without shifting layout.
        "relative w-px shrink-0 bg-border transition-colors outline-none",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2",
        "hover:bg-primary data-[separator=active]:bg-primary",
        "focus-visible:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    />
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
