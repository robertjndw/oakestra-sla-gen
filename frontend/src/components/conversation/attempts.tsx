import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { plural } from "@/lib/format";
import type { Attempt } from "@/lib/types";

/** Collapsed list of what each retry produced. A single attempt has nothing to add. */
export function Attempts({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length < 2) return null;
  return (
    <ChainOfThought>
      <ChainOfThoughtHeader>{`Show all ${attempts.length} attempts`}</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {attempts.map((a, i) => {
          const passed = !a.errors?.length;
          return (
            <ChainOfThoughtStep
              key={a.attempt ?? i}
              icon={passed ? CheckCircle2Icon : XCircleIcon}
              label={`Attempt ${a.attempt ?? i + 1}`}
              description={passed ? "Passed validation" : `Rejected with ${plural(a.errors.length, "problem")}`}
              status="complete"
            >
              {!passed && (
                <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground text-xs">
                  {a.errors.map((e, j) => (
                    <li key={j}>{e}</li>
                  ))}
                </ul>
              )}
            </ChainOfThoughtStep>
          );
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}
