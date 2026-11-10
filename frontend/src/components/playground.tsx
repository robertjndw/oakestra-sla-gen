import { ConversationPane } from "@/components/conversation/conversation-pane";
import { OutputPane } from "@/components/output/output-pane";
import { TopBar } from "@/components/topbar/top-bar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorValidationProvider } from "@/hooks/editor-validation-provider";
import { SessionProvider } from "@/hooks/session-provider";
import { useContainerMinWidth } from "@/hooks/use-container-min-width";
import { useHost } from "@/host/host-context";
import { cn } from "@/lib/utils";

/** 64rem, the same as the @5xl container variant (and the viewport's lg) used below. */
export const WIDE_REM = 64;

/**
 * The whole playground: top bar plus the conversation and SLA panes. It sizes itself from
 * `className` and lays out by its own width, so a host can put it in any box. Below 64rem the
 * panes stack and the content grows taller than the box; a fixed-height host has to let it scroll.
 */
export function Playground({ className }: { className?: string }) {
  const { storageKey } = useHost();
  const [rootRef, wide] = useContainerMinWidth<HTMLDivElement>(WIDE_REM);
  return (
    <SessionProvider>
      <EditorValidationProvider>
        <TooltipProvider>
          <div ref={rootRef} className={cn("slagen:@container slagen:flex slagen:flex-col", className)}>
            <TopBar />
            {/* Swapping layouts at the breakpoint would remount both panes and drop typed answers,
                an attached file and the editor's undo history whenever a window is resized or
                zoomed across it. So the same tree renders at every width, and below @5xl the group
                is restyled into a stacked column that scrolls with the page. */}
            <main className="slagen:flex slagen:min-h-0 slagen:flex-1">
              <ResizablePanelGroup
                id={storageKey("split")}
                orientation="horizontal"
                className="slagen:@max-5xl:h-auto! slagen:@max-5xl:flex-col! slagen:@max-5xl:overflow-visible! slagen:@max-5xl:[&>[data-panel]]:flex-none!"
              >
                <ResizablePanel id="conversation" defaultSize="42%" minSize="360px" maxSize="70%">
                  <ConversationPane />
                </ResizablePanel>
                <ResizableHandle
                  disabled={!wide}
                  aria-label="Resize conversation and output panes"
                  className="slagen:@max-5xl:hidden"
                />
                <ResizablePanel id="output" defaultSize="58%" minSize="30%">
                  <OutputPane />
                </ResizablePanel>
              </ResizablePanelGroup>
            </main>
          </div>
        </TooltipProvider>
      </EditorValidationProvider>
    </SessionProvider>
  );
}
