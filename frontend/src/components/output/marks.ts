import { diffSlas } from "@/lib/sla";
import type { ServiceEntry, Sla } from "@/lib/types";
import type { ServiceProblems } from "./problems";

export interface ServiceMark {
  added: boolean;
  /** Field names that differ from the previous model draft. */
  changed: string[];
  errors: string[];
}

/** Per-service markers: new/changed against the previous model draft, and validation problems. */
export function buildMarks(
  list: ServiceEntry[],
  sla: Sla,
  previous: Sla | null,
  problems: ServiceProblems,
): Record<string, ServiceMark> {
  const diff = previous ? diffSlas(previous, sla) : { added: [], removed: [], changed: {} };
  const marks: Record<string, ServiceMark> = {};
  for (const s of list) {
    marks[s.key] = {
      added: diff.added.includes(s.key),
      changed: (diff.changed[s.key] ?? []).map((c) => c.field),
      errors: problems.by[`${s.ai}/${s.mi}`] ?? [],
    };
  }
  return marks;
}
