import { CheckCircle2Icon, ChevronDownIcon, ListChecksIcon, XCircleIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { plural } from "@/lib/format";
import type { Attempt } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Collapsed list of what each retry produced. A single attempt has nothing to add. */
export function Attempts({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length < 2) return null;
  return (
    <Collapsible className="w-full">
      <CollapsibleTrigger className="group/attempts flex w-full items-center gap-2 rounded-sm text-muted-foreground text-sm transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <ListChecksIcon className="size-4" aria-hidden />
        <span className="flex-1 text-left">{`Show all ${attempts.length} attempts`}</span>
        <ChevronDownIcon
          className="size-4 transition-transform group-data-[state=open]/attempts:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-3 flex flex-col gap-3">
          {attempts.map((a, i) => {
            const passed = !a.errors?.length;
            const Icon = passed ? CheckCircle2Icon : XCircleIcon;
            return (
              <li key={a.attempt ?? i} className="flex gap-2 text-sm">
                <Icon className={cn("mt-0.5 size-4 shrink-0", passed ? "text-primary" : "text-rust")} aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium">{`Attempt ${a.attempt ?? i + 1}`}</div>
                  <div className={cn("text-xs", passed ? "text-muted-foreground" : "text-rust")}>
                    {passed ? "Passed validation" : `Rejected with ${plural(a.errors.length, "problem")}`}
                  </div>
                  {!passed && (
                    <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground text-xs">
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
