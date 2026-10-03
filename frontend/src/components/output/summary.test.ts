import { describe, expect, it } from "vitest";
import { services } from "@/lib/sla";
import type { Sla } from "@/lib/types";
import { summarize } from "./summary";

describe("summarize", () => {
  it("describes services, resources and ports", () => {
    const sla: Sla = {
      applications: [
        {
          application_name: "shop",
          microservices: [
            { vcpus: 1, memory: 512, port: "80;443" },
            { vcpus: 1, memory: 1024 },
          ],
        },
      ],
    };
    expect(summarize(sla, services(sla))).toBe(
      "2 services in shop, using 2 vCPU and 1.5 GB of memory. Reachable from outside on ports 80 and 443.",
    );
  });

  it("handles an SLA without services", () => {
    expect(summarize({ applications: [] }, [])).toBe("This SLA has no services yet.");
  });
});
