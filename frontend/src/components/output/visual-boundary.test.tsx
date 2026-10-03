import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { Sla } from "@/lib/types";
import { VisualBoundary } from "./visual-boundary";
import { VisualView } from "./visual-view";

describe("VisualBoundary", () => {
  it("contains a render crash from a badly shaped SLA and recovers on the next one", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = {
      applications: [{ application_name: "a", microservices: [{ microservice_name: "x", environment: "A=1" }] }],
    } as unknown as Sla;
    const view = (sla: Sla) => (
      <VisualBoundary resetKey={sla}>
        <VisualView sla={sla} previous={null} errors={[]} parseError={null} />
      </VisualBoundary>
    );

    const { rerender } = render(view(bad));
    expect(screen.getByText(/can't be drawn/)).toBeInTheDocument();

    rerender(view({ applications: [] }));
    expect(screen.queryByText(/can't be drawn/)).not.toBeInTheDocument();
    spy.mockRestore();
  });
});
