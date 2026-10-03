import { formatMb, joinWords, plural } from "@/lib/format";
import { parsePorts } from "@/lib/sla";
import type { Sla, ServiceEntry } from "@/lib/types";

/** The one-sentence overview at the top of the Visual view. */
export function summarize(sla: Sla, list: ServiceEntry[]): string {
  if (!list.length) return "This SLA has no services yet.";
  const apps = sla.applications ?? [];
  let cpu = 0;
  let mem = 0;
  const ports: string[] = [];
  for (const s of list) {
    cpu += Number(s.ms.vcpus) || 0;
    mem += Number(s.ms.memory) || 0;
    for (const p of parsePorts(s.ms.port)) if (!ports.includes(p.host)) ports.push(p.host);
  }
  const where =
    apps.length === 1
      ? " in " + (apps[0].application_name || "the application")
      : " across " + plural(apps.length, "application");
  const reach = ports.length
    ? "Reachable from outside on " + (ports.length === 1 ? "port " : "ports ") + joinWords(ports) + "."
    : "Not reachable from outside.";
  return `${plural(list.length, "service")}${where}, using ${plural(cpu, "vCPU", "vCPU")} and ${formatMb(mem)} of memory. ${reach}`;
}
