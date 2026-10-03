import { render, screen } from "@testing-library/react";
import { findLinks, services } from "@/lib/sla";
import type { Sla } from "@/lib/types";
import { ServicePreview } from "./service-preview";

const sla: Sla = {
  applications: [
    {
      application_name: "shop",
      microservices: [
        {
          microservice_name: "web",
          code: "nginx",
          vcpus: 1,
          memory: 256,
          port: "80",
          environment: ["API=10.30.0.2"],
        },
        {
          microservice_name: "api",
          code: "api:1",
          vcpus: 2,
          memory: 2048,
          addresses: { rr_ip: "10.30.0.2" },
        },
      ],
    },
  ],
};
const list = services(sla);
const links = findLinks(list);
const clean = { added: false, changed: [], errors: [] };

describe("ServicePreview", () => {
  it("summarizes a service and its connections", () => {
    render(<ServicePreview service={list[0]} mark={clean} links={links} />);
    expect(screen.getByText("1 vCPU, 256 MB memory")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
    expect(screen.getByText("1 variable")).toBeInTheDocument();
  });

  it("lists who calls a service", () => {
    render(<ServicePreview service={list[1]} mark={clean} links={links} />);
    expect(screen.getByText("Called by")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
  });

  it("caps the problems it shows and names changed fields", () => {
    const mark = { added: false, changed: ["code", "port"], errors: ["a", "b", "c"] };
    render(<ServicePreview service={list[0]} mark={mark} links={links} />);
    expect(screen.getByText("3 problems")).toBeInTheDocument();
    expect(screen.queryByText("c")).not.toBeInTheDocument();
    expect(screen.getByText("and 1 more")).toBeInTheDocument();
    expect(screen.getByText("Changed: image and ports")).toBeInTheDocument();
  });
});
