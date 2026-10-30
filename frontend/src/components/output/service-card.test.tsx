import { useState } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionForm } from "@/components/conversation/question-form";
import { initialAnswers, type QuestionAnswer } from "@/lib/answers";
import { findLinks, ipTargets, services } from "@/lib/sla";
import type { Clarification, Sla } from "@/lib/types";
import { ServiceCard } from "./service-card";

const sla: Sla = {
  applications: [
    {
      application_name: "shop",
      microservices: [
        {
          microservice_name: "api",
          code: "ghcr.io/me/api:1",
          vcpus: 1,
          memory: 512,
          port: "8080:80",
          environment: ["DB_HOST=10.30.0.1", "POSTGRES_PASSWORD=ordersecret"],
        },
        {
          microservice_name: "db",
          code: "docker.io/library/redis:latest",
          vcpus: 1,
          memory: 256,
          cmd: ["redis-server", "--requirepass", "s3cret"],
          addresses: { rr_ip: "10.30.0.1" },
        },
      ],
    },
  ],
};
const list = services(sla);
const links = findLinks(list);
const targets = ipTargets(list);
const clean = { added: false, changed: [], errors: [] };

function Cards() {
  return list.map((s) => <ServiceCard key={s.key} service={s} mark={clean} links={links} targets={targets} />);
}

const card = (name: string) => document.querySelector<HTMLElement>(`[data-service-name="${name}"]`)!;
const row = (name: string, field: string) => card(name).querySelector<HTMLElement>(`[data-row="${field}"]`)!;

describe("ServiceCard secrets", () => {
  it("hides secret values until revealed", async () => {
    const user = userEvent.setup();
    render(<Cards />);
    expect(screen.queryByText("ordersecret")).toBeNull();
    expect(screen.getByText("10.30.0.1", { selector: "span" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show POSTGRES_PASSWORD value" }));
    expect(screen.getByText("ordersecret")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide POSTGRES_PASSWORD value" }));
    expect(screen.queryByText("ordersecret")).toBeNull();
  });

  it("hides a password passed on the command line", async () => {
    const user = userEvent.setup();
    render(<Cards />);
    const command = within(row("db", "cmd"));
    expect(command.queryByText(/s3cret/)).toBeNull();
    expect(command.getByText("--requirepass")).toBeInTheDocument();
    await user.click(command.getByRole("button", { name: "Show command" }));
    expect(command.getByText("s3cret")).toBeInTheDocument();
  });

  it("masks a revealed secret again when its value changes", async () => {
    const user = userEvent.setup();
    const withSla = (password: string, cmdPass: string): Sla => ({
      applications: [
        {
          application_name: "shop",
          microservices: [
            {
              microservice_name: "api",
              code: "ghcr.io/me/api:1",
              environment: [`POSTGRES_PASSWORD=${password}`],
              cmd: ["redis-server", "--requirepass", cmdPass],
            },
          ],
        },
      ],
    });
    const view = (sla: Sla) => {
      const [s] = services(sla);
      return <ServiceCard service={s} mark={clean} links={[]} targets={[]} />;
    };
    const { rerender } = render(view(withSla("first", "cmd-one")));
    await user.click(screen.getByRole("button", { name: "Show POSTGRES_PASSWORD value" }));
    await user.click(screen.getByRole("button", { name: "Show command" }));
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("cmd-one")).toBeInTheDocument();

    rerender(view(withSla("second", "cmd-two")));
    expect(screen.queryByText("second")).toBeNull();
    expect(screen.queryByText("cmd-two")).toBeNull();
    expect(screen.getByRole("button", { name: "Show POSTGRES_PASSWORD value" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show command" })).toBeInTheDocument();
  });

  it("copies the real value of a hidden variable", async () => {
    const user = userEvent.setup();
    render(<Cards />);
    await user.click(screen.getByRole("button", { name: "Copy POSTGRES_PASSWORD value" }));
    expect(await navigator.clipboard.readText()).toBe("ordersecret");
    expect(screen.queryByText("ordersecret")).toBeNull();
  });

  it("copies the image, ports, service IP and command", async () => {
    const user = userEvent.setup();
    render(<Cards />);
    const copied = async (scope: HTMLElement, name: string) => {
      await user.click(within(scope).getByRole("button", { name }));
      return navigator.clipboard.readText();
    };
    expect(await copied(row("api", "code"), "Copy image")).toBe("ghcr.io/me/api:1");
    expect(await copied(row("api", "port"), "Copy ports")).toBe("8080:80");
    expect(await copied(row("db", "addresses"), "Copy service IP")).toBe("10.30.0.1");
    expect(await copied(row("db", "cmd"), "Copy command")).toBe("redis-server --requirepass s3cret");
  });
});

describe("questions linked to fields", () => {
  const questions: Clarification[] = [
    { topic: "db memory", question: "Enough memory?", assumption: "256 MB", field: "db.memory" },
    { topic: "api version", question: "Which version?", assumption: null, field: "api" },
    { topic: "ghost port", question: "Who?", assumption: null, field: "nosuch.port" },
    { topic: "general", question: "Anything else?", assumption: null },
  ];

  function Both({ cards = true }: { cards?: boolean }) {
    const [answers, setAnswers] = useState<QuestionAnswer[]>(initialAnswers(questions));
    return (
      <>
        <QuestionForm questions={questions} answers={answers} onChange={setAnswers} frozen={null} interactive />
        {cards && <Cards />}
      </>
    );
  }

  const item = (topic: string) => screen.getByText(topic).closest("li")!;

  // jsdom implements neither.
  const scroll = vi.fn();
  beforeEach(() => {
    scroll.mockClear();
    Element.prototype.scrollIntoView = scroll;
    Element.prototype.animate = vi.fn() as never;
  });

  it("highlights the row and card a hovered question is about", async () => {
    const user = userEvent.setup();
    render(<Both />);
    expect(card("db").dataset.highlighted).toBe("false");

    await user.hover(item("db memory"));
    expect(card("db").dataset.highlighted).toBe("true");
    expect(row("db", "resources").dataset.highlighted).toBe("true");
    expect(row("db", "code").dataset.highlighted).toBe("false");
    expect(card("api").dataset.highlighted).toBe("false");

    await user.unhover(item("db memory"));
    expect(card("db").dataset.highlighted).toBe("false");
  });

  it("highlights only the card for a whole-service question, and nothing for an unknown one", async () => {
    const user = userEvent.setup();
    render(<Both />);
    await user.hover(item("api version"));
    expect(card("api").dataset.highlighted).toBe("true");
    expect(card("api").querySelector('[data-highlighted="true"]')).toBeNull();

    await user.hover(item("ghost port"));
    expect(document.querySelector('[data-highlighted="true"]')).toBeNull();
  });

  it("follows keyboard focus", async () => {
    const user = userEvent.setup();
    render(<Both />);
    act(() => within(item("api version")).getByLabelText("Answer to question 2").focus());
    expect(card("api").dataset.highlighted).toBe("true");
    await user.tab();
    expect(card("api").dataset.highlighted).toBe("false");
  });

  it("offers Show only for fields with a card on screen, and scrolls to the row", async () => {
    const user = userEvent.setup();
    render(<Both />);
    expect(within(item("ghost port")).queryByRole("button", { name: /^Show/ })).toBeNull();
    expect(within(item("general")).queryByRole("button", { name: /^Show/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show db memory" }));
    expect(scroll.mock.contexts.at(-1)).toBe(row("db", "resources"));
    await user.click(screen.getByRole("button", { name: "Show api" }));
    expect(scroll.mock.contexts.at(-1)).toBe(card("api"));
  });

  it("hides Show when the visual view isn't there", () => {
    render(<Both cards={false} />);
    expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull();
  });
});
