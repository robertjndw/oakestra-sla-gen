import { useEffect, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Message, MessageContent } from "@/components/ai-elements/message";

// Local models at low effort routinely take over a minute, so say that is normal.
const SLOW_HINT_AFTER_S = 15;

export function PendingRound({ first, startedAt }: { first: boolean; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <Message from="assistant">
      <MessageContent>
        <div role="status" className="flex flex-wrap items-baseline gap-x-2">
          <Shimmer as="span">{first ? "Generating the first draft" : "Updating the draft"}</Shimmer>
          <span className="text-muted-foreground text-sm tabular-nums">{`${secs}s`}</span>
        </div>
        {secs >= SLOW_HINT_AFTER_S && (
          <p className="text-muted-foreground text-xs">Local models can take a minute or more.</p>
        )}
      </MessageContent>
    </Message>
  );
}
