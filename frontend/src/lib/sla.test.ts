import { describe, expect, it } from "vitest";
import {
  describeChanges,
  diffSlas,
  findLinks,
  firstDraftLine,
  parsePorts,
  portLabel,
  refsFor,
  services,
  shortImage,
  splitEnv,
} from "./sla";
import type { Sla } from "./types";

const sla = (...ms: Record<string, unknown>[]): Sla => ({
  applications: [{ application_name: "app", microservices: ms }],
});

describe("ports", () => {
  it("parses mappings and protocols", () => {
    expect(parsePorts("80;8443:443/udp")).toEqual([
      { host: "80", container: "80", proto: "" },
      { host: "8443", container: "443", proto: "udp" },
    ]);
    expect(parsePorts(undefined)).toEqual([]);
  });
  it("labels them", () => {
    expect(portLabel({ host: "80", container: "80", proto: "" })).toBe("80");
    expect(portLabel({ host: "8080", container: "80", proto: "" })).toBe("8080 to 80");
    expect(portLabel({ host: "53", container: "53", proto: "udp" })).toBe("53 udp");
  });
});

describe("shortImage", () => {
  it("strips docker.io prefixes", () => {
    expect(shortImage("docker.io/library/nginx:1")).toBe("nginx:1");
    expect(shortImage("ghcr.io/acme/x")).toBe("ghcr.io/acme/x");
    expect(shortImage(undefined)).toBe("");
  });
});

describe("services and firstDraftLine", () => {
  const s = sla({ microservice_name: "web" }, { microservice_name: "db" });
  it("flattens services with keys", () => {
    expect(services(s).map((x) => x.key)).toEqual(["app/web", "app/db"]);
    expect(services(null)).toEqual([]);
  });
  it("summarizes the first draft", () => {
    expect(firstDraftLine(s)).toBe("2 services: web and db");
  });
});

describe("diffSlas and describeChanges", () => {
  const before = sla({ microservice_name: "web", memory: 512, vcpus: 1, port: "80" }, { microservice_name: "old" });
  const after = sla(
    { microservice_name: "web", memory: 2048, vcpus: 2, port: "443", code: "docker.io/library/nginx" },
    { microservice_name: "new" },
  );
  const diff = diffSlas(before, after);
  it("finds added, removed and changed", () => {
    expect(diff.added).toEqual(["app/new"]);
    expect(diff.removed).toEqual(["app/old"]);
    expect(diff.changed["app/web"].map((c) => c.field).sort()).toEqual(["code", "memory", "port", "vcpus"]);
  });
  it("describes them in plain words", () => {
    const lines = describeChanges(diff);
    expect(lines).toContain("Added new");
    expect(lines).toContain("Removed old");
    const web = lines.find((l) => l.startsWith("web:"))!;
    expect(web).toContain("memory 512 MB to 2 GB");
    expect(web).toContain("vCPU 1 to 2");
    expect(web).toContain("ports now 443");
    expect(web).toContain("image now nginx");
  });
  it("reports no changes for identical SLAs", () => {
    expect(describeChanges(diffSlas(before, before))).toEqual([]);
  });
  it("collapses long lists", () => {
    const many = sla(...Array.from({ length: 8 }, (_, i) => ({ microservice_name: "s" + i })));
    const lines = describeChanges(diffSlas(null, many));
    expect(lines).toHaveLength(6);
    expect(lines[5]).toBe("and 3 more changes");
  });
});

describe("links", () => {
  it("splits env entries", () => {
    expect(splitEnv("A=b=c")).toEqual({ key: "A", value: "b=c" });
    expect(splitEnv("A")).toEqual({ key: "A", value: "" });
  });
  it("collects env and cmd references", () => {
    expect(refsFor({ environment: ["X=1"], cmd: ["run", "--host=10.30.0.5"] })).toEqual([
      { label: "X", value: "1" },
      { label: "cmd", value: "run" },
      { label: "cmd", value: "--host=10.30.0.5" },
    ]);
  });
  it("links a service to the one whose IP it mentions", () => {
    const list = services(
      sla(
        { microservice_name: "api", environment: ["REDIS_URL=redis://10.30.0.2:6379"] },
        { microservice_name: "redis", addresses: { rr_ip: "10.30.0.2" } },
        { microservice_name: "other", addresses: { rr_ip: "10.30.0.22" } },
      ),
    );
    const links = findLinks(list);
    expect(links).toHaveLength(1);
    expect(links[0].from.ms.microservice_name).toBe("api");
    expect(links[0].to.ms.microservice_name).toBe("redis");
    expect(links[0].label).toBe("REDIS_URL");
  });
});
