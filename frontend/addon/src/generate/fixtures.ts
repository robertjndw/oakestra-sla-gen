import type { Application, Service, SlaMicroservice } from "../types";

export const application = (overrides: Partial<Application> = {}): Application =>
  ({
    _id: "app-1",
    application_name: "shop",
    application_namespace: "default",
    application_desc: "Online shop",
    microservices: ["svc-1"],
    ...overrides,
  }) as Application;

/** A service the way the API returns it, with everything the backend adds around the SLA fields. */
export const deployedService = (overrides: Record<string, unknown> = {}): Service =>
  ({
    _id: "svc-1",
    microserviceID: "svc-1",
    microservice_name: "web",
    microservice_namespace: "default",
    applicationID: "app-1",
    app_name: "shop",
    app_ns: "default",
    job_name: "shop.default.web.default",
    virtualization: "container",
    code: "docker.io/library/nginx:1.27",
    image: "docker.io/library/nginx:1.27",
    memory: 256,
    vcpus: 1,
    port: "80",
    cmd: [],
    args: [],
    environment: ["MODE=prod"],
    added_files: [],
    status: "RUNNING",
    addresses: { rr_ip: "10.30.0.1", instances: [] },
    constraints: [],
    connectivity: [],
    instance_list: [{ instance_number: 0, status: "RUNNING", cpu_history: [], memory_history: [] }],
    next_instance_progressive_number: 1,
    ...overrides,
  }) as unknown as Service;

export const slaService = (overrides: Record<string, unknown> = {}): SlaMicroservice =>
  ({
    microservice_name: "web",
    microservice_namespace: "default",
    virtualization: "container",
    code: "docker.io/library/nginx:1.27",
    memory: 256,
    vcpus: 1,
    port: "80",
    environment: ["MODE=prod"],
    addresses: { rr_ip: "10.30.0.1" },
    ...overrides,
  }) as SlaMicroservice;
