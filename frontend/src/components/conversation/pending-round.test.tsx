import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Round } from "@/hooks/use-session";
import type { Attempt } from "@/lib/types";
import { PendingRound } from "./pending-round";

const pending = (attempts: Attempt[], maxAttempts = 3): Extract<Round, { kind: "pending" }> => ({
  id: 1,
  kind: "pending",
  first: true,
  startedAt: Date.now(),
  attempts,
  maxAttempts,
});

describe("PendingRound", () => {
  it("shows only the status before any attempt has finished", () => {
    render(<PendingRound round={pending([])} />);
    expect(screen.getByRole("status")).toHaveTextContent("Generating the first draft");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows each rejected attempt with its first error and the one running now", () => {
    render(<PendingRound round={pending([{ attempt: 1, errors: ["port is invalid", "a", "b"] }])} />);
    const item = screen.getByText("Attempt 1 rejected:").closest("li");
    expect(item).toHaveTextContent("Attempt 1 rejected:port is invalid(+2 more)");
    expect(screen.getByText("Attempt 2 of 3 running")).toBeInTheDocument();
  });

  it("leaves out the count for a single error", () => {
    render(<PendingRound round={pending([{ attempt: 1, errors: ["port is invalid"] }])} />);
    expect(screen.queryByText(/more\)/)).toBeNull();
  });

  it("shows no running attempt once the retries are used up or one passed", () => {
    const rejected = { attempt: 1, errors: ["e"] };
    const { rerender } = render(<PendingRound round={pending([rejected], 1)} />);
    expect(screen.queryByText(/running/)).toBeNull();
    rerender(<PendingRound round={pending([rejected, { attempt: 2, errors: [] }])} />);
    expect(screen.queryByText(/running/)).toBeNull();
    expect(screen.getByText("Attempt 2 passed validation")).toBeInTheDocument();
  });
});
