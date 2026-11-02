import { CheckCircle2Icon, ChevronDownIcon, ListChecksIcon, XCircleIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { plural } from "@/lib/format";
import type { Attempt } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Collapsed list of what each retry produced. A single attempt has nothing to add. */
export function Attempts({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length < 2) return null;
  return (
    <Collapsible className="slagen:w-full">
      <CollapsibleTrigger className="slagen:group/attempts slagen:flex slagen:w-full slagen:items-center slagen:gap-2 slagen:rounded-sm slagen:text-muted-foreground slagen:text-sm slagen:transition-colors slagen:outline-none slagen:hover:text-foreground slagen:focus-visible:ring-[3px] slagen:focus-visible:ring-ring/50">
        <ListChecksIcon className="slagen:size-4" aria-hidden />
        <span className="slagen:flex-1 slagen:text-left">{`Show all ${attempts.length} attempts`}</span>
        <ChevronDownIcon
          className="slagen:size-4 slagen:transition-transform slagen:group-data-[state=open]/attempts:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="slagen:mt-3 slagen:flex slagen:flex-col slagen:gap-3">
          {attempts.map((a, i) => {
            const passed = !a.errors?.length;
            const Icon = passed ? CheckCircle2Icon : XCircleIcon;
            return (
              <li key={a.attempt ?? i} className="slagen:flex slagen:gap-2 slagen:text-sm">
                <Icon className={cn("slagen:mt-0.5 slagen:size-4 slagen:shrink-0", passed ? "slagen:text-primary" : "slagen:text-rust")} aria-hidden />
                <div className="slagen:min-w-0 slagen:flex-1 slagen:space-y-1">
                  <div className="slagen:font-medium">{`Attempt ${a.attempt ?? i + 1}`}</div>
                  <div className={cn("slagen:text-xs", passed ? "slagen:text-muted-foreground" : "slagen:text-rust")}>
                    {passed ? "Passed validation" : `Rejected with ${plural(a.errors.length, "problem")}`}
                  </div>
                  {!passed && (
                    <ul className="slagen:list-disc slagen:space-y-0.5 slagen:pl-4 slagen:text-muted-foreground slagen:text-xs">
                      {a.errors.map((e, j) => (
                        <li key={j}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
