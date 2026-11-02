import { Button } from "@oakestra/ui";
import { ExternalLinkIcon } from "lucide-react";
import { Link } from "react-router";

/**
 * "Open full page" from the Generate service tab. Leaving the tab unmounts the playground, and a
 * turn still running then never shows its reply (the server refuses new ones until it's done), so
 * the link waits for the turn.
 */
export function FullPageLink({ to, turnRunning }: { to: string; turnRunning: boolean }) {
  if (turnRunning) {
    return (
      // A disabled button gets no pointer events, so the explanation hangs on a wrapper.
      <span title="Wait until the model has finished its turn.">
        <Button size="sm" variant="ghost" disabled>
          <ExternalLinkIcon aria-hidden /> Open full page
        </Button>
      </span>
    );
  }
  return (
    <Button asChild size="sm" variant="ghost">
      <Link to={to}>
        <ExternalLinkIcon aria-hidden /> Open full page
      </Link>
    </Button>
  );
}
