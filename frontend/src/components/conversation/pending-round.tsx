import { useEffect, useState } from "react";
import { Message, MessageContent } from "@/components/ui/message";
import type { Round } from "@/hooks/use-session";
import type { Attempt } from "@/lib/types";

// Local models at low effort routinely take over a minute, so say that is normal.
const SLOW_HINT_AFTER_S = 15;

export function PendingRound({ round }: { round: Extract<Round, { kind: "pending" }> }) {
  const { first, startedAt, attempts, maxAttempts } = round;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const last = attempts.at(-1);
  // The server answers right after a passing or the final attempt, so only a rejection with
  // retries left means another attempt is underway.
  const running = last && last.errors.length > 0 && attempts.length < maxAttempts;
  return (
    <Message>
      <MessageContent>
        <div role="status" className="flex flex-wrap items-baseline gap-x-2">
          <span className="shimmer text-muted-foreground">{first ? "Generating the first draft" : "Updating the draft"}</span>
          <span className="text-muted-foreground text-sm tabular-nums">{`${secs}s`}</span>
        </div>
        {attempts.length > 0 && (
          <ol aria-live="polite" className="flex flex-col gap-0.5 text-muted-foreground text-xs">
            {attempts.map((a) => (
              <AttemptLine key={a.attempt} attempt={a} />
            ))}
            {running && <li>{`Attempt ${attempts.length + 1} of ${maxAttempts} running`}</li>}
          </ol>
        )}
        {secs >= SLOW_HINT_AFTER_S && (
          <p className="text-muted-foreground text-xs">Local models can take a minute or more.</p>
        )}
      </MessageContent>
    </Message>
  );
}

function AttemptLine({ attempt }: { attempt: Attempt }) {
  const [firstError, ...rest] = attempt.errors;
  if (firstError === undefined) return <li>{`Attempt ${attempt.attempt} passed validation`}</li>;
  return (
    // One line per attempt keeps the round short; the full list is in the title and, once the
    // turn ends, in the round's own attempt list.
    <li className="flex min-w-0 gap-1" title={attempt.errors.join("\n")}>
      <span className="shrink-0 text-rust">{`Attempt ${attempt.attempt} rejected:`}</span>
      <span className="min-w-0 truncate">{firstError}</span>
      {rest.length > 0 && <span className="shrink-0">{`(+${rest.length} more)`}</span>}
    </li>
  );
}
