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
      className={cn("slagen:min-h-0 slagen:flex-1", className)}
      {...props}
    />
  );
}

// The class lands on the library's inner wrapper, a plain block. A single stretched grid row
// gives the pane a definite height, so its own scroll area and pinned composer still work.
function ResizablePanel({ className, ...props }: ComponentProps<typeof Panel>) {
  return <Panel className={cn("slagen:grid slagen:grid-rows-[minmax(0,1fr)]", className)} {...props} />;
}

function ResizableHandle({ className, ...props }: ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        // The 1px line is the divider; the ::after widens the grab area without shifting layout.
        "slagen:relative slagen:w-px slagen:shrink-0 slagen:bg-border slagen:transition-colors slagen:outline-none",
        "slagen:after:absolute slagen:after:inset-y-0 slagen:after:left-1/2 slagen:after:w-3 slagen:after:-translate-x-1/2",
        "slagen:hover:bg-primary slagen:data-[separator=active]:bg-primary",
        "slagen:focus-visible:bg-primary slagen:focus-visible:ring-2 slagen:focus-visible:ring-ring slagen:focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    />
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
