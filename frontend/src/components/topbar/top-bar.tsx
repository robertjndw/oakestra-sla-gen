import { useHost } from "@/host/host-context";
import { Logo } from "./logo";
import { PlaygroundToolbar } from "./playground-toolbar";

export function TopBar() {
  const { showBranding } = useHost();
  return (
    <header className="slagen:flex slagen:h-12 slagen:shrink-0 slagen:items-center slagen:justify-between slagen:gap-3 slagen:border-b slagen:bg-card slagen:px-4">
      {showBranding && (
        <div className="slagen:flex slagen:min-w-0 slagen:items-center slagen:gap-2.5">
          <Logo className="slagen:shrink-0 slagen:text-primary" />
          <span className="slagen:hidden slagen:text-sm slagen:text-muted-foreground slagen:sm:inline">Oakestra</span>
          <span aria-hidden className="slagen:hidden slagen:text-sm slagen:text-border slagen:sm:inline">
            /
          </span>
          <span className="slagen:truncate slagen:text-sm slagen:font-semibold slagen:whitespace-nowrap">SLA Playground</span>
        </div>
      )}
      <PlaygroundToolbar />
    </header>
  );
}
