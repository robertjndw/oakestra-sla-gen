import { ConversationPane } from "@/components/conversation/conversation-pane";
import { OutputPane } from "@/components/output/output-pane";
import { TopBar } from "@/components/topbar/top-bar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/hooks/session-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function App() {
  useColorScheme();
  return (
    <SessionProvider>
      <TooltipProvider>
        <div className="flex min-h-dvh flex-col lg:h-dvh">
          <TopBar />
          <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,5fr)_7fr]">
            <ConversationPane />
            <OutputPane />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </SessionProvider>
  );
}
