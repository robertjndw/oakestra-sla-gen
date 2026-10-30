import { ConversationPane } from "@/components/conversation/conversation-pane";
import { OutputPane } from "@/components/output/output-pane";
import { TopBar } from "@/components/topbar/top-bar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/hooks/session-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMediaQuery } from "@/hooks/use-media-query";

export default function App() {
  useColorScheme();
  const wide = useMediaQuery("(min-width: 1024px)");
  return (
    <SessionProvider>
      <TooltipProvider>
        <div className="flex min-h-dvh flex-col lg:h-dvh">
          <TopBar />
          {/* Swapping layouts at the breakpoint would remount both panes and drop typed answers,
              an attached file and the editor's undo history whenever a window is resized or
              zoomed across it. So the same tree renders at every width, and below lg the group
              is restyled into a stacked column that scrolls with the page. */}
          <main className="flex min-h-0 flex-1">
            <ResizablePanelGroup
              id="sla-gen-split"
              orientation="horizontal"
              className="max-lg:h-auto! max-lg:flex-col! max-lg:overflow-visible! max-lg:[&>[data-panel]]:flex-none!"
            >
              <ResizablePanel id="conversation" defaultSize="42%" minSize="360px" maxSize="70%">
                <ConversationPane />
              </ResizablePanel>
              <ResizableHandle
                disabled={!wide}
                aria-label="Resize conversation and output panes"
                className="max-lg:hidden"
              />
              <ResizablePanel id="output" defaultSize="58%" minSize="30%">
                <OutputPane />
              </ResizablePanel>
            </ResizablePanelGroup>
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </SessionProvider>
  );
}
