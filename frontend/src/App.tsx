import { Playground } from "@/components/playground";
import { Toaster } from "@/components/ui/sonner";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { HostProvider } from "@/host/host-provider";
import { standaloneHost } from "@/host/standalone-host";

// Theme, toasts and page sizing live here, not in Playground, because the dashboard brings its own.
export default function App() {
  useColorScheme();
  return (
    <HostProvider host={standaloneHost}>
      <Playground className="slagen:min-h-dvh slagen:lg:h-dvh" />
      <Toaster />
    </HostProvider>
  );
}
